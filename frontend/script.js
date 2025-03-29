// script.js
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements (User IP Info) ---
    const ipAddressEl = document.getElementById('ip-address');
    const countryEl = document.getElementById('country');
    const regionEl = document.getElementById('region');
    const cityEl = document.getElementById('city');
    const postalEl = document.getElementById('postal');
    const coordsEl = document.getElementById('coords');
    const timezoneEl = document.getElementById('timezone');
    const asnNumberEl = document.getElementById('asn-number');
    const asnOrgEl = document.getElementById('asn-org');
    const rdnsListEl = document.getElementById('rdns-list');
    const mapContainer = document.getElementById('map-container');
    const mapEl = document.getElementById('map');
    const mapMessageEl = document.getElementById('map-message');
    const globalErrorEl = document.getElementById('global-error');
    const ipLoader = document.getElementById('ip-loader');
    const geoLoader = document.getElementById('geo-loader');
    const asnLoader = document.getElementById('asn-loader');
    const rdnsLoader = document.getElementById('rdns-loader');
    const mapLoader = document.getElementById('map-loader');
    const geoErrorEl = document.getElementById('geo-error');
    const asnErrorEl = document.getElementById('asn-error');
    const rdnsErrorEl = document.getElementById('rdns-error');

    // --- DOM Elements (Lookup) ---
    const lookupIpInput = document.getElementById('lookup-ip-input');
    const lookupButton = document.getElementById('lookup-button');
    const lookupErrorEl = document.getElementById('lookup-error');
    const lookupResultsSection = document.getElementById('lookup-results-section');
    const lookupIpAddressEl = document.getElementById('lookup-ip-address');
    const lookupResultLoader = document.getElementById('lookup-result-loader');
    const lookupCountryEl = document.getElementById('lookup-country');
    const lookupRegionEl = document.getElementById('lookup-region');
    const lookupCityEl = document.getElementById('lookup-city');
    const lookupPostalEl = document.getElementById('lookup-postal');
    const lookupCoordsEl = document.getElementById('lookup-coords');
    const lookupTimezoneEl = document.getElementById('lookup-timezone');
    const lookupGeoErrorEl = document.getElementById('lookup-geo-error');
    const lookupAsnNumberEl = document.getElementById('lookup-asn-number');
    const lookupAsnOrgEl = document.getElementById('lookup-asn-org');
    const lookupAsnErrorEl = document.getElementById('lookup-asn-error');
    const lookupRdnsListEl = document.getElementById('lookup-rdns-list');
    const lookupRdnsErrorEl = document.getElementById('lookup-rdns-error');
    const lookupMapContainer = document.getElementById('lookup-map-container');
    const lookupMapEl = document.getElementById('lookup-map');
    const lookupMapLoader = document.getElementById('lookup-map-loader');
    const lookupMapMessageEl = document.getElementById('lookup-map-message');
    const lookupPingButton = document.getElementById('lookup-ping-button');
    const lookupTraceButton = document.getElementById('lookup-trace-button');
    const lookupPingResultsEl = document.getElementById('lookup-ping-results');
    const lookupPingLoader = document.getElementById('lookup-ping-loader');
    const lookupPingOutputEl = document.getElementById('lookup-ping-output');
    const lookupPingErrorEl = document.getElementById('lookup-ping-error');


    // --- DOM Elements (Traceroute) ---
    const tracerouteSection = document.getElementById('traceroute-section');
    const tracerouteOutputEl = document.querySelector('#traceroute-output pre');
    const tracerouteLoader = document.getElementById('traceroute-loader');
    const tracerouteMessage = document.getElementById('traceroute-message');

    // --- Configuration ---
    const API_BASE_URL = '/api'; // Anpassen, falls nötig

    // --- State ---
    let map = null; // Leaflet map instance for user's IP
    let lookupMap = null; // Leaflet map instance for lookup results
    let currentIp = null; // Store the user's fetched IP
    let currentLookupIp = null; // Store the last successfully looked-up IP
    let eventSource = null; // Store the EventSource instance for traceroute

    // --- Helper Functions ---

    /** Zeigt globale Fehler an */
    function showGlobalError(message) {
        globalErrorEl.textContent = `Error: ${message}`;
        globalErrorEl.classList.remove('hidden');
    }

    /** Versteckt globale Fehler */
    function hideGlobalError() {
        globalErrorEl.classList.add('hidden');
    }

    /**
     * Aktualisiert ein Info-Feld und versteckt optional einen Loader.
     * @param {HTMLElement} valueElement - Das Element, das den Wert anzeigt.
     * @param {any} value - Der anzuzeigende Wert oder ein Fehlerobjekt {error: string}.
     * @param {HTMLElement} [loaderElement] - Das zu versteckende Loader-Element.
     * @param {HTMLElement} [errorElement] - Das Element zur Anzeige von Fehlern für dieses Feld.
     * @param {string} [defaultValue='-'] - Standardwert bei fehlenden Daten.
     */
    function updateField(valueElement, value, loaderElement = null, errorElement = null, defaultValue = '-') {
        if (loaderElement) loaderElement.classList.add('hidden');
        if (errorElement) errorElement.textContent = ''; // Clear previous error

        // Zeige das Elternelement des valueElements, falls es vorher versteckt war (für initiale Ladeanzeige)
        if (valueElement?.parentElement?.classList.contains('hidden')) {
            valueElement.parentElement.classList.remove('hidden');
        }

        if (value && typeof value === 'object' && value.error) {
            if (valueElement) valueElement.textContent = defaultValue;
            if (errorElement) errorElement.textContent = value.error;
            else console.warn(`Error in field ${valueElement?.id}: ${value.error}`);
        } else if (value !== null && value !== undefined && value !== '') {
            if (valueElement) valueElement.textContent = value;
        } else {
            if (valueElement) valueElement.textContent = defaultValue;
        }
    }

     /**
      * Aktualisiert die rDNS Liste generisch.
      * @param {HTMLElement} listElement - Das UL Element.
      * @param {Array|object} rdnsData - Die rDNS Daten oder ein Fehlerobjekt.
      * @param {HTMLElement} [loaderElement] - Das zu versteckende Loader-Element.
      * @param {HTMLElement} [errorElement] - Das Element zur Anzeige von Fehlern.
      */
    function updateRdns(listElement, rdnsData, loaderElement = null, errorElement = null) {
        if (loaderElement) loaderElement.classList.add('hidden');
        if (listElement) listElement.innerHTML = ''; // Clear previous entries
        if (errorElement) errorElement.textContent = '';

         // Zeige das Elternelement des listElements, falls es vorher versteckt war
         if (listElement?.parentElement?.classList.contains('hidden')) {
            listElement.parentElement.classList.remove('hidden');
        }

        if (rdnsData && Array.isArray(rdnsData)) {
            if (rdnsData.length > 0) {
                 rdnsData.forEach(hostname => {
                    const li = document.createElement('li');
                    li.textContent = hostname;
                    if (listElement) listElement.appendChild(li);
                });
            } else {
                 if (listElement) listElement.innerHTML = '<li>-</li>';
            }
        } else if (rdnsData && rdnsData.error) {
            if (listElement) listElement.innerHTML = '<li>-</li>';
            if (errorElement) errorElement.textContent = rdnsData.error;
        } else {
            if (listElement) listElement.innerHTML = '<li>-</li>';
        }
    }

    /**
     * Initialisiert oder aktualisiert eine Leaflet-Karte.
     * @param {string} mapId - Die ID des Map-Containers ('map' oder 'lookup-map').
     * @param {number|null} lat - Breitengrad.
     * @param {number|null} lon - Längengrad.
     * @param {HTMLElement} mapElement - Das Karten-Div.
     * @param {HTMLElement} loaderElement - Das Loader-Element für die Karte.
     * @param {HTMLElement} messageElement - Das Nachrichten-Element für die Karte.
     * @returns {L.Map | null} Die Karteninstanz oder null bei Fehler.
     */
    function initOrUpdateMap(mapId, lat, lon, mapElement, loaderElement, messageElement) {
        loaderElement.classList.add('hidden'); // Hide loader first

        // Use a unique variable name for the map instance based on mapId
        let mapInstance = window[mapId + '_instance'];

        if (lat != null && lon != null) { // Check for non-null coordinates
            mapElement.classList.remove('hidden');
            messageElement.classList.add('hidden');

            if (mapInstance) {
                mapInstance.setView([lat, lon], 13);
                mapInstance.eachLayer((layer) => {
                    if (layer instanceof L.Marker) mapInstance.removeLayer(layer);
                });
                L.marker([lat, lon]).addTo(mapInstance).bindPopup(`Approximate Location`).openPopup();
            } else {
                mapInstance = L.map(mapId).setView([lat, lon], 13);
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    maxZoom: 19,
                    attribution: '© OpenStreetMap contributors'
                }).addTo(mapInstance);
                L.marker([lat, lon]).addTo(mapInstance).bindPopup(`Approximate Location`).openPopup();
                window[mapId + '_instance'] = mapInstance; // Store instance
            }
            // Invalidate size after showing/updating to prevent grey tiles
            setTimeout(() => {
                if (window[mapId + '_instance']) { // Check if map still exists
                    window[mapId + '_instance'].invalidateSize();
                }
            }, 100);
            return mapInstance;
        } else {
            mapElement.classList.add('hidden');
            messageElement.classList.remove('hidden');
            messageElement.textContent = 'Map could not be loaded (missing or invalid coordinates).';
            // If map existed, remove it to clean up resources
             if(mapInstance) {
                 mapInstance.remove();
                 window[mapId + '_instance'] = null;
             }
            return null;
        }
    }

    /** Ruft die IP-Informationen für die eigene IP ab */
    async function fetchIpInfo() {
        hideGlobalError();
        [ipLoader, geoLoader, asnLoader, rdnsLoader, mapLoader].forEach(l => l?.classList.remove('hidden'));
        // Hide data containers initially
        ipAddressEl.classList.add('hidden');
        geoInfo.querySelector('div').classList.add('hidden');
        asnInfo.querySelector('div').classList.add('hidden');
        rdnsInfo.querySelector('div').classList.add('hidden');
        mapEl.classList.add('hidden');
        mapMessageEl.classList.add('hidden');


        try {
            const response = await fetch(`${API_BASE_URL}/ipinfo`);
            if (!response.ok) throw new Error(`Network response: ${response.statusText} (${response.status})`);
            const data = await response.json();
            console.log('Received User IP Info:', data);

            currentIp = data.ip;
            updateField(ipAddressEl, data.ip, ipLoader);
            ipAddressEl.classList.remove('hidden'); // Show IP element
            if (data.ip) ipAddressEl.addEventListener('click', handleIpClick);

            updateField(countryEl, data.geo?.countryName ? `${data.geo.countryName} (${data.geo.country})` : null, null, geoErrorEl);
            updateField(regionEl, data.geo?.region);
            updateField(cityEl, data.geo?.city);
            updateField(postalEl, data.geo?.postalCode);
            updateField(coordsEl, data.geo?.latitude ? `${data.geo.latitude}, ${data.geo.longitude}` : null);
            updateField(timezoneEl, data.geo?.timezone, geoLoader); // Hide loader on last geo field

            updateField(asnNumberEl, data.asn?.number, null, asnErrorEl);
            updateField(asnOrgEl, data.asn?.organization, asnLoader);

            updateRdns(rdnsListEl, data.rdns, rdnsLoader, rdnsErrorEl);

            map = initOrUpdateMap('map', data.geo?.latitude, data.geo?.longitude, mapEl, mapLoader, mapMessageEl);

        } catch (error) {
            console.error('Failed to fetch user IP info:', error);
            showGlobalError(`Could not load initial IP information. ${error.message}`);
            [ipLoader, geoLoader, asnLoader, rdnsLoader, mapLoader].forEach(l => l?.classList.add('hidden'));
            mapMessageEl.textContent = 'Map could not be loaded due to an error.';
            mapMessageEl.classList.remove('hidden');
        }
    }

    // --- Lookup Functions ---

    /** Zeigt Fehler im Lookup-Bereich an */
    function showLookupError(message) {
        lookupErrorEl.textContent = `Error: ${message}`;
        lookupErrorEl.classList.remove('hidden');
    }

    /** Versteckt Fehler im Lookup-Bereich */
    function hideLookupError() {
        lookupErrorEl.classList.add('hidden');
    }

     /** Setzt den Lookup-Ergebnisbereich zurück */
     function resetLookupResults() {
        lookupResultsSection.classList.add('hidden');
        lookupResultLoader.classList.add('hidden');
        lookupMapLoader.classList.add('hidden');
        lookupMapEl.classList.add('hidden');
        lookupMapMessageEl.classList.add('hidden');
        lookupPingResultsEl.classList.add('hidden'); // Hide ping results too
        lookupPingLoader.classList.add('hidden');
        lookupPingOutputEl.textContent = '';
        lookupPingErrorEl.textContent = '';

        const fieldsToClear = [
            lookupIpAddressEl, lookupCountryEl, lookupRegionEl, lookupCityEl,
            lookupPostalEl, lookupCoordsEl, lookupTimezoneEl, lookupAsnNumberEl,
            lookupAsnOrgEl, lookupGeoErrorEl, lookupAsnErrorEl, lookupRdnsErrorEl
        ];
        fieldsToClear.forEach(el => { if (el) el.textContent = ''; });
        if (lookupRdnsListEl) lookupRdnsListEl.innerHTML = '<li>-</li>';

        lookupPingButton.disabled = true;
        lookupTraceButton.disabled = true;
        currentLookupIp = null;

        // Remove lookup map instance if it exists
        if (window['lookup-map_instance']) {
            window['lookup-map_instance'].remove();
            window['lookup-map_instance'] = null;
        }
     }

    /** Ruft Informationen für eine spezifische IP ab */
    async function fetchLookupInfo(ipToLookup) {
        resetLookupResults();
        hideLookupError();
        hideGlobalError();
        lookupResultsSection.classList.remove('hidden');
        lookupResultLoader.classList.remove('hidden');
        lookupMapLoader.classList.remove('hidden'); // Show map loader initially

        try {
            const response = await fetch(`${API_BASE_URL}/lookup?targetIp=${encodeURIComponent(ipToLookup)}`); // Use targetIp parameter
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || `Network response: ${response.statusText} (${response.status})`);
            }

            console.log(`Received Lookup Info for ${ipToLookup}:`, data);
            currentLookupIp = data.ip;

            updateField(lookupIpAddressEl, data.ip);
            updateField(lookupCountryEl, data.geo?.countryName ? `${data.geo.countryName} (${data.geo.country})` : null, null, lookupGeoErrorEl);
            updateField(lookupRegionEl, data.geo?.region);
            updateField(lookupCityEl, data.geo?.city);
            updateField(lookupPostalEl, data.geo?.postalCode);
            updateField(lookupCoordsEl, data.geo?.latitude ? `${data.geo.latitude}, ${data.geo.longitude}` : null);
            updateField(lookupTimezoneEl, data.geo?.timezone);

            updateField(lookupAsnNumberEl, data.asn?.number, null, lookupAsnErrorEl);
            updateField(lookupAsnOrgEl, data.asn?.organization);

            updateRdns(lookupRdnsListEl, data.rdns, null, lookupRdnsErrorEl);

            lookupMap = initOrUpdateMap('lookup-map', data.geo?.latitude, data.geo?.longitude, lookupMapEl, lookupMapLoader, lookupMapMessageEl);

            lookupPingButton.disabled = false;
            lookupTraceButton.disabled = false;

        } catch (error) {
            console.error(`Failed to fetch lookup info for ${ipToLookup}:`, error);
            showLookupError(`${error.message}`);
            lookupMapMessageEl.textContent = 'Map could not be loaded due to an error.';
            lookupMapMessageEl.classList.remove('hidden');
            lookupMapEl.classList.add('hidden');
            lookupMapLoader.classList.add('hidden'); // Hide loader on error

        } finally {
             lookupResultLoader.classList.add('hidden'); // Hide main loader
             // Map loader is handled by initOrUpdateMap
        }
    }

    // --- Ping Function (for Lookup) ---
    async function runLookupPing(ip) {
        if (!ip) return;

        lookupPingResultsEl.classList.remove('hidden');
        lookupPingLoader.classList.remove('hidden');
        lookupPingOutputEl.textContent = '';
        lookupPingErrorEl.textContent = '';
        hideLookupError(); // Hide general lookup errors

        try {
            const response = await fetch(`${API_BASE_URL}/ping?targetIp=${encodeURIComponent(ip)}`);
            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || `Ping request failed with status ${response.status}`);
            }

            console.log(`Ping results for ${ip}:`, data);

            // Display parsed results nicely
            let outputText = `--- Ping Statistics for ${ip} ---\n`;
            if (data.stats) {
                outputText += `Packets: ${data.stats.packets.transmitted} transmitted, ${data.stats.packets.received} received, ${data.stats.packets.lossPercent}% loss\n`;
                if (data.stats.rtt) {
                    outputText += `Round Trip Time (ms): min=${data.stats.rtt.min}, avg=${data.stats.rtt.avg}, max=${data.stats.rtt.max}, mdev=${data.stats.rtt.mdev}\n`;
                } else if (data.stats.packets.received === 0) {
                     outputText += `Status: Host unreachable or request timed out.\n`;
                }
            } else {
                 outputText += `Could not parse statistics.\n`;
            }
            outputText += `\n--- Raw Output ---\n${data.rawOutput || 'No raw output available.'}`;
            lookupPingOutputEl.textContent = outputText;

        } catch (error) {
            console.error(`Failed to run ping for ${ip}:`, error);
            lookupPingErrorEl.textContent = `Ping Error: ${error.message}`;
        } finally {
            lookupPingLoader.classList.add('hidden');
        }
    }


    // --- Traceroute Functions ---
    function startTraceroute(ip) {
        if (!ip) {
            showGlobalError('Cannot start traceroute: IP address is missing.');
            return;
        }
        if (eventSource) {
            eventSource.close();
            console.log('Previous EventSource closed.');
        }

        tracerouteSection.classList.remove('hidden');
        tracerouteOutputEl.textContent = '';
        tracerouteLoader.classList.remove('hidden');
        tracerouteMessage.textContent = `Starting traceroute to ${ip}...`;
        hideGlobalError();
        hideLookupError();

        const url = `${API_BASE_URL}/traceroute?targetIp=${encodeURIComponent(ip)}`;
        eventSource = new EventSource(url);

        eventSource.onopen = () => {
            console.log('SSE connection opened for traceroute.');
            tracerouteMessage.textContent = `Traceroute to ${ip} in progress...`;
        };

        eventSource.onerror = (event) => {
            console.error('EventSource failed:', event);
            let errorMsg = 'Connection error during traceroute.';
            if (eventSource.readyState === EventSource.CLOSED) {
                 errorMsg = 'Connection closed. Server might have stopped or a network issue occurred.';
            }
            tracerouteMessage.textContent = errorMsg;
            tracerouteLoader.classList.add('hidden');
            // Don't show global error here, as it might be a normal close
            eventSource.close();
        };

        eventSource.addEventListener('hop', (event) => {
            try {
                const hopData = JSON.parse(event.data);
                displayTracerouteHop(hopData);
            } catch (e) { displayTracerouteLine(`[Error parsing hop data: ${event.data}]`, 'error-line'); }
        });

        eventSource.addEventListener('info', (event) => {
             try {
                const infoData = JSON.parse(event.data);
                displayTracerouteLine(infoData.message, 'info-line');
            } catch (e) { displayTracerouteLine(`[Error parsing info data: ${event.data}]`, 'error-line'); }
        });

        eventSource.addEventListener('error', (event) => { // Backend error event
             try {
                const errorData = JSON.parse(event.data);
                displayTracerouteLine(errorData.error, 'error-line');
                tracerouteMessage.textContent = `Error during traceroute: ${errorData.error}`;
            } catch (e) { displayTracerouteLine(`[Received unparseable error event: ${event.data}]`, 'error-line'); }
        });

        eventSource.addEventListener('end', (event) => {
            console.log('SSE connection closed by server (end event).');
             try {
                const endData = JSON.parse(event.data);
                const endMessage = `Traceroute finished ${endData.exitCode === 0 ? 'successfully' : `with exit code ${endData.exitCode}`}.`;
                displayTracerouteLine(endMessage, 'end-line');
                tracerouteMessage.textContent = endMessage;
            } catch (e) { displayTracerouteLine('[Traceroute finished, error parsing end event]', 'end-line'); }
            tracerouteLoader.classList.add('hidden');
            eventSource.close();
        });
    }

    function displayTracerouteLine(text, className = '') {
         const lineDiv = document.createElement('div');
         if (className) lineDiv.classList.add(className);
         lineDiv.textContent = text;
         tracerouteOutputEl.appendChild(lineDiv);
         tracerouteOutputEl.scrollTop = tracerouteOutputEl.scrollHeight;
    }

    function displayTracerouteHop(hopData) {
        const lineDiv = document.createElement('div');
        lineDiv.classList.add('hop-line');

        const hopNumSpan = document.createElement('span');
        hopNumSpan.classList.add('hop-number');
        hopNumSpan.textContent = hopData.hop || '?';
        lineDiv.appendChild(hopNumSpan);

        if (hopData.ip) {
            const ipSpan = document.createElement('span');
            ipSpan.classList.add('hop-ip');
            ipSpan.textContent = hopData.ip;
            lineDiv.appendChild(ipSpan);
            if (hopData.hostname) {
                const hostSpan = document.createElement('span');
                hostSpan.classList.add('hop-hostname');
                hostSpan.textContent = ` (${hopData.hostname})`;
                lineDiv.appendChild(hostSpan);
            }
        } else if (hopData.rtt && hopData.rtt.every(r => r === '*')) {
             const timeoutSpan = document.createElement('span');
             timeoutSpan.classList.add('hop-timeout');
             timeoutSpan.textContent = '* * *';
             lineDiv.appendChild(timeoutSpan);
        } else {
             lineDiv.appendChild(document.createTextNode(hopData.rawLine || 'Unknown hop format'));
        }

        if (hopData.rtt && Array.isArray(hopData.rtt)) {
            hopData.rtt.forEach(rtt => {
                const rttSpan = document.createElement('span');
                if (rtt === '*') {
                    rttSpan.classList.add('hop-timeout');
                    rttSpan.textContent = ' *';
                } else {
                    rttSpan.classList.add('hop-rtt');
                    rttSpan.textContent = ` ${rtt} ms`;
                }
                lineDiv.appendChild(rttSpan);
            });
        }
        tracerouteOutputEl.appendChild(lineDiv);
        tracerouteOutputEl.scrollTop = tracerouteOutputEl.scrollHeight;
    }

    // --- Event Handlers ---
    function handleIpClick(event) {
        event.preventDefault();
        if (currentIp) {
            console.log(`User IP clicked: ${currentIp}. Starting traceroute...`);
            startTraceroute(currentIp);
        }
    }

    function handleLookupClick() {
        const ipToLookup = lookupIpInput.value.trim();
        if (!ipToLookup) {
            showLookupError('Please enter an IP address.');
            return;
        }
        console.log(`Lookup button clicked for IP: ${ipToLookup}`);
        fetchLookupInfo(ipToLookup);
    }

     function handleLookupPingClick() {
         if (currentLookupIp) {
             console.log(`Starting ping for looked-up IP: ${currentLookupIp}`);
             runLookupPing(currentLookupIp); // Call the new ping function
         }
     }

     function handleLookupTraceClick() {
         if (currentLookupIp) {
             console.log(`Starting traceroute for looked-up IP: ${currentLookupIp}`);
             startTraceroute(currentLookupIp);
         }
     }

    // --- Initial Load & Event Listeners ---
    fetchIpInfo(); // Lade Infos zur eigenen IP

    lookupButton.addEventListener('click', handleLookupClick);
    lookupIpInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') handleLookupClick();
    });
    lookupPingButton.addEventListener('click', handleLookupPingClick);
    lookupTraceButton.addEventListener('click', handleLookupTraceClick);

}); // End DOMContentLoaded