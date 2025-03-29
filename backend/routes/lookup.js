// backend/routes/lookup.js
const express = require('express');
const Sentry = require("@sentry/node");
const dns = require('dns').promises;
const pino = require('pino');

// Import utilities and MaxMind reader access
const { isValidIp, isPrivateIp } = require('../utils');
const { getMaxMindReaders } = require('../maxmind');

// Logger for this module
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

const router = express.Router();

// Route handler for / (relative to /api/lookup)
router.get('/', async (req, res, next) => {
    const targetIpRaw = req.query.targetIp;
    const targetIp = typeof targetIpRaw === 'string' ? targetIpRaw.trim() : targetIpRaw;
    const requestIp = req.ip || req.socket.remoteAddress; // IP of the client making the request

    logger.info({ requestIp, targetIp }, 'Lookup request received');

    if (!isValidIp(targetIp)) {
        logger.warn({ requestIp, targetIp }, 'Invalid target IP for lookup');
        return res.status(400).json({ success: false, error: 'Invalid IP address provided for lookup.' });
    }
    if (isPrivateIp(targetIp)) {
        logger.warn({ requestIp, targetIp }, 'Attempt to lookup private IP blocked');
        return res.status(403).json({ success: false, error: 'Lookup for private or local IP addresses is not supported.' });
    }

    try {
        // Get initialized MaxMind readers
        const { cityReader, asnReader } = getMaxMindReaders();

        // Perform lookups in parallel
        const geoPromise = cityReader.city(targetIp)
            .then(geoData => {
                let geo = {
                    city: geoData.city?.names?.en, region: geoData.subdivisions?.[0]?.isoCode,
                    country: geoData.country?.isoCode, countryName: geoData.country?.names?.en,
                    postalCode: geoData.postal?.code, latitude: geoData.location?.latitude,
                    longitude: geoData.location?.longitude, timezone: geoData.location?.timeZone,
                };
                geo = Object.fromEntries(Object.entries(geo).filter(([_, v]) => v != null));
                logger.debug({ targetIp, geo }, 'GeoIP lookup successful for lookup');
                return Object.keys(geo).length > 0 ? geo : null; // Return null if empty
            })
            .catch(e => {
                logger.warn({ targetIp, error: e.message }, `MaxMind City lookup failed for lookup`);
                return { error: 'GeoIP lookup failed (IP not found in database or private range).' };
            });

        const asnPromise = asnReader.asn(targetIp)
            .then(asnData => {
                let asn = { number: asnData.autonomousSystemNumber, organization: asnData.autonomousSystemOrganization };
                asn = Object.fromEntries(Object.entries(asn).filter(([_, v]) => v != null));
                logger.debug({ targetIp, asn }, 'ASN lookup successful for lookup');
                return Object.keys(asn).length > 0 ? asn : null; // Return null if empty
            })
            .catch(e => {
                logger.warn({ targetIp, error: e.message }, `MaxMind ASN lookup failed for lookup`);
                return { error: 'ASN lookup failed (IP not found in database or private range).' };
            });

        const rdnsPromise = dns.reverse(targetIp)
            .then(hostnames => {
                logger.debug({ targetIp, rdns: hostnames }, 'rDNS lookup successful for lookup');
                return hostnames; // Returns array of hostnames
            })
            .catch(e => {
                if (e.code !== 'ENOTFOUND' && e.code !== 'ENODATA') {
                    logger.warn({ targetIp, error: e.message, code: e.code }, `rDNS lookup error for lookup`);
                } else {
                    logger.debug({ targetIp, code: e.code }, 'rDNS lookup failed (No record) for lookup');
                }
                return { error: `rDNS lookup failed (${e.code || 'Unknown error'})` };
            });

        // Wait for all promises to settle
        const [geoResult, asnResult, rdnsResult] = await Promise.all([
            geoPromise,
            asnPromise,
            rdnsPromise
        ]);

        res.json({
            success: true, // Indicate overall success of the request processing
            ip: targetIp,
            geo: geoResult, // Will be the geo object, null, or error object
            asn: asnResult, // Will be the asn object, null, or error object
            rdns: rdnsResult // Will be the hostname array or error object
        });

    } catch (error) {
        // Catch unexpected errors (e.g., issue with getMaxMindReaders or Promise.all)
        logger.error({ targetIp, requestIp, error: error.message, stack: error.stack }, 'Error processing lookup');
        Sentry.captureException(error, { extra: { targetIp, requestIp } });
        next(error); // Pass to the main error handler
    }
});

module.exports = router;