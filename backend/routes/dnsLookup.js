// backend/routes/dnsLookup.js
const express = require('express');
const Sentry = require("@sentry/node");
const dns = require('dns').promises;
const pino = require('pino');

// Import utilities
const { isValidDomain } = require('../utils');

// Logger for this module
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

const router = express.Router();

// Supported DNS record types
const VALID_DNS_TYPES = ['A', 'AAAA', 'MX', 'TXT', 'NS', 'CNAME', 'SOA', 'SRV', 'PTR', 'ANY'];

// Route handler for / (relative to /api/dns-lookup)
router.get('/', async (req, res, next) => {
    const domainRaw = req.query.domain;
    const domain = typeof domainRaw === 'string' ? domainRaw.trim() : domainRaw;
    const typeRaw = req.query.type;
    // Default to 'ANY' if type is missing or invalid, convert valid types to uppercase
    let type = typeof typeRaw === 'string' ? typeRaw.trim().toUpperCase() : 'ANY';
    if (!VALID_DNS_TYPES.includes(type)) {
        logger.warn({ requestIp: req.ip, domain, requestedType: typeRaw }, 'Invalid record type requested, defaulting to ANY');
        type = 'ANY'; // Default to 'ANY' for invalid types
    }

    const requestIp = req.ip || req.socket.remoteAddress;

    logger.info({ requestIp, domain, type }, 'DNS lookup request received');

    if (!isValidDomain(domain)) {
        logger.warn({ requestIp, domain }, 'Invalid domain for DNS lookup');
        return res.status(400).json({ success: false, error: 'Invalid domain name provided.' });
    }

    // Note: No isPrivateIp check here as DNS lookups for internal domains might be valid use cases.

    try {
        let records;
        if (type === 'ANY') {
            // Define types to query for 'ANY' - exclude PTR as it requires an IP
            const typesToQuery = ['A', 'AAAA', 'MX', 'TXT', 'NS', 'CNAME', 'SOA', 'SRV'];
            const promises = typesToQuery.map(t =>
                dns.resolve(domain, t)
                   .then(result => ({ type: t, records: result })) // Wrap result with type
                   .catch(err => ({ type: t, error: err })) // Wrap error with type
            );

            const results = await Promise.allSettled(promises);

            records = {};
            results.forEach(result => {
                if (result.status === 'fulfilled') {
                    const data = result.value;
                    if (data.error) {
                        // Log DNS resolution errors for specific types as warnings/debug
                        if (data.error.code !== 'ENOTFOUND' && data.error.code !== 'ENODATA') {
                             logger.warn({ requestIp, domain, type: data.type, error: data.error.message, code: data.error.code }, `DNS lookup failed for type ${data.type}`);
                        } else {
                             logger.debug({ requestIp, domain, type: data.type, code: data.error.code }, `No record found for type ${data.type}`);
                        }
                        // Optionally include error details in response (or just omit the type)
                        // records[data.type] = { error: `Lookup failed (${data.error.code || 'Unknown'})` };
                    } else if (data.records && data.records.length > 0) {
                        // Only add if records exist
                        records[data.type] = data.records;
                    }
                } else {
                    // Handle unexpected errors from Promise.allSettled (should be rare)
                    logger.error({ requestIp, domain, type: 'ANY', error: result.reason?.message }, 'Unexpected error during Promise.allSettled for ANY DNS lookup');
                }
            });

            if (Object.keys(records).length === 0) {
                 // If no records found for any type
                 logger.info({ requestIp, domain, type }, 'DNS lookup for ANY type yielded no records.');
                 // Send success: true, but with an empty records object or a note
                 // return res.json({ success: true, domain, type, records: {}, note: 'No records found for queried types.' });
            }

        } else {
            // Handle specific type query
            try {
                records = await dns.resolve(domain, type);
            } catch (error) {
                 if (error.code === 'ENOTFOUND' || error.code === 'ENODATA') {
                     logger.info({ requestIp, domain, type, code: error.code }, `DNS lookup failed (No record) for type ${type}`);
                     // Return success: true, but indicate no records found
                     return res.json({ success: true, domain, type, records: [], note: `No ${type} records found.` });
                 } else {
                     // Rethrow other errors to be caught by the outer catch block
                     throw error;
                 }
            }
        }

        logger.info({ requestIp, domain, type }, 'DNS lookup successful');
        // For specific type, records will be an array. For ANY, it's an object.
        res.json({ success: true, domain, type, records });

    } catch (error) {
        // Catches errors from specific type lookups (not ENOTFOUND/ENODATA) or unexpected errors
        logger.error({ requestIp, domain, type, error: error.message, code: error.code }, 'DNS lookup failed');
        Sentry.captureException(error, { extra: { requestIp, domain, type } });
        // Send appropriate status code based on error if possible, otherwise 500
        const statusCode = error.code === 'ESERVFAIL' ? 502 : 500;
        res.status(statusCode).json({ success: false, error: `DNS lookup failed: ${error.message} (Code: ${error.code || 'Unknown'})` });
        // next(error); // Optional: Pass to Sentry error handler
    }
});

module.exports = router;