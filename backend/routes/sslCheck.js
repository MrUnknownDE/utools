const express = require('express');
const { exec } = require('child_process');
const router = express.Router();

// Funktion zum Parsen der openssl s_client Ausgabe
function parseSslOutput(output) {
    const result = {
        issuer: null,
        subject: null,
        validFrom: null,
        validTo: null,
        error: null,
        details: output // Rohausgabe für Debugging
    };

    try {
        const issuerMatch = output.match(/issuer=([^\n]+)/);
        if (issuerMatch) result.issuer = issuerMatch[1].trim();

        const subjectMatch = output.match(/subject=([^\n]+)/);
        if (subjectMatch) result.subject = subjectMatch[1].trim();

        // Gültigkeitsdaten extrahieren (Beispielformat: notBefore=..., notAfter=...)
        // openssl Datumsformate können variieren, dies ist ein einfacher Ansatz
        const validFromMatch = output.match(/notBefore=([^\n]+)/);
        if (validFromMatch) result.validFrom = new Date(validFromMatch[1].trim()).toISOString();

        const validToMatch = output.match(/notAfter=([^\n]+)/);
        if (validToMatch) result.validTo = new Date(validToMatch[1].trim()).toISOString();

        // Einfache Bewertung: Ist das Zertifikat noch gültig?
        if (result.validFrom && result.validTo) {
            const now = new Date();
            const validFromDate = new Date(result.validFrom);
            const validToDate = new Date(result.validTo);
            if (now < validFromDate || now > validToDate) {
                result.validity = "Invalid (Expired or Not Yet Valid)";
            } else {
                result.validity = "Valid";
            }
        } else {
             result.validity = "Could not determine validity";
        }


    } catch (e) {
        console.error("Error parsing openssl output:", e);
        result.error = "Error parsing certificate details.";
    }

    return result;
}


router.get('/', async (req, res) => {
    const domain = req.query.domain;

    if (!domain) {
        return res.status(400).json({ error: 'Domain parameter is required' });
    }

    // Verwende Port 443 für HTTPS
    const command = `echo | openssl s_client -servername ${domain} -connect ${domain}:443 -showcerts 2>/dev/null | openssl x509 -noout -text`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`exec error: ${error}`);
            // Versuche, spezifischere Fehler zu erkennen
            if (stderr.includes("connect:errno=") || error.message.includes("getaddrinfo ENOTFOUND")) {
                 return res.status(500).json({ error: `Could not connect to domain: ${domain}`, details: stderr || error.message });
            }
             if (stderr.includes("SSL alert number 40")) {
                 return res.status(500).json({ error: `No SSL certificate found or SSL handshake failed for domain: ${domain}`, details: stderr });
            }
            return res.status(500).json({ error: 'Failed to execute openssl command', details: stderr || error.message });
        }

        if (stderr) {
             console.warn(`openssl stderr: ${stderr}`); // Warnung, aber fahre fort, wenn stdout vorhanden ist
        }

        if (!stdout) {
             return res.status(500).json({ error: 'No certificate information received from openssl', details: stderr });
        }

        const certInfo = parseSslOutput(stdout);
        if (certInfo.error) {
             // Wenn beim Parsen ein Fehler aufgetreten ist, aber stdout vorhanden war
             return res.status(500).json({ error: certInfo.error, raw_output: stdout });
        }


        // Einfache Bewertung hinzufügen (Beispiel)
        let score = 0;
        let evaluation = [];
        if (certInfo.validity === "Valid") {
            score += 5;
            evaluation.push("Certificate is currently valid.");

             // Prüfe die verbleibende Gültigkeitsdauer
             const daysRemaining = Math.floor((new Date(certInfo.validTo) - new Date()) / (1000 * 60 * 60 * 24));
             if (daysRemaining < 30) {
                 score -= 2;
                 evaluation.push(`Warning: Certificate expires in ${daysRemaining} days.`);
             } else {
                 score += 2;
                 evaluation.push(`Certificate expires in ${daysRemaining} days.`);
             }
        } else {
            evaluation.push("Certificate is not valid.");
        }

        // Weitere Prüfungen könnten hier hinzugefügt werden (z.B. auf schwache Signaturalgorithmen, Schlüssellänge etc.)

        res.json({
            domain: domain,
            certificate: certInfo,
            evaluation: {
                score: Math.max(0, Math.min(10, score)), // Score zwischen 0 und 10
                summary: evaluation.join(' ')
            }
         });
    });
});

module.exports = router;