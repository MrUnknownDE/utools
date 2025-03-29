document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('ssl-check-form');
    const domainInput = document.getElementById('domain-input');
    const resultDiv = document.getElementById('result');
    const resultDomainSpan = document.getElementById('result-domain');
    const evaluationDiv = document.getElementById('evaluation');
    const scoreValueSpan = document.getElementById('score-value');
    const scoreBarInner = document.getElementById('score-bar-inner');
    const evaluationSummaryP = document.getElementById('evaluation-summary');
    const certOutputPre = document.getElementById('cert-output');
    const errorMessageDiv = document.getElementById('error-message');
    const loadingSpinner = document.querySelector('.loading-spinner');
    const submitButton = document.getElementById('submit-button');

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const domain = domainInput.value.trim();

        if (!domain) {
            showError('Please enter a domain name.');
            return;
        }

        // Reset UI
        hideError();
        resultDiv.style.display = 'none';
        loadingSpinner.style.display = 'block';
        submitButton.disabled = true;
        submitButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Checking...';


        try {
            const response = await fetch(`/api/ssl-check?domain=${encodeURIComponent(domain)}`);
            const data = await response.json();

            resultDiv.style.display = 'block';
            resultDomainSpan.textContent = domain;

            if (!response.ok || data.error) {
                // Handle API errors (including connection errors, no cert found etc.)
                const errorDetail = data.details ? ` Details: ${data.details}` : '';
                showError(data.error || `HTTP error! status: ${response.status}${errorDetail}`);
                evaluationDiv.style.display = 'none'; // Hide evaluation section on error
                document.getElementById('certificate-details').style.display = 'none'; // Hide details section
            } else {
                // Display successful result
                evaluationDiv.style.display = 'block';
                document.getElementById('certificate-details').style.display = 'block';

                // Evaluation
                scoreValueSpan.textContent = data.evaluation.score;
                evaluationSummaryP.textContent = data.evaluation.summary;
                updateScoreBar(data.evaluation.score);

                // Certificate Details (Format for readability)
                let formattedDetails = `Issuer: ${data.certificate.issuer || 'N/A'}\n`;
                formattedDetails += `Subject: ${data.certificate.subject || 'N/A'}\n`;
                formattedDetails += `Valid From: ${data.certificate.validFrom ? new Date(data.certificate.validFrom).toLocaleString() : 'N/A'}\n`;
                formattedDetails += `Valid To: ${data.certificate.validTo ? new Date(data.certificate.validTo).toLocaleString() : 'N/A'}\n`;
                formattedDetails += `Validity Status: ${data.certificate.validity || 'N/A'}\n\n`;
                formattedDetails += `--- Raw OpenSSL Output ---\n${data.certificate.details || 'N/A'}`;
                certOutputPre.textContent = formattedDetails;

            }
        } catch (error) {
            console.error('Fetch error:', error);
            showError(`An error occurred while fetching the certificate details. Check the browser console. Error: ${error.message}`);
            evaluationDiv.style.display = 'none';
            document.getElementById('certificate-details').style.display = 'none';
        } finally {
            loadingSpinner.style.display = 'none';
            submitButton.disabled = false;
            submitButton.innerHTML = 'Check Certificate';
        }
    });

    function showError(message) {
        errorMessageDiv.textContent = message;
        errorMessageDiv.style.display = 'block';
        resultDiv.style.display = 'block'; // Show the result box to display the error within it
    }

    function hideError() {
        errorMessageDiv.style.display = 'none';
        errorMessageDiv.textContent = '';
    }

    function updateScoreBar(score) {
        const percentage = score * 10; // Score is out of 10
        scoreBarInner.style.width = `${percentage}%`;

        // Change color based on score
        if (score >= 8) {
            scoreBarInner.style.backgroundColor = '#198754'; // Green
        } else if (score >= 5) {
            scoreBarInner.style.backgroundColor = '#ffc107'; // Yellow
        } else {
            scoreBarInner.style.backgroundColor = '#dc3545'; // Red
        }
    }
});