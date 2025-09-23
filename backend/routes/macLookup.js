// backend/routes/macLookup.js
const express = require('express');
const Sentry = require("@sentry/node");
const macaddress = require('macaddress');
const pino = require('pino');
const { isValidMacAddress } = require('../utils'); // Wir fügen diese neue Funktion hinzu

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
const router = express.Router();

router.get('/', async (req, res) => {
    const macRaw = req.query.mac;
    const mac = typeof macRaw === 'string' ? macRaw.trim() : macRaw;
    const requestIp = req.ip || req.socket.remoteAddress;

    logger.info({ requestIp, mac }, 'MAC lookup request received');

    if (!isValidMacAddress(mac)) {
        logger.warn({ requestIp, mac }, 'Invalid MAC address for lookup');
        return res.status(400).json({ success: false, error: 'Invalid MAC address format provided.' });
    }

    try {
        const vendor = await macaddress.lookup(mac);
        if (vendor) {
            logger.info({ requestIp, mac, vendor }, 'MAC lookup successful');
            res.json({ success: true, mac, vendor });
        } else {
            logger.info({ requestIp, mac }, 'MAC address not found in OUI database');
            res.status(404).json({ success: false, error: 'Vendor not found for this MAC address.' });
        }
    } catch (error) {
        logger.error({ requestIp, mac, error: error.message }, 'MAC lookup failed');
        Sentry.captureException(error, { extra: { requestIp, mac } });
        res.status(500).json({ success: false, error: 'An unexpected error occurred during the MAC lookup.' });
    }
});

module.exports = router;