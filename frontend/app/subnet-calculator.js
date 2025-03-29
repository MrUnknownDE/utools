document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('subnet-form');
    if (form) {
        form.addEventListener('submit', handleSubnetCalculation);
    }
    // Beispiel-Links (aus HTML hierher verschoben für bessere Organisation)
    document.querySelectorAll('.example-link').forEach(link => {
        link.addEventListener('click', (event) => {
            const ip = event.target.getAttribute('data-ip');
            const cidr = event.target.getAttribute('data-cidr');
            document.getElementById('ip-address').value = ip;
            document.getElementById('cidr').value = cidr;
            // Berechnung direkt auslösen
            form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
            // Optional: Zum Ergebnisbereich scrollen, wenn er sichtbar wird
            // document.getElementById('results').scrollIntoView({ behavior: 'smooth' });
        });
    });
});

function handleSubnetCalculation(event) {
    event.preventDefault(); // Verhindert das Neuladen der Seite
    clearResults(); // Ergebnisse zuerst löschen/verstecken

    const ipAddressInput = document.getElementById('ip-address').value.trim();
    const cidrInput = document.getElementById('cidr').value.trim();

    // Einfache Validierung (könnte verbessert werden)
    if (!isValidIP(ipAddressInput)) {
        alert("Bitte geben Sie eine gültige IP-Adresse ein.");
        // clearResults(); // Bereits oben erledigt
        return;
    }

    let cidr;
    let subnetMask;

    if (cidrInput.includes('.')) { // Annahme: Subnetzmaske im Format xxx.xxx.xxx.xxx
        if (!isValidIP(cidrInput)) {
            alert("Bitte geben Sie eine gültige Subnetzmaske ein.");
            // clearResults(); // Bereits oben erledigt
            return;
        }
        subnetMask = cidrInput;
        cidr = maskToCidr(subnetMask);
        if (cidr === null) {
            alert("Ungültige Subnetzmaske. Sie muss aus einer kontinuierlichen Folge von Einsen gefolgt von Nullen bestehen.");
            // clearResults(); // Bereits oben erledigt
            return;
        }
    } else { // Annahme: CIDR-Notation
        cidr = parseInt(cidrInput, 10);
        if (isNaN(cidr) || cidr < 0 || cidr > 32) {
            alert("Bitte geben Sie einen gültigen CIDR-Wert (0-32) ein.");
            // clearResults(); // Bereits oben erledigt
            return;
        }
        subnetMask = cidrToMask(cidr);
    }

    try {
        const results = calculateSubnet(ipAddressInput, cidr);
        displayResults(results, subnetMask);
    } catch (error) {
        alert("Fehler bei der Berechnung: " + error.message);
        clearResults(); // Sicherstellen, dass bei Fehler alles versteckt ist
    }
}

function isValidIP(ip) {
    const ipPattern = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipPattern.test(ip);
}

function ipToBinary(ip) {
    return ip.split('.').map(octet => parseInt(octet, 10).toString(2).padStart(8, '0')).join('');
}

