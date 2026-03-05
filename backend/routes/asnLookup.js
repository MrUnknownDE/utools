// backend/routes/asnLookup.js
const express = require('express');
const https = require('https');
const fs = require('fs');
const path = require('path');
const pino = require('pino');
const Sentry = require('@sentry/node');

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
const router = express.Router();

// ─── Filesystem Cache (24h TTL) ───────────────────────────────────────────────
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const CACHE_DIR = process.env.ASN_CACHE_DIR || path.join(__dirname, '..', 'data', 'asn-cache');

// Ensure cache directory exists
try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
} catch (e) {
    logger.warn({ error: e.message }, 'Could not create ASN cache directory');
}

function cacheFilePath(key) {
    // Sanitize key to safe filename
    return path.join(CACHE_DIR, key.replace(/[^a-zA-Z0-9_:-]/g, '_') + '.json');
}

function getCached(key) {
    try {
        const file = cacheFilePath(key);
        const raw = fs.readFileSync(file, 'utf8');
        const entry = JSON.parse(raw);
        if (Date.now() > entry.expiresAt) {
            fs.unlinkSync(file);
            return null;
        }
        return entry.data;
    } catch {
        return null; // File doesn't exist or parse failed
    }
}

function setCache(key, data) {
    try {
        const entry = { data, expiresAt: Date.now() + CACHE_TTL_MS };
        fs.writeFileSync(cacheFilePath(key), JSON.stringify(entry), 'utf8');
    } catch (e) {
        logger.warn({ key, error: e.message }, 'ASN cache write failed');
    }
}

// ─── HTTP Helper ──────────────────────────────────────────────────────────────
function fetchJson(url) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, {
            headers: {
                'User-Agent': 'uTools-Network-Suite/1.0 (https://github.com/MrUnknownDE/utools)',
                'Accept': 'application/json',
            },
            timeout: 15000,
        }, (res) => {
            let raw = '';
            res.on('data', (chunk) => { raw += chunk; });
            res.on('end', () => {
                if (res.statusCode < 200 || res.statusCode >= 300) {
                    return reject(new Error(`HTTP ${res.statusCode} from ${url}`));
                }
                try { resolve(JSON.parse(raw)); }
                catch (e) { reject(new Error(`JSON parse error: ${e.message}`)); }
            });
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout: ${url}`)); });
    });
}

// ─── ASN Validation ───────────────────────────────────────────────────────────
function parseAsn(raw) {
    if (!raw || typeof raw !== 'string') return null;
    const cleaned = raw.trim().toUpperCase().replace(/^AS/, '');
    const n = parseInt(cleaned, 10);
    if (isNaN(n) || n < 1 || n > 4294967295 || String(n) !== cleaned) return null;
    return n;
}

// ─── RIPE Stat Fetchers ───────────────────────────────────────────────────────
async function fetchOverview(asn) {
    const key = `overview:${asn}`;
    const cached = getCached(key);
    if (cached) return cached;

    const json = await fetchJson(`https://stat.ripe.net/data/as-overview/data.json?resource=AS${asn}`);
    const d = json?.data;
    const result = {
        asn,
        name: d?.holder || null,
        announced: d?.announced ?? false,
        type: d?.type || null,
        block: d?.block || null,
    };
    setCache(key, result);
    return result;
}

async function fetchNeighbours(asn) {
    const key = `neighbours:${asn}`;
    const cached = getCached(key);
    if (cached) return cached;

    const json = await fetchJson(`https://stat.ripe.net/data/asn-neighbours/data.json?resource=AS${asn}`);
    const neighbours = (json?.data?.neighbours || []).map(n => ({
        asn: n.asn,
        type: n.type,       // 'left' = upstream, 'right' = downstream
        power: n.power || 0,
        v4_peers: n.v4_peers || 0,
        v6_peers: n.v6_peers || 0,
    }));
    setCache(key, neighbours);
    return neighbours;
}

async function fetchPrefixes(asn) {
    const key = `prefixes:${asn}`;
    const cached = getCached(key);
    if (cached) return cached;

    const json = await fetchJson(`https://stat.ripe.net/data/announced-prefixes/data.json?resource=AS${asn}`);
    const prefixes = (json?.data?.prefixes || []).map(p => p.prefix);
    setCache(key, prefixes);
    return prefixes;
}

async function fetchPeeringDb(asn) {
    const key = `peeringdb:${asn}`;
    const cached = getCached(key);
    if (cached !== null) return cached;

    try {
        const json = await fetchJson(`https://www.peeringdb.com/api/net?asn=${asn}&depth=2`);
        const net = json?.data?.[0];
        if (!net) { setCache(key, null); return null; }

        const result = {
            peeringPolicy: net.policy_general || null,
            infoType: net.info_type || null,
            website: net.website || null,
            ixps: (net.netixlan_set || []).map(ix => ({
                name: ix.name,
                speed: ix.speed,
                ipv4: ix.ipaddr4 || null,
                ipv6: ix.ipaddr6 || null,
            })).slice(0, 20),
        };
        setCache(key, result);
        return result;
    } catch (e) {
        logger.warn({ asn, error: e.message }, 'PeeringDB fetch failed');
        return null;
    }
}

