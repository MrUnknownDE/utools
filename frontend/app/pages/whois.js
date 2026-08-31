import { API, createLookupPage } from '../shared.js';

export const page = createLookupPage({
  title: 'WHOIS Lookup',
  eyebrow: 'Registration data',
  placeholder: 'Enter domain or IP (e.g., google.com or 8.8.8.8)',
  buttonLabel: 'Lookup WHOIS',
  paramName: 'query',
  resultLabel: 'WHOIS Results for:',
  buildUrl: (query) => `${API}/whois-lookup?query=${encodeURIComponent(query)}`,
  formatResult: (data) => (typeof data.result === 'string' ? data.result : JSON.stringify(data.result, null, 2)),
});
