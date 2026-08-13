// backend/routes/echo.js
const express = require('express');

const router = express.Router();

// Minimal RTT probe for the connection-diagnostics page: no logging, no
// validation, no DB access — anything here would add jitter to the very
// latency being measured, and this is fired dozens of times per test run.
router.get('/', (req, res) => {
    res.status(204).end();
});

module.exports = router;
