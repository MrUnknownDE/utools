const express = require('express');
const Sentry = require("@sentry/node");
const oui = require('oui');
const pino = require('pino');
const { isValidMacAddress } = require('../utils');

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

    // Use 'oui' library to find vendor
    try {
        const ouiData = oui(mac);
        // oui returns a string (Vendor Name) or null if not found
        // Sometimes it returns an object? The documentation says it returns the organization name string.
        // Let's handle both just in case, but usually it's a string or null.

        let vendor = null;
        if (ouiData) {
            vendor = typeof ouiData === 'string' ? ouiData : ouiData.split('\n')[0];
        }

        if (vendor) {
            logger.info({ requestIp, mac, vendor }, 'MAC lookup successful');
            res.json({ success: true, mac, vendor });
        } else {
            logger.info({ requestIp, mac }, 'MAC address not found in OUI database');
            res.status(404).json({ success: false, error: 'Vendor not found for this MAC address.' });
        }
    } catch (err) {
        // oui might throw on invalid input, though we validated it.
        throw err;
    }
} catch (error) {
    logger.error({ requestIp, mac, error: error.message }, 'MAC lookup failed');
    Sentry.captureException(error, { extra: { requestIp, mac } });
    res.status(500).json({ success: false, error: 'An unexpected error occurred during the MAC lookup.' });
}
});

module.exports = router;