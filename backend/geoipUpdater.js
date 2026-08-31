// backend/geoipUpdater.js
// Replaces the old CI-driven Git LFS commit workflow: the backend now
// downloads the MaxMind GeoLite2 databases itself on startup and refreshes
// them on a daily schedule, so the Docker image no longer needs to be
// rebuilt just to pick up a new database.
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const os = require('os');
const tar = require('tar');
const pino = require('pino');
const Sentry = require('@sentry/node');
const { reloadMaxMind } = require('./maxmind');

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

const ACCOUNT_ID = process.env.MAXMIND_ACCOUNT_ID;
const LICENSE_KEY = process.env.MAXMIND_LICENSE_KEY;
const UPDATE_INTERVAL_MS = 24 * 60 * 60 * 1000; // daily

const EDITIONS = [
    { id: 'GeoLite2-City', targetPath: process.env.GEOIP_CITY_DB || './data/GeoLite2-City.mmdb' },
    { id: 'GeoLite2-ASN', targetPath: process.env.GEOIP_ASN_DB || './data/GeoLite2-ASN.mmdb' },
];

function authHeader() {
    return 'Basic ' + Buffer.from(`${ACCOUNT_ID}:${LICENSE_KEY}`).toString('base64');
}

async function downloadEdition({ id, targetPath }) {
    const url = `https://download.maxmind.com/geoip/databases/${id}/download?suffix=tar.gz`;
    const res = await fetch(url, { headers: { Authorization: authHeader() } });
    if (!res.ok) {
        throw new Error(`MaxMind download failed for ${id}: HTTP ${res.status}`);
    }

    const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), `geoip-${id}-`));
    try {
        const archivePath = path.join(tmpDir, `${id}.tar.gz`);
        await fsp.writeFile(archivePath, Buffer.from(await res.arrayBuffer()));

        // MaxMind ships each edition inside a dated directory, e.g.
        // GeoLite2-City_20260101/GeoLite2-City.mmdb — strip that wrapper and
        // only pull out the .mmdb file we actually need.
        await tar.x({
            file: archivePath,
            cwd: tmpDir,
            strip: 1,
            filter: (entryPath) => entryPath.endsWith('.mmdb'),
        });

        const extracted = (await fsp.readdir(tmpDir)).find((f) => f.endsWith('.mmdb'));
        if (!extracted) throw new Error(`No .mmdb file found in downloaded archive for ${id}`);

        const resolvedTarget = path.resolve(targetPath);
        await fsp.mkdir(path.dirname(resolvedTarget), { recursive: true });

        // Write next to the target and rename over it, so readers never see a
        // partially-written database mid-download.
        const stagedPath = `${resolvedTarget}.tmp`;
        await fsp.copyFile(path.join(tmpDir, extracted), stagedPath);
        await fsp.rename(stagedPath, resolvedTarget);

        logger.info({ edition: id, targetPath: resolvedTarget }, 'MaxMind database updated');
    } finally {
        await fsp.rm(tmpDir, { recursive: true, force: true });
    }
}

// Downloads both editions and hot-reloads the MaxMind readers. Never throws —
// callers get a boolean so a failed refresh doesn't take down an already
// running server (the previous readers keep serving requests).
async function updateDatabases() {
    if (!ACCOUNT_ID || !LICENSE_KEY) {
        logger.warn('MAXMIND_ACCOUNT_ID/MAXMIND_LICENSE_KEY not set — skipping MaxMind database update');
        return false;
    }

    try {
        logger.info('Checking for MaxMind database updates...');
        await Promise.all(EDITIONS.map(downloadEdition));
        await reloadMaxMind();
        return true;
    } catch (error) {
        logger.error({ error: error.message, stack: error.stack }, 'MaxMind database update failed');
        Sentry.captureException(error);
        return false;
    }
}

function databasesExist() {
    return EDITIONS.every(({ targetPath }) => fs.existsSync(path.resolve(targetPath)));
}

function msUntilNextRun(hourUtc) {
    const now = new Date();
    const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hourUtc, 0, 0, 0));
    if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
    return next.getTime() - now.getTime();
}

// Kicks off the recurring daily refresh. Safe to call even without
// credentials configured — it just logs once and never schedules anything,
// so local setups that drop in .mmdb files by hand keep working unchanged.
function scheduleDailyUpdates() {
    if (!ACCOUNT_ID || !LICENSE_KEY) {
        logger.warn('MaxMind credentials not configured — automatic daily database updates are disabled.');
        return null;
    }

    const hourUtc = parseInt(process.env.MAXMIND_UPDATE_HOUR_UTC || '3', 10);
    const delay = msUntilNextRun(hourUtc);
    logger.info({ hourUtc, nextRunInMs: delay }, 'Scheduled daily MaxMind database update job');

    const timeout = setTimeout(() => {
        updateDatabases();
        setInterval(updateDatabases, UPDATE_INTERVAL_MS).unref();
    }, delay);
    timeout.unref();
    return timeout;
}

module.exports = {
    updateDatabases,
    databasesExist,
    scheduleDailyUpdates,
};
