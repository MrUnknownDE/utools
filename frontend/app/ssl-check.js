document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('ssl-check-form');
    const domainInput = document.getElementById('domain-input');
    const resultDiv = document.getElementById('result');
    const resultDomainSpan = document.getElementById('result-domain');
    const evaluationDiv = document.getElementById('evaluation');
    const scoreValueSpan = document.getElementById('score-value');
    const scoreBarInner = document.getElementById('score-bar-inner');
    const evaluationSummaryP = document.getElementById('evaluation-summary');
    const certificateDetailsDiv = document.getElementById('certificate-details');
    const certOutputPre = document.getElementById('cert-output');
    const errorMessageDiv = document.getElementById('error-message');
    const loadingSpinner = document.getElementById('loading-spinner'); // Geändert
    const submitButton = document.getElementById('submit-button');
    const buttonTextSpan = document.getElementById('button-text'); // Geändert

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const domain = domainInput.value.trim();

        if (!domain) {
            showError('Please enter a domain name.');
            return;
        }

        // Reset UI
        hideError();
        resultDiv.classList.add('hidden');
        evaluationDiv.classList.add('hidden');
        certificateDetailsDiv.classList.add('hidden');
        loadingSpinner.classList.remove('hidden'); // Spinner anzeigen
        submitButton.disabled = true;
        buttonTextSpan.textContent = 'Checking...'; // Text im Button ändern


        try {
            // Verwende /api/ Relative Pfad, da Nginx als Proxy dient
            const apiUrl = `/api/ssl-check?domain=${encodeURIComponent(domain)}`;
            console.log(`Fetching: ${apiUrl}`); // Debugging
            const response = await fetch(apiUrl);
            const data = await response.json();
            console.log("API Response:", data); // Debugging

            resultDiv.classList.remove('hidden'); // Ergebnisbereich anzeigen
            resultDomainSpan.textContent = domain;

            if (!response.ok || data.error) {
                // API-Fehler oder Fehler in der JSON-Antwort behandeln
                const errorMsg = data.error || `HTTP error! Status: ${response.status}`;
                const errorDetails = data.details ? ` Details: ${data.details}` : (data.raw_output ? ` Raw Output: ${data.raw_output}` : '');
                 console.error("API Error:", errorMsg, errorDetails); // Debugging
                showError(`${errorMsg}${errorDetails}`);
                evaluationDiv.classList.add('hidden'); // Auswertung ausblenden bei Fehler
                certificateDetailsDiv.classList.add('hidden'); // Details ausblenden bei Fehler
            } else if (!data.certificate || !data.evaluation) {
                 // Unerwartete, aber erfolgreiche Antwort
                 console.error("Unexpected API response structure:", data); // Debugging
                 showError("Received an unexpected response from the server.");
                 evaluationDiv.classList.add('hidden');
                 certificateDetailsDiv.classList.add('hidden');
            }
            else {
                // Erfolgreiches Ergebnis anzeigen
                evaluationDiv.classList.remove('hidden');
                certificateDetailsDiv.classList.remove('hidden');

                // Auswertung
                scoreValueSpan.textContent = data.evaluation.score;
                evaluationSummaryP.textContent = data.evaluation.summary;
                updateScoreBar(data.evaluation.score);

                // Zertifikatsdetails formatieren
                let formattedDetails = `Issuer: ${data.certificate.issuer || 'N/A'}\n`;
                formattedDetails += `Subject: ${data.certificate.subject || 'N/A'}\n`;
                formattedDetails += `Valid From: ${data.certificate.validFrom ? new Date(data.certificate.validFrom).toLocaleString() : 'N/A'}\n`;
                formattedDetails += `Valid To: ${data.certificate.validTo ? new Date(data.certificate.validTo).toLocaleString() : 'N/A'}\n`;
                formattedDetails += `Validity Status: ${data.certificate.validity || 'N/A'}\n\n`;
                formattedDetails += `--- Raw OpenSSL Output ---\n${data.certificate.details || 'N/A'}`;
                certOutputPre.textContent = formattedDetails;
            }
        } catch (error) {
            console.error('Fetch or processing error:', error); // Debugging
            showError(`An error occurred: ${error.message}. Check the browser console for more details.`);
            evaluationDiv.classList.add('hidden');
            certificateDetailsDiv.classList.add('hidden');
        } finally {
            loadingSpinner.classList.add('hidden'); // Spinner ausblenden
            submitButton.disabled = false;
            buttonTextSpan.textContent = 'Check Certificate'; // Button-Text zurücksetzen
        }
    });

    function showError(message) {
        errorMessageDiv.textContent = message;
        errorMessageDiv.classList.remove('hidden');
        resultDiv.classList.remove('hidden'); // Sicherstellen, dass der Ergebnisbereich sichtbar ist, um den Fehler anzuzeigen
    }

    function hideError() {
        errorMessageDiv.classList.add('hidden');
        errorMessageDiv.textContent = '';
    }

    function updateScoreBar(score) {
        const percentage = Math.max(0, Math.min(100, score * 10)); // Sicherstellen, dass der Wert zwischen 0 und 100 liegt
        scoreBarInner.style.width = `${percentage}%`;

        // Farbwechsel basierend auf dem Score
        if (score >= 8) {
            scoreBarInner.style.backgroundColor = '#22c55e'; // green-500
        } else if (score >= 5) {
            scoreBarInner.style.backgroundColor = '#facc15'; // yellow-400
        } else {
            scoreBarInner.style.backgroundColor = '#ef4444'; // red-500
        }
    }
});