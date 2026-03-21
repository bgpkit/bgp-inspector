<script lang="ts">
  import { goto } from '$app/navigation';

  let searchValue = '';
  let errorMsg: string | null = null;

  function submit() {
    const trimmed = searchValue.trim().replace(/^as/i, '');
    const asn = parseInt(trimmed, 10);
    if (isNaN(asn) || asn < 1 || asn > 4294967295) {
      errorMsg = 'Please enter a valid AS number (1 – 4,294,967,295)';
      return;
    }
    errorMsg = null;
    goto(`/asn/${asn}`);
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter') submit();
  }
</script>

<div class="min-h-screen bg-slate-50 flex flex-col font-sans">

  <header class="bg-white border-b border-slate-200 px-6 py-4">
    <div class="max-w-5xl mx-auto flex items-center gap-3">
      <div class="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
        <svg class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.955 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
        </svg>
      </div>
      <div>
        <h1 class="text-base font-semibold text-slate-900 leading-tight">BGP Security Inspector</h1>
        <p class="text-xs text-slate-400">by <a href="https://bgpkit.com" target="_blank" rel="noopener noreferrer" class="hover:text-blue-600 transition-colors">BGPKIT</a></p>
      </div>
    </div>
  </header>

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
        on:click={submit}
        class="px-6 py-3 bg-blue-600 text-white text-base font-medium rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
      >Inspect</button>
    </div>
    {#if errorMsg}
      <p class="mt-3 text-sm text-red-600">{errorMsg}</p>
    {/if}
    <p class="mt-6 text-xs text-slate-400">Try AS13335 (Cloudflare), AS15169 (Google), AS7018 (AT&T)</p>
  </section>

  <footer class="border-t border-slate-200 bg-white px-6 py-4 text-center text-xs text-slate-400">
    Made by <a href="https://bgpkit.com" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">BGPKIT</a>
    · <a href="mailto:contact@bgpkit.com" class="text-blue-600 hover:underline">contact@bgpkit.com</a>
  </footer>

</div>
