// Event Listener hinzufügen, sobald das DOM geladen ist
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('subnet-form');
    if (form) {
        form.addEventListener('submit', handleSubnetCalculation);
    } else {
        console.error("Subnetz-Formular (ID: subnet-form) nicht gefunden!");
    }
});

// Funktion zur Behandlung der Subnetzberechnung bei Formularübermittlung
function handleSubnetCalculation(event) {
    event.preventDefault(); // Verhindert das Neuladen der Seite
    clearResults(); // Ergebnisse zuerst löschen/verstecken

    const ipAddressInput = document.getElementById('ip-address').value.trim();
    const cidrInput = document.getElementById('cidr').value.trim();
    const resultsDiv = document.getElementById('results'); // Ergebnis-Div holen

    // Einfache Validierung
    if (!isValidIP(ipAddressInput)) {
        alert("Bitte geben Sie eine gültige IPv4-Adresse ein.");
        return;
    }

    let cidr;
    let subnetMask;

    // Prüfen, ob CIDR oder Subnetzmaske eingegeben wurde
    if (cidrInput.includes('.')) { // Annahme: Subnetzmaske im Format xxx.xxx.xxx.xxx
        if (!isValidIP(cidrInput)) {
            alert("Bitte geben Sie eine gültige Subnetzmaske ein.");
            return;
        }
        subnetMask = cidrInput;
        cidr = maskToCidr(subnetMask);
        if (cidr === null) {
            alert("Ungültige Subnetzmaske. Sie muss aus einer kontinuierlichen Folge von Einsen gefolgt von Nullen bestehen (z.B. 255.255.255.0, nicht 255.255.0.255).");
            return;
        }
    } else { // Annahme: CIDR-Notation
        cidr = parseInt(cidrInput, 10);
        if (isNaN(cidr) || cidr < 0 || cidr > 32) {
            alert("Bitte geben Sie einen gültigen CIDR-Wert (0-32) ein.");
            return;
        }
        subnetMask = cidrToMask(cidr);
        if (subnetMask === null) {
             alert("Interner Fehler bei der Umwandlung von CIDR zu Maske.");
             return;
        }
    }

    // Berechnung durchführen und Ergebnisse anzeigen
    try {
        const results = calculateSubnet(ipAddressInput, cidr);
        displayResults(results, subnetMask);
        if (resultsDiv) {
             resultsDiv.classList.remove('hidden'); // Ergebnisbereich sichtbar machen
        } else {
             console.error("Ergebnis-Div (ID: results) nicht gefunden!");
        }
    } catch (error) {
        console.error("Fehler bei der Subnetzberechnung:", error);
        alert("Fehler bei der Berechnung: " + error.message);
        clearResults();
    }
}

// --- Validierungs- und Hilfsfunktionen ---

function isValidIP(ip) {
    const ipPattern = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipPattern.test(ip);
}

function ipToBinary(ip) {
    return ip.split('.').map(octet => parseInt(octet, 10).toString(2).padStart(8, '0')).join('');
}

function binaryToIp(binary) {
    if (binary.length !== 32) return null;
    const octets = [];
    for (let i = 0; i < 32; i += 8) {
        octets.push(parseInt(binary.substring(i, i + 8), 2));
    }
    return octets.join('.');
}

function cidrToMask(cidr) {
    if (cidr < 0 || cidr > 32) return null;
    const maskBinary = '1'.repeat(cidr) + '0'.repeat(32 - cidr);
    return binaryToIp(maskBinary);
}

function maskToCidr(mask) {
    if (!isValidIP(mask)) return null;
    const binaryMask = ipToBinary(mask);
    let encounteredZero = false;
    for (let i = 0; i < 32; i++) {
        if (binaryMask[i] === '1') {
            if (encounteredZero) return null;
        } else {
            encounteredZero = true;
        }
    }
    let cidr = 0;
    for(let i = 0; i < 32; i++) {
        if (binaryMask[i] === '1') {
            cidr++;
        } else {
            break;
        }
    }
    return cidr;
}

// --- Berechnungsfunktion ---

