const express = require('express');
const { exec } = require('child_process');
const router = express.Router();
const os = require('os'); // Für Timeout-Signal

// Funktion zum Parsen der openssl x509 -text Ausgabe
function parseSslOutput(output) {
    const result = {
        issuer: null,
        subject: null,
        validFrom: null,
        validTo: null,
        validity: "Could not determine validity", // Standardwert
        error: null,
        details: output // Rohausgabe für Debugging/Anzeige
    };

    try {
        // Extrahiere Issuer und Subject (robusterer Regex, der Zeilenumbrüche berücksichtigt)
        const issuerMatch = output.match(/Issuer:([^\n]+(?:\n\s+[^\n]+)*)/);
        if (issuerMatch) result.issuer = issuerMatch[1].replace(/\n\s+/g, ' ').trim();

        const subjectMatch = output.match(/Subject:([^\n]+(?:\n\s+[^\n]+)*)/);
        if (subjectMatch) result.subject = subjectMatch[1].replace(/\n\s+/g, ' ').trim();

        // Extrahiere Gültigkeitsdaten (verschiedene Datumsformate berücksichtigen)
        const validFromMatch = output.match(/Not Before\s*:\s*(.+)/);
        if (validFromMatch) {
            try {
                result.validFrom = new Date(validFromMatch[1].trim()).toISOString();
            } catch (dateError) {
                console.warn("Could not parse 'Not Before' date:", validFromMatch[1].trim());
            }
        }

        const validToMatch = output.match(/Not After\s*:\s*(.+)/);
         if (validToMatch) {
             try {
                result.validTo = new Date(validToMatch[1].trim()).toISOString();
             } catch (dateError) {
                 console.warn("Could not parse 'Not After' date:", validToMatch[1].trim());
             }
        }

        // Bewerte Gültigkeit basierend auf geparsten Daten
        if (result.validFrom && result.validTo) {
            const now = new Date();
            const validFromDate = new Date(result.validFrom);
            const validToDate = new Date(result.validTo);
            if (!isNaN(validFromDate) && !isNaN(validToDate)) { // Prüfen ob Daten gültig sind
                 if (now < validFromDate) {
                    result.validity = "Invalid (Not Yet Valid)";
                 } else if (now > validToDate) {
                    result.validity = "Invalid (Expired)";
                 } else {
                    result.validity = "Valid";
                 }
            } else {
                 result.validity = "Could not parse validity dates";
            }
        } else {
             result.validity = "Could not extract validity dates";
        }

    } catch (e) {
        console.error("Error parsing openssl output:", e);
        result.error = "Error parsing certificate details.";
        result.validity = "Parsing Error"; // Spezifischer Status
    }

    return result;
}

// Einfache Domain-Validierung (grundlegend)
function isValidDomain(domain) {
    // Erlaubt Buchstaben, Zahlen, Bindestriche und Punkte. Muss mit Buchstabe/Zahl beginnen/enden.
    // Nicht perfekt (z.B. IDNs), aber fängt grundlegende Fehler ab.
    const domainRegex = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    // Zusätzliche Längenprüfung
    return domain && domain.length <= 253 && domainRegex.test(domain);
}


