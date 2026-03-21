<script lang="ts">
  import { tick, onMount, onDestroy } from 'svelte';
  import { goto, afterNavigate } from '$app/navigation';
  import { page } from '$app/stores';
  import type { ASNRecord } from '../../../types/ASNData';
  import type { RadarData } from '../../../types/RadarData';

  // Chart.js loaded dynamically (browser-only — avoids SSR issues)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let ChartClass: any = null;

  type RadarStats = RadarData['result']['stats'];

  type RPKIWindow = { seen: number; filtered: number; filter_rate: number };
  type RPKIRecord = {
    date: string;
    as: string;
    '7': RPKIWindow;
    '14': RPKIWindow;
    '28': RPKIWindow;
    '112': RPKIWindow;
  };

  const WINDOWS = ['1M', '3M', '6M', '1Y', 'All'] as const;
  type TimeWindow = typeof WINDOWS[number];
  const WINDOW_DAYS: Record<TimeWindow, number> = { '1M': 30, '3M': 90, '6M': 180, '1Y': 365, 'All': Infinity };

  let searchValue = '';
  let loading = false;
  let errorMsg: string | null = null;
  let rankData: ASNRecord | null = null;
  let radarData: RadarStats | null = null;

  // Donut chart
  let chartCanvas: HTMLCanvasElement | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let chart: any = null;

  // History chart
  let rpkiHistory: RPKIRecord[] = [];
  let historyLoading = false;
  let historyWindow: TimeWindow = '1Y';
  let historyCanvas: HTMLCanvasElement | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let historyChart: any = null;

  onMount(async () => {
    const { Chart, DoughnutController, ArcElement, LineController, LineElement,
            PointElement, CategoryScale, LinearScale, Filler, Tooltip, Legend } =
      await import('chart.js');
    Chart.register(DoughnutController, ArcElement, LineController, LineElement,
                   PointElement, CategoryScale, LinearScale, Filler, Tooltip, Legend);
    ChartClass = Chart;
    loadAsn($page.params.number);
  });

  // Re-fetch when navigating between /asn/X and /asn/Y client-side
  afterNavigate(() => {
    if (ChartClass) loadAsn($page.params.number);
  });

  onDestroy(() => {
    if (chart) chart.destroy();
    if (historyChart) historyChart.destroy();
  });

  function formatNum(n: number): string {
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toLocaleString();
  }

  function getFilteredHistory(): RPKIRecord[] {
    const days = WINDOW_DAYS[historyWindow];
    return days === Infinity ? rpkiHistory : rpkiHistory.slice(-days);
  }

  async function loadAsn(number: string) {
    const asn = parseInt(number, 10);
    searchValue = String(asn);

    loading = true;
    errorMsg = null;
    rankData = null;
    radarData = null;
    rpkiHistory = [];
    if (chart) { chart.destroy(); chart = null; }
    if (historyChart) { historyChart.destroy(); historyChart = null; }

    try {
      const res = await fetch(`/api/asn/${asn}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(body.message || `Request failed (HTTP ${res.status})`);
      }
      const data = await res.json() as { rankData: ASNRecord | null; radarData: RadarData['result']['stats'] | null };
      rankData = data.rankData;
      radarData = data.radarData;
    } catch (e) {
      errorMsg = e instanceof Error ? e.message : 'Failed to fetch data';
    } finally {
      loading = false;
    }

    await tick();
    initDonutChart();
    fetchHistory(asn);
  }

  function handleSearch() {
    const trimmed = searchValue.trim().replace(/^as/i, '');
    const asn = parseInt(trimmed, 10);
    if (isNaN(asn) || asn < 1 || asn > 4294967295) {
      errorMsg = 'Please enter a valid AS number (1 – 4,294,967,295)';
      return;
    }
    errorMsg = null;
    goto(`/asn/${asn}`);
  }

  async function fetchHistory(asn: number) {
    historyLoading = true;
    try {
      const res = await fetch(`/api/rpki-history/${asn}`);
      if (res.ok) {
        rpkiHistory = await res.json();
        await tick();
        initHistoryChart();
      }
    } catch {
      // history is supplementary — fail silently
    } finally {
      historyLoading = false;
    }
  }

  function initDonutChart() {
    if (chart) { chart.destroy(); chart = null; }
    if (!radarData || !chartCanvas || !ChartClass) return;
    const total = radarData.routes_valid + radarData.routes_unknown + radarData.routes_invalid;
    chart = new ChartClass(chartCanvas, {
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
          legend: { display: false },
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

  function initHistoryChart() {
    if (historyChart) { historyChart.destroy(); historyChart = null; }
    if (!rpkiHistory.length || !historyCanvas || !ChartClass) return;
    const filtered = getFilteredHistory();
    historyChart = new ChartClass(historyCanvas, {
      type: 'line',
      data: {
        labels: filtered.map(d => d.date),
        datasets: [
          {
            label: '7-day',
            data: filtered.map(d => d['7'].seen > 0 ? d['7'].filter_rate : null),
            borderColor: '#93c5fd',
            backgroundColor: 'transparent',
            borderWidth: 1.5,
            pointRadius: 0,
            tension: 0.3,
            spanGaps: false,
            order: 3,
          },
          {
            label: '28-day',
            data: filtered.map(d => d['28'].seen > 0 ? d['28'].filter_rate : null),
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59,130,246,0.08)',
            fill: true,
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.3,
            spanGaps: false,
            order: 2,
          },
          {
            label: '112-day',
            data: filtered.map(d => d['112'].seen > 0 ? d['112'].filter_rate : null),
            borderColor: '#1e40af',
            backgroundColor: 'transparent',
            borderWidth: 2.5,
            pointRadius: 0,
            tension: 0.3,
            order: 1,
          },
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: {
            ticks: {
              maxTicksLimit: 10,
              maxRotation: 0,
              color: '#94a3b8',
              font: { size: 11 },
              callback(_, i) {
                const d = filtered[i]?.date ?? '';
                return d.slice(0, 7);
              }
            },
            grid: { display: false },
            border: { color: '#e2e8f0' },
          },
          y: {
            min: 0,
            max: 100,
            ticks: {
              stepSize: 25,
              color: '#94a3b8',
              font: { size: 11 },
              callback: (v) => `${v}%`,
            },
            grid: { color: '#f1f5f9' },
            border: { display: false },
          }
        },
        plugins: {
          legend: {
            position: 'top',
            align: 'end',
            labels: { boxWidth: 20, boxHeight: 2, padding: 16, color: '#64748b', font: { size: 12 } }
          },
          tooltip: {
            backgroundColor: '#1e293b',
            titleColor: '#94a3b8',
            bodyColor: '#f1f5f9',
            padding: 10,
            callbacks: {
              title: (items) => items[0]?.label ?? '',
              label: (ctx) => `  ${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}% filtered`
            }
          }
        }
      }
    });
  }

  function setWindow(w: TimeWindow) {
    historyWindow = w;
    if (!historyChart) return;
    const filtered = getFilteredHistory();
    historyChart.data.labels = filtered.map(d => d.date);
    historyChart.data.datasets[0].data = filtered.map(d => d['7'].seen > 0 ? d['7'].filter_rate : null);
    historyChart.data.datasets[1].data = filtered.map(d => d['28'].seen > 0 ? d['28'].filter_rate : null);
    historyChart.data.datasets[2].data = filtered.map(d => d['112'].seen > 0 ? d['112'].filter_rate : null);
    historyChart.update('none');
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter') handleSearch();
  }

  $: rpkiTotal = radarData
    ? radarData.routes_valid + radarData.routes_unknown + radarData.routes_invalid
    : 0;
  $: validPct   = rpkiTotal > 0 ? Math.round((radarData!.routes_valid   / rpkiTotal) * 100) : 0;
  $: unknownPct = rpkiTotal > 0 ? Math.round((radarData!.routes_unknown / rpkiTotal) * 100) : 0;
  $: invalidPct = rpkiTotal > 0 ? Math.round((radarData!.routes_invalid / rpkiTotal) * 100) : 0;

  $: currentAsn = rankData?.asn ?? $page.params.number;

  $: latestRecord = rpkiHistory.length ? rpkiHistory[rpkiHistory.length - 1] : null;

  $: rovVerdict = (() => {
    if (historyLoading && !rpkiHistory.length) return 'loading';
    const rate = latestRecord?.['7']?.filter_rate ?? null;
    if (rate === null) return 'unknown';
    if (rate >= 80) return 'yes';
    if (rate >= 40) return 'partial';
    return 'no';
  })();
</script>

<svelte:head>
  <title>AS{$page.params.number} — BGP Security Inspector</title>
</svelte:head>

<div class="min-h-screen bg-slate-50 flex flex-col font-sans">

  <!-- Header -->
  <header class="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-10">
    <div class="max-w-5xl mx-auto flex items-center gap-3">
      <a href="/" class="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0 hover:bg-blue-700 transition-colors">
        <svg class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.955 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
        </svg>
      </a>
      <div class="flex-1 min-w-0">
        <h1 class="text-base font-semibold text-slate-900 leading-tight">BGP Security Inspector</h1>
        <p class="text-xs text-slate-400">by <a href="https://bgpkit.com" target="_blank" rel="noopener noreferrer" class="hover:text-blue-600 transition-colors">BGPKIT</a></p>
      </div>
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
          on:click={handleSearch}
          disabled={loading}
          class="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >{loading ? '…' : 'Go'}</button>
      </div>
    </div>
  </header>

  <main class="flex-1 px-6 py-6">
    <div class="max-w-5xl mx-auto space-y-4">

      {#if errorMsg}
        <div class="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{errorMsg}</div>
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
          <p class="text-slate-500 text-sm">No data found for AS{currentAsn}.</p>
          <p class="text-slate-400 text-xs mt-1">This ASN may not exist or is not in the CAIDA database.</p>
        </div>

      {:else}
        <!-- ASN identity bar -->
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span class="font-mono text-2xl font-bold text-slate-900">AS{currentAsn}</span>
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

        <!-- RPKI ROV Verdict banner -->
        <div class="rounded-xl border shadow-sm p-4 flex flex-wrap items-center gap-4
          {rovVerdict === 'yes'     ? 'bg-emerald-50 border-emerald-200' :
           rovVerdict === 'partial' ? 'bg-amber-50 border-amber-200' :
           rovVerdict === 'no'      ? 'bg-red-50 border-red-200' :
                                      'bg-slate-50 border-slate-200'}">
          <div class="flex items-center gap-3">
            {#if rovVerdict === 'yes'}
              <div class="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                <svg class="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.955 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
              </div>
              <div>
                <div class="font-bold text-emerald-800 text-base leading-tight"><abbr title="Route Origin Validation: measures what fraction of the Internet observes this AS filtering RPKI-invalid routes" class="no-underline cursor-help">RPKI ROV</abbr> Enforced</div>
                <div class="text-xs text-emerald-700 mt-0.5">≥80% of measurement locations observe RPKI-invalid route filtering</div>
              </div>
            {:else if rovVerdict === 'partial'}
              <div class="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <svg class="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <div>
                <div class="font-bold text-amber-800 text-base leading-tight">Partial <abbr title="Route Origin Validation: measures what fraction of the Internet observes this AS filtering RPKI-invalid routes" class="no-underline cursor-help">RPKI ROV</abbr></div>
                <div class="text-xs text-amber-700 mt-0.5">40–79% of measurement locations observe filtering — not consistent across all measurement locations</div>
              </div>
            {:else if rovVerdict === 'no'}
              <div class="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <svg class="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div>
                <div class="font-bold text-red-800 text-base leading-tight">No <abbr title="Route Origin Validation: measures what fraction of the Internet observes this AS filtering RPKI-invalid routes" class="no-underline cursor-help">RPKI ROV</abbr></div>
                <div class="text-xs text-red-700 mt-0.5">&lt;40% of measurement locations observe filtering — RPKI-invalid routes are accepted</div>
              </div>
            {:else if rovVerdict === 'loading'}
              <div class="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                <svg class="animate-spin w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
              </div>
              <div>
                <div class="font-bold text-slate-600 text-base leading-tight">Checking RPKI ROV status…</div>
                <div class="text-xs text-slate-500 mt-0.5">Fetching APNIC measurement data</div>
              </div>
            {:else}
              <div class="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                <svg class="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
                </svg>
              </div>
              <div>
                <div class="font-bold text-slate-600 text-base leading-tight">RPKI ROV Status Unknown</div>
                <div class="text-xs text-slate-500 mt-0.5">No APNIC measurement data available for this AS</div>
              </div>
            {/if}
          </div>
          {#if latestRecord}
            <div class="ml-auto flex items-center gap-6">
              <div class="text-center">
                <div class="text-2xl font-bold tabular-nums
                  {rovVerdict === 'yes' ? 'text-emerald-700' : rovVerdict === 'partial' ? 'text-amber-700' : 'text-red-700'}">
                  {latestRecord['7'].filter_rate.toFixed(1)}%
                </div>
                <div class="text-xs text-slate-500">7-day rate</div>
              </div>
              <div class="text-center hidden sm:block">
                <div class="text-2xl font-bold text-slate-700 tabular-nums">{latestRecord['28'].filter_rate.toFixed(1)}%</div>
                <div class="text-xs text-slate-500">28-day rate</div>
              </div>
              <div class="text-center hidden sm:block">
                <div class="text-xs font-semibold uppercase tracking-wider px-3 py-1.5 rounded-full
                  {rovVerdict === 'yes'     ? 'bg-emerald-100 text-emerald-800' :
                   rovVerdict === 'partial' ? 'bg-amber-100 text-amber-800' :
                                             'bg-red-100 text-red-800'}">
                  {rovVerdict === 'yes' ? 'YES' : rovVerdict === 'partial' ? 'PARTIAL' : 'NO'}
                </div>
                <div class="text-xs text-slate-500 mt-1">verdict</div>
              </div>
            </div>
          {/if}
        </div>

        <!-- Top row: Overview + RPKI snapshot -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">

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
            <div>
              <p class="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Routing Cone</p>
              <div class="grid grid-cols-3 gap-2">
                {#each [
                  { label: 'ASes',      n: rankData.cone.numberAsns      },
                  { label: 'Prefixes',  n: rankData.cone.numberPrefixes  },
                  { label: 'Addresses', n: rankData.cone.numberAddresses },
                ] as item}
                  <div class="bg-slate-50 rounded-lg p-3 text-center border border-slate-100">
                    <div class="text-xl font-bold text-slate-900 tabular-nums">{formatNum(item.n)}</div>
                    <div class="text-xs text-slate-500 mt-0.5">{item.label}</div>
                  </div>
                {/each}
              </div>
            </div>
            <div>
              <p class="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">BGP Connections</p>
              <div class="grid grid-cols-4 gap-2">
                {#each [
                  { label: 'Customers', n: rankData.asnDegree.customer, color: 'text-slate-900' },
                  { label: 'Peers',     n: rankData.asnDegree.peer,     color: 'text-slate-900' },
                  { label: 'Providers', n: rankData.asnDegree.provider, color: 'text-slate-900' },
                  { label: 'Total',     n: rankData.asnDegree.total,    color: 'text-blue-600'  },
                ] as item}
                  <div class="text-center">
                    <div class="text-lg font-bold tabular-nums {item.color}">{item.n.toLocaleString()}</div>
                    <div class="text-xs text-slate-500 mt-0.5">{item.label}</div>
                  </div>
                {/each}
              </div>
            </div>
          </div>
          {/if}

          {#if radarData}
          <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-5">
            <h2 class="text-xs font-semibold text-slate-400 uppercase tracking-widest">RPKI Route Validation</h2>
            <div class="relative h-44 flex items-center justify-center">
              <canvas bind:this={chartCanvas}></canvas>
              <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
                <span class="text-2xl font-bold text-emerald-600 tabular-nums">{validPct}%</span>
                <span class="text-xs text-slate-500">valid</span>
              </div>
            </div>
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

        <!-- RPKI ROV Adoption History -->
        <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div class="flex flex-wrap items-start justify-between gap-3 mb-5">
            <div>
              <h2 class="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1"><abbr title="Route Origin Validation: measures what fraction of the Internet observes this AS filtering RPKI-invalid routes" class="no-underline cursor-help">RPKI ROV</abbr> Filtering Rate</h2>
              <p class="text-xs text-slate-400">% of Internet measurement locations enforcing RPKI for routes from AS{currentAsn}</p>
            </div>
            <div class="flex items-center gap-1">
              {#if historyLoading}
                <span class="text-xs text-slate-400 mr-2">Loading history…</span>
              {/if}
              {#if latestRecord}
                <span class="text-xs text-slate-400 mr-3">
                  Latest (7d): <span class="font-semibold text-blue-600">{latestRecord['7'].filter_rate.toFixed(1)}%</span>
                </span>
              {/if}
              <div class="flex rounded-lg border border-slate-200 overflow-hidden">
                {#each WINDOWS as w}
                  <button
                    on:click={() => setWindow(w)}
                    class="px-3 py-1.5 text-xs font-medium transition-colors
                      {historyWindow === w
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-600 bg-white hover:bg-slate-50'}"
                  >{w}</button>
                {/each}
              </div>
            </div>
          </div>

          {#if historyLoading && !rpkiHistory.length}
            <div class="flex items-center justify-center h-64 text-slate-400 gap-2">
              <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              <span class="text-sm">Loading RPKI ROV history…</span>
            </div>
          {:else if rpkiHistory.length}
            <div class="h-72">
              <canvas bind:this={historyCanvas}></canvas>
            </div>
            <p class="mt-3 text-xs text-slate-400 text-right">
              Data from <a href="https://stats.labs.apnic.net/rpki/AS{currentAsn}" target="_blank" rel="noopener noreferrer" class="hover:underline text-blue-500">APNIC I-ROV measurement</a>
              · {rpkiHistory.length.toLocaleString()} daily records since {rpkiHistory[0]?.date ?? ''}
            </p>
          {:else if !historyLoading}
            <div class="flex items-center justify-center h-64 text-slate-400 text-sm">
              No RPKI ROV history available for this AS.
            </div>
          {/if}
        </div>

      {/if}
    </div>
  </main>

  <footer class="border-t border-slate-200 bg-white px-6 py-4 text-center text-xs text-slate-400">
    Made by <a href="https://bgpkit.com" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">BGPKIT</a>
    · <a href="mailto:contact@bgpkit.com" class="text-blue-600 hover:underline">contact@bgpkit.com</a>
  </footer>

</div>
