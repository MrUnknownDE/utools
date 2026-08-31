export const API = '/api';

export function setupCopyBtn(btn, getText) {
  if (!btn) return;
  btn.addEventListener('click', () => {
    const text = getText();
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      const orig = btn.textContent;
      btn.textContent = '✓ copied';
      btn.classList.add('copied');
      setTimeout(() => { btn.textContent = orig; btn.classList.remove('copied'); }, 1500);
    }).catch(() => {});
  });
}

export function showError(el, msg) {
  if (!el) return;
  el.textContent = msg ? `Error: ${msg}` : '';
  el.classList.toggle('hidden', !msg);
}

// Renders the app's signature LED status indicator. `status` is one of
// 'good' | 'warn' | 'bad' | 'neutral' — the canonical replacement for the
// three ad-hoc badge/pill implementations that used to live separately in
// home.js, diagnose.js and asn.js.
export function renderLed(status, label) {
  const cls = { good: 'led-good', warn: 'led-warn', bad: 'led-bad', neutral: 'led-neutral' }[status] || 'led-neutral';
  return `<span class="led ${cls}">${label}</span>`;
}

// Factory for the "single input + button + <pre> result" pages (DNS/WHOIS/MAC
// lookup). Those three pages were near-identical clones; this owns the
// shared enable/disable, fetch/error/loader dance, and URL-param bootstrapping
// so each page only supplies its own config + result formatting.
//
//   title            page title (used for <title> and the H1)
//   eyebrow          small label above the title
//   placeholder      input placeholder text
//   buttonLabel      submit button label
//   paramName        URL query-param name for the main input value
//   resultLabel      label shown above the result (e.g. "DNS Results for:")
//   buildUrl(value, extra)      -> API URL to fetch
//   formatResult(data)          -> string to place in the <pre> output
//   formatQueryLabel(value, extra) -> string shown next to resultLabel (optional)
//   extraSelect      optional { id, paramName, options: [{value,label}], default }
//                     renders a second <select> control (used by DNS record type)
//   showCopyButton   default true; MAC lookup has no copy button
//   centerResult     default false; MAC lookup centers its single-line result
export function createLookupPage({
  title,
  eyebrow = 'Lookup Tool',
  placeholder,
  buttonLabel,
  paramName,
  resultLabel,
  buildUrl,
  formatResult,
  formatQueryLabel = (value, extra) => (extra ? `${value} (${extra})` : value),
  extraSelect = null,
  showCopyButton = true,
  centerResult = false,
}) {
  return {
    title,

    template: () => `
<div class="max-w-3xl mx-auto panel p-6 md:p-8">
  <div class="section-header">
    <span class="eyebrow">${eyebrow}</span>
    <h1 class="title text-2xl">${title}</h1>
  </div>

  <div class="card p-6">
    <div class="flex flex-col sm:flex-row gap-3 mb-6">
      <input type="text" id="lookup-input" placeholder="${placeholder}" class="input flex-grow">
      ${extraSelect ? `
      <select id="lookup-select" class="input sm:w-auto cursor-pointer">
        ${extraSelect.options.map(o => `<option value="${o.value}"${o.value === extraSelect.default ? ' selected' : ''}>${o.label}</option>`).join('')}
      </select>` : ''}
      <button id="lookup-button" disabled class="btn btn-primary">${buttonLabel}</button>
    </div>
    <div id="lookup-error" class="hidden mb-4 alert alert-bad"></div>

    <div id="lookup-results" class="hidden mt-6 pt-6 fade-in" style="border-top:1px solid var(--color-border)">
      <div class="flex items-center justify-between mb-4 gap-3">
        <h3 class="flex items-center gap-2 font-label text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
          <span class="inline-block w-1.5 h-4 rounded-full" style="background:var(--color-accent)"></span>
          ${resultLabel} <span id="lookup-query" class="font-mono normal-case tracking-normal text-[var(--color-accent-strong)] ml-1"></span>
        </h3>
        ${showCopyButton ? '<button id="lookup-copy" class="copy-btn">copy</button>' : ''}
      </div>
      <div id="lookup-loader" class="loader hidden mb-4${centerResult ? ' mx-auto' : ''}"></div>
      <pre id="lookup-output" class="result-pre${centerResult ? ' text-center text-xl' : ''}"></pre>
    </div>
  </div>
</div>`,

    async init(search) {
      const input   = document.getElementById('lookup-input');
      const select  = extraSelect ? document.getElementById('lookup-select') : null;
      const btn     = document.getElementById('lookup-button');
      const errorEl = document.getElementById('lookup-error');
      const section = document.getElementById('lookup-results');
      const queryEl = document.getElementById('lookup-query');
      const loader  = document.getElementById('lookup-loader');
      const output  = document.getElementById('lookup-output');
      const copyBtn = document.getElementById('lookup-copy');

      const syncBtn = () => { btn.disabled = !input.value.trim(); };
      input.addEventListener('input', syncBtn);

      if (copyBtn) setupCopyBtn(copyBtn, () => output.textContent);

      async function doLookup() {
        const value = input.value.trim();
        if (!value) return;
        const extra = select ? select.value : undefined;

        const url = new URL(location.href);
        url.searchParams.set(paramName, value);
        if (extraSelect) url.searchParams.set(extraSelect.paramName, extra);
        history.replaceState({}, '', url);

        showError(errorEl, null);
        section.classList.remove('hidden');
        loader.classList.remove('hidden');
        output.textContent = '';
        queryEl.textContent = formatQueryLabel(value, extra);

        try {
          const r = await fetch(buildUrl(value, extra));
          const data = await r.json();
          if (!r.ok || !data.success) throw new Error(data.error || `HTTP ${r.status}`);
          output.textContent = formatResult(data);
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
      const v = params.get(paramName);
      if (v) {
        input.value = v;
        if (extraSelect) {
          const e = params.get(extraSelect.paramName);
          if (e) select.value = e;
        }
        syncBtn();
        doLookup();
      }
    },
  };
}

// Detects IPv4/IPv6 reachability via protocol-specific subdomains
// (ipv4./ipv6. carry A-only / AAAA-only DNS), so a successful fetch proves
// that protocol works end-to-end for this client. Returns null for a
// protocol that timed out or isn't reachable (e.g. local dev without those
// subdomains configured).
export async function detectDualStack(timeoutMs = 4000) {
  async function forceDetect(url) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const r = await fetch(url, { signal: ctrl.signal });
      if (!r.ok) return null;
      const d = await r.json();
      return d.ip || null;
    } catch { return null; }
    finally { clearTimeout(timer); }
  }

  // Use current hostname so it works for any deployment (utools.mrunk.de → ipv4.utools.mrunk.de)
  const host = location.hostname;
  const [ipv4, ipv6] = await Promise.all([
    forceDetect(`https://ipv4.${host}/api/myip`),
    forceDetect(`https://ipv6.${host}/api/myip`),
  ]);
  return { ipv4, ipv6 };
}
