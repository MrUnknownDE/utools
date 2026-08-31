import { API, setupCopyBtn, detectDualStack, renderLed } from '../shared.js';

function sectionEyebrow(text) {
  return `<h2 class="flex items-center gap-2 mb-3 font-label text-xs uppercase tracking-widest text-[var(--color-text-muted)]"><span class="inline-block w-1.5 h-4 rounded-full" style="background:var(--color-accent)"></span>${text}</h2>`;
}

function sectionTitle(text, targetId) {
  return `<h2 class="text-xl font-display font-bold text-[var(--color-accent-strong)] pb-2 mb-4 flex items-center gap-2" style="border-bottom:1px solid color-mix(in oklab, var(--color-accent) 30%, var(--color-border))">
    <span class="inline-block w-1.5 h-5 rounded-full shrink-0" style="background:var(--color-accent)"></span>
    <span>${text}${targetId ? ` — <span id="${targetId}" class="font-mono text-[var(--color-text)] text-base font-normal ml-1"></span>` : ''}</span>
  </h2>`;
}

export const page = {
  title: 'IP Info & Tools',

  template: () => `
<div class="container mx-auto max-w-5xl panel p-6 md:p-8">
  <div class="section-header mx-auto max-w-2xl text-center !border-0 !pl-0 mb-8">
    <span class="eyebrow">Own connection</span>
    <h1 class="title text-3xl">Your Digital Footprint</h1>
  </div>

  <!-- Own IP info -->
  <div id="info-section" class="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
    <!-- Left column -->
    <div class="space-y-6 fade-in" style="animation-delay:.1s">
      <div class="card p-5 relative overflow-hidden">
        ${sectionEyebrow('Your Public IP')}
        <div id="ip-info" class="min-h-[40px] flex items-center gap-2">
          <div id="ip-loader" class="loader"></div>
          <a id="ip-address-link" href="#" class="text-3xl font-mono font-bold text-[var(--color-text)] tracking-tight break-all hidden hover:text-[var(--color-link)] transition-colors" title="Click for WHOIS Lookup">
            <span id="ip-address"></span>
          </a>
          <button id="copy-ip-btn" class="copy-btn hidden">copy</button>
        </div>
        <!-- IPv6 row — shown only when dual-stack is detected -->
        <div id="ipv6-row" class="hidden mt-2 flex items-center gap-2">
          <span class="text-xs font-bold text-[var(--color-link)] opacity-60 uppercase tracking-wider w-10 shrink-0">IPv6</span>
          <span id="ipv6-address" class="font-mono text-[var(--color-link)] text-sm break-all"></span>
          <button id="copy-ipv6-btn" class="copy-btn hidden">copy</button>
        </div>
        <!-- Privacy / risk flags — dual-stack: always show both rows -->
        <div id="privacy-checks" class="mt-3 space-y-1.5">
          <div class="flex items-center gap-2 min-h-[22px]">
            <span class="text-xs font-bold text-[var(--color-text-dim)] uppercase tracking-wider w-10 shrink-0">IPv4</span>
            <div id="privacy-flags-v4" class="flex flex-wrap gap-3 items-center">
              <div id="privacy-loader-v4" class="loader" style="width:12px;height:12px;border-width:2px"></div>
            </div>
          </div>
          <div class="flex items-center gap-2 min-h-[22px]">
            <span class="text-xs font-bold text-[var(--color-link)] opacity-60 uppercase tracking-wider w-10 shrink-0">IPv6</span>
            <div id="privacy-flags-v6" class="flex flex-wrap gap-3 items-center">
              <span class="text-xs text-[var(--color-text-dim)] italic">detecting…</span>
            </div>
          </div>
        </div>
      </div>

      <div class="card p-5 space-y-4">
        <div>
          <h2 class="text-xs font-label font-bold text-[var(--color-text-muted)] uppercase tracking-widest mb-2 pb-1" style="border-bottom:1px solid var(--color-border)">Location Details</h2>
          <div id="geo-info" class="min-h-[80px] space-y-1 text-sm text-[var(--color-text-muted)]">
            <div id="geo-loader" class="loader"></div>
            <div class="hidden grid grid-cols-2 gap-x-2 gap-y-1">
              <p><span class="text-[var(--color-text-dim)]">Country:</span> <span id="country" class="text-[var(--color-text)] font-medium">-</span></p>
              <p><span class="text-[var(--color-text-dim)]">Region:</span> <span id="region" class="text-[var(--color-text)] font-medium">-</span></p>
              <p><span class="text-[var(--color-text-dim)]">City:</span> <span id="city" class="text-[var(--color-text)] font-medium">-</span></p>
              <p><span class="text-[var(--color-text-dim)]">Zip:</span> <span id="postal" class="text-[var(--color-text)] font-medium">-</span></p>
              <p class="col-span-2"><span class="text-[var(--color-text-dim)]">Coords:</span> <span id="coords" class="font-mono text-xs text-[var(--color-accent)]">-</span></p>
              <p class="col-span-2"><span class="text-[var(--color-text-dim)]">Time:</span> <span id="timezone" class="text-[var(--color-text)] font-medium">-</span></p>
              <p id="geo-error" class="text-[var(--color-status-bad)] col-span-2 text-xs"></p>
            </div>
          </div>
        </div>
        <div>
          <h2 class="text-xs font-label font-bold text-[var(--color-text-muted)] uppercase tracking-widest mb-2 pb-1" style="border-bottom:1px solid var(--color-border)">Network (ASN)</h2>
          <div id="asn-info" class="min-h-[40px] space-y-1 text-sm text-[var(--color-text-muted)]">
            <div id="asn-loader" class="loader"></div>
            <div class="hidden">
              <p><span class="text-[var(--color-text-dim)]">AS Number:</span> <span id="asn-number" class="font-mono text-[var(--color-accent)]">-</span></p>
              <p><span class="text-[var(--color-text-dim)]">Org:</span> <span id="asn-org" class="font-medium text-[var(--color-text)]">-</span></p>
              <p id="asn-error" class="text-[var(--color-status-bad)] text-xs"></p>
            </div>
          </div>
        </div>
      </div>

      <div class="card p-5">
        <h2 class="text-xs font-label font-bold text-[var(--color-text-muted)] uppercase tracking-widest mb-2 pb-1" style="border-bottom:1px solid var(--color-border)">Hostname (rDNS)</h2>
        <div id="rdns-info" class="min-h-[30px] text-sm text-[var(--color-text-muted)]">
          <div id="rdns-loader" class="loader"></div>
          <div class="hidden">
            <ul id="rdns-list" class="list-none space-y-1 font-mono text-xs text-[var(--color-status-good)]"><li>-</li></ul>
            <p id="rdns-error" class="text-[var(--color-status-bad)] text-xs"></p>
          </div>
        </div>
      </div>
    </div>

    <!-- Right column: map — container is h-[420px] so the Leaflet map can fill it -->
    <div class="fade-in" style="animation-delay:.2s">
      ${sectionEyebrow('Location')}
      <div id="map-container" class="rounded-xl h-[420px] relative overflow-hidden shadow-inner" style="border:1px solid var(--color-border); background:var(--color-panel-inset)">
        <div id="map-loader" class="loader absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10"></div>
        <div id="map" class="w-full hidden z-0 transition-opacity duration-700 rounded-xl"></div>
        <p id="map-message" class="text-[var(--color-text-muted)] hidden absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-sm">Could not load map.</p>
        <div class="absolute inset-0 pointer-events-none rounded-xl ring-1 ring-inset ring-white/10"></div>
      </div>
    </div>
  </div>

  <!-- Browser Fingerprint -->
  <div class="mt-6 card p-5 fade-in" style="animation-delay:.3s">
    <h2 class="text-xs font-label font-bold text-[var(--color-text-muted)] uppercase tracking-widest mb-4 pb-2 flex items-center gap-2" style="border-bottom:1px solid var(--color-border)">
      <span class="inline-block w-1.5 h-4 rounded-full" style="background:var(--color-accent)"></span>
      Browser Fingerprint
    </h2>
    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-8 gap-y-4 text-sm">
      <div>
        <p class="text-xs text-[var(--color-text-dim)] uppercase tracking-wider mb-0.5">Browser</p>
        <p id="fp-browser" class="text-[var(--color-text)] font-medium font-mono">-</p>
      </div>
      <div>
        <p class="text-xs text-[var(--color-text-dim)] uppercase tracking-wider mb-0.5">Operating System</p>
        <p id="fp-os" class="text-[var(--color-text)] font-medium">-</p>
      </div>
      <div>
        <p class="text-xs text-[var(--color-text-dim)] uppercase tracking-wider mb-0.5">Screen</p>
        <p id="fp-screen" class="text-[var(--color-text)] font-medium font-mono">-</p>
      </div>
      <div>
        <p class="text-xs text-[var(--color-text-dim)] uppercase tracking-wider mb-0.5">Viewport</p>
        <p id="fp-viewport" class="text-[var(--color-text)] font-medium font-mono">-</p>
      </div>
      <div>
        <p class="text-xs text-[var(--color-text-dim)] uppercase tracking-wider mb-0.5">Language</p>
        <p id="fp-language" class="text-[var(--color-text)] font-medium">-</p>
      </div>
      <div>
        <p class="text-xs text-[var(--color-text-dim)] uppercase tracking-wider mb-0.5">Timezone</p>
        <p id="fp-timezone" class="text-[var(--color-text)] font-medium">-</p>
      </div>
      <div>
        <p class="text-xs text-[var(--color-text-dim)] uppercase tracking-wider mb-0.5">Color Depth</p>
        <p id="fp-color" class="text-[var(--color-text)] font-medium">-</p>
      </div>
      <div>
        <p class="text-xs text-[var(--color-text-dim)] uppercase tracking-wider mb-0.5">Privacy</p>
        <p id="fp-privacy" class="text-[var(--color-text)] font-medium text-xs leading-relaxed">-</p>
      </div>
    </div>
    <details class="mt-4 pt-3" style="border-top:1px solid var(--color-border)">
      <summary class="text-xs text-[var(--color-text-dim)] cursor-pointer hover:text-[var(--color-text-muted)] select-none list-none transition-colors">User Agent string</summary>
      <p id="fp-ua" class="font-mono text-xs text-[var(--color-text-muted)] break-all mt-2 leading-relaxed"></p>
    </details>
  </div>

  <!-- IP Lookup -->
  <div class="mt-8 p-6 card">
    <h2 class="text-xl font-display font-bold text-gradient mb-4 flex items-center gap-2">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-[var(--color-link)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
      </svg>
      IP Address / Domain Lookup
    </h2>
    <div class="flex flex-col sm:flex-row gap-3 mb-6">
      <input type="text" id="lookup-ip-input" placeholder="Enter IP or Domain (e.g., 8.8.8.8 or google.com)" class="input flex-grow">
      <button id="lookup-button" disabled class="btn btn-primary">
        Lookup
      </button>
    </div>
    <div id="lookup-error" class="mb-4 hidden alert alert-bad"></div>

    <div id="lookup-results-section" class="hidden grid grid-cols-1 md:grid-cols-2 gap-8 mt-6 pt-6 fade-in" style="border-top:1px solid var(--color-border)">
      <!-- Left: info -->
      <div class="space-y-5">
        <h3 class="text-lg font-semibold text-[var(--color-text)]">Result for: <span id="lookup-ip-address" class="font-mono text-[var(--color-accent)]" style="background:color-mix(in oklab, var(--color-accent) 12%, transparent); padding:.125rem .5rem; border-radius:.375rem"></span>
          <button id="copy-lookup-ip-btn" class="copy-btn ml-2">copy</button>
        </h3>
        <div id="lookup-result-loader" class="loader hidden"></div>

        <div id="lookup-geo-info" class="text-sm text-[var(--color-text-muted)]">
          <h4 class="font-label font-bold text-[var(--color-text-dim)] uppercase text-xs tracking-wider mb-2">Geolocation</h4>
          <div class="grid grid-cols-2 gap-x-2 gap-y-1">
            <p><span class="text-[var(--color-text-dim)]">Country:</span> <span id="lookup-country" class="text-[var(--color-text)]">-</span></p>
            <p><span class="text-[var(--color-text-dim)]">Region:</span> <span id="lookup-region" class="text-[var(--color-text)]">-</span></p>
            <p><span class="text-[var(--color-text-dim)]">City:</span> <span id="lookup-city" class="text-[var(--color-text)]">-</span></p>
            <p><span class="text-[var(--color-text-dim)]">Zip:</span> <span id="lookup-postal" class="text-[var(--color-text)]">-</span></p>
            <p class="col-span-2"><span class="text-[var(--color-text-dim)]">Coords:</span> <span id="lookup-coords" class="font-mono text-[var(--color-accent)]">-</span></p>
            <p class="col-span-2"><span class="text-[var(--color-text-dim)]">Time:</span> <span id="lookup-timezone" class="text-[var(--color-text)]">-</span></p>
            <p id="lookup-geo-error" class="text-[var(--color-status-bad)] col-span-2 text-xs"></p>
          </div>
        </div>

        <div id="lookup-asn-info" class="text-sm text-[var(--color-text-muted)]">
          <h4 class="font-label font-bold text-[var(--color-text-dim)] uppercase text-xs tracking-wider mb-2">ASN</h4>
          <p><span class="text-[var(--color-text-dim)]">Number:</span> <span id="lookup-asn-number" class="text-[var(--color-text)] font-mono">-</span></p>
          <p><span class="text-[var(--color-text-dim)]">Org:</span> <span id="lookup-asn-org" class="text-[var(--color-text)]">-</span></p>
          <p id="lookup-asn-error" class="text-[var(--color-status-bad)] text-xs"></p>
        </div>

        <div id="lookup-rdns-info" class="text-sm text-[var(--color-text-muted)]">
          <h4 class="font-label font-bold text-[var(--color-text-dim)] uppercase text-xs tracking-wider mb-2">Reverse DNS</h4>
          <ul id="lookup-rdns-list" class="list-none space-y-1 font-mono text-xs text-[var(--color-status-good)]"><li>-</li></ul>
          <p id="lookup-rdns-error" class="text-[var(--color-status-bad)] text-xs"></p>
        </div>
      </div>

      <!-- Right: map + action buttons -->
      <div class="space-y-4">
        <h4 class="font-label font-bold text-[var(--color-text-dim)] uppercase text-xs tracking-wider">Location Map</h4>
        <div id="lookup-map-container" class="rounded-xl h-[260px] relative overflow-hidden" style="background:var(--color-panel-inset); border:1px solid var(--color-border)">
          <div id="lookup-map-loader" class="loader hidden absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10"></div>
          <div id="lookup-map" class="w-full hidden rounded-xl"></div>
          <p id="lookup-map-message" class="text-[var(--color-text-muted)] hidden absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-sm text-center px-4">Could not load map.</p>
          <div class="absolute inset-0 pointer-events-none ring-1 ring-inset ring-white/10 rounded-xl"></div>
        </div>

        <!-- Action buttons -->
        <div class="grid grid-cols-3 gap-2">
          <button id="lookup-ping-button" disabled title="Send ICMP ping" class="btn-tool">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M22 12h-4l-3 9L9 3l-3 9H2"/>
            </svg>
            <span class="text-xs font-semibold">Ping</span>
          </button>
          <button id="lookup-trace-button" disabled title="Run traceroute" class="btn-tool">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
            </svg>
            <span class="text-xs font-semibold">Traceroute</span>
          </button>
          <button id="lookup-scan-button" disabled title="Scan common ports" class="btn-tool">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"/>
            </svg>
            <span class="text-xs font-semibold">Port Scan</span>
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Ping Results — dedicated section, consistent with traceroute/port-scan -->
  <div id="ping-section" class="mt-8 p-6 card hidden fade-in">
    ${sectionTitle('Ping', 'ping-target')}
    <div class="flex items-center gap-3 mb-4 text-sm">
      <div id="ping-section-loader" class="loader hidden"></div>
      <span id="ping-section-message" class="text-[var(--color-text-muted)]"></span>
      <span id="ping-section-error" class="text-[var(--color-status-bad)]"></span>
    </div>
    <!-- Stat cards -->
    <div id="ping-stats-grid" class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 hidden">
      <div class="stat-box">
        <p class="stat-label uppercase tracking-wider">Sent</p>
        <p id="ping-stat-sent" class="stat-value font-mono text-2xl">-</p>
      </div>
      <div class="stat-box stat-good">
        <p class="stat-label uppercase tracking-wider">Received</p>
        <p id="ping-stat-recv" class="stat-value font-mono text-2xl">-</p>
      </div>
      <div class="stat-box">
        <p class="stat-label uppercase tracking-wider">Packet Loss</p>
        <p id="ping-stat-loss" class="stat-value font-mono text-2xl">-</p>
      </div>
      <div class="stat-box stat-link">
        <p class="stat-label uppercase tracking-wider">Avg RTT</p>
        <p id="ping-stat-rtt" class="stat-value font-mono text-2xl">-</p>
      </div>
    </div>
    <!-- RTT range bar -->
    <div id="ping-rtt-range" class="hidden mb-4 px-4 py-3 rounded-lg flex flex-wrap gap-6 text-xs font-mono text-[var(--color-text-dim)]" style="background:var(--color-panel-inset); border:1px solid var(--color-border)">
      <span>min &nbsp;<span id="ping-rtt-min" class="text-[var(--color-text)] font-semibold">-</span> ms</span>
      <span>avg &nbsp;<span id="ping-rtt-avg" class="text-[var(--color-text)] font-semibold">-</span> ms</span>
      <span>max &nbsp;<span id="ping-rtt-max" class="text-[var(--color-text)] font-semibold">-</span> ms</span>
    </div>
    <!-- Raw output -->
    <details>
      <summary class="text-xs text-[var(--color-text-dim)] hover:text-[var(--color-text-muted)] cursor-pointer select-none list-none transition-colors">Raw output</summary>
      <pre id="ping-raw-output" class="result-pre mt-2 text-xs"></pre>
    </details>
  </div>

  <!-- Traceroute -->
  <div id="traceroute-section" class="mt-8 p-6 card hidden fade-in">
    ${sectionTitle('Traceroute', 'traceroute-target')}
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center gap-3 text-sm">
        <div id="traceroute-loader" class="loader hidden"></div>
        <span id="traceroute-message" class="text-[var(--color-text-muted)]"></span>
      </div>
      <button id="traceroute-stop-btn" class="stop-btn hidden">&#9632; Stop</button>
    </div>
    <!-- Hop table header -->
    <div class="hidden sm:grid traceroute-header text-xs text-[var(--color-text-dim)] uppercase tracking-wider px-2 mb-1" style="grid-template-columns:2rem 1fr auto">
      <span class="text-right pr-3">#</span>
      <span>IP / Hostname</span>
      <span class="text-right">RTT</span>
    </div>
    <div id="traceroute-output" class="font-mono text-sm rounded-lg overflow-y-auto max-h-[420px] p-2 space-y-0.5" style="border:1px solid var(--color-border); background:var(--color-panel-inset)"></div>
  </div>

  <!-- Port Scan -->
  <div id="port-scan-section" class="mt-8 p-6 card hidden fade-in">
    ${sectionTitle('Port Scan Results')}
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-3 text-sm">
        <div id="port-scan-loader" class="loader hidden"></div>
        <span id="port-scan-message" class="text-[var(--color-text-muted)]"></span>
      </div>
      <button id="port-scan-stop-btn" class="stop-btn hidden">&#9632; Stop</button>
    </div>
    <div id="port-scan-output" class="text-sm font-mono p-4 rounded-lg max-h-[300px] overflow-y-auto" style="background:var(--color-panel-inset); border:1px solid var(--color-border)"></div>
  </div>

  <div id="global-error" class="mt-6 alert alert-bad hidden"></div>
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

    // Ping section
    const pingSect        = document.getElementById('ping-section');
    const pingTarget      = document.getElementById('ping-target');
    const pingSectLoader  = document.getElementById('ping-section-loader');
    const pingSectMsg     = document.getElementById('ping-section-message');
    const pingSectErr     = document.getElementById('ping-section-error');
    const pingStatsGrid   = document.getElementById('ping-stats-grid');
    const pingRttRange    = document.getElementById('ping-rtt-range');
    const pingRawOutput   = document.getElementById('ping-raw-output');

    const tracerouteSection  = document.getElementById('traceroute-section');
    const tracerouteTarget   = document.getElementById('traceroute-target');
    const tracerouteOutput   = document.getElementById('traceroute-output');
    const tracerouteLoader   = document.getElementById('traceroute-loader');
    const tracerouteMessage  = document.getElementById('traceroute-message');
    const tracerouteStopBtn  = document.getElementById('traceroute-stop-btn');

    const portScanSection    = document.getElementById('port-scan-section');
    const portScanOutput     = document.getElementById('port-scan-output');
    const portScanLoader     = document.getElementById('port-scan-loader');
    const portScanMessage    = document.getElementById('port-scan-message');
    const portScanStopBtn    = document.getElementById('port-scan-stop-btn');

    // ── State ────────────────────────────────────────────────────
    let currentIp = null, currentLookupIp = null;
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
    setupCopyBtn(copyIpBtn,      () => ipAddressSpan.textContent);
    setupCopyBtn(copyLookupIpBtn, () => lookupIpEl.textContent);
    const copyIpv6Btn = document.getElementById('copy-ipv6-btn');
    setupCopyBtn(copyIpv6Btn, () => document.getElementById('ipv6-address').textContent);

    // ── Lookup button enable/disable ─────────────────────────────
    const syncLookupBtn = () => { lookupBtn.disabled = !lookupInput.value.trim(); };
    lookupInput.addEventListener('input', syncLookupBtn);

    // ── Privacy / risk flags ──────────────────────────────────────
    // Maps the backend's 4-tier severity to the app's 3-tier LED system —
    // an intentional simplification, mirroring how real status LEDs only
    // have good/warn/bad states.
    const FLAG_LED_STATUS = { green: 'good', yellow: 'warn', orange: 'warn', red: 'bad' };

    async function fetchPrivacyFlags(ip, version = 4) {
      const container = document.getElementById(`privacy-flags-v${version}`);
      const loader    = document.getElementById(`privacy-loader-v${version}`);
      if (!container) return;
      try {
        const r    = await fetch(`${API}/privacy/${encodeURIComponent(ip)}`);
        const data = await r.json();
        loader?.remove();
        if (!data.flags?.length) {
          container.innerHTML = '<span class="text-xs text-[var(--color-text-dim)]">—</span>';
          return;
        }
        container.innerHTML = data.flags.map(f =>
          renderLed(FLAG_LED_STATUS[f.color] || 'neutral', f.label)
        ).join('');
      } catch {
        loader?.remove();
        container.innerHTML = '<span class="text-xs text-[var(--color-text-dim)]">N/A</span>';
      }
    }

    // ── Browser fingerprint ───────────────────────────────────────
    function populateBrowserFingerprint() {
      const ua = navigator.userAgent;

      function getBrowser() {
        if (/Edg\/(\d+)/.test(ua))                           return `Edge ${RegExp.$1}`;
        if (/OPR\/(\d+)/.test(ua))                           return `Opera ${RegExp.$1}`;
        if (/Chrome\/(\d+)/.test(ua))                        return `Chrome ${RegExp.$1}`;
        if (/Firefox\/(\d+)/.test(ua))                       return `Firefox ${RegExp.$1}`;
        if (/Version\/([\d.]+).*Safari/.test(ua))            return `Safari ${RegExp.$1}`;
        return 'Unknown';
      }

      function getOS() {
        if (/Windows NT 10\.0/.test(ua))                     return 'Windows 10 / 11';
        if (/Windows NT 6\.3/.test(ua))                      return 'Windows 8.1';
        if (/Windows NT 6\.1/.test(ua))                      return 'Windows 7';
        if (/Mac OS X ([\d_]+)/.test(ua))                    return `macOS ${RegExp.$1.replace(/_/g, '.')}`;
        if (/Android ([\d.]+)/.test(ua))                     return `Android ${RegExp.$1}`;
        if (/iPhone OS ([\d_]+)/.test(ua))                   return `iOS ${RegExp.$1.replace(/_/g, '.')}`;
        if (/iPad.*OS ([\d_]+)/.test(ua))                    return `iPadOS ${RegExp.$1.replace(/_/g, '.')}`;
        if (/Linux/.test(ua))                                return 'Linux';
        return 'Unknown';
      }

      document.getElementById('fp-browser').textContent  = getBrowser();
      document.getElementById('fp-os').textContent       = getOS();
      document.getElementById('fp-screen').textContent   =
        `${screen.width} × ${screen.height}` + (window.devicePixelRatio !== 1 ? ` @ ${window.devicePixelRatio}×` : '');
      document.getElementById('fp-viewport').textContent = `${window.innerWidth} × ${window.innerHeight} px`;
      document.getElementById('fp-language').textContent =
        navigator.language + (navigator.languages?.length > 1 ? `  (+${navigator.languages.length - 1} more)` : '');
      document.getElementById('fp-timezone').textContent = Intl.DateTimeFormat().resolvedOptions().timeZone;
      document.getElementById('fp-color').textContent    = `${screen.colorDepth}-bit`;

      const bits = [];
      if (navigator.cookieEnabled)          bits.push('Cookies on');
      else                                  bits.push('Cookies off');
      if (navigator.doNotTrack === '1')     bits.push('DNT enabled');
      const conn = navigator.connection;
      if (conn?.effectiveType)              bits.push(conn.effectiveType.toUpperCase());
      document.getElementById('fp-privacy').textContent = bits.join(' · ');

      document.getElementById('fp-ua').textContent = ua;
    }

    // ── Own IP fetch ─────────────────────────────────────────────
    async function fetchIpInfo() {
      globalError.classList.add('hidden');
      [ipLoader, geoLoader, asnLoader, rdnsLoader, mapLoader].forEach(l => l?.classList.remove('hidden'));
      ipAddressLink.classList.add('hidden');
      copyIpBtn.classList.add('hidden');
      mapEl.classList.add('hidden');
      mapMessage.classList.add('hidden');

      function setPrivacyNA(version) {
        const el = document.getElementById(`privacy-flags-v${version}`);
        if (el) { document.getElementById(`privacy-loader-v${version}`)?.remove(); el.innerHTML = '<span class="text-xs text-[var(--color-text-dim)]">N/A</span>'; }
      }

      const { ipv4, ipv6 } = await detectDualStack();

      const hasSeperateIPv6 = !!(ipv4 && ipv6 && ipv4 !== ipv6);
      const primaryIp       = ipv4 || ipv6;

      // Fetch geo / ASN / rDNS — use /api/lookup for detected IP, /api/ipinfo as fallback
      let data;
      try {
        if (primaryIp) {
          const r = await fetch(`${API}/lookup?targetIp=${encodeURIComponent(primaryIp)}`);
          if (!r.ok) throw new Error(`${r.statusText} (${r.status})`);
          data = await r.json();
          data.ip = primaryIp;
        } else {
          // Local dev / subdomains not reachable — fall back to auto-detect
          const r = await fetch(`${API}/ipinfo`);
          if (!r.ok) throw new Error(`${r.statusText} (${r.status})`);
          data = await r.json();
        }
      } catch (err) {
        console.error('Failed to fetch IP info:', err);
        showGlobalErr(`Could not load IP information. ${err.message}`);
        [ipLoader, geoLoader, asnLoader, rdnsLoader, mapLoader].forEach(l => l?.classList.add('hidden'));
        return;
      }

      currentIp = data.ip;

      // Show primary IP
      ipAddressSpan.textContent = data.ip;
      ipAddressLink.classList.remove('hidden');
      copyIpBtn.classList.remove('hidden');
      ipLoader.classList.add('hidden');
      ipAddressLink.onclick = e => {
        e.preventDefault();
        window._router.navigate('/whois', { query: currentIp });
      };

      // IPv6 row — only when a separate IPv6 was detected alongside IPv4
      if (hasSeperateIPv6) {
        document.getElementById('ipv6-address').textContent = ipv6;
        document.getElementById('ipv6-row').classList.remove('hidden');
        copyIpv6Btn.classList.remove('hidden');
      }

      // Privacy checks — each slot gets the correct IP or N/A
      const v4ForPrivacy = ipv4 || (!data.ip.includes(':') ? data.ip : null);
      const v6ForPrivacy = hasSeperateIPv6 ? ipv6 : (data.ip.includes(':') ? data.ip : null);

      if (v4ForPrivacy) {
        fetchPrivacyFlags(v4ForPrivacy, 4);
      } else {
        setPrivacyNA(4);
      }

      if (v6ForPrivacy) {
        const v6El = document.getElementById('privacy-flags-v6');
        if (v6El) v6El.innerHTML = '<div id="privacy-loader-v6" class="loader" style="width:12px;height:12px;border-width:2px"></div>';
        fetchPrivacyFlags(v6ForPrivacy, 6);
      } else {
        setPrivacyNA(6);
      }

      // Populate geo / ASN / rDNS / map
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
          `<a href="/asn?asn=${asnNum}" class="hover:text-[var(--color-accent-strong)] underline decoration-dotted transition-colors" title="Open ASN Lookup">AS${asnNum}</a>`;
      } else {
        updateField(document.getElementById('asn-number'), null, null, document.getElementById('asn-error'), data.asn?.error || '-');
      }
      updateField(document.getElementById('asn-org'), data.asn?.organization, asnLoader);
      updateRdns(document.getElementById('rdns-list'), data.rdns, rdnsLoader, document.getElementById('rdns-error'));
      initOrUpdateMap('map', data.geo?.latitude, data.geo?.longitude, mapEl, mapLoader, mapMessage);
    }

    // ── Lookup ───────────────────────────────────────────────────
    function resetLookup() {
      lookupSection.classList.add('hidden');
      lookupResLoader.classList.add('hidden');
      lookupMapLoader.classList.add('hidden');
      lookupMapEl.classList.add('hidden');
      lookupMapMsg.classList.add('hidden');
      pingSect.classList.add('hidden');
      portScanSection.classList.add('hidden');
      portScanOutput.innerHTML = '';
      [lookupIpEl, document.getElementById('lookup-country'), document.getElementById('lookup-region'),
       document.getElementById('lookup-city'), document.getElementById('lookup-postal'),
       document.getElementById('lookup-coords'), document.getElementById('lookup-timezone'),
       document.getElementById('lookup-asn-number'), document.getElementById('lookup-asn-org'),
       document.getElementById('lookup-geo-error'), document.getElementById('lookup-asn-error'),
       document.getElementById('lookup-rdns-error')].forEach(el => { if (el) el.textContent = ''; });
      document.getElementById('lookup-rdns-list').innerHTML = '<li>-</li>';
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
            `<a href="/asn?asn=${data.asn.number}" class="text-[var(--color-accent)] hover:text-[var(--color-accent-strong)] underline decoration-dotted transition-colors font-mono">AS${data.asn.number}</a>`;
        } else {
          updateField(document.getElementById('lookup-asn-number'), data.asn?.number, null, document.getElementById('lookup-asn-error'));
        }
        updateField(document.getElementById('lookup-asn-org'), data.asn?.organization);
        updateRdns(document.getElementById('lookup-rdns-list'), data.rdns, null, document.getElementById('lookup-rdns-error'));
        initOrUpdateMap('lookup-map', data.geo?.latitude, data.geo?.longitude, lookupMapEl, lookupMapLoader, lookupMapMsg);
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
      pingSect.classList.remove('hidden');
      pingTarget.textContent = ip;
      pingSectLoader.classList.remove('hidden');
      pingSectMsg.textContent = `Pinging ${ip}…`;
      pingSectErr.textContent = '';
      pingStatsGrid.classList.add('hidden');
      pingRttRange.classList.add('hidden');
      pingRawOutput.textContent = '';
      pingSect.scrollIntoView({ behavior: 'smooth', block: 'start' });

      try {
        const r    = await fetch(`${API}/ping?targetIp=${encodeURIComponent(ip)}`);
        const data = await r.json();
        if (!r.ok || !data.success) throw new Error(data.error || `HTTP ${r.status}`);

        if (data.stats?.packets) {
          const loss = data.stats.packets.lossPercent;
          document.getElementById('ping-stat-sent').textContent = data.stats.packets.transmitted;
          document.getElementById('ping-stat-recv').textContent = data.stats.packets.received;
          document.getElementById('ping-stat-loss').textContent = `${loss}%`;
          document.getElementById('ping-stat-loss').style.color =
            (loss === 0 || loss === '0') ? 'var(--color-status-good)' : loss >= 50 ? 'var(--color-status-bad)' : 'var(--color-status-warn)';
          document.getElementById('ping-stat-rtt').textContent = data.stats.rtt ? `${data.stats.rtt.avg} ms` : '-';
          pingStatsGrid.classList.remove('hidden');
        }
        if (data.stats?.rtt) {
          document.getElementById('ping-rtt-min').textContent = data.stats.rtt.min;
          document.getElementById('ping-rtt-avg').textContent = data.stats.rtt.avg;
          document.getElementById('ping-rtt-max').textContent = data.stats.rtt.max;
          pingRttRange.classList.remove('hidden');
        }
        pingRawOutput.textContent = data.rawOutput || '';
        pingSectMsg.textContent = `Ping to ${ip} complete.`;
      } catch (err) {
        pingSectErr.textContent = `Ping failed: ${err.message}`;
        pingSectMsg.textContent = '';
      } finally {
        pingSectLoader.classList.add('hidden');
      }
    }

    // ── Traceroute ───────────────────────────────────────────────
    function startTraceroute(ip) {
      if (eventSource) { eventSource.close(); eventSource = null; }
      tracerouteSection.classList.remove('hidden');
      if (tracerouteTarget) tracerouteTarget.textContent = ip;
      tracerouteOutput.innerHTML = '';
      tracerouteLoader.classList.remove('hidden');
      tracerouteStopBtn.classList.remove('hidden');
      tracerouteMessage.textContent = `Starting traceroute to ${ip}…`;
      globalError.classList.add('hidden');
      tracerouteSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

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
          const d   = JSON.parse(e.data);
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
      div.classList.add('px-2', 'py-0.5', 'fade-in');
      if (cls) div.classList.add(cls);
      div.textContent = text;
      tracerouteOutput.appendChild(div);
      tracerouteOutput.scrollTop = tracerouteOutput.scrollHeight;
    }

    function displayHop(hop) {
      const row = document.createElement('div');
      row.classList.add('hop-row', 'fade-in');

      // Hop number
      const numEl = document.createElement('span');
      numEl.classList.add('hop-number');
      numEl.textContent = hop.hop ?? '?';
      row.appendChild(numEl);

      // Body: IP line + optional RDNS line below
      const body = document.createElement('div');
      body.classList.add('hop-body');

      if (hop.ip) {
        const ipLine = document.createElement('div');
        ipLine.classList.add('hop-ip-line');

        const ipEl = document.createElement('span');
        ipEl.classList.add('hop-ip');
        ipEl.textContent = hop.ip;
        ipLine.appendChild(ipEl);

        // RTTs — right-aligned via flex margin-left auto on the rtt group
        if (Array.isArray(hop.rtt)) {
          const rttsEl = document.createElement('span');
          rttsEl.classList.add('hop-rtts');
          hop.rtt.forEach(r => {
            const s = document.createElement('span');
            s.classList.add(r === '*' ? 'hop-timeout' : 'hop-rtt');
            s.textContent = r === '*' ? '*' : `${r} ms`;
            rttsEl.appendChild(s);
          });
          ipLine.appendChild(rttsEl);
        }
        body.appendChild(ipLine);

        // RDNS — own line, only when it differs from the IP
        if (hop.hostname && hop.hostname !== hop.ip) {
          const rdnsEl = document.createElement('div');
          rdnsEl.classList.add('hop-rdns');
          rdnsEl.textContent = hop.hostname;
          body.appendChild(rdnsEl);
        }
      } else if (hop.rtt?.every(r => r === '*')) {
        const line = document.createElement('div');
        line.classList.add('hop-ip-line');
        const t = document.createElement('span');
        t.classList.add('hop-timeout');
        t.textContent = '* * *';
        line.appendChild(t);
        body.appendChild(line);
      } else {
        const line = document.createElement('div');
        line.classList.add('hop-ip-line');
        line.style.color = 'var(--color-text-muted)';
        line.textContent = hop.rawLine || 'Unknown hop';
        body.appendChild(line);
      }

      row.appendChild(body);
      tracerouteOutput.appendChild(row);
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
      portScanSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

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
        div.innerHTML = `<span style="color:var(--color-status-bad)">Error: ${data.error}</span>`;
      } else {
        const statusMap = { open: 'good', closed: 'bad', timeout: 'warn' };
        const labels     = { open: 'OPEN', closed: 'CLOSED', timeout: 'TIMEOUT (Filtered?)' };
        const status = statusMap[data.status] || 'neutral';
        const lbl    = labels[data.status] || (data.status || '').toUpperCase();
        div.innerHTML = `<span class="inline-flex items-center gap-2 text-[var(--color-text-muted)]">Port <span class="font-bold text-[var(--color-text)] w-12 inline-block">${data.port}</span> <span class="w-24 inline-block">(${data.service})</span>: ${renderLed(status, lbl)}</span>`;
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
    populateBrowserFingerprint();
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
