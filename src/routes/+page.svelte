<script lang="ts">
  import { tick, onDestroy } from 'svelte';
  import { Chart, DoughnutController, ArcElement, Tooltip, Legend } from 'chart.js';
  import type { ASNRecord } from '../types/ASNData';
  import type { RadarData } from '../types/RadarData';

  Chart.register(DoughnutController, ArcElement, Tooltip, Legend);

  type RadarStats = RadarData['result']['stats'];

  let searchValue = '';
  let loading = false;
  let errorMsg: string | null = null;
  let rankData: ASNRecord | null = null;
  let radarData: RadarStats | null = null;
  let hasSearched = false;

  let chartCanvas: HTMLCanvasElement | null = null;
  let chart: Chart | null = null;

  onDestroy(() => { if (chart) chart.destroy(); });

  function formatNum(n: number): string {
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toLocaleString();
  }

  async function search() {
    const trimmed = searchValue.trim().replace(/^as/i, '');
    const asn = parseInt(trimmed, 10);
    if (isNaN(asn) || asn < 1 || asn > 4294967295) {
      errorMsg = 'Please enter a valid AS number (1 – 4,294,967,295)';
      return;
    }

    loading = true;
    errorMsg = null;
    rankData = null;
    radarData = null;
    hasSearched = true;
    if (chart) { chart.destroy(); chart = null; }

    try {
      const res = await fetch(`/api/asn/${asn}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `Request failed (HTTP ${res.status})`);
      }
      const data = await res.json();
      rankData = data.rankData;
      radarData = data.radarData;
    } catch (e) {
      errorMsg = e instanceof Error ? e.message : 'Failed to fetch data';
    } finally {
      loading = false;
    }

    await tick();
    initChart();
  }

  function initChart() {
    if (chart) { chart.destroy(); chart = null; }
    if (!radarData || !chartCanvas) return;

    const total = radarData.routes_valid + radarData.routes_unknown + radarData.routes_invalid;
    chart = new Chart(chartCanvas, {
      type: 'doughnut',
      data: {
        labels: ['Valid', 'Unknown', 'Invalid'],
        datasets: [{
          data: [radarData.routes_valid, radarData.routes_unknown, radarData.routes_invalid],
          backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
          borderWidth: 3,
          borderColor: '#ffffff',
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const val = ctx.parsed;
                const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0';
                return ` ${ctx.label}: ${val.toLocaleString()} (${pct}%)`;
              }
            }
          }
        }
      }
    });
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter') search();
  }

  $: rpkiTotal = radarData
    ? radarData.routes_valid + radarData.routes_unknown + radarData.routes_invalid
    : 0;
  $: validPct   = rpkiTotal > 0 ? Math.round((radarData!.routes_valid   / rpkiTotal) * 100) : 0;
  $: unknownPct = rpkiTotal > 0 ? Math.round((radarData!.routes_unknown / rpkiTotal) * 100) : 0;
  $: invalidPct = rpkiTotal > 0 ? Math.round((radarData!.routes_invalid / rpkiTotal) * 100) : 0;
</script>

<div class="min-h-screen bg-slate-50 flex flex-col font-sans">

  <!-- Header -->
  <header class="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-10">
    <div class="max-w-5xl mx-auto flex items-center gap-3">
      <div class="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
        <svg class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
        </svg>
      </div>
      <div class="flex-1 min-w-0">
        <h1 class="text-base font-semibold text-slate-900 leading-tight">BGP Security Inspector</h1>
        <p class="text-xs text-slate-400">by <a href="https://bgpkit.com" target="_blank" rel="noopener noreferrer" class="hover:text-blue-600 transition-colors">BGPKIT</a></p>
      </div>
      <!-- Inline search in header when results are showing -->
      {#if hasSearched}
        <div class="flex items-center gap-2">
          <div class="relative">
            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-mono pointer-events-none">AS</span>
            <input
              type="text"
              bind:value={searchValue}
              on:keydown={handleKeyDown}
              placeholder="13335"
              class="pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-sm w-36 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50"
            />
          </div>
          <button
            on:click={search}
            disabled={loading}
            class="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? '…' : 'Go'}
          </button>
        </div>
      {/if}
    </div>
  </header>

  <!-- Hero search (shown when no results yet) -->
  {#if !hasSearched}
    <section class="flex-1 flex flex-col items-center justify-center px-6 py-16">
      <div class="text-center mb-8 max-w-lg">
        <h2 class="text-3xl font-bold text-slate-900 mb-3 tracking-tight">Inspect any AS</h2>
        <p class="text-slate-500 text-base">Look up BGP ranking, routing topology, and RPKI validation status for any Autonomous System.</p>
      </div>
      <div class="flex gap-2 w-full max-w-sm">
        <div class="relative flex-1">
          <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-mono pointer-events-none">AS</span>
          <input
            type="text"
            bind:value={searchValue}
            on:keydown={handleKeyDown}
            placeholder="e.g. 13335"
            class="w-full pl-10 pr-3 py-3 border border-slate-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
          />
        </div>
        <button
          on:click={search}
          disabled={loading}
          class="px-6 py-3 bg-blue-600 text-white text-base font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
        >
          {loading ? 'Loading…' : 'Inspect'}
        </button>
      </div>
      {#if errorMsg}
        <p class="mt-3 text-sm text-red-600">{errorMsg}</p>
      {/if}
      <p class="mt-6 text-xs text-slate-400">Try AS13335 (Cloudflare), AS15169 (Google), AS7018 (AT&T)</p>
    </section>

  {:else}
    <!-- Results area -->
    <main class="flex-1 px-6 py-6">
      <div class="max-w-5xl mx-auto space-y-4">

        {#if errorMsg}
          <div class="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
            {errorMsg}
          </div>
        {/if}

        {#if loading}
          <div class="flex items-center justify-center py-24 text-slate-400 gap-3">
            <svg class="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            <span class="text-sm">Fetching data…</span>
          </div>

        {:else if !rankData && !radarData && !errorMsg}
          <div class="text-center py-24">
            <p class="text-slate-500 text-sm">No data found for AS{searchValue.trim().replace(/^as/i, '')}.</p>
            <p class="text-slate-400 text-xs mt-1">This ASN may not exist or is not in the CAIDA database.</p>
          </div>

        {:else}
          <!-- ASN identity bar -->
          <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span class="font-mono text-2xl font-bold text-slate-900">AS{rankData?.asn ?? searchValue.trim().replace(/^as/i, '')}</span>
            {#if rankData?.asnName}
              <span class="text-xl text-slate-600 font-light">{rankData.asnName}</span>
            {/if}
            {#if rankData?.country?.iso}
              <span class="ml-auto px-2 py-0.5 bg-slate-100 border border-slate-200 rounded-md text-xs font-mono text-slate-600">{rankData.country.iso}</span>
            {/if}
            {#if rankData?.rank}
              <span class="px-2 py-0.5 bg-blue-50 border border-blue-100 rounded-md text-xs font-semibold text-blue-700">Rank #{rankData.rank.toLocaleString()}</span>
            {/if}
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">

            <!-- AS Overview -->
            {#if rankData}
            <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-5">
              <h2 class="text-xs font-semibold text-slate-400 uppercase tracking-widest">Overview</h2>

              <dl class="space-y-2.5">
                <div class="flex justify-between items-baseline">
                  <dt class="text-sm text-slate-500">Organization</dt>
                  <dd class="text-sm text-slate-900 text-right font-medium max-w-[60%] truncate" title={rankData.organization?.orgId}>{rankData.organization?.orgId ?? '—'}</dd>
                </div>
                <div class="flex justify-between items-baseline">
                  <dt class="text-sm text-slate-500">Country</dt>
                  <dd class="text-sm font-mono font-semibold text-slate-900">{rankData.country.iso}</dd>
                </div>
              </dl>

              <!-- Routing Cone -->
              <div>
                <p class="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Routing Cone</p>
                <div class="grid grid-cols-3 gap-2">
                  <div class="bg-slate-50 rounded-lg p-3 text-center border border-slate-100">
                    <div class="text-xl font-bold text-slate-900 tabular-nums">{formatNum(rankData.cone.numberAsns)}</div>
                    <div class="text-xs text-slate-500 mt-0.5">ASes</div>
                  </div>
                  <div class="bg-slate-50 rounded-lg p-3 text-center border border-slate-100">
                    <div class="text-xl font-bold text-slate-900 tabular-nums">{formatNum(rankData.cone.numberPrefixes)}</div>
                    <div class="text-xs text-slate-500 mt-0.5">Prefixes</div>
                  </div>
                  <div class="bg-slate-50 rounded-lg p-3 text-center border border-slate-100">
                    <div class="text-xl font-bold text-slate-900 tabular-nums">{formatNum(rankData.cone.numberAddresses)}</div>
                    <div class="text-xs text-slate-500 mt-0.5">Addresses</div>
                  </div>
                </div>
              </div>

              <!-- BGP Connections -->
              <div>
                <p class="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">BGP Connections</p>
                <div class="grid grid-cols-4 gap-2">
                  {#each [['Customers', rankData.asnDegree.customer, 'text-slate-900'], ['Peers', rankData.asnDegree.peer, 'text-slate-900'], ['Providers', rankData.asnDegree.provider, 'text-slate-900'], ['Total', rankData.asnDegree.total, 'text-blue-600']] as [label, val, color]}
                    <div class="text-center">
                      <div class="text-lg font-bold tabular-nums {color}">{val.toLocaleString()}</div>
                      <div class="text-xs text-slate-500 mt-0.5">{label}</div>
                    </div>
                  {/each}
                </div>
              </div>
            </div>
            {/if}

            <!-- RPKI Validation -->
            {#if radarData}
            <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-5">
              <h2 class="text-xs font-semibold text-slate-400 uppercase tracking-widest">RPKI Route Validation</h2>

              <!-- Doughnut chart -->
              <div class="relative h-44 flex items-center justify-center">
                <canvas bind:this={chartCanvas}></canvas>
                <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
                  <span class="text-2xl font-bold text-emerald-600 tabular-nums">{validPct}%</span>
                  <span class="text-xs text-slate-500">valid</span>
                </div>
              </div>

              <!-- Legend with progress bars -->
              <div class="space-y-3">
                {#each [
                  { label: 'Valid',   count: radarData.routes_valid,   pct: validPct,   color: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50' },
                  { label: 'Unknown', count: radarData.routes_unknown, pct: unknownPct, color: 'bg-amber-400',   text: 'text-amber-700',   bg: 'bg-amber-50'   },
                  { label: 'Invalid', count: radarData.routes_invalid, pct: invalidPct, color: 'bg-red-500',     text: 'text-red-700',     bg: 'bg-red-50'     },
                ] as row}
                  <div>
                    <div class="flex items-center gap-2 mb-1">
                      <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold {row.text} {row.bg}">
                        <span class="w-1.5 h-1.5 rounded-full {row.color} inline-block"></span>
                        {row.label}
                      </span>
                      <span class="ml-auto text-sm font-mono text-slate-700">{row.count.toLocaleString()}</span>
                      <span class="text-xs text-slate-400 w-9 text-right tabular-nums">{row.pct}%</span>
                    </div>
                    <div class="w-full bg-slate-100 rounded-full h-1.5">
                      <div class="{row.color} h-1.5 rounded-full transition-all duration-500" style="width: {row.pct}%"></div>
                    </div>
                  </div>
                {/each}
              </div>

              <!-- Route counts -->
              <div class="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                <div class="text-center">
                  <div class="text-base font-bold font-mono text-slate-900 tabular-nums">{radarData.distinct_prefixes.toLocaleString()}</div>
                  <div class="text-xs text-slate-500">Distinct Prefixes</div>
                </div>
                <div class="text-center">
                  <div class="text-base font-bold font-mono text-slate-900 tabular-nums">{radarData.distinct_origins.toLocaleString()}</div>
                  <div class="text-xs text-slate-500">Distinct Origins</div>
                </div>
              </div>
            </div>
            {/if}

          </div>

          <!-- APNIC RPKI History -->
          <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-xs font-semibold text-slate-400 uppercase tracking-widest">RPKI History</h2>
              <a
                href="https://stats.labs.apnic.net/rpki/AS{rankData?.asn ?? searchValue.trim().replace(/^as/i, '')}"
                target="_blank"
                rel="noopener noreferrer"
                class="text-xs text-blue-600 hover:underline"
              >Open on APNIC ↗</a>
            </div>
            <iframe
              title="RPKI History from APNIC"
              src="https://stats.labs.apnic.net/rpki/AS{rankData?.asn ?? searchValue.trim().replace(/^as/i, '')}"
              width="100%"
              height="900px"
              sandbox="allow-scripts allow-same-origin"
              class="border-0 rounded-lg"
            ></iframe>
          </div>

        {/if}
      </div>
    </main>
  {/if}

  <footer class="border-t border-slate-200 bg-white px-6 py-4 text-center text-xs text-slate-400">
    Made by <a href="https://bgpkit.com" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">BGPKIT</a>
    · <a href="mailto:contact@bgpkit.com" class="text-blue-600 hover:underline">contact@bgpkit.com</a>
  </footer>

</div>
