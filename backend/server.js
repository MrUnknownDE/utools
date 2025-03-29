// server.js
require('dotenv').config(); // Lädt Variablen aus .env in process.env
const express = require('express');
const cors = require('cors');
const geoip = require('@maxmind/geoip2-node');
const { Address4, Address6 } = require('ip-address');
const { spawn } = require('child_process');
const dns = require('dns').promises; // Für asynchrones DNS

const app = express();
const PORT = process.env.PORT || 3000;

// --- Globale Variablen für MaxMind Reader ---
let cityReader;
let asnReader;

// --- Hilfsfunktionen ---

/**
 * Validiert eine IP-Adresse (v4 oder v6) robust mit separaten Prüfungen.
 * @param {string} ip - Die zu validierende IP-Adresse.
 * @returns {boolean} True, wenn gültig, sonst false.
 */
function isValidIp(ip) {
    // Frühe Prüfung auf offensichtlich ungültige Werte
    if (!ip || typeof ip !== 'string' || ip.trim() === '') {
        // console.log(`isValidIp: Input invalid (null, not string, or empty)`); // Optional Debugging
        return false;
    }

    const trimmedIp = ip.trim(); // Sicherstellen, dass wir getrimmten Wert verwenden
    // console.log(`isValidIp: Checking trimmed IP "${trimmedIp}"`); // Optional Debugging

    // --- Versuch 1: Ist es eine gültige IPv4? ---
    try {
        const addr4 = new Address4(trimmedIp);
        if (addr4.isValid()) {
            // console.log(`isValidIp: "${trimmedIp}" is valid IPv4.`); // Optional Debugging
            return true; // Ja, gültige IPv4 gefunden. Fertig.
        }
    } catch (e) {
        // Fehler beim Parsen als IPv4 (z.B. bei IPv6-Format). Das ist OK, wir prüfen als nächstes IPv6.
        // console.warn(`isValidIp: Error parsing "${trimmedIp}" as IPv4: ${e.message}`); // Optional Debugging
    }

    // --- Versuch 2: Ist es eine gültige IPv6? ---
    try {
        const addr6 = new Address6(trimmedIp);
        if (addr6.isValid()) {
            // console.log(`isValidIp: "${trimmedIp}" is valid IPv6.`); // Optional Debugging
            return true; // Ja, gültige IPv6 gefunden. Fertig.
        }
    } catch (e) {
        // Fehler beim Parsen als IPv6 (z.B. bei IPv4-Format oder ungültigem Text).
        // console.warn(`isValidIp: Error parsing "${trimmedIp}" as IPv6: ${e.message}`); // Optional Debugging
    }

    // --- Wenn weder als IPv4 noch als IPv6 gültig ---
    // console.log(`isValidIp: "${trimmedIp}" is neither valid IPv4 nor IPv6.`); // Optional Debugging
    return false;
}


/**
 * Bereinigt eine IP-Adresse (z.B. entfernt ::ffff: Präfix von IPv4-mapped IPv6).
 * @param {string} ip - Die IP-Adresse.
 * @returns {string} Die bereinigte IP-Adresse.
 */
function getCleanIp(ip) {
    if (!ip) return ip; // Handle null/undefined case
    if (ip.startsWith('::ffff:')) {
        const potentialIp4 = ip.substring(7);
        if (new Address4(potentialIp4).isValid()) {
            return potentialIp4;
        }
    }
    // Handle localhost cases for testing
    if (ip === '::1' || ip === '127.0.0.1') {
        // Optional: Return a public test IP or handle differently
        // For now, just return it, MaxMind/Ping/Trace will likely fail
        return ip;
    }
    return ip;
}

/**
 * Führt einen Shell-Befehl sicher aus und gibt stdout zurück.
 * @param {string} command - Der Befehl (z.B. 'ping').
 * @param {string[]} args - Die Argumente als Array.
 * @returns {Promise<string>} Eine Promise, die mit stdout aufgelöst wird.
 */
