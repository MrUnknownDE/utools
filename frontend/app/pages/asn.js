import { API, renderLed } from '../shared.js';

export const page = {
  title: 'ASN Lookup',

  template: () => `
<div class="container mx-auto max-w-6xl panel p-6 md:p-8">
  <div class="section-header mx-auto max-w-2xl text-center !border-0 !pl-0">
    <span class="eyebrow">Autonomous systems</span>
    <h1 class="title text-3xl">AS / ASN Lookup</h1>
  </div>
  <p class="text-center text-[var(--color-text-muted)] text-sm mb-8">Peering graph, prefixes &amp; IXP connections for any Autonomous System</p>

  <div class="flex flex-col sm:flex-row gap-3 mb-6 max-w-2xl mx-auto">
    <input type="text" id="asn-input" placeholder="Enter ASN (e.g. 15169 or AS3320)" class="input flex-grow">
    <button id="lookup-button" disabled class="btn btn-primary">Lookup</button>
  </div>

  <div id="error-box" class="hidden max-w-2xl mx-auto mb-6 alert alert-bad"></div>

  <div id="loading-section" class="hidden flex flex-col items-center gap-3 py-16">
    <div class="loader" style="width:40px;height:40px;border-width:5px;"></div>
    <p class="text-[var(--color-text-muted)] text-sm" id="loading-msg">Querying RIPE Stat &amp; PeeringDB…</p>
    <p class="text-xs alert alert-warn max-w-sm text-center mt-1">
      ⏳ Large ASes (Cloudflare, Google, Tier-1 carriers) can take up to 15 s on first lookup — subsequent lookups are cached for 7 days.
    </p>
  </div>

  <div id="results-section" class="hidden fade-in">
    <div class="card p-6 mb-6">
      <div class="flex flex-col md:flex-row md:items-center gap-4">
        <div class="flex-1">
          <div class="flex items-center gap-3 mb-1">
            <span id="res-asn" class="font-mono text-2xl font-bold text-[var(--color-accent)]"></span>
            <span id="res-announced-badge" class="hidden"></span>
            <span id="res-type-badge" class="tag"></span>
          </div>
          <h2 id="res-name" class="text-xl font-display font-semibold text-[var(--color-text)] mb-1"></h2>
          <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--color-text-muted)] mb-2">
            <span id="res-policy-container" class="hidden">Peering Policy: <span id="res-policy" class="text-[var(--color-text)]"></span></span>
            <span id="res-website-container" class="hidden">Website: <a id="res-website" href="#" target="_blank" rel="noopener" class="text-[var(--color-link)] hover:text-[var(--color-link-strong)] transition-colors"></a></span>
          </div>
          <div id="res-rich-info" class="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 hidden" style="border-top:1px solid var(--color-border)">
            <div id="res-info-type-container" class="hidden"><div class="text-xs font-label uppercase tracking-widest text-[var(--color-text-dim)]">Type</div><div id="res-info-type" class="text-sm text-[var(--color-text)] capitalize mt-0.5"></div></div>
            <div id="res-info-scope-container" class="hidden"><div class="text-xs font-label uppercase tracking-widest text-[var(--color-text-dim)]">Scope</div><div id="res-info-scope" class="text-sm text-[var(--color-text)] capitalize mt-0.5"></div></div>
            <div id="res-info-traffic-container" class="hidden"><div class="text-xs font-label uppercase tracking-widest text-[var(--color-text-dim)]">Traffic</div><div id="res-info-traffic" class="text-sm text-[var(--color-text)] capitalize mt-0.5"></div></div>
            <div id="res-info-ratio-container" class="hidden"><div class="text-xs font-label uppercase tracking-widest text-[var(--color-text-dim)]">Ratio</div><div id="res-info-ratio" class="text-sm text-[var(--color-text)] capitalize mt-0.5"></div></div>
          </div>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 text-center">
          <div class="stat-box stat-link">
            <div id="res-upstream-count" class="stat-value">—</div>
            <div class="stat-label">Upstreams</div>
          </div>
          <div class="stat-box stat-good">
            <div id="res-downstream-count" class="stat-value">—</div>
            <div class="stat-label">Downstreams</div>
          </div>
          <div class="stat-box stat-accent col-span-2 sm:col-span-1">
            <div id="res-prefix-count" class="stat-value">—</div>
            <div class="stat-label">Prefixes</div>
          </div>
        </div>
      </div>
    </div>

    <div class="card p-6 mb-6">
      <div class="flex items-center gap-3 mb-4 flex-wrap">
        <h3 class="text-lg font-display font-bold text-[var(--color-text)]">Network Map</h3>
        <div class="flex gap-3 text-xs text-[var(--color-text-muted)]">
          <span class="flex items-center gap-1"><span class="inline-block w-3 h-3 rounded-full bg-[var(--color-status-neutral)]"></span>Tier-1</span>
          <span class="flex items-center gap-1"><span class="inline-block w-3 h-3 rounded-full bg-[var(--color-link)]"></span>Upstream</span>
          <span class="flex items-center gap-1"><span class="inline-block w-3 h-3 rounded-full bg-[var(--color-accent)]"></span>This AS</span>
          <span class="flex items-center gap-1"><span class="inline-block w-3 h-3 rounded-full bg-[var(--color-status-good)]"></span>Downstream</span>
        </div>
        <span class="ml-auto text-xs text-[var(--color-text-dim)]">Scroll to zoom · Drag to pan · Click node to open</span>
      </div>
      <div id="graph-container">
        <svg id="graph-svg"></svg>
        <div id="graph-tooltip"></div>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
      <div class="card p-5">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm font-label font-bold text-[var(--color-text-dim)] uppercase tracking-widest">Announced Prefixes</h3>
          <button id="prefix-toggle" class="text-xs text-[var(--color-link)] hover:text-[var(--color-link-strong)] transition-colors">Show all</button>
        </div>
        <div id="prefix-list" class="max-h-48 overflow-y-auto"></div>
        <p id="prefix-empty" class="hidden text-sm text-[var(--color-text-dim)] italic">No prefix data available.</p>
      </div>
      <div class="card p-5">
        <h3 class="text-sm font-label font-bold text-[var(--color-text-dim)] uppercase tracking-widest mb-3">IXP Presence <span class="text-xs font-normal text-[var(--color-text-dim)]">(via PeeringDB)</span></h3>
        <div id="ixp-list" class="space-y-1 text-sm max-h-48 overflow-y-auto">
          <p id="ixp-empty" class="text-[var(--color-text-dim)] italic text-sm">Not listed on PeeringDB.</p>
        </div>
      </div>
    </div>

    <div class="card p-5">
      <h3 class="text-sm font-label font-bold text-[var(--color-text-dim)] uppercase tracking-widest mb-3">Direct Neighbours <span class="text-xs font-normal text-[var(--color-text-dim)]">(Level 2 · via RIPE Stat)</span></h3>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h4 class="text-xs font-label font-semibold text-[var(--color-link)] mb-2">↑ Upstreams (Transit Providers)</h4>
          <div id="upstream-table" class="space-y-1 text-xs font-mono max-h-52 overflow-y-auto"></div>
        </div>
        <div>
          <h4 class="text-xs font-label font-semibold text-[var(--color-status-good)] mb-2">↓ Downstreams (Customers)</h4>
          <div id="downstream-table" class="space-y-1 text-xs font-mono max-h-52 overflow-y-auto"></div>
        </div>
      </div>
    </div>
  </div>
</div>`,

  async init(search) {
    const asnInput       = document.getElementById('asn-input');
    const lookupButton   = document.getElementById('lookup-button');
    const errorBox       = document.getElementById('error-box');
    const loadingSection = document.getElementById('loading-section');
    const resultsSection = document.getElementById('results-section');

    let currentData      = null;
    let showAllPrefixes  = false;

    const syncBtn = () => { lookupButton.disabled = !asnInput.value.trim(); };
    asnInput.addEventListener('input', syncBtn);

    function showError(msg) {
      errorBox.textContent = msg;
      errorBox.classList.toggle('hidden', !msg);
      loadingSection.classList.add('hidden');
      resultsSection.classList.add('hidden');
    }

    function setLoading(msg) {
      errorBox.classList.add('hidden');
      document.getElementById('loading-msg').textContent = msg;
      loadingSection.classList.remove('hidden');
      resultsSection.classList.add('hidden');
    }

    async function doLookup(rawAsn) {
      const asn = String(rawAsn || '').trim().toUpperCase().replace(/^AS/, '');
      if (!asn || isNaN(Number(asn))) { showError('Please enter a valid ASN (e.g. 15169 or AS3320).'); return; }

      setLoading('Querying RIPE Stat & PeeringDB…');
      const url = new URL(location.href);
      url.searchParams.set('asn', asn);
      history.replaceState({}, '', url);

      try {
        const res  = await fetch(`${API}/asn-lookup?asn=${encodeURIComponent(asn)}`);
        const data = await res.json();
        if (!res.ok || !data.success) { showError(data.error || `Request failed (HTTP ${res.status})`); return; }
        currentData = data;
        renderResults(data);
      } catch (err) {
        showError(`Network error: ${err.message}`);
      }
    }

    function renderResults(data) {
      loadingSection.classList.add('hidden');
      resultsSection.classList.remove('hidden');

      document.getElementById('res-asn').textContent  = `AS${data.asn}`;
      document.getElementById('res-name').textContent = data.name || 'Unknown';

      const announcedBadge = document.getElementById('res-announced-badge');
      announcedBadge.innerHTML = data.announced ? renderLed('good', 'Announced') : '';
      announcedBadge.classList.toggle('hidden', !data.announced);

      const typeBadge = document.getElementById('res-type-badge');
      typeBadge.textContent = data.type || '';
      typeBadge.classList.toggle('hidden', !data.type);

      const policyContainer = document.getElementById('res-policy-container');
      const policyEl        = document.getElementById('res-policy');
      if (data.peeringdb?.peeringPolicy) {
        policyEl.textContent = data.peeringdb.peeringPolicy;
        policyContainer.classList.remove('hidden');
      } else { policyContainer.classList.add('hidden'); }

      const websiteContainer = document.getElementById('res-website-container');
      const websiteEl        = document.getElementById('res-website');
      if (data.peeringdb?.website) {
        websiteEl.href        = data.peeringdb.website;
        websiteEl.textContent = data.peeringdb.website.replace(/^https?:\/\//, '').replace(/\/$/, '');
        websiteContainer.classList.remove('hidden');
      } else { websiteContainer.classList.add('hidden'); }

      const richInfo = document.getElementById('res-rich-info');
      let hasRich    = false;
      [['type', data.peeringdb?.infoType], ['scope', data.peeringdb?.infoScope],
       ['traffic', data.peeringdb?.infoTraffic], ['ratio', data.peeringdb?.infoRatio]].forEach(([id, val]) => {
        const c = document.getElementById(`res-info-${id}-container`);
        const e = document.getElementById(`res-info-${id}`);
        if (c && e) { if (val) { e.textContent = val; c.classList.remove('hidden'); hasRich = true; } else c.classList.add('hidden'); }
      });
      richInfo.classList.toggle('hidden', !hasRich);

      document.getElementById('res-upstream-count').textContent   = data.graph?.level2?.upstreams?.length ?? '?';
      document.getElementById('res-downstream-count').textContent = data.graph?.level2?.downstreams?.length ?? '?';
      document.getElementById('res-prefix-count').textContent     = data.prefixes?.length ?? '?';

      renderPrefixes(data.prefixes);
      renderIxps(data.peeringdb?.ixps);
      renderNeighbourTable('upstream-table',   data.graph?.level2?.upstreams   ?? [], 'link');
      renderNeighbourTable('downstream-table', data.graph?.level2?.downstreams ?? [], 'good');
      if (data.graph) renderGraph(data.graph);
    }

    function renderPrefixes(prefixes) {
      const list   = document.getElementById('prefix-list');
      const empty  = document.getElementById('prefix-empty');
      const toggle = document.getElementById('prefix-toggle');
      if (!prefixes?.length) { list.classList.add('hidden'); empty.classList.remove('hidden'); toggle.classList.add('hidden'); return; }
      empty.classList.add('hidden'); toggle.classList.remove('hidden');
      const toShow = showAllPrefixes ? prefixes : prefixes.slice(0, 20);
      list.innerHTML = toShow.map(p => `<span class="tag">${p}</span>`).join('');
      toggle.textContent = showAllPrefixes ? 'Show less' : `Show all (${prefixes.length})`;
    }

    document.getElementById('prefix-toggle').addEventListener('click', () => {
      showAllPrefixes = !showAllPrefixes;
      if (currentData) renderPrefixes(currentData.prefixes);
    });

    function renderIxps(ixps) {
      const list  = document.getElementById('ixp-list');
      const empty = document.getElementById('ixp-empty');
      if (!ixps?.length) { list.innerHTML = ''; empty.classList.remove('hidden'); return; }
      empty.classList.add('hidden');
      list.innerHTML = ixps.map(ix => `
        <div class="ixp-row py-1.5 flex items-center justify-between gap-2 text-sm">
          <span class="text-[var(--color-text)] truncate">${ix.name}</span>
          <span class="text-xs text-[var(--color-text-dim)] shrink-0">${ix.speed >= 1000 ? ix.speed / 1000 + 'G' : ix.speed + 'M'}</span>
        </div>`).join('');
    }

    function renderNeighbourTable(elId, nodes, colour) {
      const el = document.getElementById(elId);
      if (!nodes?.length) { el.innerHTML = '<p class="text-[var(--color-text-dim)] italic">None reported.</p>'; return; }
      const col = colour === 'link' ? 'text-[var(--color-link)]' : 'text-[var(--color-status-good)]';
      el.innerHTML = nodes.map(n => `
        <div class="flex items-center gap-2 py-0.5 hover:bg-white/5 rounded px-1 cursor-pointer group"
             onclick="window._router.navigate('/asn',{asn:'${n.asn}'})">
          <span class="${col} font-bold w-14 shrink-0">AS${n.asn}</span>
          <span class="text-[var(--color-text-muted)] truncate flex-1 group-hover:text-[var(--color-text)]">${n.name || '—'}</span>
          <span class="text-[var(--color-text-dim)] shrink-0">${n.power ? 'pwr:' + n.power : ''}</span>
        </div>`).join('');
    }

    function renderGraph(graph) {
      const container = document.getElementById('graph-container');
      const svg = d3.select('#graph-svg');
      svg.selectAll('*').remove();
      const W = container.clientWidth, H = container.clientHeight;

      const nodeMap = new Map();
      function addNode(asn, name, role) {
        const key = String(asn);
        if (!nodeMap.has(key)) nodeMap.set(key, { id: key, asn, name: name || `AS${asn}`, role });
      }
      addNode(graph.center.asn, graph.center.name, 'center');
      const vizUp   = graph.level2.upstreams.slice(0, 15);
      const vizDown = graph.level2.downstreams.slice(0, 15);
      vizUp.forEach(n => addNode(n.asn, n.name, 'upstream'));
      vizDown.forEach(n => addNode(n.asn, n.name, 'downstream'));
      graph.level3.forEach(d => d.upstreams.forEach(n => addNode(n.asn, n.name, 'tier1')));

      const nodes  = Array.from(nodeMap.values());
      const links  = [];
      const cid    = String(graph.center.asn);
      vizUp.forEach(n => links.push({ source: String(n.asn), target: cid, type: 'upstream', power: n.power || 1 }));
      vizDown.forEach(n => links.push({ source: cid, target: String(n.asn), type: 'downstream', power: n.power || 1 }));
      graph.level3.forEach(d => d.upstreams.forEach(n => links.push({ source: String(n.asn), target: String(d.parentAsn), type: 'tier1', power: n.power || 1 })));
      const uniqueLinks = Array.from(new Map(links.map(l => [`${l.source}-${l.target}`, l])).values());

      const layerX = { tier1: W * 0.08, upstream: W * 0.3, center: W * 0.55, downstream: W * 0.8 };
      nodes.forEach(n => { n.fx = layerX[n.role] ?? W / 2; });

      const maxPow     = Math.max(...uniqueLinks.map(l => l.power), 1);
      const strokeSc   = d3.scaleLinear().domain([0, maxPow]).range([0.5, 4]);
      const nodeRadius = { center: 20, upstream: 11, downstream: 11, tier1: 8 };

      const sim = d3.forceSimulation(nodes)
        .force('link', d3.forceLink(uniqueLinks).id(d => d.id).distance(d => d.type === 'tier1' ? 90 : 120).strength(0.6))
        .force('charge', d3.forceManyBody().strength(-220))
        .force('y', d3.forceY(H / 2).strength(0.04))
        .force('collide', d3.forceCollide().radius(d => nodeRadius[d.role] + 14))
        .alphaDecay(0.025);

      const g = svg.append('g');
      svg.call(d3.zoom().scaleExtent([0.3, 3]).on('zoom', evt => g.attr('transform', evt.transform)));

      const link = g.append('g').selectAll('line').data(uniqueLinks).join('line')
        .attr('class', d => `link link-${d.type}`)
        .attr('stroke-width', d => strokeSc(d.power));

      const tooltip = document.getElementById('graph-tooltip');
      const node = g.append('g').selectAll('g').data(nodes).join('g')
        .attr('class', d => `node node-${d.role}`)
        .style('cursor', 'pointer')
        .on('click', (_, d) => { if (d.role !== 'center') window._router.navigate('/asn', { asn: d.asn }); })
        .on('mouseenter', (_, d) => {
          tooltip.style.opacity = '1';
          tooltip.innerHTML = `<strong class="text-[var(--color-accent-strong)]">AS${d.asn}</strong><br><span class="text-[var(--color-text)]">${d.name}</span><br><span class="text-[var(--color-text-dim)] text-xs capitalize">${d.role === 'tier1' ? 'Tier-1 / Transit' : d.role}</span>`;
        })
        .on('mousemove', evt => {
          const r = container.getBoundingClientRect();
          let x = evt.clientX - r.left + 14, y = evt.clientY - r.top - 10;
          if (x + 230 > W) x -= 244;
          tooltip.style.left = x + 'px'; tooltip.style.top = y + 'px';
        })
        .on('mouseleave', () => { tooltip.style.opacity = '0'; })
        .call(d3.drag()
          .on('start', (evt, d) => { if (!evt.active) sim.alphaTarget(0.3).restart(); d.fy = d.y; })
          .on('drag',  (evt, d) => { d.fy = evt.y; })
          .on('end',   (evt, d) => { if (!evt.active) sim.alphaTarget(0); d.fy = null; }));

      node.append('circle').attr('r', d => nodeRadius[d.role]);
      node.append('text').attr('dy', d => nodeRadius[d.role] + 13).attr('font-size', d => d.role === 'center' ? 12 : 9).text(d => `AS${d.asn}`);
      node.append('text').attr('dy', d => nodeRadius[d.role] + 23)
        .attr('font-size', d => d.role === 'tier1' ? 7 : 8)
        .attr('fill', d => d.role === 'tier1' ? '#6b7280' : '#9ca3af')
        .text(d => {
          if (!d.name) return '';
          const max = d.role === 'center' ? 22 : d.role === 'tier1' ? 12 : 16;
          return d.name.length > max ? d.name.slice(0, max) + '…' : d.name;
        });

      sim.on('tick', () => {
        nodes.forEach(n => { n.y = Math.max(30, Math.min(H - 30, n.y)); });
        link.attr('x1', d => d.source.x).attr('y1', d => d.source.y).attr('x2', d => d.target.x).attr('y2', d => d.target.y);
        node.attr('transform', d => `translate(${d.x},${d.y})`);
      });
    }

    lookupButton.addEventListener('click', () => doLookup(asnInput.value));
    asnInput.addEventListener('keypress', e => { if (e.key === 'Enter' && !lookupButton.disabled) doLookup(asnInput.value); });

    const params = new URLSearchParams(search);
    const urlAsn = params.get('asn');
    if (urlAsn) { asnInput.value = urlAsn; syncBtn(); doLookup(urlAsn); }
  }
};
