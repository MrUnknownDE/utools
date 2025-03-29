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

    // Get the transaction created by Sentry's tracingHandler middleware
    const scope = Sentry.getCurrentScope();
    const transaction = scope?.getTransaction();
    // Add specific context for this request if needed
    scope?.setContext("traceroute_details", { targetIp: targetIp });


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

        // Flag to ensure transaction is only finished once
        let transactionFinished = false;
        const finishTransaction = (status) => {
            if (!transactionFinished && transaction) {
                transaction.setStatus(status);
                transaction.finish();
                transactionFinished = true;
                logger.debug({ requestIp, targetIp, status }, 'Sentry transaction finished.');
            }
        };


        const sendEvent = (event, data) => {
            try {
                if (!res.writableEnded) {
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
                // This catch handles errors during res.write, likely client disconnect
                logger.error({ requestIp, targetIp, event, error: e.message }, "Error writing to SSE stream (client likely disconnected)");
                Sentry.captureException(e, { level: 'warning', extra: { requestIp, targetIp, event } });
                if (proc && !proc.killed) proc.kill();
                if (!res.writableEnded) res.end();
                // Finish transaction here as well, as the request handling failed
                finishTransaction('internal_error');
            }
        };

        proc.stdout.on('data', (data) => {
            buffer += data.toString();
            let lines = buffer.split('\n');
            buffer = lines.pop() || '';
            lines.forEach(line => {
                const parsed = parseTracerouteLine(line);
                if (parsed) {
                    // logger.debug({ requestIp, targetIp, hop: parsed.hop, ip: parsed.ip }, 'Sending hop data');
                    sendEvent('hop', parsed);
                } else if (line.trim()) {
                     // logger.debug({ requestIp, targetIp, message: line.trim() }, 'Sending info data');
                     sendEvent('info', { message: line.trim() });
                }
            });
        });

        proc.stderr.on('data', (data) => {
            const errorMsg = getErrorMessage(data.toString().trim(), 'Traceroute produced unknown stderr output.');
            logger.warn({ requestIp, targetIp, stderr: errorMsg }, 'Traceroute stderr output');
            Sentry.captureMessage('Traceroute stderr output', { level: 'warning', extra: { requestIp, targetIp, stderr: errorMsg } });
            sendEvent('error', { error: errorMsg });
        });

        proc.on('error', (err) => {
            const errorMsg = getErrorMessage(err, 'Failed to start traceroute command due to an unknown error.');
            logger.error({ requestIp, targetIp, error: errorMsg }, `Failed to start traceroute command`);
            Sentry.captureException(err, { extra: { requestIp, targetIp } });
            sendEvent('error', { error: `Failed to start traceroute: ${errorMsg}` });
            if (!res.writableEnded) res.end();
            finishTransaction('internal_error'); // Finish transaction on process error
        });

        proc.on('close', (code) => {
            if (buffer) {
                 const parsed = parseTracerouteLine(buffer);
                 if (parsed) sendEvent('hop', parsed);
                 else if (buffer.trim()) sendEvent('info', { message: buffer.trim() });
            }

            let status = 'ok';
            if (code !== 0) {
                const errorMsg = `Traceroute command failed with exit code ${code}`;
                logger.error({ requestIp, targetIp, exitCode: code }, errorMsg);
                Sentry.captureMessage('Traceroute command failed', { level: 'error', extra: { requestIp, targetIp, exitCode: code } });
                sendEvent('error', { error: errorMsg });
                status = 'unknown_error';
            } else {
                logger.info({ requestIp, targetIp }, `Traceroute stream completed successfully.`);
            }
             sendEvent('end', { exitCode: code });
             if (!res.writableEnded) res.end();
             finishTransaction(status); // Finish transaction on process close
        });

        req.on('close', () => {
            logger.info({ requestIp, targetIp }, 'Client disconnected from traceroute stream, killing process.');
            if (proc && !proc.killed) proc.kill();
            if (!res.writableEnded) res.end();
            finishTransaction('cancelled'); // Finish transaction on client disconnect
        });

    } catch (error) {
        // This catch handles errors during the initial setup (e.g., spawn fails immediately)
        const errorMsg = getErrorMessage(error, 'Failed to initiate traceroute due to an internal server error.');
        logger.error({ requestIp, targetIp, error: errorMsg, stack: error.stack }, 'Error setting up traceroute stream');
        Sentry.captureException(error, { extra: { requestIp, targetIp } });
        // Finish the transaction if an error occurs during setup
        finishTransaction('internal_error');

        if (!res.headersSent) {
             res.status(500).json({ success: false, error: `Failed to initiate traceroute: ${errorMsg}` });
        } else {
             try {
                 if (!res.writableEnded) {
                    sendEvent('error', { error: `Internal server error during setup: ${errorMsg}` });
                    res.end();
                 }
             } catch (e) { logger.error({ requestIp, targetIp, error: e.message }, "Error writing final setup error to SSE stream"); }
        }
    }
});

module.exports = router;