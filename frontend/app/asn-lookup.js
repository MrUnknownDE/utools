// frontend/app/asn-lookup.js
'use strict';

const API_BASE = '/api';

// ─── State ────────────────────────────────────────────────────────────────────
let currentData = null;
let showAllPrefixes = false;

// ─── DOM Refs ─────────────────────────────────────────────────────────────────
const asnInput = document.getElementById('asn-input');
const lookupButton = document.getElementById('lookup-button');
const errorBox = document.getElementById('error-box');
const loadingSection = document.getElementById('loading-section');
const loadingMsg = document.getElementById('loading-msg');
const resultsSection = document.getElementById('results-section');

// ─── Helpers ──────────────────────────────────────────────────────────────────
function showError(msg) {
    errorBox.textContent = msg;
    errorBox.classList.remove('hidden');
    loadingSection.classList.add('hidden');
    resultsSection.classList.add('hidden');
    if (window._loadingHintTimer) clearTimeout(window._loadingHintTimer);
}
function hideError() { errorBox.classList.add('hidden'); }

function setLoading(msg = 'Querying RIPE Stat & PeeringDB…') {
    hideError();
    loadingMsg.textContent = msg;
    loadingSection.classList.remove('hidden');
    resultsSection.classList.add('hidden');

    // After 3s show a hint that large ASes can be slow
    if (window._loadingHintTimer) clearTimeout(window._loadingHintTimer);
    window._loadingHintTimer = setTimeout(() => {
        const hint = document.getElementById('loading-hint');
        if (hint) hint.classList.remove('hidden');
    }, 3000);
}

function updateUrlParam(asn) {
    const url = new URL(window.location);
    url.searchParams.set('asn', asn);
    window.history.pushState({}, '', url);
}

// ─── Main Lookup ──────────────────────────────────────────────────────────────
async function doLookup(rawAsn) {
    const asn = String(rawAsn || '').trim().toUpperCase().replace(/^AS/, '');
    if (!asn || isNaN(Number(asn))) {
        showError('Please enter a valid ASN (e.g. 15169 or AS3320).');
        return;
    }

    setLoading('Querying RIPE Stat & PeeringDB…');
    updateUrlParam(asn);

    try {
        const res = await fetch(`${API_BASE}/asn-lookup?asn=${encodeURIComponent(asn)}`);
        const data = await res.json();

        if (!res.ok || !data.success) {
            showError(data.error || `Request failed (HTTP ${res.status})`);
            return;
        }

        currentData = data;
        renderResults(data);

    } catch (err) {
        showError(`Network error: ${err.message}`);
    }
}

// ─── Render ───────────────────────────────────────────────────────────────────
function renderResults(data) {
    // Show results FIRST so the graph container has real dimensions (clientWidth > 0)
    loadingSection.classList.add('hidden');
    resultsSection.classList.remove('hidden');
    // Reset loading hint for next lookup
    if (window._loadingHintTimer) clearTimeout(window._loadingHintTimer);
    const hint = document.getElementById('loading-hint');
    if (hint) hint.classList.add('hidden');

    // Header
    document.getElementById('res-asn').textContent = `AS${data.asn}`;
    document.getElementById('res-name').textContent = data.name || 'Unknown';

    const announcedBadge = document.getElementById('res-announced-badge');
    if (announcedBadge) {
        if (data.announced) announcedBadge.classList.remove('hidden');
        else announcedBadge.classList.add('hidden');
    }

    const typeBadge = document.getElementById('res-type-badge');
    if (typeBadge) {
        typeBadge.textContent = data.type || '';
        typeBadge.classList.toggle('hidden', !data.type);
    }

    const peeringPolicy = data.peeringdb?.peeringPolicy;
    document.getElementById('res-policy').textContent =
        peeringPolicy ? `Peering Policy: ${peeringPolicy}` : '';

    document.getElementById('res-upstream-count').textContent = data.graph?.level2?.upstreams?.length ?? '?';
    document.getElementById('res-downstream-count').textContent = data.graph?.level2?.downstreams?.length ?? '?';
    document.getElementById('res-prefix-count').textContent = data.prefixes?.length ?? '?';

    // Prefixes + IXPs (before graph — these are cheap)
    renderPrefixes(data.prefixes);
    renderIxps(data.peeringdb?.ixps);
    renderNeighbourTable('upstream-table', data.graph?.level2?.upstreams ?? [], 'blue');
    renderNeighbourTable('downstream-table', data.graph?.level2?.downstreams ?? [], 'green');

    // Graph LAST — needs the container to be visible for clientWidth
    if (data.graph) renderGraph(data.graph);
}

