// server.js
require('dotenv').config(); // Lädt Variablen aus .env in process.env
const express = require('express');
const cors = require('cors');
const geoip = require('@maxmind/geoip2-node');
const net = require('net'); // Node.js built-in module for IP validation
const { spawn } = require('child_process');
const dns = require('dns').promises;
const pino = require('pino'); // Logging library
const rateLimit = require('express-rate-limit'); // Rate limiting middleware
const whois = require('whois-json'); // Hinzugefügt für WHOIS
const oui = require('oui'); // Ersetzt mac-lookup

// --- Logger Initialisierung ---
const logger = pino({
  level: process.env.LOG_LEVEL || 'info', // Konfigurierbares Log-Level (z.B. 'debug', 'info', 'warn', 'error')
  // Pretty print nur im Development, sonst JSON für bessere Maschinenlesbarkeit
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname' } }
    : undefined,
});

const app = express();
const PORT = process.env.PORT || 3000;

// --- Globale Variablen für MaxMind Reader ---
let cityReader;
let asnReader;

// --- Hilfsfunktionen ---

/**
 * Validiert eine IP-Adresse (v4 oder v6) mit Node.js' eingebautem net Modul.
 * @param {string} ip - Die zu validierende IP-Adresse.
 * @returns {boolean} True, wenn gültig (als v4 oder v6), sonst false.
 */
function isValidIp(ip) {
    if (!ip || typeof ip !== 'string' || ip.trim() === '') {
        return false;
    }
    const trimmedIp = ip.trim();
    const ipVersion = net.isIP(trimmedIp); // Gibt 0, 4 oder 6 zurück
    // logger.debug({ ip: trimmedIp, version: ipVersion }, 'isValidIp check'); // Optional: Debug log
    return ipVersion === 4 || ipVersion === 6;
}

/**
 * Prüft, ob eine IP-Adresse im privaten, Loopback- oder Link-Local-Bereich liegt.
 * @param {string} ip - Die zu prüfende IP-Adresse (bereits validiert).
 * @returns {boolean} True, wenn die IP privat/lokal ist, sonst false.
 */
