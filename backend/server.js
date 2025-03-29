// server.js
// Load .env variables FIRST!
require('dotenv').config();

// --- Sentry Initialisierung (GANZ OBEN, nach dotenv) ---
const Sentry = require("@sentry/node");

// Initialize Sentry BEFORE requiring any other modules!
Sentry.init({
  // DSN should now be available from process.env if set in .env
  // Using a syntactically valid but fake DSN as default
  dsn: process.env.SENTRY_DSN || "https://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa@oooooooooooooooo.ingest.sentry.io/123456",
  // Minimal configuration for debugging
  // tracesSampleRate: 1.0, // Keep tracing enabled if needed later
});

// DEBUG: Check Sentry object after init
console.log("Sentry object after init:", typeof Sentry, Sentry ? Object.keys(Sentry) : 'Sentry is undefined/null');
// --- Ende Sentry Initialisierung ---


// Require other modules AFTER Sentry is initialized
const express = require('express');
const cors = require('cors');
const geoip = require('@maxmind/geoip2-node');
const net = require('net'); // Node.js built-in module for IP validation
const { spawn } = require('child_process');
const dns = require('dns').promises;
const pino = require('pino'); // Logging library
const rateLimit = require('express-rate-limit'); // Rate limiting middleware
const whois = require('whois-json'); // Added for WHOIS
// REMOVED: const oui = require('oui');

// --- Logger Initialisierung ---
const logger = pino({
  level: process.env.LOG_LEVEL || 'info', // Configurable log level (e.g., 'debug', 'info', 'warn', 'error')
  // Pretty print only in Development, otherwise JSON for better machine readability
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname' } }
    : undefined,
});

// Create Express app instance AFTER requiring express
const app = express();
const PORT = process.env.PORT || 3000;

// DEBUG: Check Sentry.Handlers before use
console.log("Sentry.Handlers before use:", typeof Sentry.Handlers, Sentry.Handlers ? Object.keys(Sentry.Handlers) : 'Sentry.Handlers is undefined/null');

// --- Sentry Request Handler (AS FIRST MIDDLEWARE!) ---
// This handler must be the first middleware on the app.
// It needs to be called AFTER Sentry.init()
if (Sentry.Handlers && Sentry.Handlers.requestHandler) {
    app.use(Sentry.Handlers.requestHandler());
} else {
    console.error("Sentry.Handlers.requestHandler is not available!");
    // Optional: process.exit(1); // Exit if Sentry handler is crucial
}
// --- Ende Sentry Request Handler ---

// --- Sentry Tracing Handler (AFTER requestHandler, BEFORE routes) ---
// This handler must be after requestHandler and before any routes.
// It adds tracing information to incoming requests.
if (Sentry.Handlers && Sentry.Handlers.tracingHandler) {
    app.use(Sentry.Handlers.tracingHandler());
} else {
    console.error("Sentry.Handlers.tracingHandler is not available!");
}
// --- Ende Sentry Tracing Handler ---


// --- Globale Variablen für MaxMind Reader ---
let cityReader;
let asnReader;

// --- Hilfsfunktionen ---

/**
 * Validiert eine IP-Adresse (v4 oder v6) mit Node.js' eingebautem net Modul.
 * @param {string} ip - Die zu validierende IP-Adresse.
 * @returns {boolean} True, wenn gültig (als v4 oder v6), sonst false.
 */
function isValidIp(ip) {
    if (!ip || typeof ip !== 'string' || ip.trim() === '') {
        return false;
    }
    const trimmedIp = ip.trim();
    const ipVersion = net.isIP(trimmedIp); // Gibt 0, 4 oder 6 zurück
    return ipVersion === 4 || ipVersion === 6;
}

/**
 * Prüft, ob eine IP-Adresse im privaten, Loopback- oder Link-Local-Bereich liegt.
 * @param {string} ip - Die zu prüfende IP-Adresse (bereits validiert).
 * @returns {boolean} True, wenn die IP privat/lokal ist, sonst false.
 */
