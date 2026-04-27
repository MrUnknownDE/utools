import { API, setupCopyBtn, showError } from '../shared.js';

export const page = {
  title: 'DNS Lookup',

  template: () => `
<div class="container mx-auto max-w-5xl glass-panel rounded-xl shadow-2xl p-6 md:p-8 backdrop-blur-xl border border-gray-800/50">
  <h1 class="text-3xl font-bold mb-8 text-center text-gradient">DNS Lookup</h1>

  <div class="p-6 glass-card rounded-xl">
    <div class="flex flex-col sm:flex-row gap-3 mb-6">
      <input type="text" id="dns-domain-input" placeholder="Enter domain (e.g., google.com)"
        class="flex-grow px-4 py-3 bg-gray-900/50 border border-gray-700/50 rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono transition-all placeholder-gray-600">
      <select id="dns-type-select"
        class="px-4 py-3 bg-gray-900/50 border border-gray-700/50 rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer">
        <option value="ANY">ANY</option><option value="A">A</option><option value="AAAA">AAAA</option>
        <option value="MX">MX</option><option value="TXT">TXT</option><option value="NS">NS</option>
        <option value="CNAME">CNAME</option><option value="SOA">SOA</option><option value="SRV">SRV</option>
        <option value="PTR">PTR (Reverse)</option>
      </select>
      <button id="dns-lookup-button" disabled
        class="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-all duration-200">
        Lookup DNS
      </button>
    </div>
    <div id="dns-lookup-error" class="hidden mb-4 p-3 bg-red-900/20 border border-red-500/30 rounded text-red-400 text-sm"></div>

    <div id="dns-lookup-results-section" class="hidden mt-6 border-t border-gray-700/50 pt-6 fade-in">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold text-purple-300 flex items-center gap-2">
          <div class="w-1.5 h-6 bg-purple-500 rounded-full"></div>
          DNS Results for: <span id="dns-lookup-query" class="font-mono text-purple-400 ml-1"></span>
        </h3>
        <button id="copy-dns-btn" class="copy-btn">copy</button>
      </div>
      <div id="dns-lookup-loader" class="loader hidden mb-4"></div>
      <pre id="dns-lookup-output" class="result-pre"></pre>
    </div>
  </div>

  <div id="global-error" class="mt-6 p-4 bg-red-900/50 border border-red-500/50 text-red-100 rounded-lg hidden backdrop-blur shadow-lg"></div>
</div>`,

  async init(search) {
    const input      = document.getElementById('dns-domain-input');
    const select     = document.getElementById('dns-type-select');
    const btn        = document.getElementById('dns-lookup-button');
    const errorEl    = document.getElementById('dns-lookup-error');
    const section    = document.getElementById('dns-lookup-results-section');
    const queryEl    = document.getElementById('dns-lookup-query');
    const loader     = document.getElementById('dns-lookup-loader');
    const output     = document.getElementById('dns-lookup-output');
    const copyBtn    = document.getElementById('copy-dns-btn');

    const syncBtn = () => { btn.disabled = !input.value.trim(); };
    input.addEventListener('input', syncBtn);

    setupCopyBtn(copyBtn, () => output.textContent);

    async function doLookup() {
      const domain = input.value.trim();
      const type   = select.value;
      if (!domain) return;

      const url = new URL(location.href);
      url.searchParams.set('domain', domain);
      url.searchParams.set('type', type);
      history.replaceState({}, '', url);

      showError(errorEl, null);
      section.classList.remove('hidden');
      loader.classList.remove('hidden');
      output.textContent = '';
      queryEl.textContent = `${domain} (${type})`;

      try {
        const r    = await fetch(`${API}/dns-lookup?domain=${encodeURIComponent(domain)}&type=${encodeURIComponent(type)}`);
        const data = await r.json();
        if (!r.ok || !data.success) throw new Error(data.error || `HTTP ${r.status}`);
        output.textContent = JSON.stringify(data.records, null, 2);
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
    const d = params.get('domain');
    if (d) {
      input.value = d;
      const t = params.get('type');
      if (t) select.value = t;
      syncBtn();
      doLookup();
    }
  }
};
