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
        // Reset animation
        resultsSection.classList.remove('fade-in');
        void resultsSection.offsetWidth; // Trigger reflow
        resultsSection.classList.add('fade-in');

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

    // --- URL Parameter Functions ---

    /**
     * Updates the URL with DNS lookup parameters
     * @param {string} domain - The domain name
     * @param {string} type - The DNS record type
     */
    function updateUrlParams(domain, type) {
        const url = new URL(window.location);
        url.searchParams.set('domain', domain);
        url.searchParams.set('type', type);
        window.history.pushState({}, '', url);
    }

    /**
     * Reads URL parameters and returns domain and type if present
     * @returns {object|null} Object with domain and type, or null if not present
     */
    function getUrlParams() {
        const urlParams = new URLSearchParams(window.location.search);
        const domain = urlParams.get('domain');
        const type = urlParams.get('type');

        if (domain && type) {
            return { domain, type };
        }
        return null;
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

        // Update URL with parameters
        updateUrlParams(domain, type);

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

    /**
     * Executes DNS lookup from URL parameters if they exist
     */
    function executeLookupFromUrl() {
        const params = getUrlParams();
        if (params) {
            // Populate the input fields
            dnsDomainInput.value = params.domain;
            dnsTypeSelect.value = params.type;

            // Trigger the lookup
            handleDnsLookupClick();
        }
    }

    // --- Initial Load & Event Listeners ---
    fetchVersionInfo(); // Lade Versionsinfo für Footer

    dnsLookupButton.addEventListener('click', handleDnsLookupClick);
    dnsDomainInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') handleDnsLookupClick();
    });

    // Execute lookup from URL parameters if present
    executeLookupFromUrl();

}); // End DOMContentLoaded