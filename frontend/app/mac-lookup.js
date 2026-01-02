// frontend/app/mac-lookup.js
document.addEventListener('DOMContentLoaded', () => {
    const macInput = document.getElementById('mac-input');
    const macLookupButton = document.getElementById('mac-lookup-button');
    const macLookupErrorEl = document.getElementById('mac-lookup-error');
    const macLookupResultsSection = document.getElementById('mac-lookup-results-section');
    const macLookupQueryEl = document.getElementById('mac-lookup-query');
    const macLookupLoader = document.getElementById('mac-lookup-loader');
    const macLookupOutputEl = document.getElementById('mac-lookup-output');
    const commitShaEl = document.getElementById('commit-sha');
    const globalErrorEl = document.getElementById('global-error');

    const API_BASE_URL = '/api';

    function showGlobalError(message) {
        if (!globalErrorEl) return;
        globalErrorEl.textContent = `Error: ${message}`;
        globalErrorEl.classList.remove('hidden');
    }

    async function fetchVersionInfo() {
        if (!commitShaEl) return;
        try {
            const response = await fetch(`${API_BASE_URL}/version`);
            if (!response.ok) throw new Error(`Network response: ${response.statusText}`);
            const data = await response.json();
            commitShaEl.textContent = data.commitSha || 'unknown';
        } catch (error) {
            console.error('Failed to fetch version info:', error);
            commitShaEl.textContent = 'error';
        }
    }

    function displayMacResult(data, outputEl) {
        outputEl.textContent = data.vendor || 'No vendor found.';
    }

    async function handleMacLookup() {
        const mac = macInput.value.trim();
        if (!mac) {
            macLookupErrorEl.textContent = 'Please enter a MAC address.';
            macLookupErrorEl.classList.remove('hidden');
            return;
        }

        // Reset animation
        macLookupResultsSection.classList.remove('fade-in');
        void macLookupResultsSection.offsetWidth; // Trigger reflow
        macLookupResultsSection.classList.add('fade-in');

        macLookupResultsSection.classList.remove('hidden');
        macLookupLoader.classList.remove('hidden');
        macLookupErrorEl.classList.add('hidden');
        macLookupOutputEl.textContent = '';
        macLookupQueryEl.textContent = mac;

        try {
            const response = await fetch(`${API_BASE_URL}/mac-lookup?mac=${encodeURIComponent(mac)}`);
            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || `Request failed with status ${response.status}`);
            }

            displayMacResult(data, macLookupOutputEl);

        } catch (error) {
            console.error('Failed to fetch MAC vendor:', error);
            macLookupErrorEl.textContent = `Error: ${error.message}`;
            macLookupErrorEl.classList.remove('hidden');
            macLookupOutputEl.textContent = '';
        } finally {
            macLookupLoader.classList.add('hidden');
        }
    }

    fetchVersionInfo();
    macLookupButton.addEventListener('click', handleMacLookup);
    macInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') handleMacLookup();
    });
});