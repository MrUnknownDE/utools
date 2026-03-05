// backend/routes/asnLookup.js
const express = require('express');
const https = require('https');
const pino = require('pino');
const Sentry = require('@sentry/node');

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
const router = express.Router();

// ─── In-Memory Cache (24h TTL) ───────────────────────────────────────────────
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const cache = new Map(); // key → { data, expiresAt }

function getCached(key) {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
        cache.delete(key);
        return null;
    }
    return entry.data;
}

function setCache(key, data) {
    cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ─── HTTP Helper ──────────────────────────────────────────────────────────────
function fetchJson(url) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, {
            headers: {
                'User-Agent': 'uTools-Network-Suite/1.0 (https://github.com/MrUnknownDE/utools)',
                'Accept': 'application/json',
            },
            timeout: 8000,
        }, (res) => {
            let raw = '';
            res.on('data', (chunk) => { raw += chunk; });
            res.on('end', () => {
                if (res.statusCode < 200 || res.statusCode >= 300) {
                    return reject(new Error(`HTTP ${res.statusCode} from ${url}`));
                }
                try {
                    resolve(JSON.parse(raw));
                } catch (e) {
                    reject(new Error(`JSON parse error from ${url}: ${e.message}`));
                }
            });
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout fetching ${url}`)); });
    });
}

// ─── ASN Validation ───────────────────────────────────────────────────────────
function parseAsn(raw) {
    if (!raw || typeof raw !== 'string') return null;
    // Accept "15169", "AS15169", "as15169"
    const cleaned = raw.trim().toUpperCase().replace(/^AS/, '');
    const n = parseInt(cleaned, 10);
    if (isNaN(n) || n < 1 || n > 4294967295 || String(n) !== cleaned) return null;
    return n;
}

// ─── RIPE Stat Fetchers ───────────────────────────────────────────────────────
async function fetchOverview(asn) {
    const cacheKey = `overview:${asn}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const url = `https://stat.ripe.net/data/as-overview/data.json?resource=AS${asn}`;
    const json = await fetchJson(url);
    const d = json?.data;
    const result = {
        asn,
        name: d?.holder || null,
        announced: d?.announced ?? false,
        type: d?.type || null,
        block: d?.block || null,
    };
    setCache(cacheKey, result);
    return result;
}

async function fetchNeighbours(asn) {
    const cacheKey = `neighbours:${asn}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const url = `https://stat.ripe.net/data/asn-neighbours/data.json?resource=AS${asn}`;
    const json = await fetchJson(url);
    const neighbours = (json?.data?.neighbours || []).map(n => ({
        asn: n.asn,
        type: n.type,         // 'left' = upstream, 'right' = downstream
        power: n.power || 0,
        v4_peers: n.v4_peers || 0,
        v6_peers: n.v6_peers || 0,
    }));
    setCache(cacheKey, neighbours);
    return neighbours;
}

async function fetchPrefixes(asn) {
    const cacheKey = `prefixes:${asn}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const url = `https://stat.ripe.net/data/announced-prefixes/data.json?resource=AS${asn}`;
    const json = await fetchJson(url);
    const prefixes = (json?.data?.prefixes || []).map(p => p.prefix);
    setCache(cacheKey, prefixes);
    return prefixes;
}

async function fetchPeeringDb(asn) {
    const cacheKey = `peeringdb:${asn}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    try {
        const url = `https://www.peeringdb.com/api/net?asn=${asn}&depth=2`;
        const json = await fetchJson(url);
        const net = json?.data?.[0];
        if (!net) { setCache(cacheKey, null); return null; }

        const result = {
            peeringPolicy: net.policy_general || null,
            infoType: net.info_type || null,
            website: net.website || null,
            ixps: (net.netixlan_set || []).map(ix => ({
                name: ix.name,
                speed: ix.speed,
                ipv4: ix.ipaddr4 || null,
                ipv6: ix.ipaddr6 || null,
            })).slice(0, 20), // max 20 IXPs
        };
        setCache(cacheKey, result);
        return result;
    } catch (e) {
        logger.warn({ asn, error: e.message }, 'PeeringDB fetch failed');
        return null;
    }
}