function executeCommand(command, args) {
    return new Promise((resolve, reject) => {
        // Zusätzliche Validierung der Argumente (besonders IPs)
        args.forEach(arg => {
            // Einfache Prüfung auf potenziell gefährliche Zeichen
            // Dies ist KEIN vollständiger Schutz, aber eine zusätzliche Ebene.
            // Die IP-Validierung vorher ist wichtiger!
            if (typeof arg === 'string' && /[;&|`$()<>]/.test(arg)) {
                 // Logge den problematischen Versuch, aber lehne ab
                console.error(`Potential command injection attempt detected in argument: ${arg}`);
                return reject(new Error(`Invalid character detected in command argument.`));
            }
        });

        const proc = spawn(command, args);
        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        proc.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        proc.on('error', (err) => {
            // Fehler beim Starten des Prozesses
            console.error(`Failed to start command ${command}: ${err.message}`);
            reject(new Error(`Failed to start command ${command}: ${err.message}`));
        });

        proc.on('close', (code) => {
            if (code !== 0) {
                // Befehl wurde ausgeführt, aber mit Fehlercode beendet
                console.error(`Command ${command} ${args.join(' ')} failed with code ${code}: ${stderr || stdout}`);
                reject(new Error(`Command ${command} failed with code ${code}: ${stderr || 'No stderr output'}`));
            } else {
                resolve(stdout);
            }
        });
    });
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
        process.exit(1); // Beenden, wenn DBs nicht geladen werden können
    }
}

// --- Middleware ---
app.use(cors()); // Erlaubt Anfragen von anderen Origins (z.B. dein Frontend)
app.use(express.json()); // Parst JSON-Request-Bodies

// Vertraue dem Proxy-Header für die IP (wenn hinter einem Reverse Proxy wie Nginx)
// Vorsicht: Nur aktivieren, wenn du WIRKLICH hinter einem vertrauenswürdigen Proxy bist!
// Und konfiguriere es spezifisch für deinen Proxy, z.B. app.set('trust proxy', 'loopback')
// app.set('trust proxy', true);

// --- Routen ---

// Haupt-Endpunkt: Liefert alle Infos zur IP des Clients
app.get('/api/ipinfo', async (req, res) => {
    // WICHTIG: 'req.ip' hängt von 'trust proxy' ab.
    // Sicherer ist oft, den spezifischen Header zu prüfen, den dein Proxy setzt (z.B. 'X-Forwarded-For')
    // Beispiel: const clientIpRaw = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress;
    // Für lokale Tests ist req.ip oft ::1 oder 127.0.0.1, req.socket.remoteAddress ist oft dasselbe.
    // Wir nehmen req.ip als Standard, aber loggen beides für Debugging.
    console.log(`ipinfo request: req.ip = ${req.ip}, req.socket.remoteAddress = ${req.socket.remoteAddress}`);
    const clientIpRaw = req.ip || req.socket.remoteAddress;
    const clientIp = getCleanIp(clientIpRaw);

    console.log(`ipinfo: Raw IP = ${clientIpRaw}, Cleaned IP = ${clientIp}`);


    // Wenn nach Bereinigung keine IP übrig bleibt oder sie ungültig ist
    if (!clientIp || !isValidIp(clientIp)) {
         // Spezieller Fall für Localhost / Private IPs, die MaxMind nicht auflösen kann
         if (clientIp === '127.0.0.1' || clientIp === '::1') {
             return res.json({
                 ip: clientIp,
                 geo: { note: 'Localhost IP, no Geo data available.' },
                 asn: { note: 'Localhost IP, no ASN data available.' },
                 rdns: ['localhost'], // Annahme
             });
         }
         // Ansonsten ein Fehler
        console.error(`ipinfo: Could not determine a valid client IP. Raw: ${clientIpRaw}, Cleaned: ${clientIp}`);
        return res.status(400).json({ error: 'Could not determine a valid client IP address.', rawIp: clientIpRaw, cleanedIp: clientIp });
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
        } catch (e) {
            console.warn(`ipinfo: MaxMind City lookup failed for ${clientIp}: ${e.message}`);
            geo = { error: 'GeoIP lookup failed (IP not found in database or private range).' };
         }

        let asn = null;
        try {
            const asnData = asnReader.asn(clientIp);
            asn = {
                number: asnData.autonomousSystemNumber,
                organization: asnData.autonomousSystemOrganization,
            };
        } catch (e) {
            console.warn(`ipinfo: MaxMind ASN lookup failed for ${clientIp}: ${e.message}`);
            asn = { error: 'ASN lookup failed (IP not found in database or private range).' };
        }

        let rdns = null;
        try {
            // Reverse DNS Lookup kann etwas dauern
            const hostnames = await dns.reverse(clientIp);
            rdns = hostnames; // Ist ein Array von Hostnamen
        } catch (e) {
            // Fehler wie NXDOMAIN (No Such Domain) sind normal, ignorieren
            if (e.code !== 'ENOTFOUND' && e.code !== 'ENODATA') {
                console.warn(`ipinfo: rDNS lookup error for ${clientIp}:`, e.message);
            }
            rdns = { error: `rDNS lookup failed (${e.code || 'Unknown error'})` };
         }

        res.json({
            ip: clientIp,
            geo,
            asn,
            rdns,
        });

    } catch (error) {
        console.error(`ipinfo: Error processing ipinfo for ${clientIp}:`, error);
        res.status(500).json({ error: 'Internal server error while processing IP information.' });
    }
});

// Ping Endpunkt
app.get('/api/ping', async (req, res) => {
    const targetIpRaw = req.query.targetIp;
    const targetIp = typeof targetIpRaw === 'string' ? targetIpRaw.trim() : targetIpRaw;

    console.log(`--- PING Request ---`);
    console.log(`Raw req.query.targetIp:`, req.query.targetIp);
    console.log(`Value of targetIp after trim: "${targetIp}"`);
    console.log(`Type of targetIp:`, typeof targetIp);

    // --- DIREKTER TEST IN DER ROUTE ---
    let isDirectlyValidV4 = false;
    let isDirectlyValidV6 = false;
    try {
        if (targetIp) { // Nur testen, wenn targetIp existiert
            const addr4 = new Address4(targetIp);
            isDirectlyValidV4 = addr4.isValid();
        }
    } catch (e) { /* Ignorieren für diesen Test */ }
    try {
         if (targetIp) { // Nur testen, wenn targetIp existiert
            const addr6 = new Address6(targetIp);
            isDirectlyValidV6 = addr6.isValid();
         }
    } catch (e) { /* Ignorieren für diesen Test */ }
    console.log(`Direct V4 check in route for "${targetIp}": ${isDirectlyValidV4}`);
    console.log(`Direct V6 check in route for "${targetIp}": ${isDirectlyValidV6}`);
    // --- ENDE DIREKTER TEST ---

    const isValidResult = isValidIp(targetIp); // Rufe die Funktion trotzdem auf
    console.log(`isValidIp function result for "${targetIp}": ${isValidResult}`);


    if (!isValidResult) { // Prüfe weiterhin das Ergebnis der Funktion
        console.log(`isValidIp returned false for "${targetIp}", sending 400.`);
        return res.status(400).json({ error: 'Invalid target IP address provided.' });
    }

    // --- Rest der Funktion ---
    try {
        console.log(`Proceeding to execute ping for "${targetIp}"...`);
        // Parameter anpassen (z.B. -c für Linux/macOS, -n für Windows)
        // Hier für Linux/macOS: 4 Pings senden
        const args = ['-c', '4', targetIp]; // WICHTIG: Hier den getrimmten targetIp verwenden!
        const command = 'ping';

        console.log(`Executing: ${command} ${args.join(' ')}`);
        const output = await executeCommand(command, args);

        // TODO: Ping-Ausgabe parsen für strukturierte Daten (RTT min/avg/max, loss)
        console.log(`Ping for ${targetIp} successful.`);
        res.json({ success: true, rawOutput: output });

    } catch (error) {
        // executeCommand loggt den Fehler bereits
        res.status(500).json({ success: false, error: `Ping command failed: ${error.message}` });
    }
});

// Traceroute Endpunkt
app.get('/api/traceroute', async (req, res) => {
    const targetIpRaw = req.query.targetIp;
    const targetIp = typeof targetIpRaw === 'string' ? targetIpRaw.trim() : targetIpRaw;

    console.log(`--- TRACEROUTE Request ---`);
    console.log(`Raw req.query.targetIp:`, req.query.targetIp);
    console.log(`Value of targetIp after trim: "${targetIp}"`);
    console.log(`Type of targetIp:`, typeof targetIp);

    // --- DIREKTER TEST IN DER ROUTE ---
    let isDirectlyValidV4 = false;
    let isDirectlyValidV6 = false;
     try {
        if (targetIp) { // Nur testen, wenn targetIp existiert
            const addr4 = new Address4(targetIp);
            isDirectlyValidV4 = addr4.isValid();
        }
    } catch (e) { /* Ignorieren für diesen Test */ }
    try {
         if (targetIp) { // Nur testen, wenn targetIp existiert
            const addr6 = new Address6(targetIp);
            isDirectlyValidV6 = addr6.isValid();
         }
    } catch (e) { /* Ignorieren für diesen Test */ }
    console.log(`Direct V4 check in route for "${targetIp}": ${isDirectlyValidV4}`);
    console.log(`Direct V6 check in route for "${targetIp}": ${isDirectlyValidV6}`);
    // --- ENDE DIREKTER TEST ---

    const isValidResult = isValidIp(targetIp); // Rufe die Funktion trotzdem auf
    console.log(`isValidIp function result for "${targetIp}": ${isValidResult}`);


    if (!isValidResult) { // Prüfe weiterhin das Ergebnis der Funktion
        console.log(`isValidIp returned false for "${targetIp}", sending 400.`);
        return res.status(400).json({ error: 'Invalid target IP address provided.' });
    }

    // --- Rest der Funktion ---
    try {
        console.log(`Proceeding to execute traceroute for "${targetIp}"...`);
        // Parameter anpassen. '-n' verhindert rDNS durch traceroute selbst (schneller).
        // Evtl. Timeouts anpassen (-w), max Hops (-m)
        const args = ['-n', targetIp]; // Für Linux/macOS
        // Für Windows wäre es: const args = ['-d', targetIp]; const command = 'tracert';
        const command = 'traceroute';

        console.log(`Executing: ${command} ${args.join(' ')}`);
        const output = await executeCommand(command, args);

        // TODO: Traceroute-Ausgabe parsen für strukturierte Daten (Array von Hops)
        console.log(`Traceroute for ${targetIp} successful.`);
        res.json({ success: true, rawOutput: output });

    } catch (error) {
         // executeCommand loggt den Fehler bereits
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
    // Fehler bei der Initialisierung wurde bereits geloggt.
    console.error("Server could not start due to initialization errors.");
});