export const page = {
  title: 'Subnetz Rechner',

  template: () => `
<div class="container mx-auto max-w-5xl glass-panel rounded-xl shadow-2xl p-6 md:p-8 backdrop-blur-xl border border-gray-800/50">
  <h2 class="text-3xl font-bold mb-8 text-center text-gradient">IP Subnetz Rechner</h2>

  <form id="subnet-form" class="mb-8 glass-card p-6 rounded-xl">
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
      <div>
        <label for="ip-address" class="block text-gray-400 text-sm font-bold mb-2 uppercase tracking-wide">IP Adresse:</label>
        <input type="text" id="ip-address" name="ip-address" placeholder="z.B. 192.168.1.1" required
          class="w-full px-4 py-3 bg-gray-900/50 border border-gray-700/50 rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono transition-all">
      </div>
      <div>
        <label for="cidr" class="block text-gray-400 text-sm font-bold mb-2 uppercase tracking-wide">CIDR / Maske:</label>
        <input type="text" id="cidr" name="cidr" placeholder="z.B. 24 oder 255.255.255.0" required
          class="w-full px-4 py-3 bg-gray-900/50 border border-gray-700/50 rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono transition-all">
      </div>
    </div>
    <div id="subnet-error" class="hidden mb-4 p-3 bg-red-900/20 border border-red-500/30 rounded text-red-400 text-sm"></div>
    <button type="submit"
      class="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold py-3 px-6 rounded-lg shadow-lg hover:shadow-purple-500/25 transition-all duration-200 ease-in-out transform hover:-translate-y-0.5">
      Berechnen
    </button>
  </form>

  <div id="results" class="glass-card rounded-xl p-6 hidden fade-in">
    <h3 class="text-xl font-bold text-purple-300 border-b border-purple-500/30 pb-2 mb-4 flex items-center gap-2">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
      Ergebnisse:
    </h3>
    <div class="space-y-3 text-sm">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 border-b border-gray-700/50 pb-2">
        <span class="text-gray-400">Netzwerkadresse:</span>
        <span id="network-address" class="font-mono text-white font-semibold">-</span>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 border-b border-gray-700/50 pb-2">
        <span class="text-gray-400">Broadcast-Adresse:</span>
        <span id="broadcast-address" class="font-mono text-purple-400 font-semibold">-</span>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 border-b border-gray-700/50 pb-2">
        <span class="text-gray-400">Subnetzmaske:</span>
        <span id="subnet-mask" class="font-mono text-gray-300">-</span>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 border-b border-gray-700/50 pb-2">
        <span class="text-gray-400">Anzahl der Hosts:</span>
        <span id="host-count" class="font-mono text-green-400 font-bold">-</span>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 border-b border-gray-700/50 pb-2">
        <span class="text-gray-400">Erste Host-Adresse:</span>
        <span id="first-host" class="font-mono text-blue-300">-</span>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <span class="text-gray-400">Letzte Host-Adresse:</span>
        <span id="last-host" class="font-mono text-blue-300">-</span>
      </div>
    </div>
  </div>

  <!-- Example subnets -->
  <div class="glass-card rounded-xl p-6 mt-8">
    <h3 class="text-lg font-bold text-gray-400 uppercase tracking-wider border-b border-gray-700/50 pb-2 mb-4">
      Beispiel-Subnetze (Private Adressbereiche)
    </h3>
    <div class="overflow-x-auto">
      <table class="min-w-full text-sm text-left text-gray-400">
        <thead class="text-xs uppercase bg-gray-800/50 text-gray-200">
          <tr>
            <th class="px-6 py-3">Bereich</th>
            <th class="px-6 py-3">CIDR</th>
            <th class="px-6 py-3">Subnetzmaske</th>
            <th class="px-6 py-3">Beschreibung</th>
            <th class="px-6 py-3">Aktion</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-700/50">
          <tr class="hover:bg-gray-700/30 transition-colors">
            <td class="px-6 py-4 font-mono text-white">192.168.0.0 – 192.168.255.255</td>
            <td class="px-6 py-4 font-mono">/16 (Gesamt)</td>
            <td class="px-6 py-4 font-mono">255.255.0.0</td>
            <td class="px-6 py-4">Klasse C (oft als /24 genutzt)</td>
            <td class="px-6 py-4"><span class="example-link text-purple-400 hover:text-purple-300 cursor-pointer underline" data-ip="192.168.1.1" data-cidr="24">Beispiel /24</span></td>
          </tr>
          <tr class="hover:bg-gray-700/30 transition-colors">
            <td class="px-6 py-4 font-mono text-white">172.16.0.0 – 172.31.255.255</td>
            <td class="px-6 py-4 font-mono">/12 (Gesamt)</td>
            <td class="px-6 py-4 font-mono">255.240.0.0</td>
            <td class="px-6 py-4">Klasse B</td>
            <td class="px-6 py-4"><span class="example-link text-purple-400 hover:text-purple-300 cursor-pointer underline" data-ip="172.16.10.5" data-cidr="16">Beispiel /16</span></td>
          </tr>
          <tr class="hover:bg-gray-700/30 transition-colors">
            <td class="px-6 py-4 font-mono text-white">10.0.0.0 – 10.255.255.255</td>
            <td class="px-6 py-4 font-mono">/8 (Gesamt)</td>
            <td class="px-6 py-4 font-mono">255.0.0.0</td>
            <td class="px-6 py-4">Klasse A</td>
            <td class="px-6 py-4"><span class="example-link text-purple-400 hover:text-purple-300 cursor-pointer underline" data-ip="10.0.50.100" data-cidr="8">Beispiel /8</span></td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="mt-4 text-xs text-gray-500 italic">Klicken Sie auf "Beispiel", um die Felder auszufüllen und die Berechnung zu starten.</p>
  </div>
</div>`,

  init() {
    const form      = document.getElementById('subnet-form');
    const ipInput   = document.getElementById('ip-address');
    const cidrInput = document.getElementById('cidr');
    const errorEl   = document.getElementById('subnet-error');
    const resultsEl = document.getElementById('results');

    function showInlineError(msg) {
      errorEl.textContent = msg;
      errorEl.classList.toggle('hidden', !msg);
    }

    function isValidIP(ip) {
      return /^(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)$/.test(ip);
    }

    function ipToBinary(ip) {
      return ip.split('.').map(o => parseInt(o, 10).toString(2).padStart(8, '0')).join('');
    }

    function binaryToIp(b) {
      const parts = [];
      for (let i = 0; i < 32; i += 8) parts.push(parseInt(b.slice(i, i + 8), 2));
      return parts.join('.');
    }

    function cidrToMask(cidr) {
      return binaryToIp('1'.repeat(cidr) + '0'.repeat(32 - cidr));
    }

    function maskToCidr(mask) {
      const b = ipToBinary(mask);
      if (/^1*0*$/.test(b)) return b.replace(/0+$/, '').length;
      return null;
    }

    function calculate() {
      showInlineError(null);
      const ip      = ipInput.value.trim();
      const cidrRaw = cidrInput.value.trim();

      if (!isValidIP(ip)) { showInlineError('Bitte eine gültige IPv4-Adresse eingeben.'); return; }

      let cidr, mask;
      if (cidrRaw.includes('.')) {
        if (!isValidIP(cidrRaw)) { showInlineError('Bitte eine gültige Subnetzmaske eingeben.'); return; }
        cidr = maskToCidr(cidrRaw);
        if (cidr === null) { showInlineError('Ungültige Subnetzmaske — muss eine kontinuierliche Folge von Einsen sein (z.B. 255.255.255.0).'); return; }
        mask = cidrRaw;
      } else {
        cidr = parseInt(cidrRaw, 10);
        if (isNaN(cidr) || cidr < 0 || cidr > 32) { showInlineError('Bitte einen gültigen CIDR-Wert (0–32) eingeben.'); return; }
        mask = cidrToMask(cidr);
      }

      const ipBin  = ipToBinary(ip);
      const maskBin = '1'.repeat(cidr) + '0'.repeat(32 - cidr);
      let netBin = '';
      for (let i = 0; i < 32; i++) netBin += (parseInt(ipBin[i]) & parseInt(maskBin[i])).toString();

      const hostBits = 32 - cidr;
      const bcBin    = netBin.slice(0, cidr) + '1'.repeat(hostBits);
      const netNum   = parseInt(netBin, 2);
      const bcNum    = parseInt(bcBin, 2);

      let hosts, first, last;
      if (hostBits >= 2) {
        hosts = Math.pow(2, hostBits) - 2;
        first = binaryToIp((netNum + 1).toString(2).padStart(32, '0'));
        last  = binaryToIp((bcNum - 1).toString(2).padStart(32, '0'));
      } else if (cidr === 31) {
        hosts = 2; first = binaryToIp(netBin); last = binaryToIp(bcBin);
      } else {
        hosts = 1; first = binaryToIp(netBin); last = binaryToIp(netBin);
      }

      document.getElementById('network-address').textContent  = binaryToIp(netBin);
      document.getElementById('broadcast-address').textContent = binaryToIp(bcBin);
      document.getElementById('subnet-mask').textContent       = mask;
      document.getElementById('host-count').textContent        = hosts.toLocaleString();
      document.getElementById('first-host').textContent        = first;
      document.getElementById('last-host').textContent         = last;

      resultsEl.classList.remove('hidden');
    }

    form.addEventListener('submit', e => { e.preventDefault(); calculate(); });

    document.querySelectorAll('.example-link').forEach(link => {
      link.addEventListener('click', () => {
        ipInput.value   = link.dataset.ip;
        cidrInput.value = link.dataset.cidr;
        calculate();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
  }
};
