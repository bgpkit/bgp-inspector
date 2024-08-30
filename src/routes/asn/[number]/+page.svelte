<script lang="ts">
    import { page } from '$app/stores';
    import type { PageData } from './$types';

    export let data: PageData;
    const { rankData, radarData } = data;
    console.log(radarData);
</script>

<main class="min-h-screen bg-gray-100 p-4">
    <div class="container mx-auto">
        <h1 class="text-3xl font-bold mb-4 text-blue-600 text-center">ASN: {$page.params.number}</h1>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <div class="bg-white p-6 rounded-lg shadow-md">
                {#if rankData}
                    <h2 class="text-xl font-semibold mb-2 text-gray-800">Rank Information</h2>
                    <p class="text-gray-700"><span class="font-medium">Rank:</span> {rankData.rank}</p>
                    <p class="text-gray-700"><span class="font-medium">Name:</span> {rankData.asnName}</p>
                    <p class="text-gray-700"><span class="font-medium">Country:</span> {rankData.country.iso}</p>
                    <p class="text-gray-700"><span class="font-medium">Total ASN Degree:</span> {rankData.asnDegree.total}</p>
                {:else}
                    <p class="text-gray-500 italic">No rank data available.</p>
                {/if}
            </div>

            <div class="bg-white p-6 rounded-lg shadow-md">
                {#if radarData}
                    <h2 class="text-xl font-semibold mb-2 text-gray-800">Radar Information</h2>
                    <p class="text-gray-700"><span class="font-medium">Total valid:</span> {radarData.routes_valid}</p>
                    <p class="text-gray-700"><span class="font-medium">Total unknown:</span> {radarData.routes_unknown}</p>
                    <p class="text-gray-700"><span class="font-medium">Total invalid:</span> {radarData.routes_invalid}</p>
                {:else}
                    <p class="text-gray-500 italic">No radar data available.</p>
                {/if}
            </div>
        </div>

        <div class="bg-white p-6 rounded-lg shadow-md">
            <h2 class="text-xl font-semibold mb-2 text-gray-800">RPKI Stats</h2>
            <iframe title="RPKI Stats" src="https://stats.labs.apnic.net/rpki/AS{$page.params.number}" width="100%" height="1000px" class="border-0 rounded-md"></iframe>
        </div>
    </div>
</main>

