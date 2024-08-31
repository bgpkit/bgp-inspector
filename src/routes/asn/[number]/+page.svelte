<script lang="ts">
    import { page } from '$app/stores';
    import type { PageData } from './$types';
    import { Chart, PieController, ArcElement, Tooltip, Legend } from 'chart.js';
    import { onMount } from 'svelte';

    Chart.register(PieController, ArcElement, Tooltip, Legend);

    export let data: PageData;
    const { rankData, radarData } = data;

    onMount(() => {
        if (radarData) {
            const ctx = document.getElementById('rpkiChart') as HTMLCanvasElement;
            new Chart(ctx, {
                type: 'pie',
                data: {
                    labels: ['Valid', 'Unknown', 'Invalid'],
                    datasets: [{
                        data: [radarData.routes_valid, radarData.routes_unknown, radarData.routes_invalid],
                        backgroundColor: ['#4CAF50', '#FFC107', '#F44336'],
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'right',
                        },
                        title: {
                            display: true,
                            text: 'RPKI Route Validation'
                        }
                    }
                }
            });
        }
    });
</script>

<main class="min-h-screen bg-gray-100 p-4">
    <div class="container mx-auto">
        <h1 class="text-3xl font-bold mb-4 text-blue-600 text-center">ASN: {$page.params.number}</h1>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <div class="bg-white p-6 rounded-lg shadow-md">
                {#if rankData}
                    <h2 class="text-xl font-semibold mb-2 text-gray-800">AS Rank</h2>
                    <p class="text-gray-700"><span class="font-medium">Rank:</span> {rankData.rank}</p>
                    <p class="text-gray-700"><span class="font-medium">Name:</span> {rankData.asnName}</p>
                    <p class="text-gray-700"><span class="font-medium">Country:</span> {rankData.country.iso}</p>
                    <p class="text-gray-700"><span class="font-medium">Cone Size:</span> {rankData.cone.numberAsns}</p>
                    
                    <h3 class="text-lg font-semibold mt-4 mb-2 text-gray-800"> Connections </h3>
                    <table class="w-full border-collapse border border-gray-300">
                        <thead>
                            <tr class="bg-gray-100">
                                <th class="border border-gray-300 p-2">Type</th>
                                <th class="border border-gray-300 p-2">Count</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td class="border border-gray-300 p-2">Customer</td>
                                <td class="border border-gray-300 p-2">{rankData.asnDegree.customer}</td>
                            </tr>
                            <tr>
                                <td class="border border-gray-300 p-2">Peer</td>
                                <td class="border border-gray-300 p-2">{rankData.asnDegree.peer}</td>
                            </tr>
                            <tr>
                                <td class="border border-gray-300 p-2">Provider</td>
                                <td class="border border-gray-300 p-2">{rankData.asnDegree.provider}</td>
                            </tr>
                            <tr class="border-t-2 border-gray-400">
                                <td class="border border-gray-300 p-2 font-semibold">Total</td>
                                <td class="border border-gray-300 p-2 font-semibold">{rankData.asnDegree.total}</td>
                            </tr>
                        </tbody>
                    </table>
                {:else}
                    <p class="text-gray-500 italic">No rank data available.</p>
                {/if}
            </div>

            <div class="bg-white p-6 rounded-lg shadow-md">
                {#if radarData}
                    <h2 class="text-xl font-semibold mb-2 text-gray-800">RPKI Validation</h2>
                    <table class="w-full mb-4 border-collapse border border-gray-300">
                        <thead>
                            <tr class="bg-gray-100">
                                <th class="border border-gray-300 p-2">Status</th>
                                <th class="border border-gray-300 p-2">Count</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td class="border border-gray-300 p-2">Valid</td>
                                <td class="border border-gray-300 p-2">{radarData.routes_valid}</td>
                            </tr>
                            <tr>
                                <td class="border border-gray-300 p-2">Unknown</td>
                                <td class="border border-gray-300 p-2">{radarData.routes_unknown}</td>
                            </tr>
                            <tr>
                                <td class="border border-gray-300 p-2">Invalid</td>
                                <td class="border border-gray-300 p-2">{radarData.routes_invalid}</td>
                            </tr>
                        </tbody>
                    </table>
                    <div class="h-64"> <!-- Add this wrapper div with a fixed height -->
                        <canvas id="rpkiChart"></canvas>
                    </div>
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

