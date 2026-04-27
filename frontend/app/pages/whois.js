import { API, setupCopyBtn, showError } from '../shared.js';

export const page = {
  title: 'WHOIS Lookup',

  template: () => `
<div class="container mx-auto max-w-5xl glass-panel rounded-xl shadow-2xl p-6 md:p-8 backdrop-blur-xl border border-gray-800/50">
  <h1 class="text-3xl font-bold mb-8 text-center text-gradient">WHOIS Lookup</h1>

  <div class="p-6 glass-card rounded-xl">
    <div class="flex flex-col sm:flex-row gap-3 mb-6">
      <input type="text" id="whois-query-input" placeholder="Enter domain or IP (e.g., google.com or 8.8.8.8)"
        class="flex-grow px-4 py-3 bg-gray-900/50 border border-gray-700/50 rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono transition-all placeholder-gray-600">
      <button id="whois-lookup-button" disabled
        class="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-all duration-200">
        Lookup WHOIS
      </button>
    </div>
    <div id="whois-lookup-error" class="hidden mb-4 p-3 bg-red-900/20 border border-red-500/30 rounded text-red-400 text-sm"></div>

    <div id="whois-lookup-results-section" class="hidden mt-6 border-t border-gray-700/50 pt-6 fade-in">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold text-purple-300 flex items-center gap-2">
          <div class="w-1.5 h-6 bg-purple-500 rounded-full"></div>
          WHOIS Results for: <span id="whois-lookup-query" class="font-mono text-purple-400 ml-1"></span>
        </h3>
        <button id="copy-whois-btn" class="copy-btn">copy</button>
      </div>
      <div id="whois-lookup-loader" class="loader hidden mb-4"></div>
      <pre id="whois-lookup-output" class="result-pre"></pre>
    </div>
  </div>

  <div id="global-error" class="mt-6 p-4 bg-red-900/50 border border-red-500/50 text-red-100 rounded-lg hidden backdrop-blur shadow-lg"></div>
</div>`,

  async init(search) {
    const input   = document.getElementById('whois-query-input');
    const btn     = document.getElementById('whois-lookup-button');
    const errorEl = document.getElementById('whois-lookup-error');
    const section = document.getElementById('whois-lookup-results-section');
    const queryEl = document.getElementById('whois-lookup-query');
    const loader  = document.getElementById('whois-lookup-loader');
    const output  = document.getElementById('whois-lookup-output');
    const copyBtn = document.getElementById('copy-whois-btn');

    const syncBtn = () => { btn.disabled = !input.value.trim(); };
    input.addEventListener('input', syncBtn);

    setupCopyBtn(copyBtn, () => output.textContent);

    async function doLookup() {
      const query = input.value.trim();
      if (!query) return;

      const url = new URL(location.href);
      url.searchParams.set('query', query);
      history.replaceState({}, '', url);

      showError(errorEl, null);
      section.classList.remove('hidden');
      loader.classList.remove('hidden');
      output.textContent = '';
      queryEl.textContent = query;

      try {
        const r    = await fetch(`${API}/whois-lookup?query=${encodeURIComponent(query)}`);
        const data = await r.json();
        if (!r.ok || !data.success) throw new Error(data.error || `HTTP ${r.status}`);
        output.textContent = typeof data.result === 'string'
          ? data.result
          : JSON.stringify(data.result, null, 2);
      } catch (err) {
        showError(errorEl, err.message);
        output.textContent = '';
      } finally {
        loader.classList.add('hidden');
      }
    }

    btn.addEventListener('click', doLookup);
    input.addEventListener('keypress', e => { if (e.key === 'Enter' && !btn.disabled) doLookup(); });

    const params = new URLSearchParams(search);
    const q = params.get('query');
    if (q) { input.value = q; syncBtn(); doLookup(); }
  }
};
