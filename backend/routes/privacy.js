const express = require('express');
const router  = express.Router();
const dns     = require('dns').promises;
const pino    = require('pino');
const { getMaxMindReaders } = require('../maxmind');

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// ASN org-name patterns that strongly suggest a VPN service
const VPN_PATTERNS = [
  /\bvpn\b/i, /nordvpn/i, /expressvpn/i, /mullvad/i, /surfshark/i,
  /protonvpn/i, /cyberghost/i, /ipvanish/i, /purevpn/i, /tunnelbear/i,
  /private.?internet.?access/i, /\bpia\b/i, /hide\.?my\.?ip/i, /hidemyass/i,
];

// ASN org-name patterns that suggest cloud/datacenter/hosting (but not necessarily VPN)
const DATACENTER_PATTERNS = [
  /amazon/i, /\baws\b/i, /google.*cloud/i, /microsoft/i, /\bazure\b/i,
  /cloudflare/i, /digitalocean/i, /linode/i, /vultr/i, /hetzner/i,
  /\bovh\b/i, /leaseweb/i, /rackspace/i, /choopa/i, /equinix/i,
  /hostinger/i, /\bhosting\b/i, /data.?cent(?:er|re)/i, /\bcloud\b/i,
  /\bcoloc\b/i, /\bvps\b/i, /akamai/i, /fastly/i, /\bcdn\b/i,
];

// Tor DNS exit-node check via torproject.org DNSBL
async function isTorExit(ip) {
  if (!ip || ip.includes(':')) return false; // IPv6 not supported by this DNSBL
  try {
    const reversed = ip.split('.').reverse().join('.');
    await dns.resolve4(`${reversed}.dnsel.torproject.org`);
    return true; // resolves → known Tor exit node
  } catch {
    return false; // NXDOMAIN → not a Tor exit node
  }
}

router.get('/:ip', async (req, res, next) => {
  const { ip } = req.params;
  const flags  = [];

  try {
    // ASN-based classification (synchronous, no network call)
    try {
      const { asnReader } = getMaxMindReaders();
      const asnData = asnReader.asn(ip);
      const org = asnData?.autonomousSystemOrganization || '';

      if (VPN_PATTERNS.some(p => p.test(org))) {
        flags.push({ id: 'vpn', label: 'VPN', color: 'yellow' });
      } else if (DATACENTER_PATTERNS.some(p => p.test(org))) {
        flags.push({ id: 'datacenter', label: 'Datacenter / Hosting', color: 'orange' });
      } else if (org) {
        flags.push({ id: 'residential', label: 'Residential / ISP', color: 'green' });
      }
    } catch (e) {
      logger.debug({ ip, err: e.message }, 'ASN lookup skipped for privacy check');
    }

    // Tor exit-node check (async DNS, ~100–300 ms)
    const tor = await isTorExit(ip);
    if (tor) flags.push({ id: 'tor', label: 'Tor Exit Node', color: 'red' });

    logger.info({ ip, flags: flags.map(f => f.id) }, 'Privacy check complete');
    res.json({ success: true, ip, flags });
  } catch (err) {
    logger.error({ ip, err: err.message }, 'Privacy check failed');
    next(err);
  }
});

module.exports = router;