function isPrivateIp(ip) {
    if (!ip) return false;
    const ipVersion = net.isIP(ip);

    if (ipVersion === 4) {
        const parts = ip.split('.').map(Number);
        return (
            parts[0] === 10 || // 10.0.0.0/8
            (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || // 172.16.0.0/12
            (parts[0] === 192 && parts[1] === 168) || // 192.168.0.0/16
            parts[0] === 127 || // 127.0.0.0/8 (Loopback)
            (parts[0] === 169 && parts[1] === 254) // 169.254.0.0/16 (Link-local)
        );
    } else if (ipVersion === 6) {
        const lowerCaseIp = ip.toLowerCase();
        return (
            lowerCaseIp === '::1' || // ::1/128 (Loopback)
            lowerCaseIp.startsWith('fc') || lowerCaseIp.startsWith('fd') || // fc00::/7 (Unique Local)
            lowerCaseIp.startsWith('fe8') || lowerCaseIp.startsWith('fe9') || // fe80::/10 (Link-local)
            lowerCaseIp.startsWith('fea') || lowerCaseIp.startsWith('feb')
        );
    }
    return false;
}

/**
 * Validiert einen Domainnamen (sehr einfache Prüfung).
 * @param {string} domain - Der zu validierende Domainname.
 * @returns {boolean} True, wenn wahrscheinlich gültig, sonst false.
 */
function isValidDomain(domain) {
    if (!domain || typeof domain !== 'string' || domain.trim().length < 3) {
        return false;
    }
    const domainRegex = /^(?:[a-z0-9\p{L}](?:[a-z0-9\p{L}-]{0,61}[a-z0-9\p{L}])?\.)+[a-z0-9\p{L}][a-z0-9\p{L}-]{0,61}[a-z0-9\p{L}]$/iu;
    return domainRegex.test(domain.trim());
}

// REMOVED: isValidMac function

/**
 * Bereinigt eine IP-Adresse (z.B. entfernt ::ffff: Präfix von IPv4-mapped IPv6).
 * @param {string} ip - Die IP-Adresse.
 * @returns {string} Die bereinigte IP-Adresse.
 */
function getCleanIp(ip) {
    if (!ip) return ip;
    const trimmedIp = ip.trim();
    if (trimmedIp.startsWith('::ffff:')) {
        const potentialIp4 = trimmedIp.substring(7);
        if (net.isIP(potentialIp4) === 4) {
            return potentialIp4;
        }
    }
    if (trimmedIp === '::1' || trimmedIp === '127.0.0.1') {
        return trimmedIp;
    }
    return trimmedIp;
}

/**
 * Führt einen Shell-Befehl sicher aus und gibt stdout zurück. (Nur für Ping verwendet)
 * @param {string} command - Der Befehl (z.B. 'ping').
 * @param {string[]} args - Die Argumente als Array.
 * @returns {Promise<string>} Eine Promise, die mit stdout aufgelöst wird.
 */
function executeCommand(command, args) {
    return new Promise((resolve, reject) => {
        args.forEach(arg => {
            if (typeof arg === 'string' && /[;&|`$()<>]/.test(arg)) {
                const error = new Error(`Invalid character detected in command argument.`);
                logger.error({ command, arg }, "Potential command injection attempt detected in argument");
                Sentry.captureException(error); // An Sentry senden
                return reject(error);
            }
        });

        const proc = spawn(command, args);
        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data) => { stdout += data.toString(); });
        proc.stderr.on('data', (data) => { stderr += data.toString(); });
        proc.on('error', (err) => {
            const error = new Error(`Failed to start command ${command}: ${err.message}`);
            logger.error({ command, args, error: err.message }, `Failed to start command`);
            Sentry.captureException(error); // An Sentry senden
            reject(error);
        });
        proc.on('close', (code) => {
            if (code !== 0) {
                const error = new Error(`Command ${command} failed with code ${code}: ${stderr || 'No stderr output'}`);
                logger.error({ command, args, exitCode: code, stderr: stderr.trim(), stdout: stdout.trim() }, `Command failed`);
                Sentry.captureException(error, { extra: { stdout: stdout.trim(), stderr: stderr.trim() } }); // An Sentry senden
                reject(error);
            } else {
                resolve(stdout);
            }
        });
    });
}

/**
 * Parst die Ausgabe des Linux/macOS ping Befehls.
 * @param {string} pingOutput - Die rohe stdout Ausgabe von ping.
 * @returns {object} Ein Objekt mit geparsten Daten oder Fehlern.
 */
function parsePingOutput(pingOutput) {
    const result = {
        rawOutput: pingOutput,
        stats: null,
        error: null,
    };

    try {
        let packetsTransmitted = 0;
        let packetsReceived = 0;
        let packetLossPercent = 100;
        let rtt = { min: null, avg: null, max: null, mdev: null };

        const lines = pingOutput.trim().split('\n');
        const statsLine = lines.find(line => line.includes('packets transmitted'));
        if (statsLine) {
            const transmittedMatch = statsLine.match(/(\d+)\s+packets transmitted/);
            const receivedMatch = statsLine.match(/(\d+)\s+(?:received|packets received)/);
            const lossMatch = statsLine.match(/([\d.]+)%\s+packet loss/);
            if (transmittedMatch) packetsTransmitted = parseInt(transmittedMatch[1], 10);
            if (receivedMatch) packetsReceived = parseInt(receivedMatch[1], 10);
            if (lossMatch) packetLossPercent = parseFloat(lossMatch[1]);
        }

        const rttLine = lines.find(line => line.startsWith('rtt min/avg/max/mdev') || line.startsWith('round-trip min/avg/max/stddev'));
         if (rttLine) {
            const rttMatch = rttLine.match(/([\d.]+)\/([\d.]+)\/([\d.]+)\/([\d.]+)/);
            if (rttMatch) {
                rtt = {
                    min: parseFloat(rttMatch[1]),
                    avg: parseFloat(rttMatch[2]),
                    max: parseFloat(rttMatch[3]),
                    mdev: parseFloat(rttMatch[4]),
                };
            }
        }

        result.stats = {
            packets: { transmitted: packetsTransmitted, received: packetsReceived, lossPercent: packetLossPercent },
            rtt: rtt.avg !== null ? rtt : null,
        };
        if (packetsTransmitted > 0 && rtt.avg === null && packetsReceived === 0) {
             result.error = "Request timed out or host unreachable.";
        }

    } catch (parseError) {
        logger.error({ error: parseError.message, output: pingOutput }, "Failed to parse ping output");
        Sentry.captureException(parseError, { extra: { pingOutput } }); // An Sentry senden
        result.error = "Failed to parse ping output.";
    }
    return result;
}

/**
 * Parst eine einzelne Zeile der Linux/macOS traceroute Ausgabe.
 * @param {string} line - Eine Zeile aus stdout.
 * @returns {object | null} Ein Objekt mit Hop-Daten oder null bei uninteressanten Zeilen.
 */
function parseTracerouteLine(line) {
    line = line.trim();
    if (!line || line.startsWith('traceroute to')) return null;

    const hopMatch = line.match(/^(\s*\d+)\s+(?:([a-zA-Z0-9\.\-]+)\s+\(([\d\.:a-fA-F]+)\)|([\d\.:a-fA-F]+))\s+(.*)$/);
    const timeoutMatch = line.match(/^(\s*\d+)\s+(\*\s+\*\s+\*)/);

    if (timeoutMatch) {
         return {
            hop: parseInt(timeoutMatch[1].trim(), 10),
            hostname: null,
            ip: null,
            rtt: ['*', '*', '*'],
            rawLine: line,
        };
    } else if (hopMatch) {
        const hop = parseInt(hopMatch[1].trim(), 10);
        const hostname = hopMatch[2];
        const ipInParen = hopMatch[3];
        const ipDirect = hopMatch[4];
        const restOfLine = hopMatch[5].trim();
        const ip = ipInParen || ipDirect;

        const rttParts = restOfLine.split(/\s+/);
        const rtts = rttParts.map(p => p === '*' ? '*' : p.replace(/\s*ms$/, '')).filter(p => p === '*' || !isNaN(parseFloat(p))).slice(0, 3);
        while (rtts.length < 3) rtts.push('*');

         return {
            hop: hop,
            hostname: hostname || null,
            ip: ip,
            rtt: rtts,
            rawLine: line,
        };
    }
    return null;
}


// --- Initialisierung (MaxMind DBs laden) ---
async function initialize() {
    try {
        logger.info('Loading MaxMind databases...');
        const cityDbPath = process.env.GEOIP_CITY_DB || './data/GeoLite2-City.mmdb';
        const asnDbPath = process.env.GEOIP_ASN_DB || './data/GeoLite2-ASN.mmdb';
        logger.info({ cityDbPath, asnDbPath }, 'Database paths');
        cityReader = await geoip.Reader.open(cityDbPath);
        asnReader = await geoip.Reader.open(asnDbPath);
        logger.info('MaxMind databases loaded successfully.');

        // REMOVED: OUI database loading

    } catch (error) {
        logger.fatal({ error: error.message, stack: error.stack }, 'Could not initialize databases. Exiting.');
        Sentry.captureException(error); // An Sentry senden
        process.exit(1);
    }
}

// --- Middleware ---
app.use(cors());
app.use(express.json());
app.set('trust proxy', 2);

// Rate Limiter
const generalLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 Minuten
    max: process.env.NODE_ENV === 'production' ? 20 : 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests from this IP, please try again after 5 minutes' },
    keyGenerator: (req, res) => req.ip || req.socket.remoteAddress,
    handler: (req, res, next, options) => {
        logger.warn({ ip: req.ip || req.socket.remoteAddress, route: req.originalUrl }, 'Rate limit exceeded');
        // Optional: Rate Limit Info an Sentry senden
        Sentry.captureMessage('Rate limit exceeded', {
            level: 'warning',
            extra: { ip: req.ip || req.socket.remoteAddress, route: req.originalUrl }
        });
        res.status(options.statusCode).send(options.message);
    }
});

// Wende Limiter auf alle API-Routen an (außer /api/version und /api/ipinfo)
app.use('/api/ping', generalLimiter);
app.use('/api/traceroute', generalLimiter);
app.use('/api/lookup', generalLimiter);
app.use('/api/dns-lookup', generalLimiter);
app.use('/api/whois-lookup', generalLimiter);
// REMOVED: app.use('/api/mac-lookup', generalLimiter);


// --- Routen ---

// Haupt-Endpunkt: Liefert alle Infos zur IP des Clients
app.get('/api/ipinfo', async (req, res, next) => { // next hinzugefügt für Sentry Error Handler
    const requestIp = req.ip || req.socket.remoteAddress;
    logger.info({ ip: requestIp, method: req.method, url: req.originalUrl }, 'ipinfo request received');
    const clientIp = getCleanIp(requestIp);
    logger.debug({ rawIp: requestIp, cleanedIp: clientIp }, 'IP cleaning result');

    if (!clientIp || !isValidIp(clientIp)) {
         if (clientIp === '127.0.0.1' || clientIp === '::1') {
             logger.info({ ip: clientIp }, 'Responding with localhost info');
             return res.json({
                 ip: clientIp,
                 geo: { note: 'Localhost IP, no Geo data available.' },
                 asn: { note: 'Localhost IP, no ASN data available.' },
                 rdns: ['localhost'],
             });
         }
        logger.error({ rawIp: requestIp, cleanedIp: clientIp }, 'Could not determine a valid client IP');
        // Fehler an Sentry senden, bevor die Antwort gesendet wird
        Sentry.captureMessage('Could not determine a valid client IP', {
            level: 'error',
            extra: { rawIp: requestIp, cleanedIp: clientIp }
        });
        return res.status(400).json({ error: 'Could not determine a valid client IP address.', rawIp: requestIp, cleanedIp: clientIp });
    }

    try {
        let geo = null;
        try {
            const geoData = cityReader.city(clientIp);
            geo = {
                city: geoData.city?.names?.en,
                region: geoData.subdivisions?.[0]?.isoCode,
                country: geoData.country?.isoCode,
                countryName: geoData.country?.names?.en,
                postalCode: geoData.postal?.code,
                latitude: geoData.location?.latitude,
                longitude: geoData.location?.longitude,
                timezone: geoData.location?.timeZone,
            };
            geo = Object.fromEntries(Object.entries(geo).filter(([_, v]) => v != null));
            logger.debug({ ip: clientIp, geo }, 'GeoIP lookup successful');
        } catch (e) {
            logger.warn({ ip: clientIp, error: e.message }, `MaxMind City lookup failed`);
            // Optional: GeoIP Fehler an Sentry senden (kann viel Lärm verursachen)
            // Sentry.captureException(e, { level: 'warning', extra: { ip: clientIp } });
            geo = { error: 'GeoIP lookup failed (IP not found in database or private range).' };
         }

        let asn = null;
        try {
            const asnData = asnReader.asn(clientIp);
            asn = {
                number: asnData.autonomousSystemNumber,
                organization: asnData.autonomousSystemOrganization,
            };
             asn = Object.fromEntries(Object.entries(asn).filter(([_, v]) => v != null));
             logger.debug({ ip: clientIp, asn }, 'ASN lookup successful');
        } catch (e) {
            logger.warn({ ip: clientIp, error: e.message }, `MaxMind ASN lookup failed`);
            // Optional: ASN Fehler an Sentry senden
            // Sentry.captureException(e, { level: 'warning', extra: { ip: clientIp } });
            asn = { error: 'ASN lookup failed (IP not found in database or private range).' };
        }

        let rdns = null;
        try {
            const hostnames = await dns.reverse(clientIp);
            rdns = hostnames;
            logger.debug({ ip: clientIp, rdns }, 'rDNS lookup successful');
        } catch (e) {
            if (e.code !== 'ENOTFOUND' && e.code !== 'ENODATA') {
                logger.warn({ ip: clientIp, error: e.message, code: e.code }, `rDNS lookup error`);
                // Optional: rDNS Fehler an Sentry senden
                // Sentry.captureException(e, { level: 'warning', extra: { ip: clientIp } });
            } else {
                 logger.debug({ ip: clientIp, code: e.code }, 'rDNS lookup failed (No record)');
            }
            rdns = { error: `rDNS lookup failed (${e.code || 'Unknown error'})` };
         }

        res.json({
            ip: clientIp,
            geo: geo.error ? geo : (Object.keys(geo).length > 0 ? geo : null),
            asn: asn.error ? asn : (Object.keys(asn).length > 0 ? asn : null),
            rdns
        });

    } catch (error) {
        logger.error({ ip: clientIp, error: error.message, stack: error.stack }, 'Error processing ipinfo');
        Sentry.captureException(error, { extra: { ip: clientIp } }); // An Sentry senden
        next(error); // Fehler an Sentry Error Handler weiterleiten
    }
});

// Ping Endpunkt
app.get('/api/ping', async (req, res, next) => { // next hinzugefügt
    const targetIpRaw = req.query.targetIp;
    const targetIp = typeof targetIpRaw === 'string' ? targetIpRaw.trim() : targetIpRaw;
    const requestIp = req.ip || req.socket.remoteAddress;

    logger.info({ requestIp, targetIp }, 'Ping request received');

    if (!isValidIp(targetIp)) {
        logger.warn({ requestIp, targetIp }, 'Invalid target IP for ping');
        return res.status(400).json({ error: 'Invalid target IP address provided.' });
    }
    if (isPrivateIp(targetIp)) {
        logger.warn({ requestIp, targetIp }, 'Attempt to ping private IP blocked');
        return res.status(403).json({ error: 'Operations on private or local IP addresses are not allowed.' });
    }

    try {
        const pingCount = process.env.PING_COUNT || '4';
        const countArg = parseInt(pingCount, 10) || 4;
        const args = ['-c', `${countArg}`, targetIp];
        const command = 'ping';

        logger.info({ requestIp, targetIp, command: `${command} ${args.join(' ')}` }, 'Executing ping');
        const output = await executeCommand(command, args);
        const parsedResult = parsePingOutput(output);

        logger.info({ requestIp, targetIp, stats: parsedResult.stats }, 'Ping successful');
        res.json({ success: true, ...parsedResult });

    } catch (error) {
        logger.error({ requestIp, targetIp, error: error.message }, 'Ping command failed');
        Sentry.captureException(error, { extra: { requestIp, targetIp } }); // An Sentry senden
        const parsedError = parsePingOutput(error.message); // Versuch, Fehler aus der Ausgabe zu parsen
        // Sende 500, aber mit Fehlerdetails im Body
        res.status(500).json({
             success: false,
             error: `Ping command failed: ${parsedError.error || error.message}`,
             rawOutput: parsedError.rawOutput || error.message
        });
        // next(error); // Optional: Fehler auch an Sentry Error Handler weiterleiten
    }
});

// Traceroute Endpunkt (Server-Sent Events)
app.get('/api/traceroute', (req, res) => { // Kein next hier, da SSE anders behandelt wird
    const targetIpRaw = req.query.targetIp;
    const targetIp = typeof targetIpRaw === 'string' ? targetIpRaw.trim() : targetIpRaw;
    const requestIp = req.ip || req.socket.remoteAddress;

    logger.info({ requestIp, targetIp }, 'Traceroute stream request received');

    if (!isValidIp(targetIp)) {
        logger.warn({ requestIp, targetIp }, 'Invalid target IP for traceroute');
        return res.status(400).json({ error: 'Invalid target IP address provided.' });
    }
    if (isPrivateIp(targetIp)) {
        logger.warn({ requestIp, targetIp }, 'Attempt to traceroute private IP blocked');
        return res.status(403).json({ error: 'Operations on private or local IP addresses are not allowed.' });
    }

    // Sentry Transaction für den Stream starten
    const transaction = Sentry.startTransaction({
        op: "traceroute.stream",
        name: `/api/traceroute?targetIp=${targetIp}`,
    });
    // Scope für diese Anfrage setzen, damit Fehler/Events der Transaktion zugeordnet werden
    Sentry.configureScope(scope => {
        scope.setSpan(transaction);
        scope.setContext("request", { ip: requestIp, targetIp });
    });

    try {
        logger.info({ requestIp, targetIp }, `Starting traceroute stream...`);
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders();

        const args = ['-n', targetIp];
        const command = 'traceroute';
        const proc = spawn(command, args);
        logger.info({ requestIp, targetIp, command: `${command} ${args.join(' ')}` }, 'Spawned traceroute process');

        let buffer = '';

        const sendEvent = (event, data) => {
            try {
                if (!res.writableEnded) {
                    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
                }
            } catch (e) {
                logger.error({ requestIp, targetIp, event, error: e.message }, "Error writing to SSE stream (client likely disconnected)");
                Sentry.captureException(e, { level: 'warning', extra: { requestIp, targetIp, event } });
                if (!proc.killed) proc.kill();
                if (!res.writableEnded) res.end();
                transaction.setStatus('internal_error');
                transaction.finish();
            }
        };

        proc.stdout.on('data', (data) => {
            buffer += data.toString();
            let lines = buffer.split('\n');
            buffer = lines.pop() || '';
            lines.forEach(line => {
                const parsed = parseTracerouteLine(line);
                if (parsed) {
                    logger.debug({ requestIp, targetIp, hop: parsed.hop, ip: parsed.ip }, 'Sending hop data');
                    sendEvent('hop', parsed);
                } else if (line.trim()) {
                     logger.debug({ requestIp, targetIp, message: line.trim() }, 'Sending info data');
                     sendEvent('info', { message: line.trim() });
                }
            });
        });

        proc.stderr.on('data', (data) => {
            const errorMsg = data.toString().trim();
            logger.warn({ requestIp, targetIp, stderr: errorMsg }, 'Traceroute stderr output');
            Sentry.captureMessage('Traceroute stderr output', { level: 'warning', extra: { requestIp, targetIp, stderr: errorMsg } });
            sendEvent('error', { error: errorMsg });
        });

        proc.on('error', (err) => {
            logger.error({ requestIp, targetIp, error: err.message }, `Failed to start traceroute command`);
            Sentry.captureException(err, { extra: { requestIp, targetIp } });
            sendEvent('error', { error: `Failed to start traceroute: ${err.message}` });
            if (!res.writableEnded) res.end();
            transaction.setStatus('internal_error');
            transaction.finish();
        });

        proc.on('close', (code) => {
            if (buffer) {
                 const parsed = parseTracerouteLine(buffer);
                 if (parsed) sendEvent('hop', parsed);
                 else if (buffer.trim()) sendEvent('info', { message: buffer.trim() });
            }
            if (code !== 0) {
                logger.error({ requestIp, targetIp, exitCode: code }, `Traceroute command finished with error code ${code}`);
                Sentry.captureMessage('Traceroute command failed', { level: 'error', extra: { requestIp, targetIp, exitCode: code } });
                sendEvent('error', { error: `Traceroute command failed with exit code ${code}` });
                transaction.setStatus('unknown_error'); // Oder spezifischer, falls möglich
            } else {
                logger.info({ requestIp, targetIp }, `Traceroute stream completed successfully.`);
                transaction.setStatus('ok');
            }
             sendEvent('end', { exitCode: code });
             if (!res.writableEnded) res.end();
             transaction.finish();
        });

        req.on('close', () => {
            logger.info({ requestIp, targetIp }, 'Client disconnected from traceroute stream, killing process.');
            if (!proc.killed) proc.kill();
            if (!res.writableEnded) res.end();
            transaction.setStatus('cancelled'); // Client hat abgebrochen
            transaction.finish();
        });

    } catch (error) {
        logger.error({ requestIp, targetIp, error: error.message, stack: error.stack }, 'Error setting up traceroute stream');
        Sentry.captureException(error, { extra: { requestIp, targetIp } });
        transaction.setStatus('internal_error');
        transaction.finish();
        if (!res.headersSent) {
             res.status(500).json({ success: false, error: `Failed to initiate traceroute: ${error.message}` });
        } else {
             try {
                 if (!res.writableEnded) {
                    res.write(`event: error\ndata: ${JSON.stringify({ error: `Internal server error: ${error.message}` })}\n\n`);
                    res.end();
                 }
             } catch (e) { logger.error({ requestIp, targetIp, error: e.message }, "Error writing final error to SSE stream"); }
        }
    }
});


// Lookup Endpunkt für beliebige IP (GeoIP, ASN, rDNS)
app.get('/api/lookup', async (req, res, next) => { // next hinzugefügt
    const targetIpRaw = req.query.targetIp;
    const targetIp = typeof targetIpRaw === 'string' ? targetIpRaw.trim() : targetIpRaw;
    const requestIp = req.ip || req.socket.remoteAddress;

    logger.info({ requestIp, targetIp }, 'Lookup request received');

    if (!isValidIp(targetIp)) {
        logger.warn({ requestIp, targetIp }, 'Invalid target IP for lookup');
        return res.status(400).json({ error: 'Invalid IP address provided for lookup.' });
    }
    if (isPrivateIp(targetIp)) {
        logger.warn({ requestIp, targetIp }, 'Attempt to lookup private IP blocked');
        return res.status(403).json({ error: 'Lookup for private or local IP addresses is not supported.' });
    }

    try {
        let geo = null;
        try {
            const geoData = cityReader.city(targetIp);
            geo = {
                city: geoData.city?.names?.en, region: geoData.subdivisions?.[0]?.isoCode,
                country: geoData.country?.isoCode, countryName: geoData.country?.names?.en,
                postalCode: geoData.postal?.code, latitude: geoData.location?.latitude,
                longitude: geoData.location?.longitude, timezone: geoData.location?.timeZone,
            };
            geo = Object.fromEntries(Object.entries(geo).filter(([_, v]) => v != null));
            logger.debug({ targetIp, geo }, 'GeoIP lookup successful for lookup');
        } catch (e) {
            logger.warn({ targetIp, error: e.message }, `MaxMind City lookup failed for lookup`);
            // Optional: Sentry.captureException(e, { level: 'warning', extra: { targetIp } });
            geo = { error: 'GeoIP lookup failed (IP not found in database or private range).' };
         }

        let asn = null;
        try {
            const asnData = asnReader.asn(targetIp);
            asn = { number: asnData.autonomousSystemNumber, organization: asnData.autonomousSystemOrganization };
             asn = Object.fromEntries(Object.entries(asn).filter(([_, v]) => v != null));
             logger.debug({ targetIp, asn }, 'ASN lookup successful for lookup');
        } catch (e) {
            logger.warn({ targetIp, error: e.message }, `MaxMind ASN lookup failed for lookup`);
            // Optional: Sentry.captureException(e, { level: 'warning', extra: { targetIp } });
            asn = { error: 'ASN lookup failed (IP not found in database or private range).' };
        }

        let rdns = null;
        try {
            const hostnames = await dns.reverse(targetIp);
            rdns = hostnames;
            logger.debug({ targetIp, rdns }, 'rDNS lookup successful for lookup');
        } catch (e) {
            if (e.code !== 'ENOTFOUND' && e.code !== 'ENODATA') {
                logger.warn({ targetIp, error: e.message, code: e.code }, `rDNS lookup error for lookup`);
                // Optional: Sentry.captureException(e, { level: 'warning', extra: { targetIp } });
            } else {
                logger.debug({ targetIp, code: e.code }, 'rDNS lookup failed (No record) for lookup');
            }
            rdns = { error: `rDNS lookup failed (${e.code || 'Unknown error'})` };
         }

        res.json({
            ip: targetIp,
            geo: geo.error ? geo : (Object.keys(geo).length > 0 ? geo : null),
            asn: asn.error ? asn : (Object.keys(asn).length > 0 ? asn : null),
            rdns,
        });

    } catch (error) {
        logger.error({ targetIp, error: error.message, stack: error.stack }, 'Error processing lookup');
        Sentry.captureException(error, { extra: { targetIp, requestIp } }); // An Sentry senden
        next(error); // An Sentry Error Handler weiterleiten
    }
});

// --- NEUE ENDPUNKTE ---

// DNS Lookup Endpunkt
app.get('/api/dns-lookup', async (req, res, next) => { // next hinzugefügt
    const domainRaw = req.query.domain;
    const domain = typeof domainRaw === 'string' ? domainRaw.trim() : domainRaw;
    const typeRaw = req.query.type;
    const type = typeof typeRaw === 'string' ? typeRaw.trim().toUpperCase() : 'ANY';
    const requestIp = req.ip || req.socket.remoteAddress;

    logger.info({ requestIp, domain, type }, 'DNS lookup request received');

    if (!isValidDomain(domain)) {
        logger.warn({ requestIp, domain }, 'Invalid domain for DNS lookup');
        return res.status(400).json({ success: false, error: 'Invalid domain name provided.' });
    }

    const validTypes = ['A', 'AAAA', 'MX', 'TXT', 'NS', 'CNAME', 'SOA', 'SRV', 'PTR', 'ANY'];
    if (!validTypes.includes(type)) {
        logger.warn({ requestIp, domain, type }, 'Invalid record type for DNS lookup');
        return res.status(400).json({ success: false, error: `Invalid record type provided. Valid types are: ${validTypes.join(', ')}` });
    }

    try {
        let records;
        if (type === 'ANY') {
            // Führe Lookups parallel aus, fange Fehler einzeln ab
            const promises = [
                dns.resolve(domain, 'A').catch(() => []), dns.resolve(domain, 'AAAA').catch(() => []),
                dns.resolve(domain, 'MX').catch(() => []), dns.resolve(domain, 'TXT').catch(() => []),
                dns.resolve(domain, 'NS').catch(() => []), dns.resolve(domain, 'CNAME').catch(() => []),
                dns.resolve(domain, 'SOA').catch(() => []),
            ];
            // Warte auf alle Promises, auch wenn einige fehlschlagen
            const results = await Promise.allSettled(promises);

            // Verarbeite die Ergebnisse
            records = {
                A: results[0].status === 'fulfilled' ? results[0].value : { error: results[0].reason?.message || 'Lookup failed' },
                AAAA: results[1].status === 'fulfilled' ? results[1].value : { error: results[1].reason?.message || 'Lookup failed' },
                MX: results[2].status === 'fulfilled' ? results[2].value : { error: results[2].reason?.message || 'Lookup failed' },
                TXT: results[3].status === 'fulfilled' ? results[3].value : { error: results[3].reason?.message || 'Lookup failed' },
                NS: results[4].status === 'fulfilled' ? results[4].value : { error: results[4].reason?.message || 'Lookup failed' },
                CNAME: results[5].status === 'fulfilled' ? results[5].value : { error: results[5].reason?.message || 'Lookup failed' },
                SOA: results[6].status === 'fulfilled' ? results[6].value : { error: results[6].reason?.message || 'Lookup failed' },
            };
            // Entferne leere Arrays oder Fehlerobjekte, wenn keine Daten vorhanden sind
            records = Object.fromEntries(Object.entries(records).filter(([_, v]) => (Array.isArray(v) && v.length > 0) || (typeof v === 'object' && v !== null && !Array.isArray(v) && !v.error)));

        } else {
            records = await dns.resolve(domain, type);
        }

        logger.info({ requestIp, domain, type }, 'DNS lookup successful');
        res.json({ success: true, domain, type, records });

    } catch (error) {
        // Dieser Catch-Block wird nur für den spezifischen Typ-Lookup oder bei Fehlern in Promise.allSettled erreicht
        logger.error({ requestIp, domain, type, error: error.message, code: error.code }, 'DNS lookup failed');
        Sentry.captureException(error, { extra: { requestIp, domain, type } }); // An Sentry senden
        // Sende 500, aber mit Fehlerdetails im Body
        res.status(500).json({ success: false, error: `DNS lookup failed: ${error.message} (Code: ${error.code})` });
        // next(error); // Optional: Fehler auch an Sentry Error Handler weiterleiten
    }
});

// WHOIS Lookup Endpunkt
app.get('/api/whois-lookup', async (req, res, next) => { // next hinzugefügt
    const queryRaw = req.query.query;
    const query = typeof queryRaw === 'string' ? queryRaw.trim() : queryRaw;
    const requestIp = req.ip || req.socket.remoteAddress;

    logger.info({ requestIp, query }, 'WHOIS lookup request received');

    if (!isValidIp(query) && !isValidDomain(query)) {
        logger.warn({ requestIp, query }, 'Invalid query for WHOIS lookup');
        return res.status(400).json({ success: false, error: 'Invalid domain name or IP address provided for WHOIS lookup.' });
    }

    try {
        const result = await whois(query, { timeout: 10000 }); // Timeout hinzugefügt
        logger.info({ requestIp, query }, 'WHOIS lookup successful');
        res.json({ success: true, query, result });

    } catch (error) {
        logger.error({ requestIp, query, error: error.message }, 'WHOIS lookup failed');
        Sentry.captureException(error, { extra: { requestIp, query } }); // An Sentry senden
        let errorMessage = error.message;
        if (error.message.includes('ETIMEDOUT') || error.message.includes('ESOCKETTIMEDOUT')) errorMessage = 'WHOIS server timed out.';
        else if (error.message.includes('ENOTFOUND')) errorMessage = 'Domain or IP not found or WHOIS server unavailable.';
        // Sende 500, aber mit Fehlerdetails im Body
        res.status(500).json({ success: false, error: `WHOIS lookup failed: ${errorMessage}` });
        // next(error); // Optional: Fehler auch an Sentry Error Handler weiterleiten
    }
});

// REMOVED: MAC Address Lookup Endpunkt

// Version Endpunkt
app.get('/api/version', (req, res) => {
    const commitSha = process.env.GIT_COMMIT_SHA || 'unknown';
    logger.info({ commitSha }, 'Version request received');
    res.json({ commitSha });
});


// --- Sentry Error Handler (NACH ALLEN ROUTEN, VOR ANDEREN ERROR HANDLERN) ---
// Wichtig: Der Error Handler muss 4 Argumente haben, damit Express ihn als Error Handler erkennt.
// Er muss NACH allen anderen Middlewares und Routen stehen.
if (Sentry.Handlers && Sentry.Handlers.errorHandler) {
    app.use(Sentry.Handlers.errorHandler({
        shouldHandleError(error) {
          // Hier können Sie entscheiden, ob ein Fehler an Sentry gesendet werden soll
          // z.B. keine 404-Fehler senden
          if (error.status === 404) {
            return false;
          }
          return true;
        },
    }));
} else {
    console.error("Sentry.Handlers.errorHandler is not available!");
}
// --- Ende Sentry Error Handler ---

// Optional: Ein generischer Fallback-Error-Handler nach Sentry
app.use((err, req, res, next) => {
    // Dieser Handler wird nur aufgerufen, wenn Sentry den Fehler nicht behandelt hat
    // oder wenn Sie `next(err)` im Sentry-Handler aufrufen.
    logger.error({ error: err.message, stack: err.stack, url: req.originalUrl }, 'Unhandled error caught by fallback handler');
    res.statusCode = err.status || 500;
    // res.sentry wird vom Sentry errorHandler gesetzt und enthält die Sentry Event ID
    res.end((res.sentry ? `Event ID: ${res.sentry}\n` : '') + (err.message || 'Internal Server Error') + "\n");
});


// --- Server starten ---
let server; // Variable für den HTTP-Server

initialize().then(() => {
    server = app.listen(PORT, () => { // Server-Instanz speichern
        logger.info({ port: PORT, node_env: process.env.NODE_ENV || 'development' }, `Server listening`);
        logger.info(`API endpoints available at:`);
        logger.info(`  http://localhost:${PORT}/api/ipinfo`);
        logger.info(`  http://localhost:${PORT}/api/ping?targetIp=<ip>`);
        logger.info(`  http://localhost:${PORT}/api/traceroute?targetIp=<ip>`);
        logger.info(`  http://localhost:${PORT}/api/lookup?targetIp=<ip>`);
        logger.info(`  http://localhost:${PORT}/api/dns-lookup?domain=<domain>&type=<type>`);
        logger.info(`  http://localhost:${PORT}/api/whois-lookup?query=<domain_or_ip>`);
        // REMOVED: MAC lookup log message
        logger.info(`  http://localhost:${PORT}/api/version`);
    });
}).catch(error => {
    logger.fatal("Server could not start due to initialization errors.");
    Sentry.captureException(error); // Fehler beim Starten an Sentry senden
    process.exit(1);
});

// Graceful Shutdown Handling
const signals = { 'SIGINT': 2, 'SIGTERM': 15 };

async function gracefulShutdown(signal) {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    if (server) {
        server.close(async () => { // async hinzugefügt
            logger.info('HTTP server closed.');
            // Sentry schließen, um sicherzustellen, dass alle Events gesendet werden
            try {
                await Sentry.close(2000); // Timeout von 2 Sekunden, await verwenden
                logger.info('Sentry closed.');
            } catch (e) {
                 logger.error({ error: e.message }, 'Error closing Sentry');
            } finally {
                 process.exit(128 + signals[signal]);
            }
        });
    } else {
        // Wenn der Server nie gestartet ist, Sentry trotzdem schließen
        try {
            await Sentry.close(2000); // await verwenden
            logger.info('Sentry closed (server never started).');
        } catch (e) {
             logger.error({ error: e.message }, 'Error closing Sentry (server never started)');
        } finally {
             process.exit(128 + signals[signal]);
        }
    }

    // Fallback-Timeout, falls das Schließen hängt
    setTimeout(() => {
        logger.warn('Graceful shutdown timed out, forcing exit.');
        process.exit(1);
    }, 5000); // 5 Sekunden Timeout
}

Object.keys(signals).forEach((signal) => {
  process.on(signal, () => gracefulShutdown(signal));
});