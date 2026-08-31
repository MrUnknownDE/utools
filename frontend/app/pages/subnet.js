export const page = {
  title: 'Subnet Calculator',

  template: () => `
<div class="container mx-auto max-w-5xl panel p-6 md:p-8">
  <div class="section-header mx-auto max-w-2xl text-center !border-0 !pl-0 mb-6">
    <span class="eyebrow">IPv4 addressing</span>
    <h2 class="title text-3xl">IP Subnet Calculator</h2>
  </div>

  <!-- Mode Toggle -->
  <div class="flex justify-center mb-8">
    <div class="flex rounded-xl p-1 gap-1" style="background:var(--color-panel-inset); border:1px solid var(--color-border)">
      <button id="btn-beginner" class="btn btn-primary !py-2 !px-6 text-sm">
        Beginner
      </button>
      <button id="btn-pro" class="px-6 py-2 rounded-lg text-sm font-semibold transition-all duration-200 text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
        Expert
      </button>
    </div>
  </div>

  <!-- BEGINNER MODE -->
  <div id="beginner-mode">
    <div class="card p-6 mb-6">

      <div class="mb-6">
        <label class="block text-[var(--color-text-muted)] text-sm font-label font-bold mb-2 uppercase tracking-wide">IP Address</label>
        <input type="text" id="beg-ip" value="192.168.1.0" placeholder="e.g. 192.168.1.0" class="input">
        <p class="text-xs text-[var(--color-text-dim)] mt-1">Enter an IPv4 address, e.g. 192.168.1.0</p>
      </div>

      <div class="mb-6">
        <div class="flex justify-between items-center mb-3">
          <label class="text-[var(--color-text-muted)] text-sm font-label font-bold uppercase tracking-wide">Network Size</label>
          <span id="beg-cidr-label" class="text-3xl font-mono font-bold text-[var(--color-accent)]">/24</span>
        </div>
        <input type="range" id="beg-slider" min="1" max="30" value="24" list="cidr-marks"
          class="w-full h-2 rounded-lg appearance-none cursor-pointer" style="background:var(--color-border-strong); accent-color:var(--color-accent)">
        <datalist id="cidr-marks">
          <option value="8"></option>
          <option value="16"></option>
          <option value="24"></option>
        </datalist>
        <div class="flex justify-between text-xs text-[var(--color-text-dim)] mt-1">
          <span>/1 &mdash; huge</span>
          <span>/8</span>
          <span>/16</span>
          <span>/24</span>
          <span>/30 &mdash; tiny</span>
        </div>
      </div>

      <!-- Host count highlight -->
      <div class="mb-4 p-4 rounded-xl flex items-center justify-between" style="background:var(--color-panel-inset); border:1px solid color-mix(in oklab, var(--color-accent) 20%, var(--color-border))">
        <div>
          <p class="text-xs text-[var(--color-text-dim)] uppercase tracking-wider mb-1">Usable Hosts</p>
          <p id="beg-hosts-count" class="text-4xl font-bold font-mono text-[var(--color-status-good)]">254</p>
        </div>
        <div class="text-right">
          <p class="text-xs text-[var(--color-text-dim)] uppercase tracking-wider mb-1">Subnet Mask</p>
          <p id="beg-mask-display" class="text-sm font-mono text-[var(--color-text-muted)]">255.255.255.0</p>
        </div>
      </div>

      <!-- Visual bar -->
      <div class="mb-6">
        <span class="text-xs text-[var(--color-text-dim)] uppercase tracking-wider">Relative Network Size (logarithmic)</span>
        <div class="h-3 rounded-full overflow-hidden mt-1" style="background:var(--color-panel-inset); border:1px solid var(--color-border)">
          <div id="beg-bar" class="speed-bar-fill h-full transition-all duration-500 rounded-full" style="width:26%"></div>
        </div>
        <div class="flex justify-between text-xs text-[var(--color-text-dim)] mt-1">
          <span>2 hosts (/30)</span>
          <span>2 billion hosts (/1)</span>
        </div>
      </div>

      <!-- Results grid -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div class="stat-box">
          <p class="text-xs text-[var(--color-text-dim)] mb-1">Network ID</p>
          <p id="beg-network" class="font-mono text-[var(--color-text)] text-sm font-bold">-</p>
          <p class="text-xs text-[var(--color-text-dim)] mt-1">network address</p>
        </div>
        <div class="stat-box">
          <p class="text-xs text-[var(--color-text-dim)] mb-1">First Host</p>
          <p id="beg-first" class="font-mono text-[var(--color-link)] text-sm font-bold">-</p>
          <p class="text-xs text-[var(--color-text-dim)] mt-1">1st usable address</p>
        </div>
        <div class="stat-box">
          <p class="text-xs text-[var(--color-text-dim)] mb-1">Last Host</p>
          <p id="beg-last" class="font-mono text-[var(--color-link)] text-sm font-bold">-</p>
          <p class="text-xs text-[var(--color-text-dim)] mt-1">last usable address</p>
        </div>
        <div class="stat-box">
          <p class="text-xs text-[var(--color-text-dim)] mb-1">Broadcast</p>
          <p id="beg-broadcast" class="font-mono text-[var(--color-accent)] text-sm font-bold">-</p>
          <p class="text-xs text-[var(--color-text-dim)] mt-1">send to all devices</p>
        </div>
      </div>
    </div>

    <!-- Explanation card -->
    <div class="card p-6 mb-6" style="border-color:color-mix(in oklab, var(--color-accent) 20%, var(--color-border))">
      <h3 class="text-base font-display font-bold text-[var(--color-accent-strong)] mb-3 flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        What does this mean?
      </h3>
      <p id="beg-explain-text" class="text-sm text-[var(--color-text-muted)] leading-relaxed mb-4"></p>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div class="stat-box text-left">
          <p class="text-[var(--color-text)] font-semibold mb-1">Network Address</p>
          <p class="text-[var(--color-text-muted)]">The first address &mdash; identifies the network itself. No device can use this address.</p>
        </div>
        <div class="stat-box text-left">
          <p class="text-[var(--color-text)] font-semibold mb-1">Host Addresses</p>
          <p class="text-[var(--color-text-muted)]">All addresses in between &mdash; assignable to devices like PCs, servers, or printers.</p>
        </div>
        <div class="stat-box text-left">
          <p class="text-[var(--color-text)] font-semibold mb-1">Broadcast Address</p>
          <p class="text-[var(--color-text-muted)]">The last address &mdash; packets sent here are delivered to every device in the network.</p>
        </div>
      </div>
    </div>

    <!-- Quick examples -->
    <div class="card p-4 mb-6">
      <p class="text-xs text-[var(--color-text-dim)] uppercase tracking-wider mb-3 font-label font-bold">Typical Networks &mdash; click to try</p>
      <div class="flex flex-wrap gap-2">
        <button class="beg-example px-3 py-1.5 text-xs rounded-lg font-mono text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-all" style="background:var(--color-panel-inset); border:1px solid var(--color-border)" data-ip="192.168.1.0" data-cidr="24">192.168.1.0/24 &mdash; home network (254 hosts)</button>
        <button class="beg-example px-3 py-1.5 text-xs rounded-lg font-mono text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-all" style="background:var(--color-panel-inset); border:1px solid var(--color-border)" data-ip="192.168.0.0" data-cidr="16">192.168.0.0/16 &mdash; large (65k hosts)</button>
        <button class="beg-example px-3 py-1.5 text-xs rounded-lg font-mono text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-all" style="background:var(--color-panel-inset); border:1px solid var(--color-border)" data-ip="10.0.0.0" data-cidr="8">10.0.0.0/8 &mdash; huge (16M hosts)</button>
        <button class="beg-example px-3 py-1.5 text-xs rounded-lg font-mono text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-all" style="background:var(--color-panel-inset); border:1px solid var(--color-border)" data-ip="192.168.1.0" data-cidr="28">192.168.1.0/28 &mdash; small (14 hosts)</button>
        <button class="beg-example px-3 py-1.5 text-xs rounded-lg font-mono text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-all" style="background:var(--color-panel-inset); border:1px solid var(--color-border)" data-ip="10.0.0.0" data-cidr="30">10.0.0.0/30 &mdash; P2P link (2 hosts)</button>
      </div>
    </div>

    <!-- Subnet explainer -->
    <details class="card group">
      <summary class="flex items-center justify-between p-5 cursor-pointer select-none list-none">
        <span class="text-sm font-label font-bold text-[var(--color-text-muted)] flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
          </svg>
          What is a subnet, exactly?
        </span>
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-[var(--color-text-dim)] transition-transform duration-200 group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
        </svg>
      </summary>

      <div class="px-5 pb-6 space-y-6 pt-5" style="border-top:1px solid var(--color-border)">

        <!-- Analogy -->
        <div>
          <h4 class="text-sm font-display font-bold text-[var(--color-accent-strong)] mb-2">The neighbourhood analogy</h4>
          <p class="text-sm text-[var(--color-text-muted)] leading-relaxed mb-3">
            Think of a city. Every house has a full address: <span class="font-mono text-[var(--color-text)]">district + house number</span>.
            A subnet works the same way &mdash; every IP address is split into two parts.
          </p>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div class="p-3 rounded-lg" style="background:color-mix(in oklab, var(--color-accent) 8%, var(--color-panel-inset)); border:1px solid color-mix(in oklab, var(--color-accent) 30%, var(--color-border))">
              <p class="text-xs font-label font-bold text-[var(--color-accent-strong)] uppercase tracking-wider mb-1">Network part (district)</p>
              <p class="font-mono text-[var(--color-text)] text-sm mb-1">192.168.1.<span class="text-[var(--color-text-dim)]">___</span></p>
              <p class="text-xs text-[var(--color-text-muted)]">All devices in the same subnet share this part &mdash; like neighbours on the same street.</p>
            </div>
            <div class="p-3 rounded-lg" style="background:color-mix(in oklab, var(--color-link) 8%, var(--color-panel-inset)); border:1px solid color-mix(in oklab, var(--color-link) 30%, var(--color-border))">
              <p class="text-xs font-label font-bold text-[var(--color-link)] uppercase tracking-wider mb-1">Host part (house number)</p>
              <p class="font-mono text-[var(--color-text)] text-sm mb-1"><span class="text-[var(--color-text-dim)]">___</span>.42</p>
              <p class="text-xs text-[var(--color-text-muted)]">Each device gets a unique number within the network.</p>
            </div>
          </div>
        </div>

        <!-- What does /24 mean -->
        <div>
          <h4 class="text-sm font-display font-bold text-[var(--color-accent-strong)] mb-2">What does the slash mean?</h4>
          <p class="text-sm text-[var(--color-text-muted)] leading-relaxed mb-3">
            An IP address is made up of exactly <strong class="text-[var(--color-text)]">32 bits</strong> (ones and zeros) under the hood.
            The <span class="font-mono text-[var(--color-accent)]">/24</span> says: &ldquo;the first 24 bits belong to the network, the remaining 8 bits are the host number.&rdquo;
          </p>
          <div class="p-3 rounded-lg font-mono text-xs overflow-x-auto" style="background:var(--color-panel-inset); border:1px solid var(--color-border)">
            <div class="flex items-center gap-2 mb-1 min-w-max">
              <span class="text-[var(--color-text-dim)] w-20 shrink-0">192.168.1.42</span>
              <span class="text-[var(--color-text-dim)]">=</span>
              <span class="text-[var(--color-accent)]">11000000.10101000.00000001</span><span class="text-[var(--color-text-dim)]">.</span><span class="text-[var(--color-link)]">00101010</span>
            </div>
            <div class="flex items-center gap-2 min-w-max">
              <span class="text-[var(--color-text-dim)] w-20 shrink-0">/24 mask</span>
              <span class="text-[var(--color-text-dim)]">=</span>
              <span class="text-[var(--color-accent)]">11111111.11111111.11111111</span><span class="text-[var(--color-text-dim)]">.</span><span class="text-[var(--color-link)]">00000000</span>
            </div>
            <div class="flex gap-2 mt-2 min-w-max">
              <span class="w-20 shrink-0"></span>
              <span class="text-[var(--color-text-dim)] ml-1">&nbsp;&nbsp;&nbsp;</span>
              <span class="text-[var(--color-accent)] text-xs">&larr;&mdash;&mdash;&mdash; network (24 bits) &mdash;&mdash;&mdash;&rarr;</span>
              <span class="text-[var(--color-link)] text-xs">&larr; host (8 bits) &rarr;</span>
            </div>
          </div>
          <p class="text-xs text-[var(--color-text-dim)] mt-2">8 host bits = 2<sup>8</sup> = 256 addresses, 254 usable (minus network ID and broadcast).</p>
        </div>

        <!-- Why subnets -->
        <div>
          <h4 class="text-sm font-display font-bold text-[var(--color-accent-strong)] mb-2">Why do subnets exist?</h4>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div class="stat-box text-left">
              <p class="font-semibold text-[var(--color-text)] mb-1">Organisation</p>
              <p class="text-[var(--color-text-muted)]">Group devices logically &mdash; e.g. keep office PCs separate from servers or guest Wi-Fi.</p>
            </div>
            <div class="stat-box text-left">
              <p class="font-semibold text-[var(--color-text)] mb-1">Security</p>
              <p class="text-[var(--color-text-muted)]">Isolate networks from each other &mdash; malware on the guest network can't reach corporate systems.</p>
            </div>
            <div class="stat-box text-left">
              <p class="font-semibold text-[var(--color-text)] mb-1">Efficiency</p>
              <p class="text-[var(--color-text-muted)]">Broadcast traffic stays within the subnet &mdash; no unnecessary noise for the rest of the network.</p>
            </div>
          </div>
        </div>

      </div>
    </details>
  </div>

  <!-- EXPERT MODE -->
  <div id="pro-mode" class="hidden">
    <form id="subnet-form" class="mb-8 card p-6">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
        <div>
          <label for="ip-address" class="block text-[var(--color-text-muted)] text-sm font-label font-bold mb-2 uppercase tracking-wide">IP Address:</label>
          <input type="text" id="ip-address" name="ip-address" placeholder="e.g. 192.168.1.1" required class="input">
          <p class="text-xs text-[var(--color-text-dim)] mt-1">IPv4 in dotted-decimal notation</p>
        </div>
        <div>
          <label for="cidr" class="block text-[var(--color-text-muted)] text-sm font-label font-bold mb-2 uppercase tracking-wide">CIDR / Mask:</label>
          <input type="text" id="cidr" name="cidr" placeholder="e.g. 24 or 255.255.255.0" required class="input">
          <p class="text-xs text-[var(--color-text-dim)] mt-1">CIDR (0&ndash;32) or subnet mask (e.g. 255.255.255.0)</p>
        </div>
      </div>
      <div id="subnet-error" class="hidden mb-4 alert alert-bad"></div>
      <button type="submit" class="btn btn-primary w-full">
        Calculate
      </button>
    </form>

    <div id="results" class="card p-6 hidden fade-in">
      <h3 class="text-xl font-display font-bold text-[var(--color-accent-strong)] pb-2 mb-4 flex items-center gap-2" style="border-bottom:1px solid color-mix(in oklab, var(--color-accent) 30%, var(--color-border))">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        Results:
      </h3>

      <div class="space-y-2 text-sm mb-6">
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-1 pb-2 items-start" style="border-bottom:1px solid var(--color-border)">
          <span class="text-[var(--color-text-muted)] font-semibold">Network Address:</span>
          <span id="network-address" class="font-mono text-[var(--color-text)] font-semibold">-</span>
          <span class="text-xs text-[var(--color-text-dim)] italic">First address of the network &mdash; not assignable to hosts</span>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-1 pb-2 items-start" style="border-bottom:1px solid var(--color-border)">
          <span class="text-[var(--color-text-muted)] font-semibold">Broadcast Address:</span>
          <span id="broadcast-address" class="font-mono text-[var(--color-accent)] font-semibold">-</span>
          <span class="text-xs text-[var(--color-text-dim)] italic">Last address &mdash; delivers packets to all hosts simultaneously</span>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-1 pb-2 items-start" style="border-bottom:1px solid var(--color-border)">
          <span class="text-[var(--color-text-muted)] font-semibold">Subnet Mask:</span>
          <span id="subnet-mask" class="font-mono text-[var(--color-text-muted)]">-</span>
          <span class="text-xs text-[var(--color-text-dim)] italic">Separates the network and host portions of the IP address</span>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-1 pb-2 items-start" style="border-bottom:1px solid var(--color-border)">
          <span class="text-[var(--color-text-muted)] font-semibold">Usable Hosts:</span>
          <span id="host-count" class="font-mono text-[var(--color-status-good)] font-bold">-</span>
          <span class="text-xs text-[var(--color-text-dim)] italic">Usable IPs = 2<sup>host bits</sup> &minus; 2</span>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-1 pb-2 items-start" style="border-bottom:1px solid var(--color-border)">
          <span class="text-[var(--color-text-muted)] font-semibold">First Host:</span>
          <span id="first-host" class="font-mono text-[var(--color-link)]">-</span>
          <span class="text-xs text-[var(--color-text-dim)] italic">Network address + 1</span>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-1 items-start">
          <span class="text-[var(--color-text-muted)] font-semibold">Last Host:</span>
          <span id="last-host" class="font-mono text-[var(--color-link)]">-</span>
          <span class="text-xs text-[var(--color-text-dim)] italic">Broadcast &minus; 1</span>
        </div>
      </div>

      <!-- Binary visualization -->
      <div class="mt-4 p-4 rounded-lg" style="background:var(--color-panel-inset); border:1px solid var(--color-border)">
        <h4 class="text-xs text-[var(--color-text-muted)] uppercase tracking-wider font-label font-bold mb-3">Binary Representation</h4>
        <div class="overflow-x-auto">
          <div class="font-mono text-xs space-y-2 min-w-max">
            <div class="flex items-center gap-3">
              <span class="text-[var(--color-text-dim)] w-16 text-right shrink-0 text-xs">IP:</span>
              <span id="bin-ip" class="tracking-wide"></span>
            </div>
            <div class="flex items-center gap-3">
              <span class="text-[var(--color-text-dim)] w-16 text-right shrink-0 text-xs">Mask:</span>
              <span id="bin-mask" class="tracking-wide"></span>
            </div>
            <div class="flex items-center gap-3">
              <span class="text-[var(--color-text-dim)] w-16 text-right shrink-0 text-xs">Network:</span>
              <span id="bin-net" class="tracking-wide"></span>
            </div>
            <div class="flex items-center gap-3 pt-1" style="border-top:1px solid var(--color-border)">
              <span class="w-16 shrink-0"></span>
              <span id="bin-legend" class="text-xs text-[var(--color-text-dim)]"></span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Example subnets -->
    <div class="card p-6 mt-8">
      <h3 class="text-lg font-label font-bold text-[var(--color-text-muted)] uppercase tracking-wider pb-2 mb-4" style="border-bottom:1px solid var(--color-border)">
        Example Subnets (Private Address Ranges)
      </h3>
      <div class="overflow-x-auto">
        <table class="min-w-full text-sm text-left text-[var(--color-text-muted)]">
          <thead class="text-xs uppercase text-[var(--color-text)]" style="background:var(--color-panel-inset)">
            <tr>
              <th class="px-6 py-3">Range</th>
              <th class="px-6 py-3">CIDR</th>
              <th class="px-6 py-3">Subnet Mask</th>
              <th class="px-6 py-3">Description</th>
              <th class="px-6 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-top:1px solid var(--color-border)">
              <td class="px-6 py-4 font-mono text-[var(--color-text)]">192.168.0.0 &ndash; 192.168.255.255</td>
              <td class="px-6 py-4 font-mono">/16 (total)</td>
              <td class="px-6 py-4 font-mono">255.255.0.0</td>
              <td class="px-6 py-4">Class C (commonly used as /24)</td>
              <td class="px-6 py-4"><span class="example-link text-[var(--color-link)] hover:text-[var(--color-link-strong)] cursor-pointer underline" data-ip="192.168.1.1" data-cidr="24">Example /24</span></td>
            </tr>
            <tr style="border-top:1px solid var(--color-border)">
              <td class="px-6 py-4 font-mono text-[var(--color-text)]">172.16.0.0 &ndash; 172.31.255.255</td>
              <td class="px-6 py-4 font-mono">/12 (total)</td>
              <td class="px-6 py-4 font-mono">255.240.0.0</td>
              <td class="px-6 py-4">Class B</td>
              <td class="px-6 py-4"><span class="example-link text-[var(--color-link)] hover:text-[var(--color-link-strong)] cursor-pointer underline" data-ip="172.16.10.5" data-cidr="16">Example /16</span></td>
            </tr>
            <tr style="border-top:1px solid var(--color-border)">
              <td class="px-6 py-4 font-mono text-[var(--color-text)]">10.0.0.0 &ndash; 10.255.255.255</td>
              <td class="px-6 py-4 font-mono">/8 (total)</td>
              <td class="px-6 py-4 font-mono">255.0.0.0</td>
              <td class="px-6 py-4">Class A</td>
              <td class="px-6 py-4"><span class="example-link text-[var(--color-link)] hover:text-[var(--color-link-strong)] cursor-pointer underline" data-ip="10.0.50.100" data-cidr="8">Example /8</span></td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="mt-4 text-xs text-[var(--color-text-dim)] italic">Click an example to populate the fields and run the calculation.</p>
    </div>
  </div>
</div>`,

  init() {
    // ─── Shared helpers ────────────────────────────────────────────────────────
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
    function isValidIP(ip) {
      return /^(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)$/.test(ip);
    }
    function calcSubnet(ip, cidr) {
      const ipBin   = ipToBinary(ip);
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
        last  = binaryToIp((bcNum  - 1).toString(2).padStart(32, '0'));
      } else if (cidr === 31) {
        hosts = 2; first = binaryToIp(netBin); last = binaryToIp(bcBin);
      } else {
        hosts = 1; first = binaryToIp(netBin); last = binaryToIp(netBin);
      }
      return { network: binaryToIp(netBin), broadcast: binaryToIp(bcBin), mask: cidrToMask(cidr), hosts, first, last, netBin, ipBin, maskBin, cidr, hostBits };
    }

    // ─── Mode toggle ──────────────────────────────────────────────────────────
    const beginnerEl = document.getElementById('beginner-mode');
    const proEl      = document.getElementById('pro-mode');
    const btnBeg     = document.getElementById('btn-beginner');
    const btnPro     = document.getElementById('btn-pro');
    const activeClass   = 'btn btn-primary !py-2 !px-6 text-sm';
    const inactiveClass = 'px-6 py-2 rounded-lg text-sm font-semibold transition-all duration-200 text-[var(--color-text-muted)] hover:text-[var(--color-text)]';

    function setMode(mode) {
      const isBeg = mode === 'beginner';
      beginnerEl.classList.toggle('hidden', !isBeg);
      proEl.classList.toggle('hidden', isBeg);
      btnBeg.className = isBeg ? activeClass : inactiveClass;
      btnPro.className = isBeg ? inactiveClass : activeClass;
    }
    btnBeg.addEventListener('click', () => setMode('beginner'));
    btnPro.addEventListener('click', () => setMode('pro'));

    // ─── Beginner mode ────────────────────────────────────────────────────────
    const begIpInput     = document.getElementById('beg-ip');
    const begSlider      = document.getElementById('beg-slider');
    const begCidrLabel   = document.getElementById('beg-cidr-label');
    const begBar         = document.getElementById('beg-bar');
    const begHostsCount  = document.getElementById('beg-hosts-count');
    const begMaskDisplay = document.getElementById('beg-mask-display');
    const begNetwork     = document.getElementById('beg-network');
    const begFirst       = document.getElementById('beg-first');
    const begLast        = document.getElementById('beg-last');
    const begBroadcast   = document.getElementById('beg-broadcast');
    const begExplain     = document.getElementById('beg-explain-text');

    function updateBeginner() {
      const ip   = begIpInput.value.trim();
      const cidr = parseInt(begSlider.value, 10);

      begCidrLabel.textContent = `/${cidr}`;

      // bar: log scale via host-bit count
      const barPct = Math.max(3, ((32 - cidr) / 31) * 100);
      begBar.style.width = barPct + '%';

      if (!isValidIP(ip)) return;

      const r = calcSubnet(ip, cidr);

      begHostsCount.textContent  = r.hosts.toLocaleString('en');
      begMaskDisplay.textContent = r.mask;
      begNetwork.textContent     = r.network;
      begFirst.textContent       = r.first;
      begLast.textContent        = r.last;
      begBroadcast.textContent   = r.broadcast;

      let sizeDesc;
      if      (cidr <= 8)  sizeDesc = 'This is a massive network &mdash; only found in large data centres or at internet service providers.';
      else if (cidr <= 12) sizeDesc = 'This is a very large network, typical for big enterprises or campus environments.';
      else if (cidr <= 16) sizeDesc = 'This is a large network, common in mid-sized companies or universities.';
      else if (cidr <= 20) sizeDesc = 'This is a medium-sized network, e.g. for a large office building or campus.';
      else if (cidr <= 24) sizeDesc = 'This is a typical home or small office network &mdash; the default on most routers.';
      else if (cidr <= 27) sizeDesc = 'This is a small network, e.g. for a single department or server cluster.';
      else                 sizeDesc = 'This is a very small network, usually used for direct point-to-point links.';

      begExplain.innerHTML = `
        A <strong class="text-[var(--color-accent-strong)]">/${cidr}</strong> network reserves
        <strong class="text-[var(--color-accent-strong)]">${cidr} bits for the network address</strong> and leaves
        <strong class="text-[var(--color-accent-strong)]">${r.hostBits} bits for hosts</strong>.
        That gives <strong class="text-[var(--color-status-good)]">${r.hosts.toLocaleString('en')} usable IP addresses</strong>
        (2<sup>${r.hostBits}</sup>&minus;2, since the network ID and broadcast are reserved).
        <br><br>${sizeDesc}
      `;
    }

    begSlider.addEventListener('input', updateBeginner);
    begIpInput.addEventListener('input', updateBeginner);

    document.querySelectorAll('.beg-example').forEach(btn => {
      btn.addEventListener('click', () => {
        begIpInput.value = btn.dataset.ip;
        begSlider.value  = btn.dataset.cidr;
        updateBeginner();
      });
    });

    updateBeginner();

    // ─── Expert mode ──────────────────────────────────────────────────────────
    const form      = document.getElementById('subnet-form');
    const ipInput   = document.getElementById('ip-address');
    const cidrInput = document.getElementById('cidr');
    const errorEl   = document.getElementById('subnet-error');
    const resultsEl = document.getElementById('results');

    function showInlineError(msg) {
      errorEl.textContent = msg;
      errorEl.classList.toggle('hidden', !msg);
    }

    function coloredBits(bits, cidr, hostChar) {
      let html = '';
      for (let i = 0; i < 32; i++) {
        if (i > 0 && i % 8 === 0) html += '<span class="text-[var(--color-text-dim)] select-none">.</span>';
        const isNet = i < cidr;
        const ch    = hostChar && !isNet ? hostChar : bits[i];
        html += `<span class="${isNet ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-dim)]'}">${ch}</span>`;
      }
      return html;
    }

    function renderBinary(r) {
      const maskBits = '1'.repeat(r.cidr) + '0'.repeat(r.hostBits);
      document.getElementById('bin-ip').innerHTML   = coloredBits(r.ipBin,  r.cidr, null);
      document.getElementById('bin-mask').innerHTML = coloredBits(maskBits, r.cidr, null);
      document.getElementById('bin-net').innerHTML  = coloredBits(r.netBin, r.cidr, 'x');
      document.getElementById('bin-legend').innerHTML =
        `<span class="text-[var(--color-accent)]">&#x25A0;</span> network bit (${r.cidr}) &nbsp;&nbsp; ` +
        `<span class="text-[var(--color-text-dim)]">&#x25A1;</span> host bit (${r.hostBits}) &nbsp;&mdash;&nbsp; ` +
        `x = any host address within this network`;
    }

    function calculate() {
      showInlineError(null);
      const ip      = ipInput.value.trim();
      const cidrRaw = cidrInput.value.trim();

      if (!isValidIP(ip)) { showInlineError('Please enter a valid IPv4 address.'); return; }

      let cidr;
      if (cidrRaw.includes('.')) {
        if (!isValidIP(cidrRaw)) { showInlineError('Please enter a valid subnet mask.'); return; }
        cidr = maskToCidr(cidrRaw);
        if (cidr === null) { showInlineError('Invalid subnet mask — must be a contiguous sequence of ones (e.g. 255.255.255.0).'); return; }
      } else {
        cidr = parseInt(cidrRaw, 10);
        if (isNaN(cidr) || cidr < 0 || cidr > 32) { showInlineError('Please enter a valid CIDR value (0–32).'); return; }
      }

      const r = calcSubnet(ip, cidr);

      document.getElementById('network-address').textContent   = r.network;
      document.getElementById('broadcast-address').textContent = r.broadcast;
      document.getElementById('subnet-mask').textContent       = r.mask;
      document.getElementById('host-count').textContent        = r.hosts.toLocaleString('en');
      document.getElementById('first-host').textContent        = r.first;
      document.getElementById('last-host').textContent         = r.last;

      renderBinary(r);
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