// ─── Route ────────────────────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
    const rawAsn = req.query.asn;
    const requestIp = req.ip;

    const asn = parseAsn(String(rawAsn || ''));
    if (!asn) {
        return res.status(400).json({ success: false, error: 'Invalid ASN. Please provide a number between 1 and 4294967295, e.g. ?asn=15169' });
    }

    logger.info({ requestIp, asn }, 'ASN lookup request');

    try {
        // Level 1 + Level 2: overview + direct neighbours + prefixes + PeeringDB (parallel)
        const [overview, neighbours, prefixes, peeringdb] = await Promise.all([
            fetchOverview(asn),
            fetchNeighbours(asn),
            fetchPrefixes(asn),
            fetchPeeringDb(asn),
        ]);

        // Split neighbours into upstream (left) and downstream (right)
        const upstreams = neighbours
            .filter(n => n.type === 'left')
            .sort((a, b) => b.power - a.power)
            .slice(0, 10); // Top 10 upstreams for Level 2

        const downstreams = neighbours
            .filter(n => n.type === 'right')
            .sort((a, b) => b.power - a.power)
            .slice(0, 10); // Top 10 downstreams for Level 2

        // Level 3: fetch upstreams of upstreams (top 5 of Level 2 upstreams only)
        const level3Raw = await Promise.allSettled(
            upstreams.slice(0, 5).map(async (upstreamNode) => {
                const theirNeighbours = await fetchNeighbours(upstreamNode.asn);
                const overviewResult = await fetchOverview(upstreamNode.asn);
                // Their upstreams (left) = Level 3
                const theirUpstreams = theirNeighbours
                    .filter(n => n.type === 'left')
                    .sort((a, b) => b.power - a.power)
                    .slice(0, 3); // Top 3 per Level-2 upstream
                return {
                    parentAsn: upstreamNode.asn,
                    parentName: overviewResult.name,
                    theirUpstreams,
                };
            })
        );

        // Collect Level 3 nodes, resolve names for them
        const level3Data = level3Raw
            .filter(r => r.status === 'fulfilled')
            .map(r => r.value);

        // Flatten all unique Level 3 ASNs and fetch their names
        const level3Asns = [...new Set(
            level3Data.flatMap(d => d.theirUpstreams.map(n => n.asn))
        )];
        const level3Names = await Promise.allSettled(
            level3Asns.map(a => fetchOverview(a))
        );
        const asnNameMap = {};
        level3Names.forEach((r, i) => {
            if (r.status === 'fulfilled') asnNameMap[level3Asns[i]] = r.value.name;
        });
        // Also include Level 2 names
        [...upstreams, ...downstreams].forEach(n => {
            if (!asnNameMap[n.asn]) asnNameMap[n.asn] = null;
        });

        // Build graph structure for frontend
        const graph = {
            center: { asn, name: overview.name },
            level2: {
                upstreams: upstreams.map(n => ({ asn: n.asn, name: asnNameMap[n.asn] || null, power: n.power, v4: n.v4_peers, v6: n.v6_peers })),
                downstreams: downstreams.map(n => ({ asn: n.asn, name: asnNameMap[n.asn] || null, power: n.power, v4: n.v4_peers, v6: n.v6_peers })),
            },
            level3: level3Data.map(d => ({
                parentAsn: d.parentAsn,
                parentName: d.parentName,
                upstreams: d.theirUpstreams.map(n => ({ asn: n.asn, name: asnNameMap[n.asn] || null, power: n.power })),
            })),
        };

        res.json({
            success: true,
            asn,
            name: overview.name,
            announced: overview.announced,
            type: overview.type,
            prefixes: prefixes.slice(0, 100), // max 100 prefixes
            peeringdb,
            graph,
        });

    } catch (error) {
        logger.error({ asn, requestIp, error: error.message }, 'ASN lookup failed');
        Sentry.captureException(error, { extra: { asn, requestIp } });
        next(error);
    }
});

module.exports = router;
