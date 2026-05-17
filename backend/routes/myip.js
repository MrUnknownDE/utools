const express = require('express');
const router  = express.Router();
const { getCleanIp } = require('../utils');

router.get('/', (req, res) => {
  const ip = getCleanIp(req.ip || req.socket.remoteAddress);
  res.json({ ip: ip || null });
});

module.exports = router;