// ─── Resolve names for a list of ASNs ────────────────────────────────────────
async function resolveNames(asnList) {
    const results = await Promise.allSettled(asnList.map(a => fetchOverview(a)));
    const map = {};
    results.forEach((r, i) => {
        map[asnList[i]] = r.status === 'fulfilled' ? (r.value.name || null) : null;
    });
    return map;
}

// ─── Route ────────────────────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
    const rawAsn = req.query.asn;
    const requestIp = req.ip;

    const asn = parseAsn(String(rawAsn || ''));
    if (!asn) {
        return res.status(400).json({
            success: false,
            error: 'Invalid ASN. Please provide a number between 1 and 4294967295, e.g. ?asn=15169'
        });
    }

    logger.info({ requestIp, asn }, 'ASN lookup request');

    try {
        // Level 1 + Level 2: fetch all base data in parallel (allSettled = one failure won't crash everything)
        const [overviewResult, neighboursResult, prefixesResult, peeringdbResult] = await Promise.allSettled([
            fetchOverview(asn),
            fetchNeighbours(asn),
            fetchPrefixes(asn),
            fetchPeeringDb(asn),
        ]);

        const overview = overviewResult.status === 'fulfilled' ? overviewResult.value : { asn, name: null, announced: false, type: null };
        const neighbours = neighboursResult.status === 'fulfilled' ? neighboursResult.value : [];
        const prefixes = prefixesResult.status === 'fulfilled' ? prefixesResult.value : [];
        const peeringdb = peeringdbResult.status === 'fulfilled' ? peeringdbResult.value : null;

        if (overviewResult.status === 'rejected') logger.warn({ asn, error: overviewResult.reason?.message }, 'Overview fetch failed, continuing with partial data');
        if (neighboursResult.status === 'rejected') logger.warn({ asn, error: neighboursResult.reason?.message }, 'Neighbours fetch failed, continuing with partial data');
        if (prefixesResult.status === 'rejected') logger.warn({ asn, error: prefixesResult.reason?.message }, 'Prefixes fetch failed, continuing with partial data');

        // Split neighbours
        const upstreams = neighbours.filter(n => n.type === 'left').sort((a, b) => b.power - a.power).slice(0, 10);
        const downstreams = neighbours.filter(n => n.type === 'right').sort((a, b) => b.power - a.power).slice(0, 10);

        // Resolve names for ALL Level 2 nodes (both upstreams and downstreams)
        const level2Asns = [...new Set([...upstreams, ...downstreams].map(n => n.asn))];
        const level2Names = await resolveNames(level2Asns);

        // Level 3: fetch upstreams-of-upstreams for top 5 Level 2 upstreams
        const level3Raw = await Promise.allSettled(
            upstreams.slice(0, 5).map(async (upstreamNode) => {
                const theirNeighbours = await fetchNeighbours(upstreamNode.asn);
                const theirUpstreams = theirNeighbours
                    .filter(n => n.type === 'left')
                    .sort((a, b) => b.power - a.power)
                    .slice(0, 3);
                return { parentAsn: upstreamNode.asn, theirUpstreams };
            })
        );

        const level3Data = level3Raw
            .filter(r => r.status === 'fulfilled')
            .map(r => r.value);

        // Resolve names for Level 3 nodes
        const level3Asns = [...new Set(level3Data.flatMap(d => d.theirUpstreams.map(n => n.asn)))];
        const level3Names = await resolveNames(level3Asns);

        // ── Build graph ───────────────────────────────────────────────────────
        const graph = {
            center: { asn, name: overview.name },
            level2: {
                upstreams: upstreams.map(n => ({ asn: n.asn, name: level2Names[n.asn] || null, power: n.power, v4: n.v4_peers, v6: n.v6_peers })),
                downstreams: downstreams.map(n => ({ asn: n.asn, name: level2Names[n.asn] || null, power: n.power, v4: n.v4_peers, v6: n.v6_peers })),
            },
            level3: level3Data.map(d => ({
                parentAsn: d.parentAsn,
                parentName: level2Names[d.parentAsn] || null,
                upstreams: d.theirUpstreams.map(n => ({
                    asn: n.asn,
                    name: level3Names[n.asn] || null,
                    power: n.power,
                })),
            })),
        };

        res.json({
            success: true,
            asn,
            name: overview.name,
            announced: overview.announced,
            type: overview.type,
            prefixes: prefixes.slice(0, 100),
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