function isPrivateIp(ip) {
    if (!ip) return false;
    const ipVersion = net.isIP(ip);

    if (ipVersion === 4) {
        const parts = ip.split('.').map(Number);
        return (
            parts[0] === 10 || // 10.0.0.0/8
            (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || // 172.16.0.0/12
            (parts[0] === 192 && parts[1] === 168) || // 192.168.0.0/16
            parts[0] === 127 || // 127.0.0.0/8 (Loopback)
            (parts[0] === 169 && parts[1] === 254) // 169.254.0.0/16 (Link-local)
        );
    } else if (ipVersion === 6) {
        const lowerCaseIp = ip.toLowerCase();
        return (
            lowerCaseIp === '::1' || // ::1/128 (Loopback)
            lowerCaseIp.startsWith('fc') || lowerCaseIp.startsWith('fd') || // fc00::/7 (Unique Local)
            lowerCaseIp.startsWith('fe8') || lowerCaseIp.startsWith('fe9') || // fe80::/10 (Link-local)
            lowerCaseIp.startsWith('fea') || lowerCaseIp.startsWith('feb')
        );
    }
    return false;
}

/**
 * Validiert einen Domainnamen (sehr einfache Prüfung).
 * @param {string} domain - Der zu validierende Domainname.
 * @returns {boolean} True, wenn wahrscheinlich gültig, sonst false.
 */
function isValidDomain(domain) {
    if (!domain || typeof domain !== 'string' || domain.trim().length < 3) {
        return false;
    }
    // Einfache Regex: Muss mindestens einen Punkt enthalten und keine ungültigen Zeichen.
    // Erlaubt IDNs (Internationalized Domain Names) durch \p{L}
    const domainRegex = /^(?:[a-z0-9\p{L}](?:[a-z0-9\p{L}-]{0,61}[a-z0-9\p{L}])?\.)+[a-z0-9\p{L}][a-z0-9\p{L}-]{0,61}[a-z0-9\p{L}]$/iu;
    return domainRegex.test(domain.trim());
}

/**
 * Validiert eine MAC-Adresse.
 * @param {string} mac - Die zu validierende MAC-Adresse.
 * @returns {boolean} True, wenn gültig, sonst false.
 */
function isValidMac(mac) {
    if (!mac || typeof mac !== 'string') {
        return false;
    }
    // Erlaubt Formate wie 00:1A:2B:3C:4D:5E, 00-1A-2B-3C-4D-5E, 001A.2B3C.4D5E
    // oui() validiert intern, aber eine Vorabprüfung schadet nicht.
    const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$|^([0-9A-Fa-f]{4}\.){2}([0-9A-Fa-f]{4})$/;
    return macRegex.test(mac.trim());
}


/**
 * Bereinigt eine IP-Adresse (z.B. entfernt ::ffff: Präfix von IPv4-mapped IPv6).
 * Verwendet net.isIP zur Validierung.
 * @param {string} ip - Die IP-Adresse.
 * @returns {string} Die bereinigte IP-Adresse.
 */
function getCleanIp(ip) {
    if (!ip) return ip;
    const trimmedIp = ip.trim();
    if (trimmedIp.startsWith('::ffff:')) {
        const potentialIp4 = trimmedIp.substring(7);
        if (net.isIP(potentialIp4) === 4) {
            return potentialIp4;
        }
    }
    if (trimmedIp === '::1' || trimmedIp === '127.0.0.1') {
        return trimmedIp;
    }
    return trimmedIp;
}

/**
 * Führt einen Shell-Befehl sicher aus und gibt stdout zurück. (Nur für Ping verwendet)
 * @param {string} command - Der Befehl (z.B. 'ping').
 * @param {string[]} args - Die Argumente als Array.
 * @returns {Promise<string>} Eine Promise, die mit stdout aufgelöst wird.
 */
function executeCommand(command, args) {
    return new Promise((resolve, reject) => {
        args.forEach(arg => {
            if (typeof arg === 'string' && /[;&|`$()<>]/.test(arg)) {
                logger.error({ command, arg }, "Potential command injection attempt detected in argument");
                return reject(new Error(`Invalid character detected in command argument.`));
            }
        });

        const proc = spawn(command, args);
        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data) => { stdout += data.toString(); });
        proc.stderr.on('data', (data) => { stderr += data.toString(); });
        proc.on('error', (err) => {
            logger.error({ command, args, error: err.message }, `Failed to start command`);
            reject(new Error(`Failed to start command ${command}: ${err.message}`));
        });
        proc.on('close', (code) => {
            if (code !== 0) {
                logger.error({ command, args, exitCode: code, stderr: stderr.trim(), stdout: stdout.trim() }, `Command failed`);
                reject(new Error(`Command ${command} failed with code ${code}: ${stderr || 'No stderr output'}`));
            } else {
                resolve(stdout);
            }
        });
    });
}

/**
 * Parst die Ausgabe des Linux/macOS ping Befehls.
 * @param {string} pingOutput - Die rohe stdout Ausgabe von ping.
 * @returns {object} Ein Objekt mit geparsten Daten oder Fehlern.
 */
function parsePingOutput(pingOutput) {
    const result = {
        rawOutput: pingOutput,
        stats: null,
        error: null,
    };

    try {
        let packetsTransmitted = 0;
        let packetsReceived = 0;
        let packetLossPercent = 100;
        let rtt = { min: null, avg: null, max: null, mdev: null };

        const lines = pingOutput.trim().split('\n');
        const statsLine = lines.find(line => line.includes('packets transmitted'));
        if (statsLine) {
            const transmittedMatch = statsLine.match(/(\d+)\s+packets transmitted/);
            const receivedMatch = statsLine.match(/(\d+)\s+(?:received|packets received)/); // Anpassung für Varianten
            const lossMatch = statsLine.match(/([\d.]+)%\s+packet loss/);
            if (transmittedMatch) packetsTransmitted = parseInt(transmittedMatch[1], 10);
            if (receivedMatch) packetsReceived = parseInt(receivedMatch[1], 10);
            if (lossMatch) packetLossPercent = parseFloat(lossMatch[1]);
        }

        const rttLine = lines.find(line => line.startsWith('rtt min/avg/max/mdev') || line.startsWith('round-trip min/avg/max/stddev'));
         if (rttLine) {
            const rttMatch = rttLine.match(/([\d.]+)\/([\d.]+)\/([\d.]+)\/([\d.]+)/);
            if (rttMatch) {
                rtt = {
                    min: parseFloat(rttMatch[1]),
                    avg: parseFloat(rttMatch[2]),
                    max: parseFloat(rttMatch[3]),
                    mdev: parseFloat(rttMatch[4]),
                };
            }
        }

        result.stats = {
            packets: { transmitted: packetsTransmitted, received: packetsReceived, lossPercent: packetLossPercent },
            rtt: rtt.avg !== null ? rtt : null,
        };
        if (packetsTransmitted > 0 && rtt.avg === null && packetsReceived === 0) {
             result.error = "Request timed out or host unreachable."; // Spezifischer Fehler bei Totalausfall
        }

    } catch (parseError) {
        logger.error({ error: parseError.message, output: pingOutput }, "Failed to parse ping output");
        result.error = "Failed to parse ping output.";
    }
    return result;
}

/**
 * Parst eine einzelne Zeile der Linux/macOS traceroute Ausgabe.
 * @param {string} line - Eine Zeile aus stdout.
 * @returns {object | null} Ein Objekt mit Hop-Daten oder null bei uninteressanten Zeilen.
 */
function parseTracerouteLine(line) {
    line = line.trim();
    if (!line || line.startsWith('traceroute to')) return null; // Ignoriere Header

    // Regex angepasst für mehr Robustheit (optionaler Hostname, IP immer da, RTTs oder *)
    const hopMatch = line.match(/^(\s*\d+)\s+(?:([a-zA-Z0-9\.\-]+)\s+\(([\d\.:a-fA-F]+)\)|([\d\.:a-fA-F]+))\s+(.*)$/);
    const timeoutMatch = line.match(/^(\s*\d+)\s+(\*\s+\*\s+\*)/);

    if (timeoutMatch) {
         return {
            hop: parseInt(timeoutMatch[1].trim(), 10),
            hostname: null,
            ip: null,
            rtt: ['*', '*', '*'],
            rawLine: line,
        };
    } else if (hopMatch) {
        const hop = parseInt(hopMatch[1].trim(), 10);
        const hostname = hopMatch[2]; // Kann undefined sein
        const ipInParen = hopMatch[3]; // Kann undefined sein
        const ipDirect = hopMatch[4]; // Kann undefined sein
        const restOfLine = hopMatch[5].trim();

        const ip = ipInParen || ipDirect;

        // Extrahiere RTTs (können * sein oder Zahl mit " ms")
        const rttParts = restOfLine.split(/\s+/);
        const rtts = rttParts.map(p => p === '*' ? '*' : p.replace(/\s*ms$/, '')).filter(p => p === '*' || !isNaN(parseFloat(p))).slice(0, 3);
        // Fülle fehlende RTTs mit '*' auf, falls weniger als 3 gefunden wurden
        while (rtts.length < 3) rtts.push('*');

         return {
            hop: hop,
            hostname: hostname || null, // Setze null, wenn kein Hostname gefunden
            ip: ip,
            rtt: rtts,
            rawLine: line,
        };
    }
    // logger.debug({ line }, "Unparsed traceroute line"); // Optional: Log unparsed lines
    return null; // Nicht als Hop-Zeile erkannt
}


// --- Initialisierung (MaxMind DBs laden) ---
async function initialize() {
    try {
        logger.info('Loading MaxMind databases...');
        const cityDbPath = process.env.GEOIP_CITY_DB || './data/GeoLite2-City.mmdb';
        const asnDbPath = process.env.GEOIP_ASN_DB || './data/GeoLite2-ASN.mmdb';
        logger.info({ cityDbPath, asnDbPath }, 'Database paths');
        cityReader = await geoip.Reader.open(cityDbPath);
        asnReader = await geoip.Reader.open(asnDbPath);
        logger.info('MaxMind databases loaded successfully.');

        // Kein explizites Laden mehr für 'oui' nötig.
        // Die Daten werden bei der ersten Verwendung automatisch geladen/aktualisiert.
        logger.info('MAC address lookup data (oui) will be loaded on first use.');

    } catch (error) {
        logger.fatal({ error: error.message, stack: error.stack }, 'Could not initialize MaxMind databases. Exiting.');
        process.exit(1);
    }
}

// --- Middleware ---
app.use(cors()); // Erlaubt Anfragen von anderen Origins
app.use(express.json()); // Parst JSON-Request-Bodies

// Vertraue Proxy-Headern (vorsichtig verwenden!)
app.set('trust proxy', 2); // Vertraue zwei Proxys (externer Nginx + interner Nginx)

// Rate Limiter
const generalLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 Minuten
    max: process.env.NODE_ENV === 'production' ? 20 : 200, // Mehr Anfragen im Dev erlauben
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests from this IP, please try again after 5 minutes' },
    keyGenerator: (req, res) => req.ip || req.socket.remoteAddress, // IP des Clients als Schlüssel
    handler: (req, res, next, options) => {
        logger.warn({ ip: req.ip || req.socket.remoteAddress, route: req.originalUrl }, 'Rate limit exceeded');
        res.status(options.statusCode).send(options.message);
    }
});

// Wende Limiter auf alle API-Routen an (außer /api/version und /api/ipinfo)
app.use('/api/ping', generalLimiter);
app.use('/api/traceroute', generalLimiter);
app.use('/api/lookup', generalLimiter);
app.use('/api/dns-lookup', generalLimiter);
app.use('/api/whois-lookup', generalLimiter);
app.use('/api/mac-lookup', generalLimiter);


// --- Routen ---

// Haupt-Endpunkt: Liefert alle Infos zur IP des Clients
app.get('/api/ipinfo', async (req, res) => {
    const requestIp = req.ip || req.socket.remoteAddress; // req.ip berücksichtigt 'trust proxy'
    logger.info({ ip: requestIp, method: req.method, url: req.originalUrl }, 'ipinfo request received');

    const clientIp = getCleanIp(requestIp);
    logger.debug({ rawIp: requestIp, cleanedIp: clientIp }, 'IP cleaning result');

    if (!clientIp || !isValidIp(clientIp)) {
         if (clientIp === '127.0.0.1' || clientIp === '::1') {
             logger.info({ ip: clientIp }, 'Responding with localhost info');
             return res.json({
                 ip: clientIp,
                 geo: { note: 'Localhost IP, no Geo data available.' },
                 asn: { note: 'Localhost IP, no ASN data available.' },
                 rdns: ['localhost'],
             });
         }
        logger.error({ rawIp: requestIp, cleanedIp: clientIp }, 'Could not determine a valid client IP');
        return res.status(400).json({ error: 'Could not determine a valid client IP address.', rawIp: requestIp, cleanedIp: clientIp });
    }

    try {
        let geo = null;
        try {
            const geoData = cityReader.city(clientIp);
            geo = {
                city: geoData.city?.names?.en,
                region: geoData.subdivisions?.[0]?.isoCode,
                country: geoData.country?.isoCode,
                countryName: geoData.country?.names?.en,
                postalCode: geoData.postal?.code,
                latitude: geoData.location?.latitude,
                longitude: geoData.location?.longitude,
                timezone: geoData.location?.timeZone,
            };
            geo = Object.fromEntries(Object.entries(geo).filter(([_, v]) => v != null)); // Entferne leere Werte
            logger.debug({ ip: clientIp, geo }, 'GeoIP lookup successful');
        } catch (e) {
            logger.warn({ ip: clientIp, error: e.message }, `MaxMind City lookup failed`);
            geo = { error: 'GeoIP lookup failed (IP not found in database or private range).' };
         }

        let asn = null;
        try {
            const asnData = asnReader.asn(clientIp);
            asn = {
                number: asnData.autonomousSystemNumber,
                organization: asnData.autonomousSystemOrganization,
            };
             asn = Object.fromEntries(Object.entries(asn).filter(([_, v]) => v != null)); // Entferne leere Werte
             logger.debug({ ip: clientIp, asn }, 'ASN lookup successful');
        } catch (e) {
            logger.warn({ ip: clientIp, error: e.message }, `MaxMind ASN lookup failed`);
            asn = { error: 'ASN lookup failed (IP not found in database or private range).' };
        }

        let rdns = null;
        try {
            const hostnames = await dns.reverse(clientIp);
            rdns = hostnames;
            logger.debug({ ip: clientIp, rdns }, 'rDNS lookup successful');
        } catch (e) {
            if (e.code !== 'ENOTFOUND' && e.code !== 'ENODATA') {
                logger.warn({ ip: clientIp, error: e.message, code: e.code }, `rDNS lookup error`);
            } else {
                 logger.debug({ ip: clientIp, code: e.code }, 'rDNS lookup failed (No record)');
            }
            rdns = { error: `rDNS lookup failed (${e.code || 'Unknown error'})` };
         }

        res.json({
            ip: clientIp,
            geo: geo.error ? geo : (Object.keys(geo).length > 0 ? geo : null),
            asn: asn.error ? asn : (Object.keys(asn).length > 0 ? asn : null),
            rdns
        });

    } catch (error) {
        logger.error({ ip: clientIp, error: error.message, stack: error.stack }, 'Error processing ipinfo');
        res.status(500).json({ error: 'Internal server error while processing IP information.' });
    }
});

// Ping Endpunkt
app.get('/api/ping', async (req, res) => {
    const targetIpRaw = req.query.targetIp;
    const targetIp = typeof targetIpRaw === 'string' ? targetIpRaw.trim() : targetIpRaw;
    const requestIp = req.ip || req.socket.remoteAddress;

    logger.info({ requestIp, targetIp }, 'Ping request received');

    if (!isValidIp(targetIp)) {
        logger.warn({ requestIp, targetIp }, 'Invalid target IP for ping');
        return res.status(400).json({ error: 'Invalid target IP address provided.' });
    }

    if (isPrivateIp(targetIp)) {
        logger.warn({ requestIp, targetIp }, 'Attempt to ping private IP blocked');
        return res.status(403).json({ error: 'Operations on private or local IP addresses are not allowed.' });
    }

    try {
        const pingCount = process.env.PING_COUNT || '4';
        const countArg = parseInt(pingCount, 10) || 4;
        const args = ['-c', `${countArg}`, targetIp]; // Linux/macOS
        const command = 'ping';

        logger.info({ requestIp, targetIp, command: `${command} ${args.join(' ')}` }, 'Executing ping');
        const output = await executeCommand(command, args);
        const parsedResult = parsePingOutput(output);

        logger.info({ requestIp, targetIp, stats: parsedResult.stats }, 'Ping successful');
        res.json({ success: true, ...parsedResult });

    } catch (error) {
        // executeCommand loggt bereits Details
        logger.error({ requestIp, targetIp, error: error.message }, 'Ping command failed');
        // Sende strukturierte Fehlermeldung, wenn möglich
        const parsedError = parsePingOutput(error.message); // Versuche, Fehler aus Ping-Output zu parsen
        res.status(500).json({
             success: false,
             error: `Ping command failed: ${parsedError.error || error.message}`,
             rawOutput: parsedError.rawOutput || error.message
        });
    }
});

// Traceroute Endpunkt (Server-Sent Events)
app.get('/api/traceroute', (req, res) => { // Beachte: nicht async, da wir streamen
    const targetIpRaw = req.query.targetIp;
    const targetIp = typeof targetIpRaw === 'string' ? targetIpRaw.trim() : targetIpRaw;
    const requestIp = req.ip || req.socket.remoteAddress;

    logger.info({ requestIp, targetIp }, 'Traceroute stream request received');

    if (!isValidIp(targetIp)) {
        logger.warn({ requestIp, targetIp }, 'Invalid target IP for traceroute');
        return res.status(400).json({ error: 'Invalid target IP address provided.' });
    }

    if (isPrivateIp(targetIp)) {
        logger.warn({ requestIp, targetIp }, 'Attempt to traceroute private IP blocked');
        return res.status(403).json({ error: 'Operations on private or local IP addresses are not allowed.' });
    }

    try {
        logger.info({ requestIp, targetIp }, `Starting traceroute stream...`);

        // Set SSE Headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no'); // Wichtig für Nginx-Proxies
        res.flushHeaders(); // Send headers immediately

        const args = ['-n', targetIp]; // Linux/macOS, -n für keine Namensauflösung (schneller)
        const command = 'traceroute';
        const proc = spawn(command, args);
        logger.info({ requestIp, targetIp, command: `${command} ${args.join(' ')}` }, 'Spawned traceroute process');

        let buffer = ''; // Buffer für unvollständige Zeilen

        const sendEvent = (event, data) => {
            try {
                res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
            } catch (e) {
                logger.error({ requestIp, targetIp, event, error: e.message }, "Error writing to SSE stream (client likely disconnected)");
                proc.kill(); // Beende Prozess, wenn Schreiben fehlschlägt
                if (!res.writableEnded) res.end();
            }
        };

        proc.stdout.on('data', (data) => {
            buffer += data.toString();
            let lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Letzte (evtl. unvollständige) Zeile zurück in den Buffer

            lines.forEach(line => {
                const parsed = parseTracerouteLine(line);
                if (parsed) {
                    logger.debug({ requestIp, targetIp, hop: parsed.hop, ip: parsed.ip }, 'Sending hop data');
                    sendEvent('hop', parsed);
                } else if (line.trim()) {
                     logger.debug({ requestIp, targetIp, message: line.trim() }, 'Sending info data');
                     sendEvent('info', { message: line.trim() });
                }
            });
        });

        proc.stderr.on('data', (data) => {
            const errorMsg = data.toString().trim();
            logger.warn({ requestIp, targetIp, stderr: errorMsg }, 'Traceroute stderr output');
            sendEvent('error', { error: errorMsg });
        });

        proc.on('error', (err) => {
            logger.error({ requestIp, targetIp, error: err.message }, `Failed to start traceroute command`);
            sendEvent('error', { error: `Failed to start traceroute: ${err.message}` });
            if (!res.writableEnded) res.end();
        });

        proc.on('close', (code) => {
            if (buffer) { // Verarbeite letzte Zeile im Buffer
                 const parsed = parseTracerouteLine(buffer);
                 if (parsed) {
                     sendEvent('hop', parsed);
                 } else if (buffer.trim()) {
                     sendEvent('info', { message: buffer.trim() });
                 }
            }

            if (code !== 0) {
                logger.error({ requestIp, targetIp, exitCode: code }, `Traceroute command finished with error code ${code}`);
                sendEvent('error', { error: `Traceroute command failed with exit code ${code}` });
            } else {
                logger.info({ requestIp, targetIp }, `Traceroute stream completed successfully.`);
            }
             sendEvent('end', { exitCode: code });
             if (!res.writableEnded) res.end();
        });

        // Handle client disconnect
        req.on('close', () => {
            logger.info({ requestIp, targetIp }, 'Client disconnected from traceroute stream, killing process.');
            if (!proc.killed) {
                proc.kill();
            }
            if (!res.writableEnded) res.end();
        });

    } catch (error) {
        // Dieser Catch ist eher für synchrone Fehler vor dem Spawn
        logger.error({ requestIp, targetIp, error: error.message, stack: error.stack }, 'Error setting up traceroute stream');
        if (!res.headersSent) {
             res.status(500).json({ success: false, error: `Failed to initiate traceroute: ${error.message}` });
        } else {
             // Wenn Header gesendet wurden, können wir nur noch versuchen, einen Fehler zu schreiben und zu beenden
             try {
                 if (!res.writableEnded) {
                    res.write(`event: error\ndata: ${JSON.stringify({ error: `Internal server error: ${error.message}` })}\n\n`);
                    res.end();
                 }
             } catch (e) { logger.error({ requestIp, targetIp, error: e.message }, "Error writing final error to SSE stream"); }
        }
    }
}); // Ende von app.get('/api/traceroute'...)


// Lookup Endpunkt für beliebige IP (GeoIP, ASN, rDNS)
app.get('/api/lookup', async (req, res) => {
    const targetIpRaw = req.query.targetIp; // IP kommt jetzt als Query-Parameter 'targetIp'
    const targetIp = typeof targetIpRaw === 'string' ? targetIpRaw.trim() : targetIpRaw;
    const requestIp = req.ip || req.socket.remoteAddress; // Nur für Logging

    logger.info({ requestIp, targetIp }, 'Lookup request received');

    // Validierung: Ist es eine gültige IP?
    if (!isValidIp(targetIp)) {
        logger.warn({ requestIp, targetIp }, 'Invalid target IP for lookup');
        return res.status(400).json({ error: 'Invalid IP address provided for lookup.' });
    }

    // Validierung: Ist es eine private IP?
    if (isPrivateIp(targetIp)) {
        logger.warn({ requestIp, targetIp }, 'Attempt to lookup private IP blocked');
        return res.status(403).json({ error: 'Lookup for private or local IP addresses is not supported.' });
    }

    // Führe die gleichen Lookups wie bei /api/ipinfo durch, aber für targetIp
    try {
        let geo = null;
        try {
            const geoData = cityReader.city(targetIp);
            geo = {
                city: geoData.city?.names?.en,
                region: geoData.subdivisions?.[0]?.isoCode,
                country: geoData.country?.isoCode,
                countryName: geoData.country?.names?.en,
                postalCode: geoData.postal?.code,
                latitude: geoData.location?.latitude,
                longitude: geoData.location?.longitude,
                timezone: geoData.location?.timeZone,
            };
            geo = Object.fromEntries(Object.entries(geo).filter(([_, v]) => v != null));
            logger.debug({ targetIp, geo }, 'GeoIP lookup successful for lookup');
        } catch (e) {
            logger.warn({ targetIp, error: e.message }, `MaxMind City lookup failed for lookup`);
            geo = { error: 'GeoIP lookup failed (IP not found in database or private range).' };
         }

        let asn = null;
        try {
            const asnData = asnReader.asn(targetIp);
            asn = {
                number: asnData.autonomousSystemNumber,
                organization: asnData.autonomousSystemOrganization,
            };
             asn = Object.fromEntries(Object.entries(asn).filter(([_, v]) => v != null));
             logger.debug({ targetIp, asn }, 'ASN lookup successful for lookup');
        } catch (e) {
            logger.warn({ targetIp, error: e.message }, `MaxMind ASN lookup failed for lookup`);
            asn = { error: 'ASN lookup failed (IP not found in database or private range).' };
        }

        let rdns = null;
        try {
            const hostnames = await dns.reverse(targetIp);
            rdns = hostnames;
            logger.debug({ targetIp, rdns }, 'rDNS lookup successful for lookup');
        } catch (e) {
            if (e.code !== 'ENOTFOUND' && e.code !== 'ENODATA') {
                logger.warn({ targetIp, error: e.message, code: e.code }, `rDNS lookup error for lookup`);
            } else {
                 logger.debug({ targetIp, code: e.code }, 'rDNS lookup failed (No record) for lookup');
            }
            rdns = { error: `rDNS lookup failed (${e.code || 'Unknown error'})` };
         }

        // Gib die gesammelten Daten zurück
        res.json({
            ip: targetIp,
            geo: geo.error ? geo : (Object.keys(geo).length > 0 ? geo : null),
            asn: asn.error ? asn : (Object.keys(asn).length > 0 ? asn : null),
            rdns,
        });

    } catch (error) {
        logger.error({ targetIp, error: error.message, stack: error.stack }, 'Error processing lookup');
        res.status(500).json({ error: 'Internal server error while processing lookup.' });
    }
});

// --- NEUE ENDPUNKTE ---

// DNS Lookup Endpunkt
app.get('/api/dns-lookup', async (req, res) => {
    const domainRaw = req.query.domain;
    const domain = typeof domainRaw === 'string' ? domainRaw.trim() : domainRaw;
    const typeRaw = req.query.type;
    const type = typeof typeRaw === 'string' ? typeRaw.trim().toUpperCase() : 'ANY';
    const requestIp = req.ip || req.socket.remoteAddress;

    logger.info({ requestIp, domain, type }, 'DNS lookup request received');

    if (!isValidDomain(domain)) {
        logger.warn({ requestIp, domain }, 'Invalid domain for DNS lookup');
        return res.status(400).json({ success: false, error: 'Invalid domain name provided.' });
    }

    const validTypes = ['A', 'AAAA', 'MX', 'TXT', 'NS', 'CNAME', 'SOA', 'SRV', 'PTR', 'ANY'];
    if (!validTypes.includes(type)) {
        logger.warn({ requestIp, domain, type }, 'Invalid record type for DNS lookup');
        return res.status(400).json({ success: false, error: `Invalid record type provided. Valid types are: ${validTypes.join(', ')}` });
    }

    try {
        // dns.resolve unterstützt 'ANY', aber gibt oft nur einen Teil zurück oder wirft Fehler.
        // Besser spezifische Typen abfragen oder dns.resolveAny verwenden (wenn verfügbar und gewünscht).
        // Für Einfachheit hier dns.resolve.
        let records;
        if (type === 'ANY') {
            // Versuche, gängige Typen einzeln abzufragen, da resolveAny oft nicht wie erwartet funktioniert
            const promises = [
                dns.resolve(domain, 'A').catch(() => []),
                dns.resolve(domain, 'AAAA').catch(() => []),
                dns.resolve(domain, 'MX').catch(() => []),
                dns.resolve(domain, 'TXT').catch(() => []),
                dns.resolve(domain, 'NS').catch(() => []),
                dns.resolve(domain, 'CNAME').catch(() => []),
                dns.resolve(domain, 'SOA').catch(() => []),
            ];
            const results = await Promise.all(promises);
            records = {
                A: results[0],
                AAAA: results[1],
                MX: results[2],
                TXT: results[3],
                NS: results[4],
                CNAME: results[5],
                SOA: results[6],
            };
            // Entferne leere Ergebnisse
            records = Object.fromEntries(Object.entries(records).filter(([_, v]) => Array.isArray(v) ? v.length > 0 : v));
        } else {
            records = await dns.resolve(domain, type);
        }

        logger.info({ requestIp, domain, type }, 'DNS lookup successful');
        res.json({ success: true, domain, type, records });

    } catch (error) {
        logger.error({ requestIp, domain, type, error: error.message, code: error.code }, 'DNS lookup failed');
        res.status(500).json({ success: false, error: `DNS lookup failed: ${error.message} (Code: ${error.code})` });
    }
});

// WHOIS Lookup Endpunkt
app.get('/api/whois-lookup', async (req, res) => {
    const queryRaw = req.query.query;
    const query = typeof queryRaw === 'string' ? queryRaw.trim() : queryRaw;
    const requestIp = req.ip || req.socket.remoteAddress;

    logger.info({ requestIp, query }, 'WHOIS lookup request received');

    // Einfache Validierung: Muss entweder eine gültige IP oder eine Domain sein
    if (!isValidIp(query) && !isValidDomain(query)) {
        logger.warn({ requestIp, query }, 'Invalid query for WHOIS lookup');
        return res.status(400).json({ success: false, error: 'Invalid domain name or IP address provided for WHOIS lookup.' });
    }

    try {
        // whois-json kann manchmal sehr lange dauern oder fehlschlagen
        const result = await whois(query, { timeout: 10000 }); // 10 Sekunden Timeout

        logger.info({ requestIp, query }, 'WHOIS lookup successful');
        res.json({ success: true, query, result });

    } catch (error) {
        logger.error({ requestIp, query, error: error.message }, 'WHOIS lookup failed');
        // Versuche, eine spezifischere Fehlermeldung zu geben
        let errorMessage = error.message;
        if (error.message.includes('ETIMEDOUT') || error.message.includes('ESOCKETTIMEDOUT')) {
            errorMessage = 'WHOIS server timed out.';
        } else if (error.message.includes('ENOTFOUND')) {
             errorMessage = 'Domain or IP not found or WHOIS server unavailable.';
        }
        res.status(500).json({ success: false, error: `WHOIS lookup failed: ${errorMessage}` });
    }
});

// MAC Address Lookup Endpunkt (mit 'oui' Bibliothek)
app.get('/api/mac-lookup', async (req, res) => { // async ist hier nicht unbedingt nötig, aber schadet nicht
    const macRaw = req.query.mac;
    const mac = typeof macRaw === 'string' ? macRaw.trim() : macRaw;
    const requestIp = req.ip || req.socket.remoteAddress;

    logger.info({ requestIp, mac }, 'MAC lookup request received');

    if (!isValidMac(mac)) { // Vorabprüfung beibehalten
        logger.warn({ requestIp, mac }, 'Invalid MAC address format for lookup');
        return res.status(400).json({ success: false, error: 'Invalid MAC address format provided.' });
    }

    try {
        // oui() lädt die DB bei Bedarf und gibt den Vendor-String oder null zurück
        const vendor = oui(mac); // Einfacher Aufruf

        if (vendor) {
            logger.info({ requestIp, mac, vendor }, 'MAC lookup successful');
            res.json({ success: true, mac, vendor });
        } else {
            logger.info({ requestIp, mac }, 'MAC lookup successful, but no vendor found');
            res.json({ success: true, mac, vendor: null, message: 'Vendor not found for this MAC address prefix.' });
        }

    } catch (error) {
        // Fehler können auftreten, wenn die interne DB nicht geladen werden kann
        // oder die Eingabe trotz Regex ungültig ist (sollte selten sein)
        logger.error({ requestIp, mac, error: error.message }, 'MAC lookup failed');
        res.status(500).json({ success: false, error: `MAC lookup failed: ${error.message}` });
    }
});


// Version Endpunkt
app.get('/api/version', (req, res) => {
    const commitSha = process.env.GIT_COMMIT_SHA || 'unknown';
    logger.info({ commitSha }, 'Version request received');
    res.json({ commitSha });
});


// --- Server starten ---
initialize().then(() => {
    app.listen(PORT, () => {
        logger.info({ port: PORT, node_env: process.env.NODE_ENV || 'development' }, `Server listening`);
        logger.info(`API endpoints available at:`);
        logger.info(`  http://localhost:${PORT}/api/ipinfo`);
        logger.info(`  http://localhost:${PORT}/api/ping?targetIp=<ip>`);
        logger.info(`  http://localhost:${PORT}/api/traceroute?targetIp=<ip>`);
        logger.info(`  http://localhost:${PORT}/api/lookup?targetIp=<ip>`);
        logger.info(`  http://localhost:${PORT}/api/dns-lookup?domain=<domain>&type=<type>`);
        logger.info(`  http://localhost:${PORT}/api/whois-lookup?query=<domain_or_ip>`);
        logger.info(`  http://localhost:${PORT}/api/mac-lookup?mac=<mac_address>`);
        logger.info(`  http://localhost:${PORT}/api/version`);
    });
}).catch(error => {
    // Fehler bei der Initialisierung wurde bereits geloggt.
    logger.fatal("Server could not start due to initialization errors.");
    process.exit(1); // Beenden bei schwerwiegendem Startfehler
});

// Graceful Shutdown Handling (optional aber gut für Produktion)
const signals = { 'SIGINT': 2, 'SIGTERM': 15 };
Object.keys(signals).forEach((signal) => {
  process.on(signal, () => {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    // Hier könnten noch Aufräumarbeiten stattfinden (z.B. DB-Verbindungen schließen)
    process.exit(128 + signals[signal]);
  });
});