const express = require('express');
const Sentry = require("@sentry/node");
const pino = require('pino');
const { isValidIp, isPrivateIp, checkPort } = require('../utils');

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
const router = express.Router();

const COMMON_PORTS_TO_SCAN = [
    21, 22, 25, 53, 80, 110, 143, 443, 3306, 3389, 5432, 8080, 8443
];

router.get('/', (req, res) => {
    const targetIpRaw = req.query.targetIp;
    const targetIp = typeof targetIpRaw === 'string' ? targetIpRaw.trim() : targetIpRaw;
    const requestIp = req.ip || req.socket.remoteAddress;

    logger.info({ requestIp, targetIp }, 'Port scan stream request received');

    if (!isValidIp(targetIp)) {
        logger.warn({ requestIp, targetIp }, 'Invalid target IP for port scan');
        return res.status(400).json({ success: false, error: 'Invalid target IP address provided.' });
    }
    if (isPrivateIp(targetIp)) {
        logger.warn({ requestIp, targetIp }, 'Attempt to scan private IP blocked');
        return res.status(403).json({ success: false, error: 'Operations on private or local IP addresses are not allowed.' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const sendEvent = (event, data) => {
        if (!res.writableEnded) {
            res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        }
    };

    let isConnectionClosed = false;
    req.on('close', () => {
        logger.info({ requestIp, targetIp }, 'Client disconnected from port scan stream.');
        isConnectionClosed = true;
    });

    (async () => {
        try {
            sendEvent('info', { message: `Starting scan of ${COMMON_PORTS_TO_SCAN.length} common ports on ${targetIp}...` });

            for (const port of COMMON_PORTS_TO_SCAN) {
                if (isConnectionClosed) break;
                const result = await checkPort(port, targetIp, 2000);
                sendEvent('port_status', result);
            }

            if (!isConnectionClosed) {
                logger.info({ requestIp, targetIp }, 'Port scan stream completed successfully.');
                sendEvent('end', { message: 'Scan complete.' });
            }
        } catch (error) {
            logger.error({ requestIp, targetIp, error: error.message }, 'Error during port scan stream');
            // Add context directly to the captureException call
            Sentry.captureException(error, { extra: { requestIp, targetIp } });
            if (!isConnectionClosed) {
                sendEvent('error', { error: 'An unexpected error occurred during the scan.' });
            }
        } finally {
            if (!res.writableEnded) {
                res.end();
            }
        }
    })();
});

module.exports = router;