// backend/routes/echo.js
const express = require('express');

const router = express.Router();

// Minimal RTT probe for the connection-diagnostics page: no logging, no
// DB access — anything here would add jitter to the very latency being
// measured, and this is fired dozens/hundreds of times per test run.
//
// Optional ?size=N pads the response to N bytes so the latency test's
// "packet size" setting is reflected in what's actually transferred, not
// just cosmetic. Capped well below the echoLimiter's per-window budget.
const MAX_ECHO_SIZE = 4096;

router.get('/', (req, res) => {
    const size = parseInt(req.query.size, 10);
    if (Number.isInteger(size) && size > 0 && size <= MAX_ECHO_SIZE) {
        res.status(200).type('application/octet-stream').send(Buffer.alloc(size));
        return;
    }
    res.status(204).end();
});

module.exports = router;
