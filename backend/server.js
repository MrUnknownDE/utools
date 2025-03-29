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
 * Validiert eine IP-Adresse (v4 oder v6) robust.
 * @param {string} ip - Die zu validierende IP-Adresse.
 * @returns {boolean} True, wenn gültig, sonst false.
 */
function isValidIp(ip) {
    // Frühe Prüfung auf offensichtlich ungültige Werte
    if (!ip || typeof ip !== 'string' || ip.trim() === '') {
        return false;
    }

    try {
        // Zuerst versuchen, als IPv4 zu parsen und zu validieren
        const addr4 = new Address4(ip);
        if (addr4.isValid()) {
            return true; // Gültige IPv4
        }

        // Wenn nicht IPv4, versuchen als IPv6 zu parsen und zu validieren
        const addr6 = new Address6(ip);
        if (addr6.isValid()) {
            return true; // Gültige IPv6
        }

        // Wenn keine der Konstruktoren einen Fehler geworfen hat,
        // aber isValid() false zurückgibt (selten, aber möglich)
        return false;

    } catch (error) {
        // Wenn bei new Address4() oder new Address6() ein Fehler auftritt
        // (z.B. "Incorrect number of groups"), ist die Eingabe ungültig.
        // Wir loggen den Fehler optional für Debugging-Zwecke, geben aber false zurück.
        // console.warn(`IP validation caught error for input "${ip}": ${error.message}`);
        return false;
    }
}

/**
 * Bereinigt eine IP-Adresse (z.B. entfernt ::ffff: Präfix von IPv4-mapped IPv6).
 * @param {string} ip - Die IP-Adresse.
 * @returns {string} Die bereinigte IP-Adresse.
 */