// ─── Prefix List ─────────────────────────────────────────────────────────────
function renderPrefixes(prefixes) {
    const list = document.getElementById('prefix-list');
    const empty = document.getElementById('prefix-empty');
    const toggle = document.getElementById('prefix-toggle');

    if (!prefixes || prefixes.length === 0) {
        list?.classList.add('hidden');
        empty?.classList.remove('hidden');
        toggle?.classList.add('hidden');
        return;
    }
    empty?.classList.add('hidden');
    toggle?.classList.remove('hidden');

    const toShow = showAllPrefixes ? prefixes : prefixes.slice(0, 20);
    if (list) list.innerHTML = toShow.map(p => `<span class="prefix-tag">${p}</span>`).join('');
    if (toggle) toggle.textContent = showAllPrefixes ? 'Show less' : `Show all (${prefixes.length})`;
}

document.getElementById('prefix-toggle').addEventListener('click', () => {
    showAllPrefixes = !showAllPrefixes;
    if (currentData) renderPrefixes(currentData.prefixes);
});

// ─── IXP List ─────────────────────────────────────────────────────────────────
function renderIxps(ixps) {
    const list = document.getElementById('ixp-list');
    const empty = document.getElementById('ixp-empty');

    if (!ixps || ixps.length === 0) {
        if (list) list.innerHTML = '';
        empty?.classList.remove('hidden');
        return;
    }
    empty?.classList.add('hidden');
    if (list) {
        list.innerHTML = ixps.map(ix => `
        <div class="ixp-row py-1.5 flex items-center justify-between gap-2 text-sm">
            <span class="text-gray-200 truncate">${ix.name}</span>
            <span class="text-xs text-gray-500 shrink-0">${ix.speed >= 1000 ? `${ix.speed / 1000}G` : `${ix.speed}M`}</span>
        </div>
        `).join('');
    }
}

// ─── Neighbour Table ──────────────────────────────────────────────────────────
function renderNeighbourTable(elId, nodes, colour) {
    const el = document.getElementById(elId);
    if (!nodes || nodes.length === 0) {
        el.innerHTML = `<p class="text-gray-500 italic">None reported.</p>`;
        return;
    }
    const colClass = colour === 'blue' ? 'text-blue-400' : 'text-green-400';
    el.innerHTML = nodes.map(n => `
        <div class="flex items-center gap-2 py-0.5 hover:bg-white/5 rounded px-1 cursor-pointer group"
             onclick="window.location.href='/asn?asn=${n.asn}'">
            <span class="${colClass} font-bold w-14 shrink-0">AS${n.asn}</span>
            <span class="text-gray-300 truncate flex-1 group-hover:text-white">${n.name || '—'}</span>
            <span class="text-gray-600 shrink-0">${n.power ? `pwr:${n.power}` : ''}</span>
        </div>
    `).join('');
}

