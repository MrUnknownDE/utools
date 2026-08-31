import { API, createLookupPage } from '../shared.js';

export const page = createLookupPage({
  title: 'MAC Address Vendor Lookup',
  eyebrow: 'OUI vendor lookup',
  placeholder: 'Enter MAC address (e.g., 00:1A:2B:3C:4D:5E)',
  buttonLabel: 'Find Vendor',
  paramName: 'mac',
  resultLabel: 'Vendor for:',
  showCopyButton: false,
  centerResult: true,
  buildUrl: (mac) => `${API}/mac-lookup?mac=${encodeURIComponent(mac)}`,
  formatResult: (data) => data.vendor || 'No vendor found.',
});
