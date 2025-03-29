// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const geoip = require('@maxmind/geoip2-node');
const net = require('net'); // Node.js built-in module for IP validation
const { spawn } = require('child_process');
const dns = require('dns').promises;

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
    // Frühe Prüfung auf offensichtlich ungültige Werte
    if (!ip || typeof ip !== 'string' || ip.trim() === '') {
        // console.log(`isValidIp (net): Input invalid`); // Optional Debugging
        return false;
    }
    const trimmedIp = ip.trim();

    // net.isIP(trimmedIp) gibt 0 zurück, wenn ungültig, 4 für IPv4, 6 für IPv6.
    const ipVersion = net.isIP(trimmedIp);

    // console.log(`isValidIp (net): net.isIP check for "${trimmedIp}": Version ${ipVersion}`); // Optional Debugging

    return ipVersion === 4 || ipVersion === 6;
}


/**
 * Bereinigt eine IP-Adresse (z.B. entfernt ::ffff: Präfix von IPv4-mapped IPv6).
 * Verwendet net.isIP zur Validierung.
 * @param {string} ip - Die IP-Adresse.
 * @returns {string} Die bereinigte IP-Adresse.
 */
function getCleanIp(ip) {
    if (!ip) return ip; // Handle null/undefined case

    const trimmedIp = ip.trim(); // Trimmen für Konsistenz

    if (trimmedIp.startsWith('::ffff:')) {
        const potentialIp4 = trimmedIp.substring(7);
        // Prüfen, ob der extrahierte Teil eine gültige IPv4 ist
        if (net.isIP(potentialIp4) === 4) {
            return potentialIp4;
        }
    }
    // Handle localhost cases for testing
    if (trimmedIp === '::1' || trimmedIp === '127.0.0.1') {
        return trimmedIp;
    }
    return trimmedIp; // Gib die getrimmte IP zurück
}

/**
 * Führt einen Shell-Befehl sicher aus und gibt stdout zurück.
 * @param {string} command - Der Befehl (z.B. 'ping').
 * @param {string[]} args - Die Argumente als Array.
 * @returns {Promise<string>} Eine Promise, die mit stdout aufgelöst wird.
 */
