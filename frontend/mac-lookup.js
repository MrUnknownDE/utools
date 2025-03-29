// frontend/mac-lookup.js
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements (MAC Lookup) ---
    const macInput = document.getElementById('mac-input');
    const macLookupButton = document.getElementById('mac-lookup-button');
    const macLookupErrorEl = document.getElementById('mac-lookup-error');
    const macLookupResultsSection = document.getElementById('mac-lookup-results-section');
    const macLookupQueryEl = document.getElementById('mac-lookup-query');
    const macLookupLoader = document.getElementById('mac-lookup-loader');
    const macLookupOutputEl = document.getElementById('mac-lookup-output');
    const macLookupNotFoundEl = document.getElementById('mac-lookup-notfound');

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
     * @param {string} endpoint - Der API-Endpunkt (z.B. '/mac-lookup').
     * @param {object} params - Query-Parameter als Objekt (z.B. { mac: '...' }).
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
        if (macLookupNotFoundEl) macLookupNotFoundEl.classList.add('hidden'); // Hide 'not found' specifically for MAC
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

    // --- MAC Lookup Specific Functions ---
    function displayMacResults(data, outputEl) {
        macLookupNotFoundEl.classList.add('hidden'); // Hide not found message first
        if (data.vendor) {
            outputEl.textContent = data.vendor;
        } else {
            outputEl.textContent = ''; // Clear vendor text
            macLookupNotFoundEl.classList.remove('hidden'); // Show not found message
        }
    }

    function handleMacLookupClick() {
        const mac = macInput.value.trim();
        if (!mac) {
            macLookupErrorEl.textContent = 'Please enter a MAC address.';
            macLookupErrorEl.classList.remove('hidden');
            return;
        }
        // Clear previous 'not found' message
        macLookupNotFoundEl.classList.add('hidden');
        fetchAndDisplay(
            '/mac-lookup',
            { mac },
            macLookupResultsSection,
            macLookupLoader,
            macLookupErrorEl,
            macLookupQueryEl,
            macLookupOutputEl, // Pass the <p> element
            displayMacResults
        );
    }

    // --- Initial Load & Event Listeners ---
    fetchVersionInfo(); // Lade Versionsinfo für Footer

    macLookupButton.addEventListener('click', handleMacLookupClick);
    macInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') handleMacLookupClick();
    });

}); // End DOMContentLoaded