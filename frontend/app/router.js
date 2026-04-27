import { page as homePage }   from './pages/home.js';
import { page as subnetPage } from './pages/subnet.js';
import { page as dnsPage }    from './pages/dns.js';
import { page as whoisPage }  from './pages/whois.js';
import { page as macPage }    from './pages/mac.js';
import { page as asnPage }    from './pages/asn.js';

const routes = {
  '/':       homePage,
  '/subnet': subnetPage,
  '/dns':    dnsPage,
  '/whois':  whoisPage,
  '/mac':    macPage,
  '/asn':    asnPage,
};

const app = document.getElementById('app');
let currentCleanup = null;

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
  .then(d => { const el = document.getElementById('commit-sha'); if (el) el.textContent = d.commitSha || 'unknown'; })
  .catch(() => { const el = document.getElementById('commit-sha'); if (el) el.textContent = 'error'; });

// ── Initial render ───────────────────────────────────────────────
navigate(location.pathname, { push: false, search: location.search });
