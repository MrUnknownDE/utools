// backend/maxmind.js
const geoip = require('@maxmind/geoip2-node');
const pino = require('pino');
const Sentry = require("@sentry/node");

// Minimaler Logger für dieses Modul
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

let cityReaderInstance = null;
let asnReaderInstance = null;

async function initializeMaxMind() {
    if (cityReaderInstance && asnReaderInstance) {
        logger.debug('MaxMind databases already loaded.');
        return { cityReader: cityReaderInstance, asnReader: asnReaderInstance };
    }

    try {
        logger.info('Loading MaxMind databases...');
        const cityDbPath = process.env.GEOIP_CITY_DB || './data/GeoLite2-City.mmdb';
        const asnDbPath = process.env.GEOIP_ASN_DB || './data/GeoLite2-ASN.mmdb';
        logger.info({ cityDbPath, asnDbPath }, 'Database paths');

        // Verwende Promise.all für paralleles Laden
        const [cityReader, asnReader] = await Promise.all([
            geoip.Reader.open(cityDbPath),
            geoip.Reader.open(asnDbPath)
        ]);

        cityReaderInstance = cityReader;
        asnReaderInstance = asnReader;
        logger.info('MaxMind databases loaded successfully.');
        return { cityReader: cityReaderInstance, asnReader: asnReaderInstance };

    } catch (error) {
        logger.fatal({ error: error.message, stack: error.stack }, 'Could not initialize MaxMind databases.');
        Sentry.captureException(error);
        // Wirf den Fehler weiter, damit der Serverstart fehlschlägt
        throw error;
    }
}

// Funktion zum Abrufen der Reader (stellt sicher, dass sie initialisiert wurden)
function getMaxMindReaders() {
    if (!cityReaderInstance || !asnReaderInstance) {
        // Dieser Fall sollte im normalen Betrieb nicht auftreten, da initialize() beim Serverstart aufgerufen wird.
        logger.error('MaxMind readers accessed before initialization!');
        throw new Error('MaxMind readers not initialized. Call initializeMaxMind() first.');
    }
    return { cityReader: cityReaderInstance, asnReader: asnReaderInstance };
}

// @maxmind/geoip2-node's ReaderModel doesn't expose the underlying mmdb-lib
// Reader (and its `metadata.buildEpoch`) through any public API — `mmdbReader`
// is only TS-`private`, which is erased at runtime, so it's still a real
// accessible property. Wrapped defensively in case that internal shape
// changes on a future library upgrade.
function getBuildDate(readerModel) {
    try {
        const epoch = readerModel?.mmdbReader?.metadata?.buildEpoch;
        return epoch instanceof Date ? epoch : null;
    } catch {
        return null;
    }
}

function getMaxMindBuildDates() {
    const { cityReader, asnReader } = getMaxMindReaders();
    return {
        cityDbDate: getBuildDate(cityReader),
        asnDbDate: getBuildDate(asnReader),
    };
}

module.exports = {
    initializeMaxMind,
    getMaxMindReaders,
    getMaxMindBuildDates,
};