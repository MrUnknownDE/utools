// Event Listener hinzufügen, sobald das DOM geladen ist
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('subnet-form');
    if (form) {
        console.log("Attaching submit listener to form:", form);
        form.addEventListener('submit', handleSubnetCalculation);
    } else {
        console.error("Subnetz-Formular (ID: subnet-form) nicht gefunden!");
    }
});

// Funktion zur Behandlung der Subnetzberechnung bei Formularübermittlung
function handleSubnetCalculation(event) {
    console.log("handleSubnetCalculation called"); // Protokoll: Start
    event.preventDefault(); // Verhindert das Neuladen der Seite
    clearResults(); // Ergebnisse zuerst löschen/verstecken

    const ipAddressInput = document.getElementById('ip-address').value.trim();
    const cidrInput = document.getElementById('cidr').value.trim();
    const resultsDiv = document.getElementById('results'); // Ergebnis-Div holen

    console.log(`Inputs: IP=${ipAddressInput}, CIDR/Mask=${cidrInput}`); // Protokoll: Eingaben

    // Einfache Validierung
    if (!isValidIP(ipAddressInput)) {
        console.error("Invalid IP address:", ipAddressInput); // Protokoll: Fehler
        alert("Bitte geben Sie eine gültige IPv4-Adresse ein.");
        return;
    }
    console.log("IP is valid"); // Protokoll: Erfolg

    let cidr;
    let subnetMask;

    // Prüfen, ob CIDR oder Subnetzmaske eingegeben wurde
    if (cidrInput.includes('.')) { // Annahme: Subnetzmaske im Format xxx.xxx.xxx.xxx
        console.log("Input detected as subnet mask"); // Protokoll: Pfad
        if (!isValidIP(cidrInput)) {
            console.error("Invalid subnet mask:", cidrInput); // Protokoll: Fehler
            alert("Bitte geben Sie eine gültige Subnetzmaske ein.");
            return;
        }
        subnetMask = cidrInput;
        cidr = maskToCidr(subnetMask);
        if (cidr === null) {
            console.error("maskToCidr returned null for mask:", subnetMask); // Protokoll: Fehler
            alert("Ungültige Subnetzmaske. Sie muss aus einer kontinuierlichen Folge von Einsen gefolgt von Nullen bestehen (z.B. 255.255.255.0, nicht 255.255.0.255).");
            return;
        }
        console.log(`Mask converted to CIDR: ${cidr}`); // Protokoll: Erfolg
    } else { // Annahme: CIDR-Notation
        console.log("Input detected as CIDR notation"); // Protokoll: Pfad
        cidr = parseInt(cidrInput, 10);
        if (isNaN(cidr) || cidr < 0 || cidr > 32) {
            console.error("Invalid CIDR value:", cidrInput); // Protokoll: Fehler
            alert("Bitte geben Sie einen gültigen CIDR-Wert (0-32) ein.");
            return;
        }
        subnetMask = cidrToMask(cidr);
        if (subnetMask === null) {
             console.error("cidrToMask returned null for CIDR:", cidr); // Protokoll: Fehler
             alert("Interner Fehler bei der Umwandlung von CIDR zu Maske."); // Sollte nicht passieren bei gültigem CIDR
             return;
        }
        console.log(`CIDR converted to mask: ${subnetMask}`); // Protokoll: Erfolg
    }

    // Berechnung durchführen und Ergebnisse anzeigen
    try {
        console.log(`Calculating subnet for IP=${ipAddressInput}, CIDR=${cidr}`); // Protokoll: Vor Berechnung
        const results = calculateSubnet(ipAddressInput, cidr);
        console.log("Calculation successful, results:", results); // Protokoll: Ergebnisse
        displayResults(results, subnetMask);
        if (resultsDiv) {
             resultsDiv.classList.remove('hidden'); // Ergebnisbereich sichtbar machen
             console.log("Results div made visible"); // Protokoll: Sichtbarkeit geändert
        } else {
            console.error("Results div not found!"); // Protokoll: Fehler, falls Div fehlt
        }
    } catch (error) {
        console.error("Error during subnet calculation:", error); // Protokoll: Ausnahme
        alert("Fehler bei der Berechnung: " + error.message);
        clearResults(); // Stellt sicher, dass der Ergebnisbereich bei Fehlern versteckt wird
    }
    console.log("handleSubnetCalculation finished"); // Protokoll: Ende
}

