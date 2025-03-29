// frontend/whois-lookup.js
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements (WHOIS Lookup) ---
    const whoisQueryInput = document.getElementById('whois-query-input');
    const whoisLookupButton = document.getElementById('whois-lookup-button');
    const whoisLookupErrorEl = document.getElementById('whois-lookup-error');
    const whoisLookupResultsSection = document.getElementById('whois-lookup-results-section');
    const whoisLookupQueryEl = document.getElementById('whois-lookup-query');
    const whoisLookupLoader = document.getElementById('whois-lookup-loader');
    const whoisLookupOutputEl = document.getElementById('whois-lookup-output');

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
     * @param {string} endpoint - Der API-Endpunkt (z.B. '/whois-lookup').
     * @param {object} params - Query-Parameter als Objekt (z.B. { query: '...' }).
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

    // --- WHOIS Lookup Specific Functions ---
    function displayWhoisResults(data, outputEl) {
        // WHOIS data can be large and unstructured, display as raw text
        if (typeof data.result === 'string') {
             outputEl.textContent = data.result; // Display raw text
        } else {
             // Fallback if the result is not a string (shouldn't happen with current backend)
             outputEl.textContent = JSON.stringify(data.result, null, 2);
        }
    }

    function handleWhoisLookupClick() {
        const query = whoisQueryInput.value.trim();
        if (!query) {
            whoisLookupErrorEl.textContent = 'Please enter a domain or IP address.';
            whoisLookupErrorEl.classList.remove('hidden');
            return;
        }
        fetchAndDisplay(
            '/whois-lookup',
            { query },
            whoisLookupResultsSection,
            whoisLookupLoader,
            whoisLookupErrorEl,
            whoisLookupQueryEl,
            whoisLookupOutputEl,
            displayWhoisResults
        );
    }

    /** Prüft URL-Parameter und startet ggf. den Lookup */
    function checkUrlParamsAndLookup() {
        const urlParams = new URLSearchParams(window.location.search);
        const queryFromUrl = urlParams.get('query');

        if (queryFromUrl && whoisQueryInput) {
            console.log(`Found query parameter in URL: ${queryFromUrl}`);
            whoisQueryInput.value = queryFromUrl; // Set input field value
            handleWhoisLookupClick(); // Trigger the lookup
        }
    }

    // --- Initial Load & Event Listeners ---
    fetchVersionInfo(); // Lade Versionsinfo für Footer

    whoisLookupButton.addEventListener('click', handleWhoisLookupClick);
    whoisQueryInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') handleWhoisLookupClick();
    });

    // Prüfe URL-Parameter nach dem Setup der Listener
    checkUrlParamsAndLookup();

}); // End DOMContentLoaded