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
