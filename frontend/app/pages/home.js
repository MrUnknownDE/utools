import { API, setupCopyBtn } from '../shared.js';

export const page = {
  title: 'IP Info & Tools',

  template: () => `
<div class="container mx-auto max-w-5xl glass-panel rounded-xl shadow-2xl p-6 md:p-8 backdrop-blur-xl border border-gray-800/50">
  <h1 class="text-3xl font-bold mb-8 text-center text-gradient glitch-text">Your Digital Footprint</h1>

  <!-- Own IP info -->
  <div id="info-section" class="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
    <!-- Left column -->
    <div class="space-y-6 fade-in" style="animation-delay:.1s">
      <div class="glass-card rounded-lg p-5 relative overflow-hidden group">
        <div class="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"/>
          </svg>
        </div>
        <h2 class="text-xs font-bold text-purple-400 uppercase tracking-widest mb-2">Your Public IP</h2>
        <div id="ip-info" class="min-h-[40px] flex items-center gap-2">
          <div id="ip-loader" class="loader"></div>
          <a id="ip-address-link" href="#" class="text-3xl font-mono font-bold text-white tracking-tight break-all hidden hover:text-purple-300 transition-colors" title="Click for WHOIS Lookup">
            <span id="ip-address"></span>
          </a>
          <button id="copy-ip-btn" class="copy-btn hidden">copy</button>
        </div>
      </div>

      <div class="glass-card rounded-lg p-5 space-y-4">
        <div>
          <h2 class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 border-b border-gray-700 pb-1">Location Details</h2>
          <div id="geo-info" class="min-h-[80px] space-y-1 text-sm text-gray-300">
            <div id="geo-loader" class="loader"></div>
            <div class="hidden grid grid-cols-2 gap-x-2 gap-y-1">
              <p><span class="text-gray-500">Country:</span> <span id="country" class="text-gray-200 font-medium">-</span></p>
              <p><span class="text-gray-500">Region:</span> <span id="region" class="text-gray-200 font-medium">-</span></p>
              <p><span class="text-gray-500">City:</span> <span id="city" class="text-gray-200 font-medium">-</span></p>
              <p><span class="text-gray-500">Zip:</span> <span id="postal" class="text-gray-200 font-medium">-</span></p>
              <p class="col-span-2"><span class="text-gray-500">Coords:</span> <span id="coords" class="font-mono text-xs text-purple-300">-</span></p>
              <p class="col-span-2"><span class="text-gray-500">Time:</span> <span id="timezone" class="text-gray-200 font-medium">-</span></p>
              <p id="geo-error" class="text-red-400 col-span-2 text-xs"></p>
            </div>
          </div>
        </div>
        <div>
          <h2 class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 border-b border-gray-700 pb-1">Network (ASN)</h2>
          <div id="asn-info" class="min-h-[40px] space-y-1 text-sm text-gray-300">
            <div id="asn-loader" class="loader"></div>
            <div class="hidden">
              <p><span class="text-gray-500">AS Number:</span> <span id="asn-number" class="font-mono text-purple-300">-</span></p>
              <p><span class="text-gray-500">Org:</span> <span id="asn-org" class="font-medium text-white">-</span></p>
              <p id="asn-error" class="text-red-400 text-xs"></p>
            </div>
          </div>
        </div>
      </div>

      <div class="glass-card rounded-lg p-5">
        <h2 class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 border-b border-gray-700 pb-1">Hostname (rDNS)</h2>
        <div id="rdns-info" class="min-h-[30px] text-sm text-gray-300">
          <div id="rdns-loader" class="loader"></div>
          <div class="hidden">
            <ul id="rdns-list" class="list-none space-y-1 font-mono text-xs text-green-400"><li>-</li></ul>
            <p id="rdns-error" class="text-red-400 text-xs"></p>
          </div>
        </div>
      </div>
    </div>

    <!-- Right column: map -->
    <div class="space-y-4 fade-in" style="animation-delay:.2s">
      <h2 class="text-lg font-semibold text-gray-200 flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-purple-400" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"/>
        </svg>
        Location Visualization
      </h2>
      <div id="map-container" class="bg-gray-800/50 rounded-lg min-h-[400px] h-full flex items-center justify-center relative border border-gray-700/50 shadow-inner overflow-hidden">
        <div id="map-loader" class="loader absolute z-10"></div>
        <div id="map" class="w-full h-full rounded-lg hidden z-0 opacity-80 hover:opacity-100 transition-opacity duration-700"></div>
        <p id="map-message" class="text-gray-400 hidden absolute text-sm">Could not load map.</p>
        <div class="absolute inset-0 pointer-events-none rounded-lg ring-1 ring-inset ring-white/10"></div>
      </div>
    </div>
  </div>

  <!-- IP Lookup -->
  <div class="mt-8 p-6 glass-card rounded-xl">
    <h2 class="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-500 mb-4 flex items-center gap-2">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
      </svg>
      IP Address / Domain Lookup
    </h2>
    <div class="flex flex-col sm:flex-row gap-3 mb-6">
      <input type="text" id="lookup-ip-input" placeholder="Enter IP or Domain (e.g., 8.8.8.8 or google.com)"
        class="flex-grow px-4 py-3 bg-gray-900/50 border border-gray-700/50 rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono transition-all placeholder-gray-600">
      <button id="lookup-button" disabled
        class="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg shadow-lg hover:shadow-purple-500/25 transition-all duration-200">
        Lookup
      </button>
    </div>
    <div id="lookup-error" class="text-red-400 mb-4 hidden p-3 bg-red-900/20 border border-red-500/30 rounded text-sm"></div>

    <div id="lookup-results-section" class="hidden grid grid-cols-1 md:grid-cols-2 gap-8 mt-6 border-t border-gray-700/50 pt-6 fade-in">
      <div class="space-y-6">
        <h3 class="text-lg font-semibold text-gray-200">Result for: <span id="lookup-ip-address" class="font-mono text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded"></span>
          <button id="copy-lookup-ip-btn" class="copy-btn ml-2">copy</button>
        </h3>
        <div id="lookup-result-loader" class="loader hidden"></div>
        <div id="lookup-geo-info" class="space-y-1 text-sm text-gray-300">
          <h4 class="font-bold text-gray-500 uppercase text-xs tracking-wider mb-2">Geolocation</h4>
          <div class="grid grid-cols-2 gap-x-2 gap-y-1">
            <p><span class="text-gray-500">Country:</span> <span id="lookup-country" class="text-white">-</span></p>
            <p><span class="text-gray-500">Region:</span> <span id="lookup-region" class="text-white">-</span></p>
            <p><span class="text-gray-500">City:</span> <span id="lookup-city" class="text-white">-</span></p>
            <p><span class="text-gray-500">Zip:</span> <span id="lookup-postal" class="text-white">-</span></p>
            <p class="col-span-2"><span class="text-gray-500">Coords:</span> <span id="lookup-coords" class="font-mono text-purple-300">-</span></p>
            <p class="col-span-2"><span class="text-gray-500">Time:</span> <span id="lookup-timezone" class="text-white">-</span></p>
            <p id="lookup-geo-error" class="text-red-400 col-span-2"></p>
          </div>
        </div>
        <div id="lookup-asn-info" class="space-y-1 text-sm text-gray-300">
          <h4 class="font-bold text-gray-500 uppercase text-xs tracking-wider mb-2 mt-4">ASN</h4>
          <p><span class="text-gray-500">Number:</span> <span id="lookup-asn-number" class="text-white font-mono">-</span></p>
          <p><span class="text-gray-500">Org:</span> <span id="lookup-asn-org" class="text-white">-</span></p>
          <p id="lookup-asn-error" class="text-red-400"></p>
        </div>
        <div id="lookup-rdns-info" class="space-y-1 text-sm text-gray-300">
          <h4 class="font-bold text-gray-500 uppercase text-xs tracking-wider mb-2 mt-4">Reverse DNS</h4>
          <ul id="lookup-rdns-list" class="list-none space-y-1 font-mono text-xs text-green-400"><li>-</li></ul>
          <p id="lookup-rdns-error" class="text-red-400"></p>
        </div>
      </div>

      <div class="space-y-6">
        <h4 class="font-bold text-gray-500 uppercase text-xs tracking-wider mb-2">Location Map</h4>
        <div id="lookup-map-container" class="glass-panel rounded-lg min-h-[250px] flex items-center justify-center relative overflow-hidden">
          <div id="lookup-map-loader" class="loader hidden absolute z-10"></div>
          <div id="lookup-map" class="w-full rounded hidden opacity-90"></div>
          <p id="lookup-map-message" class="text-gray-400 hidden absolute">Could not load map.</p>
          <div class="absolute inset-0 pointer-events-none ring-1 ring-inset ring-white/10 rounded-lg"></div>
        </div>
        <div class="flex flex-wrap gap-2 pt-2">
          <button id="lookup-ping-button" disabled class="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-gray-600 hover:border-gray-500 shadow-md">Ping</button>
          <button id="lookup-trace-button" disabled class="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-gray-600 hover:border-gray-500 shadow-md">Trace</button>
          <button id="lookup-scan-button" disabled class="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-gray-600 hover:border-gray-500 shadow-md">Port Scan</button>
        </div>
        <div id="lookup-ping-results" class="mt-4 text-sm hidden fade-in">
          <h4 class="font-bold text-purple-400 mb-2 flex items-center gap-2">
            <div class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div> Ping Results
          </h4>
          <div id="lookup-ping-loader" class="loader hidden"></div>
          <pre id="lookup-ping-output" class="result-pre mt-1"></pre>
          <p id="lookup-ping-error" class="text-red-400 mt-2"></p>
        </div>
      </div>
    </div>
  </div>

  <!-- Traceroute -->
  <div id="traceroute-section" class="mt-8 p-6 glass-card rounded-xl hidden fade-in">
    <h2 class="text-xl font-bold text-purple-300 border-b border-purple-500/30 pb-2 mb-4">Traceroute Results</h2>
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-3 text-sm">
        <div id="traceroute-loader" class="loader hidden"></div>
        <span id="traceroute-message" class="text-gray-300"></span>
      </div>
      <button id="traceroute-stop-btn" class="stop-btn hidden">■ Stop</button>
    </div>
    <div id="traceroute-output" class="rounded-lg overflow-hidden"><pre class="m-0"></pre></div>
  </div>

  <!-- Port Scan -->
  <div id="port-scan-section" class="mt-8 p-6 glass-card rounded-xl hidden fade-in">
    <h2 class="text-xl font-bold text-purple-300 border-b border-purple-500/30 pb-2 mb-4">Port Scan Results</h2>
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-3 text-sm">
        <div id="port-scan-loader" class="loader hidden"></div>
        <span id="port-scan-message" class="text-gray-300"></span>
      </div>
      <button id="port-scan-stop-btn" class="stop-btn hidden">■ Stop</button>
    </div>
    <div id="port-scan-output" class="text-sm font-mono bg-gray-900/50 p-4 rounded-lg border border-gray-700/50 max-h-[300px] overflow-y-auto"></div>
  </div>

  <div id="global-error" class="mt-6 p-4 bg-red-900/50 border border-red-500/50 text-red-100 rounded-lg hidden backdrop-blur shadow-lg"></div>
</div>`,

  async init(search) {
    // ── DOM refs ──────────────────────────────────────────────────
    const ipAddressLink   = document.getElementById('ip-address-link');
    const ipAddressSpan   = document.getElementById('ip-address');
    const copyIpBtn       = document.getElementById('copy-ip-btn');
    const ipLoader        = document.getElementById('ip-loader');
    const geoLoader       = document.getElementById('geo-loader');
    const asnLoader       = document.getElementById('asn-loader');
    const rdnsLoader      = document.getElementById('rdns-loader');
    const mapLoader       = document.getElementById('map-loader');
    const mapEl           = document.getElementById('map');
    const mapMessage      = document.getElementById('map-message');
    const globalError     = document.getElementById('global-error');

    const lookupInput     = document.getElementById('lookup-ip-input');
    const lookupBtn       = document.getElementById('lookup-button');
    const lookupErrorEl   = document.getElementById('lookup-error');
    const lookupSection   = document.getElementById('lookup-results-section');
    const lookupIpEl      = document.getElementById('lookup-ip-address');
    const copyLookupIpBtn = document.getElementById('copy-lookup-ip-btn');
    const lookupResLoader = document.getElementById('lookup-result-loader');
    const lookupMapEl     = document.getElementById('lookup-map');
    const lookupMapLoader = document.getElementById('lookup-map-loader');
    const lookupMapMsg    = document.getElementById('lookup-map-message');
    const lookupPingBtn   = document.getElementById('lookup-ping-button');
    const lookupTraceBtn  = document.getElementById('lookup-trace-button');
    const lookupScanBtn   = document.getElementById('lookup-scan-button');
    const lookupPingRes   = document.getElementById('lookup-ping-results');
    const lookupPingLoader= document.getElementById('lookup-ping-loader');
    const lookupPingOutput= document.getElementById('lookup-ping-output');
    const lookupPingError = document.getElementById('lookup-ping-error');

    const tracerouteSection  = document.getElementById('traceroute-section');
    const tracerouteOutput   = document.querySelector('#traceroute-output pre');
    const tracerouteLoader   = document.getElementById('traceroute-loader');
    const tracerouteMessage  = document.getElementById('traceroute-message');
    const tracerouteStopBtn  = document.getElementById('traceroute-stop-btn');

    const portScanSection    = document.getElementById('port-scan-section');
    const portScanOutput     = document.getElementById('port-scan-output');
    const portScanLoader     = document.getElementById('port-scan-loader');
    const portScanMessage    = document.getElementById('port-scan-message');
    const portScanStopBtn    = document.getElementById('port-scan-stop-btn');

    // ── State ────────────────────────────────────────────────────
    let map = null, lookupMap = null, currentIp = null, currentLookupIp = null;
    let eventSource = null, portScanEventSource = null;

    // ── Helpers ──────────────────────────────────────────────────
    function showGlobalErr(msg) {
      if (!globalError) return;
      globalError.textContent = `Error: ${msg}`;
      globalError.classList.remove('hidden');
    }

    function isValidIp(input) {
      const v4 = /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/;
      const v6 = /^(?:(?:[a-fA-F0-9]{1,4}:){7}[a-fA-F0-9]{1,4}|(?:[a-fA-F0-9]{1,4}:){1,7}:|(?:[a-fA-F0-9]{1,4}:){1,6}:[a-fA-F0-9]{1,4}|(?:[a-fA-F0-9]{1,4}:){1,5}(?::[a-fA-F0-9]{1,4}){1,2}|(?:[a-fA-F0-9]{1,4}:){1,4}(?::[a-fA-F0-9]{1,4}){1,3}|(?:[a-fA-F0-9]{1,4}:){1,3}(?::[a-fA-F0-9]{1,4}){1,4}|(?:[a-fA-F0-9]{1,4}:){1,2}(?::[a-fA-F0-9]{1,4}){1,5}|[a-fA-F0-9]{1,4}:(?::[a-fA-F0-9]{1,4}){1,6}|:(?::[a-fA-F0-9]{1,4}){1,7}|::)$/;
      return v4.test(input) || v6.test(input);
    }

    function updateField(el, val, loaderEl = null, errorEl = null, def = '-') {
      if (loaderEl) loaderEl.classList.add('hidden');
      if (errorEl) errorEl.textContent = '';
      const container = el?.closest('div:not(.loader)');
      if (container?.classList.contains('hidden')) container.classList.remove('hidden');
      if (val && typeof val === 'object' && val.error) {
        if (el) el.textContent = def;
        if (errorEl) errorEl.textContent = val.error;
      } else if (val != null && val !== '') {
        if (el) el.textContent = val;
      } else {
        if (el) el.textContent = def;
      }
    }

    function updateRdns(listEl, data, loaderEl = null, errorEl = null) {
      if (loaderEl) loaderEl.classList.add('hidden');
      if (listEl) listEl.innerHTML = '';
      if (errorEl) errorEl.textContent = '';
      const container = listEl?.closest('div:not(.loader)');
      if (container?.classList.contains('hidden')) container.classList.remove('hidden');
      if (Array.isArray(data)) {
        if (data.length > 0) data.forEach(h => { const li = document.createElement('li'); li.textContent = h; listEl.appendChild(li); });
        else if (listEl) listEl.innerHTML = '<li>No rDNS records found.</li>';
      } else if (data?.error) {
        if (listEl) listEl.innerHTML = '<li>-</li>';
        if (errorEl) errorEl.textContent = data.error;
      } else {
        if (listEl) listEl.innerHTML = '<li>-</li>';
      }
    }

    function initOrUpdateMap(mapId, lat, lon, mapElement, loaderEl, msgEl) {
      if (!mapElement || !loaderEl || !msgEl) return null;
      loaderEl.classList.add('hidden');
      let inst = window[mapId + '_instance'];
      if (lat != null && lon != null) {
        mapElement.classList.remove('hidden');
        msgEl.classList.add('hidden');
        if (inst) {
          inst.setView([lat, lon], 13);
          inst.eachLayer(l => { if (l instanceof L.Marker) inst.removeLayer(l); });
          L.marker([lat, lon]).addTo(inst).bindPopup('Approximate Location').openPopup();
        } else {
          try {
            inst = L.map(mapId).setView([lat, lon], 13);
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
              attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
              subdomains: 'abcd', maxZoom: 19
            }).addTo(inst);
            L.marker([lat, lon]).addTo(inst).bindPopup('Approximate Location').openPopup();
            window[mapId + '_instance'] = inst;
          } catch (e) {
            console.error('Map init failed:', e);
            mapElement.classList.add('hidden');
            msgEl.classList.remove('hidden');
            msgEl.textContent = 'Error initializing map.';
            return null;
          }
        }
        setTimeout(() => { if (window[mapId + '_instance']) window[mapId + '_instance'].invalidateSize(); }, 100);
        return inst;
      } else {
        mapElement.classList.add('hidden');
        msgEl.classList.remove('hidden');
        msgEl.textContent = 'Map could not be loaded (missing coordinates).';
        if (inst) { inst.remove(); window[mapId + '_instance'] = null; }
        return null;
      }
    }

    // ── Copy buttons ─────────────────────────────────────────────
    setupCopyBtn(copyIpBtn, () => ipAddressSpan.textContent);
    setupCopyBtn(copyLookupIpBtn, () => lookupIpEl.textContent);

    // ── Lookup button enable/disable ─────────────────────────────
    const syncLookupBtn = () => { lookupBtn.disabled = !lookupInput.value.trim(); };
    lookupInput.addEventListener('input', syncLookupBtn);

    // ── Own IP fetch ─────────────────────────────────────────────
    async function fetchIpInfo() {
      globalError.classList.add('hidden');
      [ipLoader, geoLoader, asnLoader, rdnsLoader, mapLoader].forEach(l => l?.classList.remove('hidden'));
      ipAddressLink.classList.add('hidden');
      copyIpBtn.classList.add('hidden');
      mapEl.classList.add('hidden');
      mapMessage.classList.add('hidden');

      try {
        const r    = await fetch(`${API}/ipinfo`);
        if (!r.ok) throw new Error(`${r.statusText} (${r.status})`);
        const data = await r.json();
        currentIp = data.ip;

        ipAddressSpan.textContent = data.ip;
        ipAddressLink.classList.remove('hidden');
        copyIpBtn.classList.remove('hidden');
        ipLoader.classList.add('hidden');
        ipAddressLink.addEventListener('click', e => {
          e.preventDefault();
          if (currentIp) window._router.navigate('/whois', { query: currentIp });
        });

        updateField(document.getElementById('country'), data.geo?.countryName ? `${data.geo.countryName} (${data.geo.country})` : null, null, document.getElementById('geo-error'));
        updateField(document.getElementById('region'), data.geo?.region);
        updateField(document.getElementById('city'), data.geo?.city);
        updateField(document.getElementById('postal'), data.geo?.postalCode);
        updateField(document.getElementById('coords'), data.geo?.latitude ? `${data.geo.latitude}, ${data.geo.longitude}` : null);
        updateField(document.getElementById('timezone'), data.geo?.timezone, geoLoader);

        const asnNum = (data.asn && !data.asn.error) ? data.asn.number : null;
        if (asnNum) {
          const asnContainer = document.getElementById('asn-number')?.closest('div:not(.loader)');
          if (asnContainer) asnContainer.classList.remove('hidden');
          document.getElementById('asn-number').innerHTML =
            `<a href="/asn?asn=${asnNum}" class="hover:text-purple-200 underline decoration-dotted transition-colors" title="Open ASN Lookup">AS${asnNum}</a>`;
        } else {
          updateField(document.getElementById('asn-number'), null, null, document.getElementById('asn-error'), data.asn?.error || '-');
        }
        updateField(document.getElementById('asn-org'), data.asn?.organization, asnLoader);
        updateRdns(document.getElementById('rdns-list'), data.rdns, rdnsLoader, document.getElementById('rdns-error'));
        map = initOrUpdateMap('map', data.geo?.latitude, data.geo?.longitude, mapEl, mapLoader, mapMessage);

      } catch (err) {
        console.error('Failed to fetch IP info:', err);
        showGlobalErr(`Could not load IP information. ${err.message}`);
        [ipLoader, geoLoader, asnLoader, rdnsLoader, mapLoader].forEach(l => l?.classList.add('hidden'));
      }
    }

    // ── Lookup ───────────────────────────────────────────────────
    function resetLookup() {
      lookupSection.classList.add('hidden');
      lookupResLoader.classList.add('hidden');
      lookupMapLoader.classList.add('hidden');
      lookupMapEl.classList.add('hidden');
      lookupMapMsg.classList.add('hidden');
      lookupPingRes.classList.add('hidden');
      lookupPingLoader.classList.add('hidden');
      portScanSection.classList.add('hidden');
      portScanOutput.innerHTML = '';
      [lookupIpEl, document.getElementById('lookup-country'), document.getElementById('lookup-region'),
       document.getElementById('lookup-city'), document.getElementById('lookup-postal'),
       document.getElementById('lookup-coords'), document.getElementById('lookup-timezone'),
       document.getElementById('lookup-asn-number'), document.getElementById('lookup-asn-org'),
       document.getElementById('lookup-geo-error'), document.getElementById('lookup-asn-error'),
       document.getElementById('lookup-rdns-error')].forEach(el => { if (el) el.textContent = ''; });
      document.getElementById('lookup-rdns-list').innerHTML = '<li>-</li>';
      lookupPingOutput.textContent = '';
      lookupPingError.textContent = '';
      [lookupPingBtn, lookupTraceBtn, lookupScanBtn].forEach(b => { if (b) b.disabled = true; });
      currentLookupIp = null;
      if (window['lookup-map_instance']) { window['lookup-map_instance'].remove(); window['lookup-map_instance'] = null; }
      if (portScanEventSource) { portScanEventSource.close(); portScanEventSource = null; }
    }

    async function doLookup(query) {
      resetLookup();
      lookupErrorEl.classList.add('hidden');
      globalError.classList.add('hidden');

      const url = new URL(location.href);
      url.searchParams.set('ip', query);
      history.replaceState({}, '', url);

      lookupSection.classList.remove('hidden');
      lookupResLoader.classList.remove('hidden');
      lookupMapLoader.classList.remove('hidden');

      let ipToLookup = query;
      if (!isValidIp(query)) {
        try {
          const r    = await fetch(`${API}/dns-lookup?domain=${encodeURIComponent(query)}&type=ANY`);
          const data = await r.json();
          if (r.ok && data.success) {
            const ip = data.records?.A?.[0] ?? data.records?.AAAA?.[0];
            if (ip) ipToLookup = ip;
            else throw new Error('No A or AAAA records found.');
          } else {
            throw new Error(data.error || 'DNS lookup failed.');
          }
        } catch (err) {
          lookupErrorEl.textContent = `Error: Could not resolve domain — ${err.message}`;
          lookupErrorEl.classList.remove('hidden');
          resetLookup();
          return;
        }
      }

      try {
        const r    = await fetch(`${API}/lookup?targetIp=${encodeURIComponent(ipToLookup)}`);
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
        currentLookupIp = data.ip;

        updateField(lookupIpEl, data.ip);
        updateField(document.getElementById('lookup-country'), data.geo?.countryName ? `${data.geo.countryName} (${data.geo.country})` : null, null, document.getElementById('lookup-geo-error'));
        updateField(document.getElementById('lookup-region'), data.geo?.region);
        updateField(document.getElementById('lookup-city'), data.geo?.city);
        updateField(document.getElementById('lookup-postal'), data.geo?.postalCode);
        updateField(document.getElementById('lookup-coords'), data.geo?.latitude ? `${data.geo.latitude}, ${data.geo.longitude}` : null);
        updateField(document.getElementById('lookup-timezone'), data.geo?.timezone);

        if (data.asn?.number) {
          document.getElementById('lookup-asn-number').innerHTML =
            `<a href="/asn?asn=${data.asn.number}" class="text-purple-400 hover:text-purple-300 underline decoration-dotted transition-colors font-mono">AS${data.asn.number}</a>`;
        } else {
          updateField(document.getElementById('lookup-asn-number'), data.asn?.number, null, document.getElementById('lookup-asn-error'));
        }
        updateField(document.getElementById('lookup-asn-org'), data.asn?.organization);
        updateRdns(document.getElementById('lookup-rdns-list'), data.rdns, null, document.getElementById('lookup-rdns-error'));
        lookupMap = initOrUpdateMap('lookup-map', data.geo?.latitude, data.geo?.longitude, lookupMapEl, lookupMapLoader, lookupMapMsg);
        [lookupPingBtn, lookupTraceBtn, lookupScanBtn].forEach(b => { if (b) b.disabled = false; });

      } catch (err) {
        lookupErrorEl.textContent = `Error: Lookup failed — ${err.message}`;
        lookupErrorEl.classList.remove('hidden');
        lookupMapMsg.textContent = 'Map could not be loaded.';
        lookupMapMsg.classList.remove('hidden');
        lookupMapEl.classList.add('hidden');
        lookupMapLoader.classList.add('hidden');
        resetLookup();
      } finally {
        lookupResLoader.classList.add('hidden');
      }
    }

    // ── Ping ─────────────────────────────────────────────────────
    async function runPing(ip) {
      lookupPingRes.classList.remove('hidden');
      lookupPingLoader.classList.remove('hidden');
      lookupPingOutput.textContent = '';
      lookupPingError.textContent = '';
      try {
        const r    = await fetch(`${API}/ping?targetIp=${encodeURIComponent(ip)}`);
        const data = await r.json();
        if (!r.ok || !data.success) throw new Error(data.error || `HTTP ${r.status}`);
        let out = `--- Ping Statistics for ${ip} ---\n`;
        if (data.stats) {
          out += `Packets: ${data.stats.packets.transmitted} sent, ${data.stats.packets.received} received, ${data.stats.packets.lossPercent}% loss\n`;
          if (data.stats.rtt) out += `RTT (ms): min=${data.stats.rtt.min} avg=${data.stats.rtt.avg} max=${data.stats.rtt.max}\n`;
        }
        out += `\n--- Raw Output ---\n${data.rawOutput || ''}`;
        lookupPingOutput.textContent = out;
      } catch (err) {
        lookupPingError.textContent = `Ping Error: ${err.message}`;
      } finally {
        lookupPingLoader.classList.add('hidden');
      }
    }

    // ── Traceroute ───────────────────────────────────────────────
    function startTraceroute(ip) {
      if (eventSource) { eventSource.close(); eventSource = null; }
      tracerouteSection.classList.remove('hidden');
      tracerouteOutput.textContent = '';
      tracerouteLoader.classList.remove('hidden');
      tracerouteStopBtn.classList.remove('hidden');
      tracerouteMessage.textContent = `Starting traceroute to ${ip}…`;
      globalError.classList.add('hidden');

      eventSource = new EventSource(`${API}/traceroute?targetIp=${encodeURIComponent(ip)}`);

      eventSource.onopen = () => { tracerouteMessage.textContent = `Traceroute to ${ip} in progress…`; };
      eventSource.onerror = () => {
        tracerouteMessage.textContent = eventSource.readyState === EventSource.CLOSED
          ? 'Connection closed.' : 'Connection error.';
        tracerouteLoader.classList.add('hidden');
        tracerouteStopBtn.classList.add('hidden');
        eventSource.close();
      };
      eventSource.addEventListener('hop', e => {
        try { displayHop(JSON.parse(e.data)); } catch { displayTraceLine(`[Parse error: ${e.data}]`, 'error-line'); }
      });
      eventSource.addEventListener('info', e => {
        try { displayTraceLine(JSON.parse(e.data).message, 'info-line'); } catch {}
      });
      eventSource.addEventListener('error', e => {
        try { const d = JSON.parse(e.data); displayTraceLine(d.error, 'error-line'); } catch {}
      });
      eventSource.addEventListener('end', e => {
        try {
          const d = JSON.parse(e.data);
          const msg = `Traceroute finished${d.exitCode === 0 ? ' successfully' : ` (exit code ${d.exitCode})`}.`;
          displayTraceLine(msg, 'end-line');
          tracerouteMessage.textContent = msg;
        } catch {}
        tracerouteLoader.classList.add('hidden');
        tracerouteStopBtn.classList.add('hidden');
        eventSource.close();
      });
    }

    function stopTraceroute() {
      if (eventSource) { eventSource.close(); eventSource = null; }
      tracerouteLoader.classList.add('hidden');
      tracerouteStopBtn.classList.add('hidden');
      tracerouteMessage.textContent = 'Traceroute stopped.';
      displayTraceLine('— Stopped by user —', 'info-line');
    }

    function displayTraceLine(text, cls = '') {
      const div = document.createElement('div');
      if (cls) div.classList.add(cls);
      div.classList.add('fade-in');
      div.textContent = text;
      tracerouteOutput.appendChild(div);
      tracerouteOutput.scrollTop = tracerouteOutput.scrollHeight;
    }

    function displayHop(hop) {
      const div = document.createElement('div');
      div.classList.add('hop-line', 'fade-in');
      const num = document.createElement('span'); num.classList.add('hop-number'); num.textContent = hop.hop || '?'; div.appendChild(num);
      if (hop.ip) {
        const ip = document.createElement('span'); ip.classList.add('hop-ip'); ip.textContent = hop.ip; div.appendChild(ip);
        if (hop.hostname) { const h = document.createElement('span'); h.classList.add('hop-hostname'); h.textContent = ` (${hop.hostname})`; div.appendChild(h); }
      } else if (hop.rtt?.every(r => r === '*')) {
        const t = document.createElement('span'); t.classList.add('hop-timeout'); t.textContent = '* * *'; div.appendChild(t);
      } else {
        div.appendChild(document.createTextNode(hop.rawLine || 'Unknown hop'));
      }
      if (Array.isArray(hop.rtt)) {
        hop.rtt.forEach(r => {
          const s = document.createElement('span');
          s.classList.add(r === '*' ? 'hop-timeout' : 'hop-rtt');
          s.textContent = r === '*' ? ' *' : ` ${r} ms`;
          div.appendChild(s);
        });
      }
      tracerouteOutput.appendChild(div);
      tracerouteOutput.scrollTop = tracerouteOutput.scrollHeight;
    }

    // ── Port Scan ────────────────────────────────────────────────
    function startPortScan(ip) {
      if (portScanEventSource) { portScanEventSource.close(); portScanEventSource = null; }
      portScanSection.classList.remove('hidden');
      portScanOutput.innerHTML = '';
      portScanLoader.classList.remove('hidden');
      portScanStopBtn.classList.remove('hidden');
      portScanMessage.textContent = `Starting port scan for ${ip}…`;

      portScanEventSource = new EventSource(`${API}/port-scan?targetIp=${encodeURIComponent(ip)}`);
      portScanEventSource.onopen = () => {};
      portScanEventSource.onerror = () => {
        portScanMessage.textContent = 'Connection error during port scan.';
        portScanLoader.classList.add('hidden');
        portScanStopBtn.classList.add('hidden');
        portScanEventSource.close();
      };
      portScanEventSource.addEventListener('info', e => {
        try { portScanMessage.textContent = JSON.parse(e.data).message; } catch {}
      });
      portScanEventSource.addEventListener('port_status', e => {
        try { displayPortResult(JSON.parse(e.data)); } catch {}
      });
      portScanEventSource.addEventListener('error', e => {
        try { displayPortResult({ error: JSON.parse(e.data).error }); } catch {}
      });
      portScanEventSource.addEventListener('end', e => {
        try { portScanMessage.textContent = JSON.parse(e.data).message; } catch {}
        portScanLoader.classList.add('hidden');
        portScanStopBtn.classList.add('hidden');
        portScanEventSource.close();
      });
    }

    function stopPortScan() {
      if (portScanEventSource) { portScanEventSource.close(); portScanEventSource = null; }
      portScanLoader.classList.add('hidden');
      portScanStopBtn.classList.add('hidden');
      portScanMessage.textContent = 'Port scan stopped.';
    }

    function displayPortResult(data) {
      const div = document.createElement('div');
      div.classList.add('mb-1', 'fade-in');
      if (data.error) {
        div.innerHTML = `<span class="text-red-400">Error: ${data.error}</span>`;
      } else {
        const colors = { open: 'text-green-400', closed: 'text-red-400', timeout: 'text-yellow-400' };
        const labels = { open: 'OPEN', closed: 'CLOSED', timeout: 'TIMEOUT (Filtered?)' };
        const col = colors[data.status] || 'text-gray-400';
        const lbl = labels[data.status] || (data.status || '').toUpperCase();
        div.innerHTML = `Port <span class="font-bold w-12 inline-block">${data.port}</span> <span class="w-24 inline-block">(${data.service})</span>: <span class="font-bold ${col}">${lbl}</span>`;
      }
      portScanOutput.appendChild(div);
      portScanOutput.scrollTop = portScanOutput.scrollHeight;
    }

    // ── Event listeners ──────────────────────────────────────────
    lookupBtn.addEventListener('click', () => { const q = lookupInput.value.trim(); if (q) doLookup(q); });
    lookupInput.addEventListener('keypress', e => { if (e.key === 'Enter' && !lookupBtn.disabled) { const q = lookupInput.value.trim(); if (q) doLookup(q); } });
    lookupPingBtn.addEventListener('click', () => { if (currentLookupIp) runPing(currentLookupIp); });
    lookupTraceBtn.addEventListener('click', () => { if (currentLookupIp) startTraceroute(currentLookupIp); });
    lookupScanBtn.addEventListener('click', () => { if (currentLookupIp) startPortScan(currentLookupIp); });
    tracerouteStopBtn.addEventListener('click', stopTraceroute);
    portScanStopBtn.addEventListener('click', stopPortScan);

    // ── Bootstrap ────────────────────────────────────────────────
    fetchIpInfo();

    const params = new URLSearchParams(search);
    const ipParam = params.get('ip');
    if (ipParam) { lookupInput.value = ipParam; syncLookupBtn(); doLookup(ipParam); }

    // ── Cleanup ──────────────────────────────────────────────────
    return () => {
      if (eventSource) { eventSource.close(); eventSource = null; }
      if (portScanEventSource) { portScanEventSource.close(); portScanEventSource = null; }
      if (window['map_instance']) { window['map_instance'].remove(); window['map_instance'] = null; }
      if (window['lookup-map_instance']) { window['lookup-map_instance'].remove(); window['lookup-map_instance'] = null; }
    };
  }
};