// ─── D3 Network Graph ─────────────────────────────────────────────────────────
function renderGraph(graph) {
    const container = document.getElementById('graph-container');
    const svg = d3.select('#graph-svg');
    svg.selectAll('*').remove();

    const W = container.clientWidth;
    const H = container.clientHeight;

    // ── Build nodes & links ───────────────────────────────────────────────────
    const nodeMap = new Map();

    function addNode(asn, name, role) {
        const key = String(asn);
        if (!nodeMap.has(key)) nodeMap.set(key, { id: key, asn, name: name || `AS${asn}`, role });
    }

    addNode(graph.center.asn, graph.center.name, 'center');

    // Limit graph nodes to top 15 to prevent Physics Engine crash & unreadable hairball
    const vizUpstreams = graph.level2.upstreams.slice(0, 15);
    const vizDownstreams = graph.level2.downstreams.slice(0, 15);

    vizUpstreams.forEach(n => addNode(n.asn, n.name, 'upstream'));
    vizDownstreams.forEach(n => addNode(n.asn, n.name, 'downstream'));
    graph.level3.forEach(d => {
        d.upstreams.forEach(n => addNode(n.asn, n.name, 'tier1'));
    });

    const nodes = Array.from(nodeMap.values());

    const links = [];
    const centerId = String(graph.center.asn);

    vizUpstreams.forEach(n => {
        links.push({ source: String(n.asn), target: centerId, type: 'upstream', power: n.power || 1 });
    });
    vizDownstreams.forEach(n => {
        links.push({ source: centerId, target: String(n.asn), type: 'downstream', power: n.power || 1 });
    });
    graph.level3.forEach(d => {
        d.upstreams.forEach(n => {
            links.push({ source: String(n.asn), target: String(d.parentAsn), type: 'tier1', power: n.power || 1 });
        });
    });

    // Remove duplicate links
    const uniqueLinks = Array.from(
        new Map(links.map(l => [`${l.source}-${l.target}`, l])).values()
    );

    // ── Layer X positions (fixed horizontal layout) ────────────────────────
    const layerX = { tier1: W * 0.08, upstream: W * 0.3, center: W * 0.55, downstream: W * 0.8 };

    nodes.forEach(n => {
        n.fx = layerX[n.role] ?? W / 2;
    });

    // ── Power → stroke width ──────────────────────────────────────────────
    const maxPower = Math.max(...uniqueLinks.map(l => l.power), 1);
    const strokeScale = d3.scaleLinear().domain([0, maxPower]).range([0.5, 4]);

    // ── Node size ─────────────────────────────────────────────────────────
    const nodeRadius = { center: 20, upstream: 11, downstream: 11, tier1: 8 };

    // ── Simulation ────────────────────────────────────────────────────────
    const sim = d3.forceSimulation(nodes)
        .force('link', d3.forceLink(uniqueLinks).id(d => d.id).distance(d => {
            if (d.type === 'tier1') return 90;
            if (d.type === 'upstream') return 130;
            return 110;
        }).strength(0.6))
        .force('charge', d3.forceManyBody().strength(-220))
        .force('y', d3.forceY(H / 2).strength(0.04))
        .force('collide', d3.forceCollide().radius(d => nodeRadius[d.role] + 14))
        .alphaDecay(0.025);

    // ── Zoom/Pan ──────────────────────────────────────────────────────────
    const g = svg.append('g');
    svg.call(d3.zoom().scaleExtent([0.3, 3]).on('zoom', evt => g.attr('transform', evt.transform)));

    // ── Draw links ────────────────────────────────────────────────────────
    const link = g.append('g').selectAll('line')
        .data(uniqueLinks).join('line')
        .attr('class', d => `link link-${d.type}`)
        .attr('stroke-width', d => strokeScale(d.power));

    // ── Draw nodes ────────────────────────────────────────────────────────
    const tooltip = document.getElementById('graph-tooltip');

    const node = g.append('g').selectAll('g')
        .data(nodes).join('g')
        .attr('class', d => `node node-${d.role}`)
        .style('cursor', 'pointer')
        .on('click', (_, d) => {
            if (d.role !== 'center') window.location.href = `/asn?asn=${d.asn}`;
        })
        .on('mouseenter', (evt, d) => {
            tooltip.style.opacity = '1';
            tooltip.innerHTML = `
                <strong class="text-purple-300">AS${d.asn}</strong><br>
                <span class="text-gray-300">${d.name}</span><br>
                <span class="text-gray-500 text-xs capitalize">${d.role === 'tier1' ? 'Tier-1 / Transit' : d.role}</span>
            `;
        })
        .on('mousemove', (evt) => {
            const rect = container.getBoundingClientRect();
            let x = evt.clientX - rect.left + 14;
            let y = evt.clientY - rect.top - 10;
            if (x + 230 > W) x = x - 244;
            tooltip.style.left = x + 'px';
            tooltip.style.top = y + 'px';
        })
        .on('mouseleave', () => { tooltip.style.opacity = '0'; })
        .call(d3.drag()
            .on('start', (evt, d) => { if (!evt.active) sim.alphaTarget(0.3).restart(); d.fy = d.y; })
            .on('drag', (evt, d) => { d.fy = evt.y; })
            .on('end', (evt, d) => { if (!evt.active) sim.alphaTarget(0); d.fy = null; })
        );

    node.append('circle').attr('r', d => nodeRadius[d.role]);

    // Label: 2 lines (ASN + name truncated)
    node.append('text')
        .attr('dy', d => nodeRadius[d.role] + 13)
        .attr('font-size', d => d.role === 'center' ? 12 : 9)
        .attr('fill', '#e5e7eb')
        .text(d => `AS${d.asn}`);

    // Name label for ALL roles (tier1 gets shorter truncation)
    node.append('text')
        .attr('dy', d => nodeRadius[d.role] + 23)
        .attr('font-size', d => d.role === 'tier1' ? 7 : 8)
        .attr('fill', d => d.role === 'tier1' ? '#6b7280' : '#9ca3af')
        .text(d => {
            if (!d.name) return '';
            const max = d.role === 'center' ? 22 : d.role === 'tier1' ? 12 : 16;
            return d.name.length > max ? d.name.slice(0, max) + '…' : d.name;
        });

    // ── Tick ──────────────────────────────────────────────────────────────
    sim.on('tick', () => {
        // Clamp Y so nodes don't fly off
        nodes.forEach(n => { n.y = Math.max(30, Math.min(H - 30, n.y)); });

        link
            .attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y);

        node.attr('transform', d => `translate(${d.x},${d.y})`);
    });
}

// ─── Initialise ───────────────────────────────────────────────────────────────
lookupButton.addEventListener('click', () => doLookup(asnInput.value));
asnInput.addEventListener('keypress', e => { if (e.key === 'Enter') doLookup(asnInput.value); });

// Auto-lookup from URL
const urlParam = new URLSearchParams(window.location.search).get('asn');
if (urlParam) {
    asnInput.value = urlParam;
    doLookup(urlParam);
}
