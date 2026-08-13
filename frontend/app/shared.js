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
