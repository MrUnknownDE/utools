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

// Helper function to safely create an error message string
function getErrorMessage(err, defaultMessage = 'An unknown error occurred') {
    if (typeof err === 'string') return err;
    if (err && typeof err.message === 'string' && err.message.trim() !== '') return err.message;
    return defaultMessage;
}


// Route handler for / (relative to /api/traceroute)
router.get('/', (req, res) => {
    const targetIpRaw = req.query.targetIp;
    const targetIp = typeof targetIpRaw === 'string' ? targetIpRaw.trim() : targetIpRaw;
    const requestIp = req.ip || req.socket.remoteAddress;

    logger.info({ requestIp, targetIp }, 'Traceroute stream request received');

    if (!isValidIp(targetIp)) {
        logger.warn({ requestIp, targetIp }, 'Invalid target IP for traceroute');
        return res.status(400).json({ success: false, error: 'Invalid target IP address provided.' });
    }
    if (isPrivateIp(targetIp)) {
        logger.warn({ requestIp, targetIp }, 'Attempt to traceroute private IP blocked');
        return res.status(403).json({ success: false, error: 'Operations on private or local IP addresses are not allowed.' });
    }

    const transaction = Sentry.startTransaction({
        op: "traceroute.stream",
        name: `/api/traceroute?targetIp=${targetIp}`,
    });
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
                    // Ensure error events always have a string in data.error
                    if (event === 'error' && (!data || typeof data.error !== 'string')) {
                         const safeErrorMessage = getErrorMessage(data?.error, 'Traceroute encountered an unspecified error.');
                         logger.warn({ requestIp, targetIp, originalData: data }, `Corrected invalid error event data. Sending: ${safeErrorMessage}`);
                         data = { error: safeErrorMessage };
                    }
                    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
                } else {
                     logger.warn({ requestIp, targetIp, event }, "Attempted to write to closed SSE stream.");
                }
            } catch (e) {
                logger.error({ requestIp, targetIp, event, error: e.message }, "Error writing to SSE stream (client likely disconnected)");
                Sentry.captureException(e, { level: 'warning', extra: { requestIp, targetIp, event } });
                if (proc && !proc.killed) proc.kill();
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
            const errorMsg = getErrorMessage(data.toString().trim(), 'Traceroute produced unknown stderr output.');
            logger.warn({ requestIp, targetIp, stderr: errorMsg }, 'Traceroute stderr output');
            Sentry.captureMessage('Traceroute stderr output', { level: 'warning', extra: { requestIp, targetIp, stderr: errorMsg } });
            sendEvent('error', { error: errorMsg }); // errorMsg is now guaranteed to be a string
        });

        proc.on('error', (err) => {
            const errorMsg = getErrorMessage(err, 'Failed to start traceroute command due to an unknown error.');
            logger.error({ requestIp, targetIp, error: errorMsg }, `Failed to start traceroute command`);
            Sentry.captureException(err, { extra: { requestIp, targetIp } }); // Send original error to Sentry
            sendEvent('error', { error: `Failed to start traceroute: ${errorMsg}` }); // Send safe message to client
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
                const errorMsg = `Traceroute command failed with exit code ${code}`;
                logger.error({ requestIp, targetIp, exitCode: code }, errorMsg);
                Sentry.captureMessage('Traceroute command failed', { level: 'error', extra: { requestIp, targetIp, exitCode: code } });
                sendEvent('error', { error: errorMsg }); // Send specific error message
                transaction.setStatus('unknown_error');
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
            if (proc && !proc.killed) proc.kill();
            if (!res.writableEnded) res.end();
            transaction.setStatus('cancelled');
            transaction.finish();
        });

    } catch (error) {
        const errorMsg = getErrorMessage(error, 'Failed to initiate traceroute due to an internal server error.');
        logger.error({ requestIp, targetIp, error: errorMsg, stack: error.stack }, 'Error setting up traceroute stream');
        Sentry.captureException(error, { extra: { requestIp, targetIp } }); // Send original error to Sentry
        transaction.setStatus('internal_error');
        transaction.finish();

        if (!res.headersSent) {
             res.status(500).json({ success: false, error: `Failed to initiate traceroute: ${errorMsg}` });
        } else {
             try {
                 if (!res.writableEnded) {
                    // Use the safe sendEvent function here as well
                    sendEvent('error', { error: `Internal server error during setup: ${errorMsg}` });
                    res.end();
                 }
             } catch (e) { logger.error({ requestIp, targetIp, error: e.message }, "Error writing final setup error to SSE stream"); }
        }
    }
});

module.exports = router;