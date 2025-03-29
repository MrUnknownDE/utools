// backend/routes/version.js
const express = require('express');
const pino = require('pino');

// Logger for this module
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

const router = express.Router();

// Route handler for / (relative to /api/version)
router.get('/', (req, res) => {
    // Read commit SHA from environment variable (set during build/deploy)
    const commitSha = process.env.GIT_COMMIT_SHA || 'unknown';
    const requestIp = req.ip || req.socket.remoteAddress;

    logger.info({ requestIp, commitSha }, 'Version request received');
    res.json({ commitSha });
});

module.exports = router;