function getCleanIp(ip) {
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
            if (/[;&|`$()<>]/.test(arg)) {
                return reject(new Error(`Invalid character detected in argument: ${arg}`));
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
            reject(new Error(`Failed to start command ${command}: ${err.message}`));
        });

        proc.on('close', (code) => {
            if (code !== 0) {
                // Befehl wurde ausgeführt, aber mit Fehlercode beendet
                reject(new Error(`Command ${command} failed with code ${code}: ${stderr || stdout}`));
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
        cityReader = await geoip.Reader.open(process.env.GEOIP_CITY_DB || './data/GeoLite2-City.mmdb');
        asnReader = await geoip.Reader.open(process.env.GEOIP_ASN_DB || './data/GeoLite2-ASN.mmdb');
        console.log('MaxMind databases loaded successfully.');
    } catch (error) {
        console.error('FATAL: Could not load MaxMind databases.');
        console.error('Ensure GEOIP_CITY_DB and GEOIP_ASN_DB point to valid .mmdb files.');
        console.error(error);
        process.exit(1); // Beenden, wenn DBs nicht geladen werden können
    }
}

// --- Middleware ---
app.use(cors()); // Erlaubt Anfragen von anderen Origins (z.B. dein Frontend)
app.use(express.json()); // Parst JSON-Request-Bodies (brauchen wir hier nicht direkt, aber gute Praxis)

// Vertraue dem Proxy-Header für die IP (wenn hinter einem Reverse Proxy wie Nginx)
// Vorsicht: Nur aktivieren, wenn du WIRKLICH hinter einem vertrauenswürdigen Proxy bist!
// app.set('trust proxy', true);

// --- Routen ---

// Haupt-Endpunkt: Liefert alle Infos zur IP des Clients
app.get('/api/ipinfo', async (req, res) => {
    // WICHTIG: 'req.ip' hängt von 'trust proxy' ab.
    // Sicherer ist oft, den spezifischen Header zu prüfen, den dein Proxy setzt (z.B. 'X-Forwarded-For')
    // Beispiel: const clientIpRaw = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress;
    const clientIpRaw = req.ip || req.socket.remoteAddress;
    const clientIp = getCleanIp(clientIpRaw);

    if (!isValidIp(clientIp)) {
        return res.status(400).json({ error: 'Could not determine a valid client IP address.', rawIp: clientIpRaw });
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
        } catch (e) { /* IP nicht in DB oder private IP */ }

        let asn = null;
        try {
            const asnData = asnReader.asn(clientIp);
            asn = {
                number: asnData.autonomousSystemNumber,
                organization: asnData.autonomousSystemOrganization,
            };
        } catch (e) { /* IP nicht in DB oder private IP */ }

        let rdns = null;
        try {
            // Reverse DNS Lookup kann etwas dauern
            const hostnames = await dns.reverse(clientIp);
            rdns = hostnames; // Ist ein Array von Hostnamen
        } catch (e) {
            // Fehler wie NXDOMAIN (No Such Domain) sind normal, ignorieren
            if (e.code !== 'ENOTFOUND' && e.code !== 'ENODATA') {
                console.warn(`rDNS lookup error for ${clientIp}:`, e.message);
            }
         }

        res.json({
            ip: clientIp,
            geo,
            asn,
            rdns,
        });

    } catch (error) {
        console.error(`Error processing ipinfo for ${clientIp}:`, error);
        res.status(500).json({ error: 'Internal server error while processing IP information.' });
    }
});

// Ping Endpunkt
app.get('/api/ping', async (req, res) => {
    const targetIp = req.query.targetIp;

    // --- DEBUGGING START ---
    console.log(`--- PING Request ---`);
    console.log(`Raw req.query.targetIp:`, req.query.targetIp);
    console.log(`Type of targetIp:`, typeof targetIp);
    console.log(`Value of targetIp before validation: "${targetIp}"`);
    // --- DEBUGGING END ---

    if (!isValidIp(targetIp)) {
        // --- DEBUGGING START ---
        console.log(`isValidIp returned false for "${targetIp}"`);
        // --- DEBUGGING END ---
        return res.status(400).json({ error: 'Invalid target IP address provided.' });
    }

    // Sicherstellen, dass es sich nicht um eine private/interne IP handelt? Optional.
    // const addr = new Address6(targetIp);
    // if (addr.isInSubnet('10.0.0.0/8') || ... ) {
    //    return res.status(403).json({ error: 'Pinging private IPs is not allowed.' });
    // }

    try {
        // Parameter anpassen (z.B. -c für Linux/macOS, -n für Windows)
        // Hier für Linux/macOS: 4 Pings senden
        const args = ['-c', '4', targetIp];
        const command = 'ping';

        console.log(`Executing: ${command} ${args.join(' ')}`);
        const output = await executeCommand(command, args);

        // TODO: Ping-Ausgabe parsen für strukturierte Daten (RTT min/avg/max, loss)
        res.json({ success: true, rawOutput: output });

    } catch (error) {
        console.error(`Error executing ping for ${targetIp}:`, error);
        res.status(500).json({ success: false, error: `Ping command failed: ${error.message}` });
    }
});

// Traceroute Endpunkt
app.get('/api/traceroute', async (req, res) => {
    const targetIp = req.query.targetIp;

    // --- DEBUGGING START ---
    console.log(`--- TRACEROUTE Request ---`);
    console.log(`Raw req.query.targetIp:`, req.query.targetIp);
    console.log(`Type of targetIp:`, typeof targetIp);
    console.log(`Value of targetIp before validation: "${targetIp}"`);
    // --- DEBUGGING END ---

    if (!isValidIp(targetIp)) {
        // --- DEBUGGING START ---
        console.log(`isValidIp returned false for "${targetIp}"`);
        // --- DEBUGGING END ---
        return res.status(400).json({ error: 'Invalid target IP address provided.' });
    }

    try {
        // Parameter anpassen. '-n' verhindert rDNS durch traceroute selbst (schneller).
        // Evtl. Timeouts anpassen (-w), max Hops (-m)
        const args = ['-n', targetIp]; // Für Linux/macOS
        // Für Windows wäre es: const args = ['-d', targetIp]; const command = 'tracert';
        const command = 'traceroute';

        console.log(`Executing: ${command} ${args.join(' ')}`);
        const output = await executeCommand(command, args);

        // TODO: Traceroute-Ausgabe parsen für strukturierte Daten (Array von Hops)
        res.json({ success: true, rawOutput: output });

    } catch (error) {
        console.error(`Error executing traceroute for ${targetIp}:`, error);
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