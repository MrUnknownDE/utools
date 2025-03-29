// backend/routes/whoisLookup.js
const express = require('express');
const Sentry = require("@sentry/node");
const whois = require('whois-json');
const pino = require('pino');

// Import utilities
const { isValidIp, isValidDomain } = require('../utils');

// Logger for this module
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

const router = express.Router();

// Route handler for / (relative to /api/whois-lookup)
router.get('/', async (req, res, next) => {
    const queryRaw = req.query.query;
    const query = typeof queryRaw === 'string' ? queryRaw.trim() : queryRaw;
    const requestIp = req.ip || req.socket.remoteAddress;

    logger.info({ requestIp, query }, 'WHOIS lookup request received');

    // Validate if the query is either a valid IP or a valid domain
    if (!isValidIp(query) && !isValidDomain(query)) {
        logger.warn({ requestIp, query }, 'Invalid query for WHOIS lookup');
        return res.status(400).json({ success: false, error: 'Invalid domain name or IP address provided for WHOIS lookup.' });
    }

    // Note: No isPrivateIp check here, as WHOIS for IPs might be desired regardless of range,
    // and domain lookups don't involve IP ranges.

    try {
        // Execute WHOIS lookup with a timeout
        const result = await whois(query, {
             timeout: parseInt(process.env.WHOIS_TIMEOUT || '10000', 10), // Configurable timeout (default 10s), ensure integer
             // follow: 3, // Optional: limit number of redirects followed
             // verbose: true // Optional: get raw text output as well
        });

        // Check if the result indicates an error (some servers return structured errors)
        // This check might need adjustment based on the 'whois-json' library's output for errors.
        if (result && (result.error || result.Error)) {
             logger.warn({ requestIp, query, whoisResult: result }, 'WHOIS lookup returned an error structure');
             return res.status(404).json({ success: false, error: `WHOIS lookup failed: ${result.error || result.Error}`, result });
        }
        // Basic check if the result is empty or just contains the query itself (might indicate no data)
        if (!result || Object.keys(result).length === 0 || (Object.keys(result).length === 1 && (result.domainName === query || result.query === query))) {
             logger.info({ requestIp, query }, 'WHOIS lookup returned no detailed data.');
             // Consider 404 Not Found if no data is available
             return res.status(404).json({ success: false, error: 'No detailed WHOIS information found for the query.', query });
        }


        logger.info({ requestIp, query }, 'WHOIS lookup successful');
        res.json({ success: true, query, result });

    } catch (error) {
        logger.error({ requestIp, query, error: error.message }, 'WHOIS lookup failed');
        Sentry.captureException(error, { extra: { requestIp, query } });

        // Provide more user-friendly error messages based on common errors
        let errorMessage = error.message;
        let statusCode = 500; // Default to Internal Server Error

        if (error.message.includes('ETIMEDOUT') || error.message.includes('ESOCKETTIMEDOUT')) {
            errorMessage = 'WHOIS server timed out.';
            statusCode = 504; // Gateway Timeout
        } else if (error.message.includes('ENOTFOUND')) {
            // This might indicate the domain doesn't exist or the WHOIS server for the TLD couldn't be found
            errorMessage = 'Domain or IP not found, or the corresponding WHOIS server is unavailable.';
            statusCode = 404; // Not Found
        } else if (error.message.includes('ECONNREFUSED')) {
             errorMessage = 'Connection to WHOIS server refused.';
             statusCode = 503; // Service Unavailable
        } else if (error.message.includes('No WHOIS server found for')) {
             errorMessage = 'Could not find a WHOIS server for the requested domain/TLD.';
             statusCode = 404; // Not Found (as the server for it isn't known)
        }
        // Add more specific error handling if needed based on observed errors

        res.status(statusCode).json({ success: false, error: `WHOIS lookup failed: ${errorMessage}` });
        // next(error); // Optional: Pass to Sentry error handler
    }
});

module.exports = router;