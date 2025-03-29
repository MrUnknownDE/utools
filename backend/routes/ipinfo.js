// backend/routes/ipinfo.js
const express = require('express');
const Sentry = require("@sentry/node");
const dns = require('dns').promises;
const pino = require('pino'); // Assuming logger is needed, or pass it down

// Import utilities and MaxMind reader access
const { isValidIp, getCleanIp } = require('../utils');
const { getMaxMindReaders } = require('../maxmind');

// Create a logger instance for this route module
// Ideally, the main logger instance should be passed down or configured globally
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

const router = express.Router();

// Route handler for / (relative to where this router is mounted, e.g., /api/ipinfo)
router.get('/', async (req, res, next) => {
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
        Sentry.captureMessage('Could not determine a valid client IP', {
            level: 'error',
            extra: { rawIp: requestIp, cleanedIp: clientIp }
        });
        // Use 400 for client error (invalid IP derived)
        return res.status(400).json({ error: 'Could not determine a valid client IP address.', rawIp: requestIp, cleanedIp: clientIp });
    }

    try {
        // Get initialized MaxMind readers
        const { cityReader, asnReader } = getMaxMindReaders();

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
            // Remove null/undefined values
            geo = Object.fromEntries(Object.entries(geo).filter(([_, v]) => v != null));
            logger.debug({ ip: clientIp, geo }, 'GeoIP lookup successful');
        } catch (e) {
            // Log as warning, as this is expected for private IPs or IPs not in DB
            logger.warn({ ip: clientIp, error: e.message }, `MaxMind City lookup failed`);
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
            asn = { error: 'ASN lookup failed (IP not found in database or private range).' };
        }

        let rdns = null;
        try {
            const hostnames = await dns.reverse(clientIp);
            rdns = hostnames;
            logger.debug({ ip: clientIp, rdns }, 'rDNS lookup successful');
        } catch (e) {
            // Log non-existence as debug, other errors as warn
            if (e.code !== 'ENOTFOUND' && e.code !== 'ENODATA') {
                logger.warn({ ip: clientIp, error: e.message, code: e.code }, `rDNS lookup error`);
            } else {
                 logger.debug({ ip: clientIp, code: e.code }, 'rDNS lookup failed (No record)');
            }
            // Provide a structured error in the response
            rdns = { error: `rDNS lookup failed (${e.code || 'Unknown error'})` };
         }

        res.json({
            ip: clientIp,
            // Only include geo/asn if they don't contain an error and have data
            geo: geo.error ? geo : (Object.keys(geo).length > 0 ? geo : null),
            asn: asn.error ? asn : (Object.keys(asn).length > 0 ? asn : null),
            rdns // rdns will contain either the array of hostnames or the error object
        });

    } catch (error) {
        // Catch unexpected errors during processing (e.g., issues with getMaxMindReaders)
        logger.error({ ip: clientIp, error: error.message, stack: error.stack }, 'Error processing ipinfo');
        Sentry.captureException(error, { extra: { ip: clientIp } });
        // Pass the error to the Sentry error handler middleware
        next(error);
    }
});

module.exports = router;