import { API, createLookupPage } from '../shared.js';

export const page = createLookupPage({
  title: 'DNS Lookup',
  eyebrow: 'Resolve records',
  placeholder: 'Enter domain (e.g., google.com)',
  buttonLabel: 'Lookup DNS',
  paramName: 'domain',
  resultLabel: 'DNS Results for:',
  extraSelect: {
    paramName: 'type',
    default: 'ANY',
    options: [
      { value: 'ANY', label: 'ANY' },
      { value: 'A', label: 'A' },
      { value: 'AAAA', label: 'AAAA' },
      { value: 'MX', label: 'MX' },
      { value: 'TXT', label: 'TXT' },
      { value: 'NS', label: 'NS' },
      { value: 'CNAME', label: 'CNAME' },
      { value: 'SOA', label: 'SOA' },
      { value: 'SRV', label: 'SRV' },
      { value: 'PTR', label: 'PTR (Reverse)' },
    ],
  },
  buildUrl: (domain, type) => `${API}/dns-lookup?domain=${encodeURIComponent(domain)}&type=${encodeURIComponent(type)}`,
  formatResult: (data) => JSON.stringify(data.records, null, 2),
});