function calculateSubnet(ip, cidr) {
    const ipBinary = ipToBinary(ip);
    const maskBinary = '1'.repeat(cidr) + '0'.repeat(32 - cidr);

    // Netzwerkadresse berechnen (Bitweises UND von IP und Maske)
    let networkBinary = '';
    for (let i = 0; i < 32; i++) {
        networkBinary += (parseInt(ipBinary[i], 10) & parseInt(maskBinary[i], 10)).toString();
    }
    const networkAddress = binaryToIp(networkBinary);
    const networkNum = parseInt(networkBinary, 2); // Netzwerkadresse als Zahl

    // Broadcast-Adresse berechnen (Netzwerk-Teil + Host-Teil mit Einsen) - Korrigierte Methode
    const hostBitsCount = 32 - cidr;
    let broadcastBinary = networkBinary.substring(0, cidr) + '1'.repeat(hostBitsCount);
    // Sicherstellen, dass die Länge 32 Bit beträgt (sollte sie aber ohnehin)
    broadcastBinary = broadcastBinary.padEnd(32, '1'); // Auffüllen mit 1, falls Länge < 32 (unwahrscheinlich)

    const broadcastAddress = binaryToIp(broadcastBinary);
    // broadcastNum wird für die letzte Host-Adresse benötigt
    const broadcastNum = parseInt(broadcastBinary, 2);

    // Anzahl der Hosts
    const hostBits = 32 - cidr; // hostBitsCount umbenannt für Konsistenz
    let hostCount = 0;
    if (hostBits >= 2) { // Mindestens /30 für 2 Hosts (-2)
        hostCount = Math.pow(2, hostBits) - 2;
    } else if (hostBits === 1) { // /31 hat 2 Adressen, beide nutzbar (RFC 3021)
        hostCount = 2;
    } else { // /32 hat nur 1 Adresse
        hostCount = 1;
    }

    // Erste Host-Adresse
    let firstHost = '-';
    if (hostBits >= 2) { // /30 oder größer: Netzwerkadresse + 1
        // Sicherstellen, dass die Addition korrekt behandelt wird (als Zahl)
        const firstHostNum = networkNum + 1;
        const firstHostBinary = firstHostNum.toString(2).padStart(32, '0');
        firstHost = binaryToIp(firstHostBinary);
    } else if (cidr === 31) { // /31: Die erste Adresse des /31
        firstHost = networkAddress;
    } else { // /32: Nur die eine Adresse
        firstHost = networkAddress;
    }

    // Letzte Host-Adresse
    let lastHost = '-';
    if (hostBits >= 2) { // /30 oder größer: Broadcast-Adresse - 1
        // Sicherstellen, dass die Subtraktion korrekt behandelt wird (als Zahl)
        const lastHostNum = broadcastNum - 1;
        const lastHostBinary = lastHostNum.toString(2).padStart(32, '0');
        lastHost = binaryToIp(lastHostBinary);
    } else if (cidr === 31) { // /31: Die zweite Adresse des /31
        lastHost = broadcastAddress;
    } else { // /32: Nur die eine Adresse
        lastHost = networkAddress;
    }

    return {
        networkAddress,
        broadcastAddress,
        hostCount,
        firstHost,
        lastHost
    };
}

// --- Anzeige-Funktionen ---

function displayResults(results, subnetMask) {
    document.getElementById('network-address').textContent = results.networkAddress;
    document.getElementById('broadcast-address').textContent = results.broadcastAddress;
    document.getElementById('host-count').textContent = results.hostCount >= 0 ? results.hostCount.toLocaleString() : '-';
    document.getElementById('first-host').textContent = results.firstHost;
    document.getElementById('last-host').textContent = results.lastHost;
    document.getElementById('subnet-mask').textContent = subnetMask;
}

function clearResults() {
    document.getElementById('network-address').textContent = '-';
    document.getElementById('broadcast-address').textContent = '-';
    document.getElementById('host-count').textContent = '-';
    document.getElementById('first-host').textContent = '-';
    document.getElementById('last-host').textContent = '-';
    document.getElementById('subnet-mask').textContent = '-';

    const resultsDiv = document.getElementById('results');
    if (resultsDiv && !resultsDiv.classList.contains('hidden')) {
        resultsDiv.classList.add('hidden');
    }
}