function executeCommand(command, args) {
    return new Promise((resolve, reject) => {
        // Argumenten-Validierung (einfach)
        args.forEach(arg => {
            if (typeof arg === 'string' && /[;&|`$()<>]/.test(arg)) {
                console.error(`Potential command injection attempt detected in argument: ${arg}`);
                return reject(new Error(`Invalid character detected in command argument.`));
            }
        });

        const proc = spawn(command, args);
        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data) => { stdout += data.toString(); });
        proc.stderr.on('data', (data) => { stderr += data.toString(); });
        proc.on('error', (err) => {
            console.error(`Failed to start command ${command}: ${err.message}`);
            reject(new Error(`Failed to start command ${command}: ${err.message}`));
        });
        proc.on('close', (code) => {
            if (code !== 0) {
                console.error(`Command ${command} ${args.join(' ')} failed with code ${code}: ${stderr || stdout}`);
                reject(new Error(`Command ${command} failed with code ${code}: ${stderr || 'No stderr output'}`));
            } else {
                resolve(stdout);
            }
        });
    });
}


/**
 * Prüft, ob eine IP-Adresse im privaten, Loopback- oder Link-Local-Bereich liegt.
 * @param {string} ip - Die zu prüfende IP-Adresse (bereits validiert).
 * @returns {boolean} True, wenn die IP privat/lokal ist, sonst false.
 */
function isPrivateIp(ip) {
    if (!ip) return false; // Sollte durch isValidIp vorher abgefangen werden

    const ipVersion = net.isIP(ip); // Gibt 4 oder 6 zurück

    if (ipVersion === 4) {
        const parts = ip.split('.').map(Number);
        return (
            // 10.0.0.0/8
            parts[0] === 10 ||
            // 172.16.0.0/12
            (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
            // 192.168.0.0/16
            (parts[0] === 192 && parts[1] === 168) ||
            // 127.0.0.0/8 (Loopback)
            parts[0] === 127 ||
            // 169.254.0.0/16 (Link-local)
            (parts[0] === 169 && parts[1] === 254)
        );
    } else if (ipVersion === 6) {
        const lowerCaseIp = ip.toLowerCase();
        return (
            // ::1/128 (Loopback)
            lowerCaseIp === '::1' ||
            // fc00::/7 (Unique Local Addresses)
            lowerCaseIp.startsWith('fc') || lowerCaseIp.startsWith('fd') ||
            // fe80::/10 (Link-local)
            lowerCaseIp.startsWith('fe8') || lowerCaseIp.startsWith('fe9') ||
            lowerCaseIp.startsWith('fea') || lowerCaseIp.startsWith('feb')
        );
    }

    // Wenn net.isIP 0 zurückgibt (sollte nicht passieren nach isValidIp)
    return false;
}

// --- Initialisierung (MaxMind DBs laden) ---
async function initialize() {
    try {
        console.log('Loading MaxMind databases...');
        const cityDbPath = process.env.GEOIP_CITY_DB || './data/GeoLite2-City.mmdb';
        const asnDbPath = process.env.GEOIP_ASN_DB || './data/GeoLite2-ASN.mmdb';
        console.log(`City DB Path: ${cityDbPath}`);
        console.log(`ASN DB Path: ${asnDbPath}`);
        cityReader = await geoip.Reader.open(cityDbPath);
        asnReader = await geoip.Reader.open(asnDbPath);
        console.log('MaxMind databases loaded successfully.');
    } catch (error) {
        console.error('FATAL: Could not load MaxMind databases.');
        console.error('Ensure GEOIP_CITY_DB and GEOIP_ASN_DB point to valid .mmdb files in the ./data directory or via .env');
        console.error(error);
        process.exit(1);
    }
}

// --- Middleware ---
app.use(cors());
app.use(express.json());
// app.set('trust proxy', true); // Nur aktivieren, wenn nötig und korrekt konfiguriert

// --- Routen ---

// Haupt-Endpunkt: Liefert alle Infos zur IP des Clients
app.get('/api/ipinfo', async (req, res) => {
    console.log(`ipinfo request: req.ip = ${req.ip}, req.socket.remoteAddress = ${req.socket.remoteAddress}`);
    const clientIpRaw = req.ip || req.socket.remoteAddress;
    const clientIp = getCleanIp(clientIpRaw); // Verwendet jetzt die neue getCleanIp

    console.log(`ipinfo: Raw IP = ${clientIpRaw}, Cleaned IP = ${clientIp}`);

    if (!clientIp || !isValidIp(clientIp)) { // Verwendet jetzt die neue isValidIp
         if (clientIp === '127.0.0.1' || clientIp === '::1') {
             return res.json({
                 ip: clientIp,
                 geo: { note: 'Localhost IP, no Geo data available.' },
                 asn: { note: 'Localhost IP, no ASN data available.' },
                 rdns: ['localhost'],
             });
         }
        console.error(`ipinfo: Could not determine a valid client IP. Raw: ${clientIpRaw}, Cleaned: ${clientIp}`);
        return res.status(400).json({ error: 'Could not determine a valid client IP address.', rawIp: clientIpRaw, cleanedIp: clientIp });
    }

    try {
        let geo = null;
        try {
            const geoData = cityReader.city(clientIp);
            geo = { /* ... Geo-Daten wie zuvor ... */ };
        } catch (e) {
            console.warn(`ipinfo: MaxMind City lookup failed for ${clientIp}: ${e.message}`);
            geo = { error: 'GeoIP lookup failed.' };
         }

        let asn = null;
        try {
            const asnData = asnReader.asn(clientIp);
            asn = { /* ... ASN-Daten wie zuvor ... */ };
        } catch (e) {
            console.warn(`ipinfo: MaxMind ASN lookup failed for ${clientIp}: ${e.message}`);
            asn = { error: 'ASN lookup failed.' };
        }

        let rdns = null;
        try {
            const hostnames = await dns.reverse(clientIp);
            rdns = hostnames;
        } catch (e) {
            if (e.code !== 'ENOTFOUND' && e.code !== 'ENODATA') {
                console.warn(`ipinfo: rDNS lookup error for ${clientIp}:`, e.message);
            }
            rdns = { error: `rDNS lookup failed (${e.code || 'Unknown error'})` };
         }

        res.json({ ip: clientIp, geo, asn, rdns });

    } catch (error) {
        console.error(`ipinfo: Error processing ipinfo for ${clientIp}:`, error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Ping Endpunkt
app.get('/api/ping', async (req, res) => {
    const targetIpRaw = req.query.targetIp;
    const targetIp = typeof targetIpRaw === 'string' ? targetIpRaw.trim() : targetIpRaw;

    console.log(`--- PING Request ---`);
    console.log(`Value of targetIp: "${targetIp}"`);

    const isValidResult = isValidIp(targetIp);
    console.log(`isValidIp (net) result for "${targetIp}": ${isValidResult}`);

    if (!isValidResult) {
        console.log(`isValidIp (net) returned false for "${targetIp}", sending 400.`);
        return res.status(400).json({ error: 'Invalid target IP address provided.' });
    }

    // --- NEUE PRÜFUNG AUF PRIVATE IP ---
    if (isPrivateIp(targetIp)) {
        console.log(`Target IP "${targetIp}" is private/local. Aborting ping.`);
        return res.status(403).json({ error: 'Operations on private or local IP addresses are not allowed.' });
    }
    // --- ENDE NEUE PRÜFUNG ---

    try {
        console.log(`Proceeding to execute ping for "${targetIp}"...`);
        const args = ['-c', '4', targetIp];
        const command = 'ping';

        console.log(`Executing: ${command} ${args.join(' ')}`);
        const output = await executeCommand(command, args);

        console.log(`Ping for ${targetIp} successful.`);
        // TODO: Ping-Ausgabe parsen
        res.json({ success: true, rawOutput: output });

    } catch (error) {
        res.status(500).json({ success: false, error: `Ping command failed: ${error.message}` });
    }
});

// Traceroute Endpunkt
app.get('/api/traceroute', async (req, res) => {
    const targetIpRaw = req.query.targetIp;
    const targetIp = typeof targetIpRaw === 'string' ? targetIpRaw.trim() : targetIpRaw;

    console.log(`--- TRACEROUTE Request ---`);
    console.log(`Value of targetIp: "${targetIp}"`);

    const isValidResult = isValidIp(targetIp);
    console.log(`isValidIp (net) result for "${targetIp}": ${isValidResult}`);

    if (!isValidResult) {
        console.log(`isValidIp (net) returned false for "${targetIp}", sending 400.`);
        return res.status(400).json({ error: 'Invalid target IP address provided.' });
    }

    // --- NEUE PRÜFUNG AUF PRIVATE IP ---
    if (isPrivateIp(targetIp)) {
        console.log(`Target IP "${targetIp}" is private/local. Aborting traceroute.`);
        return res.status(403).json({ error: 'Operations on private or local IP addresses are not allowed.' });
    }
    // --- ENDE NEUE PRÜFUNG ---

    try {
        console.log(`Proceeding to execute traceroute for "${targetIp}"...`);
        const args = ['-n', targetIp]; // Linux/macOS
        const command = 'traceroute';

        console.log(`Executing: ${command} ${args.join(' ')}`);
        const output = await executeCommand(command, args);

        console.log(`Traceroute for ${targetIp} successful.`);
        // TODO: Traceroute-Ausgabe parsen
        res.json({ success: true, rawOutput: output });

    } catch (error) {
        res.status(500).json({ success: false, error: `Traceroute command failed: ${error.message}` });
    }
});


// --- Server starten ---
initialize().then(() => {
    app.listen(PORT, () => {
        console.log(`Server listening on port ${PORT}`);
        console.log(`API endpoints available at:`);
        console.log(`  http://localhost:${PORT}/api/ipinfo`);
        console.log(`  http://localhost:${PORT}/api/ping?targetIp=<ip>`);
        console.log(`  http://localhost:${PORT}/api/traceroute?targetIp=<ip>`);
    });
}).catch(error => {
    console.error("Server could not start due to initialization errors.");
});