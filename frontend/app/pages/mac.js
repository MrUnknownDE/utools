import { API, showError } from '../shared.js';

export const page = {
  title: 'MAC Vendor Lookup',

  template: () => `
<div class="container mx-auto max-w-5xl glass-panel rounded-xl shadow-2xl p-6 md:p-8 backdrop-blur-xl border border-gray-800/50">
  <h1 class="text-3xl font-bold mb-8 text-center text-gradient">MAC Address Vendor Lookup</h1>

  <div class="p-6 glass-card rounded-xl">
    <div class="flex flex-col sm:flex-row gap-3 mb-6">
      <input type="text" id="mac-input" placeholder="Enter MAC address (e.g., 00:1A:2B:3C:4D:5E)"
        class="flex-grow px-4 py-3 bg-gray-900/50 border border-gray-700/50 rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono transition-all placeholder-gray-600">
      <button id="mac-lookup-button" disabled
        class="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-all duration-200">
        Find Vendor
      </button>
    </div>
    <div id="mac-lookup-error" class="hidden mb-4 p-3 bg-red-900/20 border border-red-500/30 rounded text-red-400 text-sm"></div>

    <div id="mac-lookup-results-section" class="hidden mt-6 border-t border-gray-700/50 pt-6 fade-in">
      <h3 class="text-lg font-semibold text-purple-300 mb-4 flex items-center justify-center gap-2">
        <div class="w-1.5 h-6 bg-purple-500 rounded-full"></div>
        Vendor for: <span id="mac-lookup-query" class="font-mono text-purple-400 ml-1"></span>
      </h3>
      <div id="mac-lookup-loader" class="loader hidden mb-4 mx-auto"></div>
      <pre id="mac-lookup-output" class="result-pre text-center text-xl"></pre>
    </div>
  </div>

  <div id="global-error" class="mt-6 p-4 bg-red-900/50 border border-red-500/50 text-red-100 rounded-lg hidden backdrop-blur shadow-lg"></div>
</div>`,

  async init(search) {
    const input   = document.getElementById('mac-input');
    const btn     = document.getElementById('mac-lookup-button');
    const errorEl = document.getElementById('mac-lookup-error');
    const section = document.getElementById('mac-lookup-results-section');
    const queryEl = document.getElementById('mac-lookup-query');
    const loader  = document.getElementById('mac-lookup-loader');
    const output  = document.getElementById('mac-lookup-output');

    const syncBtn = () => { btn.disabled = !input.value.trim(); };
    input.addEventListener('input', syncBtn);

    async function doLookup() {
      const mac = input.value.trim();
      if (!mac) return;

      showError(errorEl, null);
      section.classList.remove('hidden');
      loader.classList.remove('hidden');
      output.textContent = '';
      queryEl.textContent = mac;

      try {
        const r    = await fetch(`${API}/mac-lookup?mac=${encodeURIComponent(mac)}`);
        const data = await r.json();
        if (!r.ok || !data.success) throw new Error(data.error || `HTTP ${r.status}`);
        output.textContent = data.vendor || 'No vendor found.';
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
    const m = params.get('mac');
    if (m) { input.value = m; syncBtn(); doLookup(); }
  }
};
