import { page as homePage }   from './pages/home.js';
import { page as subnetPage } from './pages/subnet.js';
import { page as dnsPage }    from './pages/dns.js';
import { page as whoisPage }  from './pages/whois.js';
import { page as macPage }    from './pages/mac.js';
import { page as asnPage }    from './pages/asn.js';
import { page as diagnosePage } from './pages/diagnose.js';

const routes = {
  '/':         homePage,
  '/subnet':   subnetPage,
  '/dns':      dnsPage,
  '/whois':    whoisPage,
  '/mac':      macPage,
  '/asn':      asnPage,
  '/diagnose': diagnosePage,
};

const app = document.getElementById('app');
const header = document.querySelector('header');
let currentCleanup = null;

// ── Hamburger toggle ─────────────────────────────────────────────
const navToggle = document.getElementById('nav-toggle');
if (navToggle) {
  navToggle.addEventListener('click', () => {
    const open = header.classList.toggle('nav-open');
    navToggle.setAttribute('aria-expanded', open);
  });
}

function setActiveNav(path) {
  document.querySelectorAll('nav a').forEach(a => {
    try {
      const p = new URL(a.href).pathname;
      a.classList.toggle('active-link', p === path);
    } catch {}
  });
}

async function navigate(path, { push = true, search = '' } = {}) {
  const route = routes[path] ?? routes['/'];

  // ── close mobile nav on navigate ────────────────────────────
  if (header) { header.classList.remove('nav-open'); navToggle?.setAttribute('aria-expanded', 'false'); }

  // ── leave animation ──────────────────────────────────────────
  app.classList.add('page-leaving');
  if (currentCleanup) { try { currentCleanup(); } catch {} currentCleanup = null; }
  await new Promise(r => setTimeout(r, 200));

  // ── swap content ─────────────────────────────────────────────
  app.innerHTML = route.template();
  document.title = route.title ? `${route.title} – uTools` : 'uTools – Network Suite';
  setActiveNav(path);

  const fullUrl = path + (search ? (search.startsWith('?') ? search : '?' + search) : '');
  if (push) history.pushState({ path }, '', fullUrl);

  // ── enter animation ──────────────────────────────────────────
  app.classList.remove('page-leaving');
  app.classList.add('page-entering');
  setTimeout(() => app.classList.remove('page-entering'), 300);

  // ── init page ────────────────────────────────────────────────
  const cleanup = await route.init(search);
  currentCleanup = typeof cleanup === 'function' ? cleanup : null;
}

// ── Intercept same-origin link clicks ───────────────────────────
document.addEventListener('click', e => {
  if (e.defaultPrevented) return;
  const a = e.target.closest('a[href]');
  if (!a) return;
  let url;
  try { url = new URL(a.href); } catch { return; }
  if (url.origin !== location.origin) return;
  if (!(url.pathname in routes)) return;
  e.preventDefault();
  navigate(url.pathname, { push: true, search: url.search });
});

window.addEventListener('popstate', () => {
  navigate(location.pathname, { push: false, search: location.search });
});

// ── Expose for programmatic navigation ──────────────────────────
window._router = {
  navigate(path, searchObj = {}) {
    const s = new URLSearchParams(searchObj).toString();
    navigate(path, { push: true, search: s ? '?' + s : '' });
  }
};

// ── Fetch version once ───────────────────────────────────────────
fetch('/api/version')
  .then(r => r.json())
  .then(d => {
    const shaEl = document.getElementById('commit-sha');
    if (shaEl) shaEl.textContent = d.commitSha || 'unknown';

    const geoipEl = document.getElementById('geoip-date');
    if (geoipEl) {
      // City and ASN DB are updated together monthly (see maxmind-update.yml) — same date in practice,
      // but fall back to whichever is present in case they ever diverge.
      const date = d.cityDbDate || d.asnDbDate;
      geoipEl.textContent = date
        ? new Date(date).toLocaleDateString('de-DE', { year: 'numeric', month: '2-digit', day: '2-digit' })
        : 'unbekannt';
    }
  })
  .catch(() => {
    const el = document.getElementById('commit-sha');
    if (el) el.textContent = 'error';
    const geoipEl = document.getElementById('geoip-date');
    if (geoipEl) geoipEl.textContent = 'error';
  });

// ── Initial render ───────────────────────────────────────────────
navigate(location.pathname, { push: false, search: location.search });
