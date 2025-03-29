document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('subnet-form');
    if (form) {
        form.addEventListener('submit', handleSubnetCalculation);
    }
});

function handleSubnetCalculation(event) {
    event.preventDefault(); // Verhindert das Neuladen der Seite

    const ipAddressInput = document.getElementById('ip-address').value.trim();
    const cidrInput = document.getElementById('cidr').value.trim();

    // Einfache Validierung (könnte verbessert werden)
    if (!isValidIP(ipAddressInput)) {
        alert("Bitte geben Sie eine gültige IP-Adresse ein.");
        return;
    }

    let cidr;
    let subnetMask;

    if (cidrInput.includes('.')) { // Annahme: Subnetzmaske im Format xxx.xxx.xxx.xxx
        if (!isValidIP(cidrInput)) {
            alert("Bitte geben Sie eine gültige Subnetzmaske ein.");
            return;
        }
        subnetMask = cidrInput;
        cidr = maskToCidr(subnetMask);
        if (cidr === null) {
            alert("Ungültige Subnetzmaske.");
            return;
        }
    } else { // Annahme: CIDR-Notation
        cidr = parseInt(cidrInput, 10);
        if (isNaN(cidr) || cidr < 0 || cidr > 32) {
            alert("Bitte geben Sie einen gültigen CIDR-Wert (0-32) ein.");
            return;
        }
        subnetMask = cidrToMask(cidr);
    }

    try {
        const results = calculateSubnet(ipAddressInput, cidr);
        displayResults(results, subnetMask);
    } catch (error) {
        alert("Fehler bei der Berechnung: " + error.message);
        clearResults();
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
    // Zähle die führenden Einsen
    let cidr = 0;
    let validMask = true;
    let encounteredZero = false;
    for (let i = 0; i < 32; i++) {
        if (binaryMask[i] === '1') {
            if (encounteredZero) { // Einsen dürfen nicht nach Nullen kommen
                validMask = false;
                break;
            }
            cidr++;
        } else {
            encounteredZero = true;
        }
    }
     // Prüfen, ob die Maske gültig ist (nur Einsen gefolgt von Nullen)
    const calculatedMask = '1'.repeat(cidr) + '0'.repeat(32 - cidr);
    if (!validMask || binaryMask !== calculatedMask) {
        return null; // Ungültige Maske
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
        broadcastBinary += (parseInt(networkBinary[i], 10) | (1 - parseInt(maskBinary[i], 10))).toString();
    }
    const broadcastAddress = binaryToIp(broadcastBinary);

    // Anzahl der Hosts
    const hostBits = 32 - cidr;
    const hostCount = hostBits <= 1 ? 0 : Math.pow(2, hostBits) - 2; // -2 für Netzwerk- und Broadcast-Adresse

    // Erste Host-Adresse (Netzwerkadresse + 1) - nur wenn Hosts möglich sind
    let firstHost = '-';
     if (hostBits > 1) {
        let firstHostBinary = networkBinary.substring(0, 31) + '1';
         // Sonderfall /31 Netzwerke haben keine traditionellen Host-Adressen
         if (cidr === 31) {
             firstHost = networkAddress; // Oder eine andere Konvention, je nach Definition
         } else {
            // Umwandlung in Zahl, +1, zurück in Binär (sicherer für Überlauf)
            const networkNum = parseInt(networkBinary, 2);
            firstHostBinary = (networkNum + 1).toString(2).padStart(32, '0');
            firstHost = binaryToIp(firstHostBinary);
         }
    }


    // Letzte Host-Adresse (Broadcast-Adresse - 1) - nur wenn Hosts möglich sind
    let lastHost = '-';
    if (hostBits > 1) {
        let lastHostBinary = broadcastBinary.substring(0, 31) + '0';
         // Sonderfall /31 Netzwerke
         if (cidr === 31) {
             lastHost = broadcastAddress; // Oder eine andere Konvention
         } else {
            // Umwandlung in Zahl, -1, zurück in Binär
            const broadcastNum = parseInt(broadcastBinary, 2);
            lastHostBinary = (broadcastNum - 1).toString(2).padStart(32, '0');
            lastHost = binaryToIp(lastHostBinary);
         }
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
}

function clearResults() {
     document.getElementById('network-address').textContent = '-';
    document.getElementById('broadcast-address').textContent = '-';
    document.getElementById('host-count').textContent = '-';
    document.getElementById('first-host').textContent = '-';
    document.getElementById('last-host').textContent = '-';
    document.getElementById('subnet-mask').textContent = '-';
}