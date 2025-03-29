// frontend/dns-lookup.js
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements (DNS Lookup) ---
    const dnsDomainInput = document.getElementById('dns-domain-input');
    const dnsTypeSelect = document.getElementById('dns-type-select');
    const dnsLookupButton = document.getElementById('dns-lookup-button');
    const dnsLookupErrorEl = document.getElementById('dns-lookup-error');
    const dnsLookupResultsSection = document.getElementById('dns-lookup-results-section');
    const dnsLookupQueryEl = document.getElementById('dns-lookup-query');
    const dnsLookupLoader = document.getElementById('dns-lookup-loader');
    const dnsLookupOutputEl = document.getElementById('dns-lookup-output');

    // --- DOM Elements (Common) ---
    const globalErrorEl = document.getElementById('global-error');
    const commitShaEl = document.getElementById('commit-sha');

    // --- Configuration ---
    const API_BASE_URL = '/api'; // Anpassen, falls nötig

    // --- Helper Functions ---

    /** Zeigt globale Fehler an */
    function showGlobalError(message) {
        if (!globalErrorEl) return;
        globalErrorEl.textContent = `Error: ${message}`;
        globalErrorEl.classList.remove('hidden');
    }

    /** Versteckt globale Fehler */
    function hideGlobalError() {
        if (!globalErrorEl) return;
        globalErrorEl.classList.add('hidden');
    }

    /**
     * Generische Funktion zum Abrufen und Anzeigen von Lookup-Ergebnissen.
     * @param {string} endpoint - Der API-Endpunkt (z.B. '/dns-lookup').
     * @param {object} params - Query-Parameter als Objekt (z.B. { domain: '...', type: '...' }).
     * @param {HTMLElement} resultsSection - Der Container für die Ergebnisse.
     * @param {HTMLElement} loaderElement - Das Loader-Element.
     * @param {HTMLElement} errorElement - Das Fehleranzeige-Element für diesen Lookup.
     * @param {HTMLElement} queryElement - Das Element zur Anzeige der Suchanfrage.
     * @param {HTMLElement} outputElement - Das Element zur Anzeige der Ergebnisse (<pre> oder <p>).
     * @param {function} displayFn - Funktion zur Formatierung und Anzeige der Daten im outputElement.
     */
    async function fetchAndDisplay(endpoint, params, resultsSection, loaderElement, errorElement, queryElement, outputElement, displayFn) {
        resultsSection.classList.remove('hidden');
        loaderElement.classList.remove('hidden');
        errorElement.classList.add('hidden');
        outputElement.textContent = ''; // Clear previous results
        if (queryElement) queryElement.textContent = Object.values(params).join(', '); // Display query
        hideGlobalError(); // Hide global errors before new request

        const urlParams = new URLSearchParams(params);
        const url = `${API_BASE_URL}${endpoint}?${urlParams.toString()}`;

        try {
            const response = await fetch(url);
            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || `Request failed with status ${response.status}`);
            }

            console.log(`Received ${endpoint} data:`, data);
            displayFn(data, outputElement); // Call the specific display function

        } catch (error) {
            console.error(`Failed to fetch ${endpoint}:`, error);
            errorElement.textContent = `Error: ${error.message}`;
            errorElement.classList.remove('hidden');
            outputElement.textContent = ''; // Clear output on error
        } finally {
            loaderElement.classList.add('hidden');
        }
    }

    /** Ruft die Versionsinformationen (Commit SHA) ab */
    async function fetchVersionInfo() {
        if (!commitShaEl) return; // Don't fetch if element doesn't exist
        try {
            const response = await fetch(`${API_BASE_URL}/version`);
            if (!response.ok) throw new Error(`Network response: ${response.statusText} (${response.status})`);
            const data = await response.json();
            commitShaEl.textContent = data.commitSha || 'unknown';
        } catch (error) {
            console.error('Failed to fetch version info:', error);
            commitShaEl.textContent = 'error';
            // Optionally show global error
            // showGlobalError(`Could not load version info: ${error.message}`);
        }
    }

    // --- DNS Lookup Specific Functions ---
    function displayDnsResults(data, outputEl) {
        if (!data.records || Object.keys(data.records).length === 0) {
            outputEl.textContent = 'No records found for this domain and type.';
            return;
        }
        // Format output as JSON string for simplicity
        outputEl.textContent = JSON.stringify(data.records, null, 2);
    }

    function handleDnsLookupClick() {
        const domain = dnsDomainInput.value.trim();
        const type = dnsTypeSelect.value;
        if (!domain) {
            dnsLookupErrorEl.textContent = 'Please enter a domain name.';
            dnsLookupErrorEl.classList.remove('hidden');
            return;
        }
        fetchAndDisplay(
            '/dns-lookup',
            { domain, type },
            dnsLookupResultsSection,
            dnsLookupLoader,
            dnsLookupErrorEl,
            dnsLookupQueryEl,
            dnsLookupOutputEl,
            displayDnsResults
        );
    }

    // --- Initial Load & Event Listeners ---
    fetchVersionInfo(); // Lade Versionsinfo für Footer

    dnsLookupButton.addEventListener('click', handleDnsLookupClick);
    dnsDomainInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') handleDnsLookupClick();
    });

}); // End DOMContentLoaded