// --- Validierungs- und Hilfsfunktionen ---

function isValidIP(ip) {
    // Einfacher Regex für IPv4
    const ipPattern = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipPattern.test(ip);
}

function ipToBinary(ip) {
    // Wandelt eine IP-Adresse (String) in einen 32-Bit-Binärstring um
    return ip.split('.').map(octet => parseInt(octet, 10).toString(2).padStart(8, '0')).join('');
}

function binaryToIp(binary) {
    // Wandelt einen 32-Bit-Binärstring in eine IP-Adresse (String) um
    if (binary.length !== 32) return null; // Ungültige Länge
    const octets = [];
    for (let i = 0; i < 32; i += 8) {
        octets.push(parseInt(binary.substring(i, i + 8), 2));
    }
    return octets.join('.');
}

function cidrToMask(cidr) {
    // Wandelt eine CIDR-Zahl (0-32) in eine Subnetzmaske (String) um
    if (cidr < 0 || cidr > 32) return null;
    const maskBinary = '1'.repeat(cidr) + '0'.repeat(32 - cidr);
    return binaryToIp(maskBinary);
}

function maskToCidr(mask) {
    // Wandelt eine Subnetzmaske (String) in eine CIDR-Zahl um
    if (!isValidIP(mask)) return null;
    const binaryMask = ipToBinary(mask);

    // Prüfen, ob die Maske gültig ist (nur Einsen gefolgt von Nullen)
    let encounteredZero = false;
    for (let i = 0; i < 32; i++) {
        if (binaryMask[i] === '1') {
            if (encounteredZero) return null; // Eins nach Null -> ungültig
        } else {
            encounteredZero = true;
        }
    }

    // Zähle die Einsen (CIDR)
    let cidr = 0;
    for(let i = 0; i < 32; i++) {
        if (binaryMask[i] === '1') {
            cidr++;
        } else {
            break; // Nach der ersten Null können keine Einsen mehr kommen
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

    // Broadcast-Adresse berechnen (Netzwerkadresse | invertierte Maske)
    const invertedMaskBinary = '0'.repeat(cidr) + '1'.repeat(32 - cidr);
    const invertedMaskNum = parseInt(invertedMaskBinary, 2);
    const broadcastNum = networkNum | invertedMaskNum;
    const broadcastBinary = broadcastNum.toString(2).padStart(32, '0');
    const broadcastAddress = binaryToIp(broadcastBinary);

    // Anzahl der Hosts
    const hostBits = 32 - cidr;
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
        const firstHostBinary = (networkNum + 1).toString(2).padStart(32, '0');
        firstHost = binaryToIp(firstHostBinary);
    } else if (cidr === 31) { // /31: Die erste Adresse des /31
        firstHost = networkAddress;
    } else { // /32: Nur die eine Adresse
        firstHost = networkAddress;
    }

    // Letzte Host-Adresse
    let lastHost = '-';
    if (hostBits >= 2) { // /30 oder größer: Broadcast-Adresse - 1
        const lastHostBinary = (broadcastNum - 1).toString(2).padStart(32, '0');
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
    console.log("Displaying results:", results, "with mask:", subnetMask); // Protokoll: Anzeige
    // Ergebnisse in die entsprechenden HTML-Elemente schreiben
    document.getElementById('network-address').textContent = results.networkAddress;
    document.getElementById('broadcast-address').textContent = results.broadcastAddress;
    // Zeige Host Count nur an, wenn sinnvoll (>=0)
    document.getElementById('host-count').textContent = results.hostCount >= 0 ? results.hostCount.toLocaleString() : '-';
    document.getElementById('first-host').textContent = results.firstHost;
    document.getElementById('last-host').textContent = results.lastHost;
    document.getElementById('subnet-mask').textContent = subnetMask;
}

function clearResults() {
    console.log("Clearing results and hiding results div"); // Protokoll: Löschen
    // Setzt die Ergebnis-Felder zurück und versteckt den Bereich
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