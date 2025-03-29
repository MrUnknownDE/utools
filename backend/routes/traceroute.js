// backend/routes/traceroute.js
const express = require('express');
const Sentry = require("@sentry/node");
const { spawn } = require('child_process');
const pino = require('pino');

// Import utilities
const { isValidIp, isPrivateIp, parseTracerouteLine } = require('../utils');

// Logger for this module
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

const router = express.Router();

// Route handler for / (relative to /api/traceroute)
router.get('/', (req, res) => {
    const targetIpRaw = req.query.targetIp;
    const targetIp = typeof targetIpRaw === 'string' ? targetIpRaw.trim() : targetIpRaw;
    const requestIp = req.ip || req.socket.remoteAddress;

    logger.info({ requestIp, targetIp }, 'Traceroute stream request received');

    if (!isValidIp(targetIp)) {
        logger.warn({ requestIp, targetIp }, 'Invalid target IP for traceroute');
        // Send JSON error for consistency, even though it's an SSE endpoint initially
        return res.status(400).json({ success: false, error: 'Invalid target IP address provided.' });
    }
    if (isPrivateIp(targetIp)) {
        logger.warn({ requestIp, targetIp }, 'Attempt to traceroute private IP blocked');
        return res.status(403).json({ success: false, error: 'Operations on private or local IP addresses are not allowed.' });
    }

    // Start Sentry transaction for the stream
    const transaction = Sentry.startTransaction({
        op: "traceroute.stream",
        name: `/api/traceroute?targetIp=${targetIp}`, // Use sanitized targetIp
    });
    // Set scope for this request to associate errors/events with the transaction
    Sentry.configureScope(scope => {
        scope.setSpan(transaction);
        scope.setContext("request", { ip: requestIp, targetIp });
    });

    try {
        logger.info({ requestIp, targetIp }, `Starting traceroute stream...`);
        // Set SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no'); // Important for Nginx buffering
        res.flushHeaders(); // Send headers immediately

        // Traceroute command arguments (using -n to avoid DNS lookups within traceroute itself)
        const args = ['-n', targetIp];
        const command = 'traceroute';
        const proc = spawn(command, args);
        logger.info({ requestIp, targetIp, command: `${command} ${args.join(' ')}` }, 'Spawned traceroute process');

        let buffer = ''; // Buffer for incomplete lines

        // Helper function to send SSE events safely
        const sendEvent = (event, data) => {
            try {
                // Check if the connection is still writable before sending
                if (!res.writableEnded) {
                    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
                } else {
                     logger.warn({ requestIp, targetIp, event }, "Attempted to write to closed SSE stream.");
                }
            } catch (e) {
                // Catch errors during write (e.g., client disconnected)
                logger.error({ requestIp, targetIp, event, error: e.message }, "Error writing to SSE stream (client likely disconnected)");
                Sentry.captureException(e, { level: 'warning', extra: { requestIp, targetIp, event } });
                // Clean up: kill process, end response, finish transaction
                if (proc && !proc.killed) proc.kill();
                if (!res.writableEnded) res.end();
                transaction.setStatus('internal_error');
                transaction.finish();
            }
        };

        // Handle stdout data (traceroute output)
        proc.stdout.on('data', (data) => {
            buffer += data.toString();
            let lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep the last potentially incomplete line
            lines.forEach(line => {
                const parsed = parseTracerouteLine(line);
                if (parsed) {
                    logger.debug({ requestIp, targetIp, hop: parsed.hop, ip: parsed.ip }, 'Sending hop data');
                    sendEvent('hop', parsed);
                } else if (line.trim()) {
                    // Send non-hop lines as info messages (e.g., header)
                     logger.debug({ requestIp, targetIp, message: line.trim() }, 'Sending info data');
                     sendEvent('info', { message: line.trim() });
                }
            });
        });

        // Handle stderr data
        proc.stderr.on('data', (data) => {
            const errorMsg = data.toString().trim();
            logger.warn({ requestIp, targetIp, stderr: errorMsg }, 'Traceroute stderr output');
            Sentry.captureMessage('Traceroute stderr output', { level: 'warning', extra: { requestIp, targetIp, stderr: errorMsg } });
            sendEvent('error', { error: errorMsg }); // Send stderr as an error event
        });

        // Handle process errors (e.g., command not found)
        proc.on('error', (err) => {
            logger.error({ requestIp, targetIp, error: err.message }, `Failed to start traceroute command`);
            Sentry.captureException(err, { extra: { requestIp, targetIp } });
            sendEvent('error', { error: `Failed to start traceroute: ${err.message}` });
            if (!res.writableEnded) res.end(); // Ensure response is ended
            transaction.setStatus('internal_error');
            transaction.finish();
        });

        // Handle process close event
        proc.on('close', (code) => {
            // Process any remaining data in the buffer
            if (buffer) {
                 const parsed = parseTracerouteLine(buffer);
                 if (parsed) sendEvent('hop', parsed);
                 else if (buffer.trim()) sendEvent('info', { message: buffer.trim() });
            }

            if (code !== 0) {
                logger.error({ requestIp, targetIp, exitCode: code }, `Traceroute command finished with error code ${code}`);
                Sentry.captureMessage('Traceroute command failed', { level: 'error', extra: { requestIp, targetIp, exitCode: code } });
                sendEvent('error', { error: `Traceroute command failed with exit code ${code}` });
                transaction.setStatus('unknown_error'); // Or more specific if possible
            } else {
                logger.info({ requestIp, targetIp }, `Traceroute stream completed successfully.`);
                transaction.setStatus('ok');
            }
             sendEvent('end', { exitCode: code }); // Signal the end of the stream
             if (!res.writableEnded) res.end(); // Ensure response is ended
             transaction.finish(); // Finish Sentry transaction
        });

        // Handle client disconnection
        req.on('close', () => {
            logger.info({ requestIp, targetIp }, 'Client disconnected from traceroute stream, killing process.');
            if (proc && !proc.killed) proc.kill(); // Kill the traceroute process
            if (!res.writableEnded) res.end(); // Ensure response is ended
            transaction.setStatus('cancelled'); // Mark transaction as cancelled
            transaction.finish();
        });

    } catch (error) {
        // Catch errors during initial setup (before headers sent)
        logger.error({ requestIp, targetIp, error: error.message, stack: error.stack }, 'Error setting up traceroute stream');
        Sentry.captureException(error, { extra: { requestIp, targetIp } });
        transaction.setStatus('internal_error');
        transaction.finish();

        // If headers haven't been sent, send a standard JSON error
        if (!res.headersSent) {
             res.status(500).json({ success: false, error: `Failed to initiate traceroute: ${error.message}` });
        } else {
             // If headers were sent, try to send an error event via SSE (best effort)
             try {
                 if (!res.writableEnded) {
                    sendEvent('error', { error: `Internal server error during setup: ${error.message}` });
                    res.end();
                 }
             } catch (e) { logger.error({ requestIp, targetIp, error: e.message }, "Error writing final setup error to SSE stream"); }
        }
    }
});

module.exports = router;