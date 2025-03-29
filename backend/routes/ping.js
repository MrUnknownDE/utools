// backend/routes/ping.js
const express = require('express');
const Sentry = require("@sentry/node");
const pino = require('pino');

// Import utilities
const { isValidIp, isPrivateIp, executeCommand, parsePingOutput } = require('../utils');

// Logger for this module
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

const router = express.Router();

// Route handler for / (relative to /api/ping)
router.get('/', async (req, res, next) => {
    const targetIpRaw = req.query.targetIp;
    const targetIp = typeof targetIpRaw === 'string' ? targetIpRaw.trim() : targetIpRaw;
    const requestIp = req.ip || req.socket.remoteAddress;

    logger.info({ requestIp, targetIp }, 'Ping request received');

    if (!isValidIp(targetIp)) {
        logger.warn({ requestIp, targetIp }, 'Invalid target IP for ping');
        return res.status(400).json({ success: false, error: 'Invalid target IP address provided.' });
    }
    if (isPrivateIp(targetIp)) {
        logger.warn({ requestIp, targetIp }, 'Attempt to ping private IP blocked');
        return res.status(403).json({ success: false, error: 'Operations on private or local IP addresses are not allowed.' });
    }

    try {
        const pingCount = process.env.PING_COUNT || '4';
        let countArg = parseInt(pingCount, 10); // Use let as it might be reassigned
        // Validate countArg to prevent potential issues
        if (isNaN(countArg) || countArg <= 0 || countArg > 10) { // Limit count for safety
             logger.warn({ requestIp, targetIp, requestedCount: pingCount }, 'Invalid or excessive ping count requested, using default.');
             countArg = 4; // Default to 4 if invalid
        }

        const args = ['-c', `${countArg}`, targetIp];
        const command = 'ping';

        logger.info({ requestIp, targetIp, command: `${command} ${args.join(' ')}` }, 'Executing ping');
        const output = await executeCommand(command, args);
        const parsedResult = parsePingOutput(output);

        if (parsedResult.error) {
             logger.warn({ requestIp, targetIp, error: parsedResult.error, rawOutput: parsedResult.rawOutput }, 'Ping command executed but resulted in an error state');
             // Send 200 OK but indicate failure in the response body
             return res.status(200).json({
                 success: false,
                 error: parsedResult.error,
                 rawOutput: parsedResult.rawOutput,
                 stats: parsedResult.stats // Include stats even if there's an error message
             });
        }

        logger.info({ requestIp, targetIp, stats: parsedResult.stats }, 'Ping successful');
        res.json({ success: true, ...parsedResult });

    } catch (error) {
        // This catch block handles errors from executeCommand (e.g., command not found, non-zero exit code)
        logger.error({ requestIp, targetIp, error: error.message, stderr: error.stderr }, 'Ping command failed execution');
        Sentry.captureException(error, { extra: { requestIp, targetIp, stderr: error.stderr } });

        // Attempt to parse the error output (might be stdout or stderr from the error object)
        const errorOutput = error.stderr || error.stdout || error.message;
        const parsedError = parsePingOutput(errorOutput);

        // Send 500 Internal Server Error, but include parsed details if available
        res.status(500).json({
             success: false,
             // Prioritize parsed error message, fallback to original error message
             error: `Ping command failed: ${parsedError.error || error.message}`,
             rawOutput: parsedError.rawOutput || errorOutput // Include raw output for debugging
        });
        // Optionally call next(error) if you want the main Sentry error handler to also catch this
        // next(error);
    }
});

module.exports = router;