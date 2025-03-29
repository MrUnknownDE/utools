// server.js
// Load .env variables FIRST!
require('dotenv').config();

// --- Sentry Initialisierung (GANZ OBEN, nach dotenv) ---
const Sentry = require("@sentry/node");

// Initialize Sentry BEFORE requiring any other modules!
Sentry.init({
  // DSN should now be available from process.env if set in .env
  dsn: process.env.SENTRY_DSN || "https://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa@oooooooooooooooo.ingest.sentry.io/123456",
  // Enable tracing - Adjust sample rate as needed
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
});

// DEBUG: Check Sentry object after init
console.log("Sentry object after init:", typeof Sentry, Sentry ? Object.keys(Sentry) : 'Sentry is undefined/null');
// --- Ende Sentry Initialisierung ---


// Require necessary core modules AFTER Sentry is initialized
const express = require('express');
const cors = require('cors');
const pino = require('pino'); // Logging library
const rateLimit = require('express-rate-limit'); // Rate limiting middleware

// Import local modules
const { initializeMaxMind } = require('./maxmind'); // MaxMind DB initialization
const ipinfoRoutes = require('./routes/ipinfo');
const pingRoutes = require('./routes/ping');
const tracerouteRoutes = require('./routes/traceroute');
const lookupRoutes = require('./routes/lookup');
const dnsLookupRoutes = require('./routes/dnsLookup');
const whoisLookupRoutes = require('./routes/whoisLookup');
const versionRoutes = require('./routes/version');

// --- Logger Initialisierung ---
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname' } }
    : undefined,
});

// Create Express app instance
const app = express();
const PORT = process.env.PORT || 3000;

// --- Sentry Middleware (Request Handler & Tracing) ---
// Must be the first middleware
if (Sentry.Handlers && Sentry.Handlers.requestHandler) {
    app.use(Sentry.Handlers.requestHandler());
} else {
    logger.error("Sentry.Handlers.requestHandler is not available!");
}
// Must be after requestHandler, before routes
if (Sentry.Handlers && Sentry.Handlers.tracingHandler) {
    app.use(Sentry.Handlers.tracingHandler());
} else {
    logger.error("Sentry.Handlers.tracingHandler is not available!");
}
// --- Ende Sentry Middleware ---


// --- Core Middleware ---
app.use(cors()); // Enable CORS
app.use(express.json()); // Parse JSON bodies
app.set('trust proxy', parseInt(process.env.TRUST_PROXY_COUNT || '1', 10)); // Adjust based on your proxy setup, ensure integer


// --- Rate Limiter ---
// Apply a general limiter to most routes
const generalLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX || (process.env.NODE_ENV === 'production' ? '20' : '200'), 10), // Requests per window per IP, ensure integer
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: { success: false, error: 'Too many requests from this IP, please try again after 5 minutes' },
    keyGenerator: (req, res) => req.ip, // Use client IP address from Express
    handler: (req, res, next, options) => {
        logger.warn({ ip: req.ip, route: req.originalUrl }, 'Rate limit exceeded');
        Sentry.captureMessage('Rate limit exceeded', {
            level: 'warning',
            extra: { ip: req.ip, route: req.originalUrl }
        });
        res.status(options.statusCode).send(options.message);
    }
});

// Apply the limiter to specific API routes that perform external actions
// Note: /api/ipinfo and /api/version are often excluded as they are less resource-intensive
app.use('/api/ping', generalLimiter);
app.use('/api/traceroute', generalLimiter);
app.use('/api/lookup', generalLimiter);
app.use('/api/dns-lookup', generalLimiter);
app.use('/api/whois-lookup', generalLimiter);


// --- API Routes ---
// Mount the imported route handlers
app.use('/api/ipinfo', ipinfoRoutes);
app.use('/api/ping', pingRoutes);
app.use('/api/traceroute', tracerouteRoutes);
app.use('/api/lookup', lookupRoutes);
app.use('/api/dns-lookup', dnsLookupRoutes);
app.use('/api/whois-lookup', whoisLookupRoutes);
app.use('/api/version', versionRoutes);


// --- Sentry Error Handler ---
// Must be AFTER all controllers and BEFORE any other error handling middleware
if (Sentry.Handlers && Sentry.Handlers.errorHandler) {
    app.use(Sentry.Handlers.errorHandler({
        shouldHandleError(error) {
          // Capture all 500 errors
          if (error.status === 500) return true;
          // Capture specific client errors if needed, e.g., 403
          // if (error.status === 403) return true;
          // By default, capture only server errors (5xx)
          return error.status >= 500;
        },
    }));
} else {
    logger.error("Sentry.Handlers.errorHandler is not available!");
}
// --- Ende Sentry Error Handler ---


// --- Fallback Error Handler ---
// Optional: Catches errors not handled by Sentry or passed via next(err)
app.use((err, req, res, next) => {
    logger.error({
        error: err.message,
        stack: err.stack,
        url: req.originalUrl,
        method: req.method,
        status: err.status,
        sentryId: res.sentry // Sentry ID if available
    }, 'Unhandled error caught by fallback handler');

    // Avoid sending stack trace in production
    const errorResponse = {
        error: err.message || 'Internal Server Error',
        ...(res.sentry && { sentryId: res.sentry }) // Include Sentry ID if available
    };

    res.status(err.status || 500).json(errorResponse);
});


// --- Server Start ---
let server; // Variable to hold the server instance for graceful shutdown

// Initialize external resources (like MaxMind DBs) then start the server
initializeMaxMind().then(() => {
    server = app.listen(PORT, () => {
        logger.info({ port: PORT, node_env: process.env.NODE_ENV || 'development' }, `Server listening`);
        // Log available routes (optional)
        logger.info(`API base URL: http://localhost:${PORT}/api`);
    });
}).catch(error => {
    logger.fatal({ error: error.message, stack: error.stack }, "Server could not start due to initialization errors.");
    Sentry.captureException(error); // Capture initialization errors
    process.exit(1); // Exit if initialization fails
});


// --- Graceful Shutdown ---
const signals = { 'SIGINT': 2, 'SIGTERM': 15 };

async function gracefulShutdown(signal) {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    if (server) {
        server.close(async () => {
            logger.info('HTTP server closed.');
            // Close Sentry to allow time for events to be sent
            try {
                await Sentry.close(2000); // 2 second timeout
                logger.info('Sentry closed.');
            } catch (e) {
                 logger.error({ error: e.message }, 'Error closing Sentry');
            } finally {
                 process.exit(128 + signals[signal]); // Standard exit code for signals
            }
        });
    } else {
        // If server never started, still try to close Sentry and exit
        logger.warn('Server was not running, attempting to close Sentry and exit.');
        try {
            await Sentry.close(2000);
            logger.info('Sentry closed (server never started).');
        } catch (e) {
             logger.error({ error: e.message }, 'Error closing Sentry (server never started)');
        } finally {
             process.exit(128 + signals[signal]);
        }
    }

    // Force exit after a timeout if graceful shutdown hangs
    setTimeout(() => {
        logger.warn('Graceful shutdown timed out, forcing exit.');
        process.exit(1);
    }, 5000); // 5 seconds
}

// Register signal handlers
Object.keys(signals).forEach((signal) => {
  process.on(signal, () => gracefulShutdown(signal));
});