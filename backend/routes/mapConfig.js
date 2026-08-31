// backend/routes/mapConfig.js
const express = require('express');

const router = express.Router();

// GET /api/map-config — CARTO's basemap tiles (used for the Leaflet dark map
// on the IP-info page) now require a free API key: https://carto.com/basemaps/apikey/
// Exposed through the backend, like /api/speedtest/config, so the key lives
// in one place per deployment instead of being baked into the frontend image.
// Without CARTO_API_KEY set, cartoApiKey is just null and the map tiles will
// show CARTO's "key required" placeholder — degraded, not broken.
router.get('/', (req, res) => {
    res.json({ cartoApiKey: process.env.CARTO_API_KEY || null });
});

module.exports = router;
