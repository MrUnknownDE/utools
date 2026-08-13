// backend/routes/speedtest.js
const express = require('express');
const crypto = require('crypto');

const router = express.Router();

function clampMb(raw, fallbackMb, hardCeilingMb) {
    const n = parseInt(raw, 10);
    if (isNaN(n) || n <= 0 || n > hardCeilingMb) return fallbackMb;
    return n;
}

const SPEEDTEST_ENABLED = process.env.SPEEDTEST_ENABLED === 'true';
const MAX_DOWNLOAD_BYTES = clampMb(process.env.SPEEDTEST_MAX_DOWNLOAD_MB, 25, 500) * 1024 * 1024;
const MAX_UPLOAD_BYTES = clampMb(process.env.SPEEDTEST_MAX_UPLOAD_MB, 25, 500) * 1024 * 1024;

const DEFAULT_DOWNLOAD_BYTES = 5 * 1024 * 1024;
const CHUNK_SIZE = 64 * 1024;
// Generated once at module load and reused/wrapped for every download —
// avoids paying crypto.randomBytes() cost on the request hot path.
const RANDOM_POOL = crypto.randomBytes(1024 * 1024);

function poolSlice(offset, length) {
    const start = offset % RANDOM_POOL.length;
    if (start + length <= RANDOM_POOL.length) {
        return RANDOM_POOL.subarray(start, start + length);
    }
    return Buffer.concat([
        RANDOM_POOL.subarray(start),
        RANDOM_POOL.subarray(0, length - (RANDOM_POOL.length - start)),
    ]);
}

function writeRandomStream(res, totalBytes) {
    let written = 0;

    function pump() {
        let canWriteMore = true;
        while (written < totalBytes && canWriteMore) {
            const sliceLen = Math.min(CHUNK_SIZE, totalBytes - written);
            canWriteMore = res.write(poolSlice(written, sliceLen));
            written += sliceLen;
        }
        if (written < totalBytes) {
            res.once('drain', pump);
        } else {
            res.end();
        }
    }

    pump();
}

// GET /api/speedtest/config — always reachable so the frontend can feature-detect
// and hide the speedtest UI instead of surfacing a 404 as an error.
router.get('/config', (req, res) => {
    res.json({
        enabled: SPEEDTEST_ENABLED,
        maxDownloadBytes: MAX_DOWNLOAD_BYTES,
        maxUploadBytes: MAX_UPLOAD_BYTES,
    });
});

router.get('/download', (req, res) => {
    if (!SPEEDTEST_ENABLED) {
        return res.status(404).json({ success: false, error: 'Speedtest is disabled on this server.' });
    }

    let bytes = parseInt(req.query.bytes, 10);
    if (isNaN(bytes) || bytes <= 0) bytes = DEFAULT_DOWNLOAD_BYTES;
    bytes = Math.min(bytes, MAX_DOWNLOAD_BYTES); // never trust the client-requested size

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', bytes);
    res.setHeader('Cache-Control', 'no-store');
    writeRandomStream(res, bytes);
});

// Relies on express.json() (mounted globally in server.js) only parsing
// application/json bodies — an application/octet-stream body is left
// untouched on req, so it can be drained manually here without buffering.
router.post('/upload', (req, res) => {
    if (!SPEEDTEST_ENABLED) {
        return res.status(404).json({ success: false, error: 'Speedtest is disabled on this server.' });
    }

    let received = 0;
    let aborted = false;

    req.on('data', (chunk) => {
        if (aborted) return;
        received += chunk.length;
        if (received > MAX_UPLOAD_BYTES) {
            aborted = true;
            res.status(413).json({ success: false, error: 'Upload exceeds the allowed size limit.' });
            req.destroy();
        }
    });

    req.on('end', () => {
        if (aborted) return;
        res.status(200).json({ success: true, bytesReceived: received });
    });

    req.on('error', () => {
        if (!res.headersSent) res.status(400).json({ success: false, error: 'Upload failed.' });
    });
});

module.exports = router;
