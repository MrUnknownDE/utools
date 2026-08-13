// backend/routes/version.js
const express = require('express');
const pino = require('pino');
const { getMaxMindBuildDates } = require('../maxmind');

// Logger for this module
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

const router = express.Router();

// Route handler for / (relative to /api/version)
router.get('/', (req, res) => {
    // Read commit SHA from environment variable (set during build/deploy)
    const commitSha = process.env.GIT_COMMIT_SHA || 'unknown';
    const requestIp = req.ip || req.socket.remoteAddress;

    let cityDbDate = null;
    let asnDbDate = null;
    try {
        ({ cityDbDate, asnDbDate } = getMaxMindBuildDates());
    } catch (error) {
        logger.warn({ error: error.message }, 'Could not read MaxMind database build dates');
    }

    logger.info({ requestIp, commitSha }, 'Version request received');
    res.json({ commitSha, cityDbDate, asnDbDate });
});

module.exports = router;