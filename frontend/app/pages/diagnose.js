import { API, detectDualStack } from '../shared.js';

export const page = {
  title: 'Connection Test',

  template: () => `
<div class="container mx-auto max-w-5xl glass-panel rounded-xl shadow-2xl p-6 md:p-8 backdrop-blur-xl border border-gray-800/50">
  <h1 class="text-3xl font-bold mb-2 text-center text-gradient">Connection Test</h1>
  <p class="text-center text-gray-500 text-sm mb-8">Test the quality of your own connection to this server.</p>

  <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
    <!-- Dual-Stack -->
    <div class="p-6 glass-card rounded-xl fade-in" style="animation-delay:.05s">
      <h3 class="text-lg font-semibold text-purple-300 flex items-center gap-2 mb-4">
        <div class="w-1.5 h-6 bg-purple-500 rounded-full"></div>
        Dual-Stack Support
      </h3>
      <div class="space-y-3">
        <div class="flex items-center gap-3">
          <span class="text-sm text-gray-400 w-14">IPv4</span>
          <div id="diag-v4-loader" class="loader" style="width:14px;height:14px;border-width:2px"></div>
          <span id="diag-v4-badge" class="hidden inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"></span>
          <span id="diag-v4-ip" class="font-mono text-xs text-gray-500"></span>
        </div>
        <div class="flex items-center gap-3">
          <span class="text-sm text-gray-400 w-14">IPv6</span>
          <div id="diag-v6-loader" class="loader" style="width:14px;height:14px;border-width:2px"></div>
          <span id="diag-v6-badge" class="hidden inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"></span>
          <span id="diag-v6-ip" class="font-mono text-xs text-gray-500"></span>
        </div>
      </div>
    </div>

    <!-- Protocol -->
    <div class="p-6 glass-card rounded-xl fade-in" style="animation-delay:.1s">
      <h3 class="text-lg font-semibold text-purple-300 flex items-center gap-2 mb-4">
        <div class="w-1.5 h-6 bg-purple-500 rounded-full"></div>
        Connection Protocol
      </h3>
      <div class="flex items-center gap-3 mb-3">
        <div id="diag-protocol-loader" class="loader" style="width:14px;height:14px;border-width:2px"></div>
        <span id="diag-protocol-badge" class="hidden inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold font-mono"></span>
      </div>
      <p class="text-xs text-gray-600 leading-relaxed">TLS version isn't shown here because TLS is terminated outside this application (a reverse proxy in front of this deployment), and neither the backend nor Nginx have access to the TLS version negotiated with the browser.</p>
    </div>
  </div>

  <!-- Latency / Jitter / Packet loss -->
  <div class="p-6 glass-card rounded-xl mb-6 fade-in" style="animation-delay:.15s">
    <div class="flex items-center justify-between flex-wrap gap-3 mb-4">
      <h3 class="text-lg font-semibold text-purple-300 flex items-center gap-2">
        <div class="w-1.5 h-6 bg-purple-500 rounded-full"></div>
        Latency, Jitter &amp; Packet Loss
      </h3>
      <button id="diag-latency-btn"
        class="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-2.5 px-5 rounded-lg shadow-lg transition-all duration-200 text-sm">
        Start Test
      </button>
    </div>
    <div id="diag-latency-loader" class="loader hidden mx-auto"></div>
    <div id="diag-latency-results" class="hidden grid grid-cols-2 sm:grid-cols-5 gap-3">
      <div class="bg-gray-900/50 rounded-lg p-4 text-center border border-gray-700/30">
        <p class="text-xs text-gray-500 uppercase tracking-wider mb-1">Min</p>
        <p id="diag-lat-min" class="text-2xl font-bold font-mono text-blue-300">-</p>
      </div>
      <div class="bg-gray-900/50 rounded-lg p-4 text-center border border-gray-700/30">
        <p class="text-xs text-gray-500 uppercase tracking-wider mb-1">Avg</p>
        <p id="diag-lat-avg" class="text-2xl font-bold font-mono text-blue-300">-</p>
      </div>
      <div class="bg-gray-900/50 rounded-lg p-4 text-center border border-gray-700/30">
        <p class="text-xs text-gray-500 uppercase tracking-wider mb-1">Max</p>
        <p id="diag-lat-max" class="text-2xl font-bold font-mono text-blue-300">-</p>
      </div>
      <div class="bg-gray-900/50 rounded-lg p-4 text-center border border-gray-700/30">
        <p class="text-xs text-gray-500 uppercase tracking-wider mb-1">Jitter</p>
        <p id="diag-lat-jitter" class="text-2xl font-bold font-mono text-yellow-300">-</p>
      </div>
      <div class="bg-gray-900/50 rounded-lg p-4 text-center border border-gray-700/30">
        <p class="text-xs text-gray-500 uppercase tracking-wider mb-1">Packet Loss</p>
        <p id="diag-lat-loss" class="text-2xl font-bold font-mono text-green-400">-</p>
      </div>
    </div>
  </div>

  <!-- Speedtest — hidden until /api/speedtest/config confirms it's enabled -->
  <div id="diag-speedtest-section" class="p-6 glass-card rounded-xl hidden fade-in" style="animation-delay:.2s">
    <h3 class="text-lg font-semibold text-purple-300 flex items-center gap-2 mb-4">
      <div class="w-1.5 h-6 bg-purple-500 rounded-full"></div>
      Speedtest
    </h3>
    <div class="flex gap-3 flex-wrap mb-4">
      <button id="diag-download-btn"
        class="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-2.5 px-5 rounded-lg shadow-lg transition-all duration-200 text-sm">
        Test Download
      </button>
      <button id="diag-upload-btn"
        class="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-2.5 px-5 rounded-lg shadow-lg transition-all duration-200 text-sm">
        Test Upload
      </button>
    </div>
    <div id="diag-speed-bar-track" class="speed-bar-track mb-4 hidden">
      <div id="diag-speed-bar-fill" class="speed-bar-fill" style="width:0%"></div>
    </div>
    <div class="grid grid-cols-2 gap-3">
      <div class="bg-gray-900/50 rounded-lg p-4 text-center border border-gray-700/30">
        <p class="text-xs text-gray-500 uppercase tracking-wider mb-1">Download</p>
        <p id="diag-speed-down" class="text-2xl font-bold font-mono text-green-400">-</p>
      </div>
      <div class="bg-gray-900/50 rounded-lg p-4 text-center border border-gray-700/30">
        <p class="text-xs text-gray-500 uppercase tracking-wider mb-1">Upload</p>
        <p id="diag-speed-up" class="text-2xl font-bold font-mono text-blue-300">-</p>
      </div>
    </div>
    <p id="diag-speed-error" class="text-red-400 text-xs mt-3 hidden"></p>
  </div>
</div>`,

  async init() {
    let cancelled = false;
    const activeControllers = new Set();

    function setBadge(el, ok, textOk, textFail) {
      el.textContent = ok ? textOk : textFail;
      el.className = ok
        ? 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-900/40 text-green-300 border border-green-700/50'
        : 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-900/40 text-red-300 border border-red-700/50';
    }

    // ── Dual-Stack ──────────────────────────────────────────────
    async function runDualStackCheck() {
      const { ipv4, ipv6 } = await detectDualStack();
      if (cancelled) return;

      document.getElementById('diag-v4-loader')?.remove();
      document.getElementById('diag-v6-loader')?.remove();

      setBadge(document.getElementById('diag-v4-badge'), !!ipv4, 'reachable', 'unreachable');
      setBadge(document.getElementById('diag-v6-badge'), !!ipv6, 'reachable', 'unreachable');
      if (ipv4) document.getElementById('diag-v4-ip').textContent = ipv4;
      if (ipv6) document.getElementById('diag-v6-ip').textContent = ipv6;
    }

    // ── Connection protocol (client-side only, see note in template) ──
    function detectProtocol() {
      const loader = document.getElementById('diag-protocol-loader');
      const badgeEl = document.getElementById('diag-protocol-badge');
      let done = false;

      function renderProtocol(proto) {
        if (done || cancelled) return;
        done = true;
        loader?.remove();
        badgeEl.textContent = proto;
        badgeEl.className = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold font-mono bg-blue-900/40 text-blue-300 border border-blue-700/50';
      }

      if (typeof PerformanceObserver !== 'undefined') {
        const observer = new PerformanceObserver((list) => {
          const entry = list.getEntries().find(e => e.name.includes('/api/echo'));
          if (!entry) return;
          observer.disconnect();
          renderProtocol(entry.nextHopProtocol || 'unknown');
        });
        try {
          observer.observe({ type: 'resource', buffered: true });
        } catch { /* fall through to timeout fallback below */ }
      }

      fetch(`${API}/echo`, { cache: 'no-store' }).catch(() => {});

      // Fallback for browsers without (working) resource-timing support
      setTimeout(() => renderProtocol('unknown'), 3000);
    }

    // ── Latency / Jitter / Packet loss ─────────────────────────
    async function pingOnce(timeoutMs) {
      const ctrl = new AbortController();
      activeControllers.add(ctrl);
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      const t0 = performance.now();
      try {
        const r = await fetch(`${API}/echo`, { signal: ctrl.signal, cache: 'no-store' });
        return r.ok ? performance.now() - t0 : null;
      } catch {
        return null;
      } finally {
        clearTimeout(timer);
        activeControllers.delete(ctrl);
      }
    }

    async function runLatencyAndLossTest() {
      const btn = document.getElementById('diag-latency-btn');
      const loader = document.getElementById('diag-latency-loader');
      const results = document.getElementById('diag-latency-results');

      btn.disabled = true;
      loader.classList.remove('hidden');
      results.classList.add('hidden');

      const N = 40, CONCURRENCY = 4, TIMEOUT_MS = 2000;
      const samples = [];
      let lost = 0;

      for (let i = 0; i < N; i += CONCURRENCY) {
        if (cancelled) return;
        const batchSize = Math.min(CONCURRENCY, N - i);
        const batchResults = await Promise.all(
          Array.from({ length: batchSize }, () => pingOnce(TIMEOUT_MS))
        );
        batchResults.forEach(r => r === null ? lost++ : samples.push(r));
      }

      if (cancelled) return;

      loader.classList.add('hidden');
      btn.disabled = false;
      results.classList.remove('hidden');

      if (samples.length) {
        const min = Math.min(...samples);
        const max = Math.max(...samples);
        const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
        let jitter = 0;
        if (samples.length > 1) {
          let sum = 0;
          for (let i = 1; i < samples.length; i++) sum += Math.abs(samples[i] - samples[i - 1]);
          jitter = sum / (samples.length - 1);
        }
        document.getElementById('diag-lat-min').textContent = min.toFixed(1);
        document.getElementById('diag-lat-avg').textContent = avg.toFixed(1);
        document.getElementById('diag-lat-max').textContent = max.toFixed(1);
        document.getElementById('diag-lat-jitter').textContent = jitter.toFixed(1);
      } else {
        ['diag-lat-min', 'diag-lat-avg', 'diag-lat-max', 'diag-lat-jitter'].forEach(id => {
          document.getElementById(id).textContent = 'N/A';
        });
      }

      const lossPercent = (lost / N) * 100;
      const lossEl = document.getElementById('diag-lat-loss');
      lossEl.textContent = `${lossPercent.toFixed(0)}%`;
      lossEl.className = `text-2xl font-bold font-mono ${lossPercent === 0 ? 'text-green-400' : lossPercent >= 20 ? 'text-red-400' : 'text-yellow-400'}`;
    }

    // ── Speedtest ────────────────────────────────────────────────
    // Web Crypto's getRandomValues() caps out at 65536 bytes per call, so
    // larger payloads are filled chunk by chunk.
    function generateRandomPayload(bytes) {
      const buf = new Uint8Array(bytes);
      const CHUNK = 65536;
      for (let offset = 0; offset < bytes; offset += CHUNK) {
        crypto.getRandomValues(buf.subarray(offset, Math.min(offset + CHUNK, bytes)));
      }
      return buf;
    }

    async function initSpeedtestSection() {
      const section = document.getElementById('diag-speedtest-section');
      let cfg;
      try {
        cfg = await fetch(`${API}/speedtest/config`).then(r => r.json());
      } catch {
        cfg = { enabled: false };
      }
      if (cancelled || !cfg.enabled) {
        section.classList.add('hidden');
        return;
      }
      section.classList.remove('hidden');

      const downBtn = document.getElementById('diag-download-btn');
      const upBtn = document.getElementById('diag-upload-btn');
      const barTrack = document.getElementById('diag-speed-bar-track');
      const barFill = document.getElementById('diag-speed-bar-fill');
      const errorEl = document.getElementById('diag-speed-error');

      function showSpeedError(msg) {
        errorEl.textContent = msg || '';
        errorEl.classList.toggle('hidden', !msg);
      }

      async function withSpeedTestUI(run) {
        downBtn.disabled = true;
        upBtn.disabled = true;
        showSpeedError(null);
        barTrack.classList.remove('hidden');
        barFill.style.width = '0%';
        try {
          await run();
          barFill.style.width = '100%';
        } catch (err) {
          showSpeedError(err.message);
        } finally {
          downBtn.disabled = false;
          upBtn.disabled = false;
        }
      }

      function runDownloadTest() {
        return withSpeedTestUI(async () => {
          const bytes = Math.min(10 * 1024 * 1024, cfg.maxDownloadBytes);
          const t0 = performance.now();
          const r = await fetch(`${API}/speedtest/download?bytes=${bytes}`, { cache: 'no-store' });
          if (!r.ok) throw new Error(`Download test failed (HTTP ${r.status})`);
          await r.arrayBuffer();
          const seconds = (performance.now() - t0) / 1000;
          const mbps = (bytes * 8 / 1e6) / seconds;
          document.getElementById('diag-speed-down').textContent = `${mbps.toFixed(1)} Mbit/s`;
        });
      }

      function runUploadTest() {
        return withSpeedTestUI(async () => {
          const bytes = Math.min(5 * 1024 * 1024, cfg.maxUploadBytes);
          const payload = generateRandomPayload(bytes);
          const t0 = performance.now();
          const r = await fetch(`${API}/speedtest/upload`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/octet-stream' },
            body: payload,
          });
          if (!r.ok) throw new Error(`Upload test failed (HTTP ${r.status})`);
          const seconds = (performance.now() - t0) / 1000;
          const mbps = (bytes * 8 / 1e6) / seconds;
          document.getElementById('diag-speed-up').textContent = `${mbps.toFixed(1)} Mbit/s`;
        });
      }

      downBtn.addEventListener('click', runDownloadTest);
      upBtn.addEventListener('click', runUploadTest);
    }

    runDualStackCheck();
    detectProtocol();
    initSpeedtestSection();
    document.getElementById('diag-latency-btn').addEventListener('click', runLatencyAndLossTest);

    return () => {
      cancelled = true;
      activeControllers.forEach(ctrl => ctrl.abort());
      activeControllers.clear();
    };
  }
};
