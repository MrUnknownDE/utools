import { API, detectDualStack, renderLed } from '../shared.js';

export const page = {
  title: 'Connection Test',

  template: () => `
<div class="container mx-auto max-w-5xl panel p-6 md:p-8">
  <div class="section-header mx-auto max-w-2xl text-center !border-0 !pl-0 mb-2">
    <span class="eyebrow">Client-side diagnostics</span>
    <h1 class="title text-3xl">Connection Test</h1>
  </div>
  <p class="text-center text-[var(--color-text-dim)] text-sm mb-8">Test the quality of your own connection to this server.</p>

  <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
    <!-- Dual-Stack -->
    <div class="p-6 card fade-in" style="animation-delay:.05s">
      <h3 class="flex items-center gap-2 mb-4 font-label text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
        <span class="inline-block w-1.5 h-4 rounded-full" style="background:var(--color-accent)"></span>
        Dual-Stack Support
      </h3>
      <div class="space-y-3">
        <div class="flex items-center gap-3">
          <span class="text-sm text-[var(--color-text-muted)] w-14">IPv4</span>
          <div id="diag-v4-loader" class="loader" style="width:14px;height:14px;border-width:2px"></div>
          <span id="diag-v4-badge" class="hidden"></span>
          <span id="diag-v4-ip" class="font-mono text-xs text-[var(--color-text-dim)]"></span>
        </div>
        <div class="flex items-center gap-3">
          <span class="text-sm text-[var(--color-text-muted)] w-14">IPv6</span>
          <div id="diag-v6-loader" class="loader" style="width:14px;height:14px;border-width:2px"></div>
          <span id="diag-v6-badge" class="hidden"></span>
          <span id="diag-v6-ip" class="font-mono text-xs text-[var(--color-text-dim)]"></span>
        </div>
      </div>
    </div>

    <!-- Protocol -->
    <div class="p-6 card fade-in" style="animation-delay:.1s">
      <h3 class="flex items-center gap-2 mb-4 font-label text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
        <span class="inline-block w-1.5 h-4 rounded-full" style="background:var(--color-accent)"></span>
        Connection Protocol
      </h3>
      <div class="flex items-center gap-3 mb-3">
        <div id="diag-protocol-loader" class="loader" style="width:14px;height:14px;border-width:2px"></div>
        <span id="diag-protocol-badge" class="hidden tag font-mono"></span>
      </div>
      <p class="text-xs text-[var(--color-text-dim)] leading-relaxed">TLS version isn't shown here because TLS is terminated outside this application (a reverse proxy in front of this deployment), and neither the backend nor Nginx have access to the TLS version negotiated with the browser.</p>
    </div>
  </div>

  <!-- Latency / Jitter / Packet loss -->
  <div class="p-6 card mb-6 fade-in" style="animation-delay:.15s">
    <div class="flex items-center justify-between flex-wrap gap-3 mb-4">
      <h3 class="flex items-center gap-2 font-label text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
        <span class="inline-block w-1.5 h-4 rounded-full" style="background:var(--color-accent)"></span>
        Latency, Jitter &amp; Packet Loss
      </h3>
      <button id="diag-latency-btn" class="btn btn-primary text-sm">
        Start Test
      </button>
    </div>

    <!-- Test settings — sliders only -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4 mb-3">
      <div>
        <div class="flex justify-between items-baseline mb-1">
          <label for="diag-lat-size" class="text-xs font-label uppercase tracking-wider text-[var(--color-text-dim)]">Packet size</label>
          <span id="diag-lat-size-label" class="text-xs font-mono text-[var(--color-text)]">212 and 228 Bytes</span>
        </div>
        <input type="range" id="diag-lat-size" min="142" max="440" step="1" value="212"
          class="w-full h-2 rounded-lg appearance-none cursor-pointer" style="background:var(--color-border-strong); accent-color:var(--color-accent)">
      </div>
      <div>
        <div class="flex justify-between items-baseline mb-1">
          <label for="diag-lat-freq" class="text-xs font-label uppercase tracking-wider text-[var(--color-text-dim)]">Frequency</label>
          <span id="diag-lat-freq-label" class="text-xs font-mono text-[var(--color-text)]">15 / second</span>
        </div>
        <input type="range" id="diag-lat-freq" min="1" max="300" step="1" value="15"
          class="w-full h-2 rounded-lg appearance-none cursor-pointer" style="background:var(--color-border-strong); accent-color:var(--color-accent)">
      </div>
      <div>
        <div class="flex justify-between items-baseline mb-1">
          <label for="diag-lat-duration" class="text-xs font-label uppercase tracking-wider text-[var(--color-text-dim)]">Duration</label>
          <span id="diag-lat-duration-label" class="text-xs font-mono text-[var(--color-text)]">10 seconds</span>
        </div>
        <input type="range" id="diag-lat-duration" min="1" max="300" step="1" value="10"
          class="w-full h-2 rounded-lg appearance-none cursor-pointer" style="background:var(--color-border-strong); accent-color:var(--color-accent)">
      </div>
      <div>
        <div class="flex justify-between items-baseline mb-1">
          <label for="diag-lat-delay" class="text-xs font-label uppercase tracking-wider text-[var(--color-text-dim)]">Acceptable delay</label>
          <span id="diag-lat-delay-label" class="text-xs font-mono text-[var(--color-text)]">200 ms</span>
        </div>
        <input type="range" id="diag-lat-delay" min="10" max="1000" step="10" value="200"
          class="w-full h-2 rounded-lg appearance-none cursor-pointer" style="background:var(--color-border-strong); accent-color:var(--color-accent)">
      </div>
    </div>
    <div class="flex items-center justify-between flex-wrap gap-x-4 gap-y-2 mb-4 text-xs">
      <label class="flex items-center gap-2 cursor-pointer select-none text-[var(--color-text-muted)]">
        <input type="checkbox" id="diag-lat-warmup" checked class="cursor-pointer" style="accent-color:var(--color-accent)">
        Wait 2s before recording results
      </label>
      <div class="flex items-center gap-3 text-[var(--color-text-dim)]">
        <button id="diag-lat-preset-btn" type="button" class="text-[var(--color-link)] hover:text-[var(--color-link-strong)] transition-colors">Use Standard preset</button>
        <span id="diag-lat-summary" class="font-mono"></span>
      </div>
    </div>

    <div id="diag-latency-loader" class="loader hidden mx-auto"></div>

    <!-- Live ping/loss chart -->
    <div id="diag-latency-chart-wrap" class="hidden mb-4">
      <div class="flex items-center justify-between flex-wrap gap-2 mb-2 text-xs">
        <span id="diag-latency-progress" class="font-mono text-[var(--color-text-dim)]">0 / 0 pings</span>
        <span class="flex items-center gap-4 text-[var(--color-text-dim)]">
          <span class="flex items-center gap-1.5"><span class="inline-block w-3 h-0.5" style="background:var(--color-link)"></span>RTT</span>
          <span class="flex items-center gap-1.5"><span class="inline-block w-2 h-2 rounded-full" style="background:var(--color-status-bad)"></span>Lost</span>
          <span class="flex items-center gap-1.5"><span class="inline-block w-3 h-0.5" style="background:repeating-linear-gradient(to right, var(--color-status-warn) 0 3px, transparent 3px 6px)"></span>Target</span>
        </span>
      </div>
      <div id="diag-latency-chart-container" class="rounded-lg overflow-hidden" style="background:var(--color-panel-inset); border:1px solid var(--color-border)">
        <svg id="diag-latency-chart" width="100%" height="160" style="display:block"></svg>
      </div>
    </div>

    <div id="diag-latency-results" class="hidden grid grid-cols-2 sm:grid-cols-5 gap-3">
      <div class="stat-box stat-link">
        <p class="stat-label uppercase tracking-wider">Min</p>
        <p id="diag-lat-min" class="stat-value font-mono">-</p>
      </div>
      <div class="stat-box stat-link">
        <p class="stat-label uppercase tracking-wider">Avg</p>
        <p id="diag-lat-avg" class="stat-value font-mono">-</p>
      </div>
      <div class="stat-box stat-link">
        <p class="stat-label uppercase tracking-wider">Max</p>
        <p id="diag-lat-max" class="stat-value font-mono">-</p>
      </div>
      <div class="stat-box">
        <p class="stat-label uppercase tracking-wider">Jitter</p>
        <p id="diag-lat-jitter" class="stat-value font-mono" style="color:var(--color-status-warn)">-</p>
      </div>
      <div class="stat-box">
        <p class="stat-label uppercase tracking-wider">Packet Loss</p>
        <p id="diag-lat-loss" class="stat-value font-mono">-</p>
      </div>
    </div>
  </div>

  <!-- Speedtest — hidden until /api/speedtest/config confirms it's enabled -->
  <div id="diag-speedtest-section" class="p-6 card hidden fade-in" style="animation-delay:.2s">
    <h3 class="flex items-center gap-2 mb-4 font-label text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
      <span class="inline-block w-1.5 h-4 rounded-full" style="background:var(--color-accent)"></span>
      Speedtest
    </h3>
    <div class="flex gap-3 flex-wrap mb-4">
      <button id="diag-download-btn" class="btn btn-primary text-sm">
        Test Download
      </button>
      <button id="diag-upload-btn" class="btn btn-primary text-sm">
        Test Upload
      </button>
    </div>
    <div id="diag-speed-bar-track" class="speed-bar-track mb-4 hidden">
      <div id="diag-speed-bar-fill" class="speed-bar-fill" style="width:0%"></div>
    </div>
    <div class="grid grid-cols-2 gap-3">
      <div class="stat-box stat-good">
        <p class="stat-label uppercase tracking-wider">Download</p>
        <p id="diag-speed-down" class="stat-value font-mono">-</p>
      </div>
      <div class="stat-box stat-link">
        <p class="stat-label uppercase tracking-wider">Upload</p>
        <p id="diag-speed-up" class="stat-value font-mono">-</p>
      </div>
    </div>
    <p id="diag-speed-error" class="text-[var(--color-status-bad)] text-xs mt-3 hidden"></p>
  </div>
</div>`,

  async init() {
    let cancelled = false;
    const activeControllers = new Set();

    function setBadge(el, ok, textOk, textFail) {
      el.innerHTML = renderLed(ok ? 'good' : 'bad', ok ? textOk : textFail);
      el.classList.remove('hidden');
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
        badgeEl.classList.remove('hidden');
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
    const latSizeSlider     = document.getElementById('diag-lat-size');
    const latFreqSlider     = document.getElementById('diag-lat-freq');
    const latDurationSlider = document.getElementById('diag-lat-duration');
    const latDelaySlider    = document.getElementById('diag-lat-delay');
    const latWarmupCheckbox = document.getElementById('diag-lat-warmup');
    const latPresetBtn      = document.getElementById('diag-lat-preset-btn');
    const latSummaryEl      = document.getElementById('diag-lat-summary');

    // The "and" figure mirrors how the underlying ICMP-style probe reports
    // size: base payload bytes, and payload+16 (probe header) bytes.
    const PACKET_HEADER_BYTES = 16;

    const STANDARD_PRESET = { size: 212, freq: 15, duration: 10, delay: 200, warmup: true };

    function updateSliderLabels() {
      const size = parseInt(latSizeSlider.value, 10);
      document.getElementById('diag-lat-size-label').textContent = `${size} and ${size + PACKET_HEADER_BYTES} Bytes`;
      document.getElementById('diag-lat-freq-label').textContent = `${latFreqSlider.value} / second`;
      document.getElementById('diag-lat-duration-label').textContent = `${latDurationSlider.value} seconds`;
      document.getElementById('diag-lat-delay-label').textContent = `${latDelaySlider.value} ms`;
    }

    function applyLatencyPreset(preset) {
      latSizeSlider.value = preset.size;
      latFreqSlider.value = preset.freq;
      latDurationSlider.value = preset.duration;
      latDelaySlider.value = preset.delay;
      latWarmupCheckbox.checked = preset.warmup;
      updateSliderLabels();
      updateLatencySummary();
    }

    function updateLatencySummary() {
      const size = parseInt(latSizeSlider.value, 10);
      const freq = parseInt(latFreqSlider.value, 10);
      const duration = parseInt(latDurationSlider.value, 10);
      const totalPings = Math.max(1, Math.round(freq * duration));
      // Estimate only — each ping is an echo request + a size-byte reply,
      // real transfer also includes HTTP/TCP/TLS overhead not counted here.
      const totalKB = (totalPings * size * 2) / 1024;
      latSummaryEl.textContent = `Sends ${totalPings} pings total, uses ~${totalKB.toFixed(1)} KB of data.`;
    }

    [latSizeSlider, latFreqSlider, latDurationSlider, latDelaySlider].forEach(el => {
      el.addEventListener('input', () => { updateSliderLabels(); updateLatencySummary(); });
    });
    latPresetBtn.addEventListener('click', () => applyLatencyPreset(STANDARD_PRESET));
    updateSliderLabels();
    updateLatencySummary();

    // Renders the ping-history chart (RTT line + loss markers + acceptable-
    // delay reference) into #diag-latency-chart. `history[i]` is one of:
    // { index, status: 'pending' | 'ok' | 'lost', rtt }.
    function renderLatencyChart(history, acceptableDelayMs, totalN) {
      const container = document.getElementById('diag-latency-chart-container');
      const svg = d3.select('#diag-latency-chart');
      const W = container.clientWidth || 600;
      const H = 160;
      const marginLeft = 36, marginRight = 8, marginTop = 8, marginBottom = 10;

      svg.attr('viewBox', `0 0 ${W} ${H}`);
      svg.selectAll('*').remove();

      const rtts = history.filter(h => h.status === 'ok').map(h => h.rtt);
      const maxRtt = rtts.length ? Math.max(...rtts) : 0;
      const yMax = Math.max(maxRtt * 1.15, acceptableDelayMs * 1.4, 30);

      const x = d3.scaleLinear().domain([0, Math.max(totalN - 1, 1)]).range([marginLeft, W - marginRight]);
      const y = d3.scaleLinear().domain([0, yMax]).range([H - marginBottom, marginTop]);

      const ticks = y.ticks(4);
      svg.append('g').selectAll('line').data(ticks).join('line')
        .attr('class', 'latency-grid')
        .attr('x1', marginLeft).attr('x2', W - marginRight)
        .attr('y1', d => y(d)).attr('y2', d => y(d));
      svg.append('g').selectAll('text').data(ticks).join('text')
        .attr('class', 'latency-ytick')
        .attr('x', 2).attr('y', d => y(d) - 2)
        .text(d => `${d}ms`);

      if (acceptableDelayMs <= yMax) {
        svg.append('line')
          .attr('class', 'latency-threshold')
          .attr('x1', marginLeft).attr('x2', W - marginRight)
          .attr('y1', y(acceptableDelayMs)).attr('y2', y(acceptableDelayMs));
      }

      const line = d3.line()
        .defined(d => d.status === 'ok')
        .x(d => x(d.index))
        .y(d => y(d.rtt));
      svg.append('path')
        .datum(history)
        .attr('class', 'latency-line')
        .attr('d', line);

      svg.append('g').selectAll('circle').data(history.filter(h => h.status === 'lost')).join('circle')
        .attr('class', 'latency-loss-marker')
        .attr('cx', d => x(d.index))
        .attr('cy', H - marginBottom)
        .attr('r', 2.5);
    }

    async function pingOnce(timeoutMs, sizeBytes) {
      const ctrl = new AbortController();
      activeControllers.add(ctrl);
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      const t0 = performance.now();
      try {
        const r = await fetch(`${API}/echo?size=${sizeBytes}`, { signal: ctrl.signal, cache: 'no-store' });
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
      const chartWrap = document.getElementById('diag-latency-chart-wrap');
      const progressEl = document.getElementById('diag-latency-progress');

      const sizeBytes = parseInt(latSizeSlider.value, 10);
      const freq = parseInt(latFreqSlider.value, 10);
      const duration = parseInt(latDurationSlider.value, 10);
      const acceptableDelayMs = Math.max(1, parseInt(latDelaySlider.value, 10) || 200);
      const doWarmup = latWarmupCheckbox.checked;

      const TIMEOUT_MS = 2000;
      const N = Math.max(1, Math.round(freq * duration));
      const intervalMs = 1000 / freq;

      btn.disabled = true;
      loader.classList.remove('hidden');
      results.classList.add('hidden');
      chartWrap.classList.add('hidden');

      // Warm-up: a couple of unrecorded pings while waiting 2s, so TCP/TLS
      // connection setup on the very first request doesn't skew the results.
      if (doWarmup) {
        pingOnce(TIMEOUT_MS, sizeBytes);
        await new Promise(r => setTimeout(r, 2000));
        if (cancelled) return;
      }

      loader.classList.add('hidden');
      chartWrap.classList.remove('hidden');

      // history[i] tracks each ping by send order (not completion order, since
      // requests can resolve out of order) so the chart's x-axis stays a
      // consistent timeline even under high frequency/concurrency.
      const history = Array.from({ length: N }, (_, i) => ({ index: i, status: 'pending', rtt: null }));
      const samples = [];
      const pending = [];
      let lost = 0;
      let completed = 0;
      let lastRenderTs = 0;

      function maybeRenderChart(force) {
        const now = performance.now();
        if (!force && now - lastRenderTs < 80) return;
        lastRenderTs = now;
        progressEl.textContent = `${completed} / ${N} pings`;
        renderLatencyChart(history, acceptableDelayMs, N);
      }

      maybeRenderChart(true);

      for (let i = 0; i < N; i++) {
        if (cancelled) return;
        const idx = i;
        pending.push(
          pingOnce(TIMEOUT_MS, sizeBytes).then(r => {
            completed++;
            if (r === null) {
              lost++;
              history[idx].status = 'lost';
            } else {
              samples.push(r);
              history[idx] = { index: idx, status: 'ok', rtt: r };
            }
            maybeRenderChart(false);
          })
        );
        if (i < N - 1) await new Promise(r => setTimeout(r, intervalMs));
      }
      await Promise.all(pending);

      if (cancelled) return;

      maybeRenderChart(true);
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
        const avgEl = document.getElementById('diag-lat-avg');
        avgEl.textContent = avg.toFixed(1);
        avgEl.style.color = avg <= acceptableDelayMs ? 'var(--color-status-good)' : avg <= acceptableDelayMs * 1.5 ? 'var(--color-status-warn)' : 'var(--color-status-bad)';
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
      lossEl.style.color = lossPercent === 0 ? 'var(--color-status-good)' : lossPercent >= 20 ? 'var(--color-status-bad)' : 'var(--color-status-warn)';
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