router.get('/', async (req, res) => {
    const domain = req.query.domain;

    if (!domain) {
        return res.status(400).json({ error: 'Domain parameter is required' });
    }

    // Grundlegende Validierung der Domain
    if (!isValidDomain(domain)) {
         return res.status(400).json({ error: 'Invalid domain format provided' });
    }

    // Verwende Port 443 für HTTPS. Timeout nach 10 Sekunden.
    // Leite stderr nicht mehr nach /dev/null um, um Fehler von s_client zu sehen.
    // Verwende -brief für eine kompaktere Ausgabe, falls -text fehlschlägt
    const command = `echo "" | openssl s_client -servername ${domain} -connect ${domain}:443 -showcerts 2>&1 | openssl x509 -noout -text`;
    const timeoutMs = 10000; // 10 Sekunden

    const child = exec(command, { timeout: timeoutMs }, (error, stdout, stderr) => {
        // WICHTIG: stderr wird hier durch 2>&1 im Befehl in stdout umgeleitet!
        // Daher prüfen wir stdout auf Fehlermuster und error auf Exit-Code.

        const combinedOutput = stdout || ""; // stdout enthält jetzt auch stderr

        if (error) {
            console.error(`exec error for domain ${domain}:`, error);
            let errorMessage = 'Failed to execute openssl command.';
            let errorDetails = combinedOutput || error.message; // Bevorzuge Output, wenn vorhanden

            // Versuche, spezifischere Fehler aus der Ausgabe zu erkennen
            if (error.signal === 'SIGTERM' || (error.code === null && error.signal === os.constants.signals.SIGTERM)) { // Expliziter Timeout Check
                 errorMessage = `Connection timed out after ${timeoutMs / 1000} seconds.`;
                 errorDetails = `Timeout while trying to connect to ${domain}:443`;
            } else if (combinedOutput.includes("getaddrinfo: Name or service not known") || combinedOutput.includes("nodename nor servname provided, or not known") || combinedOutput.includes("failed to get server ip address")) {
                errorMessage = `Could not resolve domain: ${domain}`;
            } else if (combinedOutput.includes("connect: Connection refused")) {
                errorMessage = `Connection refused by ${domain}:443. Is the server running and accepting connections?`;
            } else if (combinedOutput.includes("connect:errno=") || combinedOutput.includes("SSL_connect:failed")) {
                 errorMessage = `Could not establish SSL connection to ${domain}:443.`;
            } else if (combinedOutput.includes("unable to load certificate") || combinedOutput.includes("Expecting: TRUSTED CERTIFICATE")) {
                 errorMessage = `Could not retrieve or parse certificate from ${domain}. Server might not be sending a valid certificate.`;
            } else if (error.code) {
                 errorMessage = `OpenSSL command failed with exit code ${error.code}.`;
            }

            return res.status(500).json({ error: errorMessage, details: errorDetails });
        }

        // Wenn kein Fehler aufgetreten ist, aber stdout leer ist (sollte nicht passieren wegen 2>&1, aber sicherheitshalber)
        if (!combinedOutput.trim()) {
             console.warn(`Empty output received for domain ${domain}, although no exec error occurred.`);
             return res.status(500).json({ error: 'Received empty response from openssl command.' });
        }

        // Versuche, das Zertifikat zu parsen
        const certInfo = parseSslOutput(combinedOutput); // Parse die kombinierte Ausgabe

        // Wenn das Parsen fehlschlägt ODER keine relevanten Infos gefunden wurden
        if (certInfo.error || (!certInfo.issuer && !certInfo.subject && !certInfo.validTo)) {
             // Möglicherweise war die Ausgabe nur eine Fehlermeldung von s_client oder x509
             console.warn(`Could not parse certificate details for ${domain}. Raw output:`, combinedOutput);
             // Gib einen spezifischeren Fehler zurück, wenn möglich
             let parseErrorMsg = certInfo.error || `Could not extract certificate details from the server response.`;
             if (combinedOutput.includes("connect:errno=")) {
                 parseErrorMsg = `Could not establish SSL connection to ${domain}:443.`;
             } else if (combinedOutput.toLowerCase().includes("no certificate")) {
                  parseErrorMsg = `Server at ${domain}:443 did not present a certificate.`;
             }
             return res.status(500).json({ error: parseErrorMsg, details: combinedOutput });
        }


        // Einfache Bewertung hinzufügen
        let score = 0;
        let evaluation = [];
        if (certInfo.validity === "Valid") {
            score += 5; // Basispunktzahl für Gültigkeit
            evaluation.push("Certificate is currently valid.");

             // Prüfe die verbleibende Gültigkeitsdauer
             try {
                const daysRemaining = Math.floor((new Date(certInfo.validTo) - new Date()) / (1000 * 60 * 60 * 24));
                if (!isNaN(daysRemaining)) {
                    if (daysRemaining < 14) { // Strengere Warnung
                        score -= 3;
                        evaluation.push(`Warning: Certificate expires in ${daysRemaining} days (less than 14 days).`);
                    } else if (daysRemaining < 30) {
                        score -= 1;
                        evaluation.push(`Warning: Certificate expires in ${daysRemaining} days (less than 30 days).`);
                    } else {
                        score += 2; // Bonus für gute Restlaufzeit
                        evaluation.push(`Certificate expires in ${daysRemaining} days.`);
                    }
                } else {
                     evaluation.push("Could not calculate remaining days.");
                }
             } catch (e) {
                 console.warn("Could not calculate remaining days:", e);
                 evaluation.push("Could not calculate remaining days.");
             }
        } else {
            // Keine Punkte für ungültige Zertifikate
            evaluation.push(`Certificate is not valid (${certInfo.validity}).`);
        }

        // Weitere Prüfungen könnten hier hinzugefügt werden

        res.json({
            domain: domain,
            certificate: { // Nur relevante Infos senden, nicht die ganze Roh-Ausgabe im Hauptobjekt
                 issuer: certInfo.issuer,
                 subject: certInfo.subject,
                 validFrom: certInfo.validFrom,
                 validTo: certInfo.validTo,
                 validity: certInfo.validity,
                 details: certInfo.details // Roh-Details bleiben für die Anzeige im Frontend
            },
            evaluation: {
                score: Math.max(0, Math.min(10, score)), // Score zwischen 0 und 10 begrenzen
                summary: evaluation.join(' ')
            }
         });
    });

     // Timeout-Handling (falls das interne Timeout von exec nicht greift)
     const timer = setTimeout(() => {
         console.warn(`Forcing termination of openssl command for ${domain} after ${timeoutMs}ms`);
         child.kill('SIGTERM'); // Versuche, den Prozess sauber zu beenden
     }, timeoutMs + 1000); // Gib dem internen Timeout eine kleine Gnadenfrist

     child.on('exit', () => {
         clearTimeout(timer); // Timer löschen, wenn der Prozess normal endet
     });
});

module.exports = router;