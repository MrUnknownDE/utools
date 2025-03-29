// backend/utils.js
const net = require('net'); // Node.js built-in module for IP validation
const { spawn } = require('child_process');
const pino = require('pino'); // Import pino for logging within utils if needed
const Sentry = require("@sentry/node"); // Import Sentry for error reporting

// Logger instance (assuming a logger is initialized elsewhere and passed or created here)
// For simplicity, creating a basic logger here. Ideally, pass the main logger instance.
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

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
    // Regex updated to be more robust and handle international characters (IDNs)
    const domainRegex = /^(?:[a-z0-9\p{L}](?:[a-z0-9\p{L}-]{0,61}[a-z0-9\p{L}])?\.)+[a-z0-9\p{L}][a-z0-9\p{L}-]{0,61}[a-z0-9\p{L}]$/iu;
    return domainRegex.test(domain.trim());
}


/**
 * Bereinigt eine IP-Adresse (z.B. entfernt ::ffff: Präfix von IPv4-mapped IPv6).
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
    // Keep localhost IPs as they are
    if (trimmedIp === '::1' || trimmedIp === '127.0.0.1') {
        return trimmedIp;
    }
    // Return trimmed IP for other cases
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
        // Basic argument validation
        args.forEach(arg => {
            if (typeof arg === 'string' && /[;&|`$()<>]/.test(arg)) {
                const error = new Error(`Invalid character detected in command argument.`);
                logger.error({ command, arg }, "Potential command injection attempt detected in argument");
                Sentry.captureException(error); // Send to Sentry
                return reject(error);
            }
        });

        const proc = spawn(command, args);
        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data) => { stdout += data.toString(); });
        proc.stderr.on('data', (data) => { stderr += data.toString(); });
        proc.on('error', (err) => {
            const error = new Error(`Failed to start command ${command}: ${err.message}`);
            logger.error({ command, args, error: err.message }, `Failed to start command`);
            Sentry.captureException(error); // Send to Sentry
            reject(error);
        });
        proc.on('close', (code) => {
            if (code !== 0) {
                const error = new Error(`Command ${command} failed with code ${code}: ${stderr || 'No stderr output'}`);
                // Attach stdout/stderr to the error object for better context in rejection
                error.stdout = stdout;
                error.stderr = stderr;
                logger.error({ command, args, exitCode: code, stderr: stderr.trim(), stdout: stdout.trim() }, `Command failed`);
                Sentry.captureException(error, { extra: { stdout: stdout.trim(), stderr: stderr.trim() } }); // Send to Sentry
                reject(error);
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
            const receivedMatch = statsLine.match(/(\d+)\s+(?:received|packets received)/);
            const lossMatch = statsLine.match(/([\d.]+)%\s+packet loss/);
            if (transmittedMatch) packetsTransmitted = parseInt(transmittedMatch[1], 10);
            if (receivedMatch) packetsReceived = parseInt(receivedMatch[1], 10);
            if (lossMatch) packetLossPercent = parseFloat(lossMatch[1]);
        }

        // Handle both 'rtt' and 'round-trip' prefixes for broader compatibility
        const rttLine = lines.find(line => line.startsWith('rtt min/avg/max/mdev') || line.startsWith('round-trip min/avg/max/stddev'));
         if (rttLine) {
            const rttMatch = rttLine.match(/([\d.]+)\/([\d.]+)\/([\d.]+)\/([\d.]+)/);
            if (rttMatch) {
                rtt = {
                    min: parseFloat(rttMatch[1]),
                    avg: parseFloat(rttMatch[2]),
                    max: parseFloat(rttMatch[3]),
                    mdev: parseFloat(rttMatch[4]), // Note: mdev/stddev might have different meanings
                };
            }
        }

        result.stats = {
            packets: { transmitted: packetsTransmitted, received: packetsReceived, lossPercent: packetLossPercent },
            rtt: rtt.avg !== null ? rtt : null, // Only include RTT if average is available
        };

        // Check for common error messages or patterns
        if (packetsTransmitted > 0 && packetsReceived === 0) {
             result.error = "Request timed out or host unreachable.";
        } else if (pingOutput.includes('unknown host') || pingOutput.includes('Name or service not known')) {
            result.error = "Unknown host.";
        }

    } catch (parseError) {
        logger.error({ error: parseError.message, output: pingOutput }, "Failed to parse ping output");
        Sentry.captureException(parseError, { extra: { pingOutput } }); // Send to Sentry
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
    // Ignore header lines and empty lines
    if (!line || line.startsWith('traceroute to') || line.includes('hops max')) return null;

    // Regex to capture hop number, hostname (optional), IP address, and RTT times
    // Handles cases with or without hostname, and different spacing
    const hopMatch = line.match(/^(\s*\d+)\s+(?:([a-zA-Z0-9\.\-]+)\s+\(([\d\.:a-fA-F]+)\)|([\d\.:a-fA-F]+))\s+(.*)$/);
    const timeoutMatch = line.match(/^(\s*\d+)\s+(\*\s+\*\s+\*)/); // Match lines with only timeouts

    if (timeoutMatch) {
         // Handle timeout line
         return {
            hop: parseInt(timeoutMatch[1].trim(), 10),
            hostname: null,
            ip: null,
            rtt: ['*', '*', '*'], // Represent timeouts as '*'
            rawLine: line,
        };
    } else if (hopMatch) {
        // Handle successful hop line
        const hop = parseInt(hopMatch[1].trim(), 10);
        const hostname = hopMatch[2]; // Hostname if present
        const ipInParen = hopMatch[3]; // IP if hostname is present
        const ipDirect = hopMatch[4]; // IP if hostname is not present
        const restOfLine = hopMatch[5].trim();
        const ip = ipInParen || ipDirect; // Determine the correct IP

        // Extract RTT times, handling '*' for timeouts and removing ' ms' units
        const rttParts = restOfLine.split(/\s+/);
        const rtts = rttParts
            .map(p => p === '*' ? '*' : p.replace(/\s*ms$/, '')) // Keep '*' or remove ' ms'
            .filter(p => p === '*' || !isNaN(parseFloat(p))) // Ensure it's '*' or a number
            .slice(0, 3); // Take the first 3 valid RTT values

        // Pad with '*' if fewer than 3 RTTs were found (e.g., due to timeouts)
        while (rtts.length < 3) rtts.push('*');

         return {
            hop: hop,
            hostname: hostname || null, // Use null if hostname wasn't captured
            ip: ip,
            rtt: rtts,
            rawLine: line,
        };
    }

    // Return null if the line doesn't match expected formats
    return null;
}


module.exports = {
    isValidIp,
    isPrivateIp,
    isValidDomain,
    getCleanIp,
    executeCommand,
    parsePingOutput,
    parseTracerouteLine,
    // Note: logger is not exported, assuming it's managed globally or passed where needed
};