function binaryToIp(binary) {
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
    // Prüfen, ob die Maske gültig ist (nur Einsen gefolgt von Nullen)
    let encounteredZero = false;
    for (let i = 0; i < 32; i++) {
        if (binaryMask[i] === '1') {
            if (encounteredZero) { // Eins nach Null -> ungültig
                return null;
            }
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


function calculateSubnet(ip, cidr) {
    const ipBinary = ipToBinary(ip);
    const maskBinary = '1'.repeat(cidr) + '0'.repeat(32 - cidr);

    // Netzwerkadresse berechnen (Bitweises UND)
    let networkBinary = '';
    for (let i = 0; i < 32; i++) {
        networkBinary += (parseInt(ipBinary[i], 10) & parseInt(maskBinary[i], 10)).toString();
    }
    const networkAddress = binaryToIp(networkBinary);

    // Broadcast-Adresse berechnen (Netzwerkadresse | invertierte Maske)
    let broadcastBinary = '';
    for (let i = 0; i < 32; i++) {
        // broadcastBinary += (parseInt(networkBinary[i], 10) | (1 - parseInt(maskBinary[i], 10))).toString(); // Fehlerhaft für Netzwerkadresse
         broadcastBinary += (parseInt(ipBinary[i], 10) | (1 - parseInt(maskBinary[i], 10))).toString(); // Korrekt: IP | invertierte Maske
    }
     // Korrektur: Sicherstellen, dass die Broadcast-Adresse korrekt berechnet wird
     const networkNum = parseInt(networkBinary, 2);
     const invertedMaskNum = parseInt('0'.repeat(cidr) + '1'.repeat(32 - cidr), 2);
     broadcastBinary = (networkNum | invertedMaskNum).toString(2).padStart(32, '0');
    const broadcastAddress = binaryToIp(broadcastBinary);


    // Anzahl der Hosts
    const hostBits = 32 - cidr;
    // const hostCount = hostBits <= 1 ? 0 : Math.pow(2, hostBits) - 2; // -2 für Netzwerk- und Broadcast-Adresse
    let hostCount = 0;
    if (hostBits >= 2) { // Mindestens /30 für 2 Hosts (-2)
        hostCount = Math.pow(2, hostBits) - 2;
    } else if (hostBits === 1) { // /31 hat 2 Adressen, beide nutzbar (RFC 3021)
        hostCount = 2; // Oder 0, je nach Interpretation, ob man sie "Hosts" nennt
    } else { // /32 hat nur 1 Adresse
        hostCount = 1;
    }


    // Erste Host-Adresse (Netzwerkadresse + 1) - nur wenn Hosts möglich sind
    let firstHost = '-';
     if (hostBits >= 2) { // /30 oder größer
        const networkNum = parseInt(networkBinary, 2);
        const firstHostBinary = (networkNum + 1).toString(2).padStart(32, '0');
        firstHost = binaryToIp(firstHostBinary);
     } else if (cidr === 31) { // /31 - beide Adressen sind nutzbar
         firstHost = networkAddress; // Die erste Adresse des /31
     } else { // /32 - nur die eine Adresse
         firstHost = networkAddress;
     }


    // Letzte Host-Adresse (Broadcast-Adresse - 1) - nur wenn Hosts möglich sind
    let lastHost = '-';
    if (hostBits >= 2) { // /30 oder größer
        const broadcastNum = parseInt(broadcastBinary, 2);
        const lastHostBinary = (broadcastNum - 1).toString(2).padStart(32, '0');
        lastHost = binaryToIp(lastHostBinary);
    } else if (cidr === 31) { // /31 - beide Adressen sind nutzbar
        lastHost = broadcastAddress; // Die zweite Adresse des /31
    } else { // /32 - nur die eine Adresse
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

function displayResults(results, subnetMask) {
    document.getElementById('network-address').textContent = results.networkAddress;
    document.getElementById('broadcast-address').textContent = results.broadcastAddress;
    document.getElementById('host-count').textContent = results.hostCount >= 0 ? results.hostCount.toLocaleString() : '-';
    document.getElementById('first-host').textContent = results.firstHost;
    document.getElementById('last-host').textContent = results.lastHost;
    document.getElementById('subnet-mask').textContent = subnetMask; // Zeige die berechnete/validierte Maske an

    // Ergebnisbereich sichtbar machen
    const resultsDiv = document.getElementById('results');
    if (resultsDiv) {
        resultsDiv.classList.remove('hidden');
    }
}

function clearResults() {
     document.getElementById('network-address').textContent = '-';
    document.getElementById('broadcast-address').textContent = '-';
    document.getElementById('host-count').textContent = '-';
    document.getElementById('first-host').textContent = '-';
    document.getElementById('last-host').textContent = '-';
    document.getElementById('subnet-mask').textContent = '-';

    // Ergebnisbereich wieder verstecken
    const resultsDiv = document.getElementById('results');
    if (resultsDiv) {
        resultsDiv.classList.add('hidden');
    }
}