<script lang="ts">
    import { goto } from '$app/navigation';

    let searchValue = '';

    function handleSearch() {
        if (searchValue) {
            goto(`/asn/${searchValue}`);
        }
    }

    function handleKeyPress(event: KeyboardEvent) {
        if (event.key === 'Enter') {
            handleSearch();
        }
    }
</script>

<main class="flex flex-col justify-center items-center h-screen">
    <h1 class="text-3xl font-bold mb-6">BGP Security Inspector</h1>
    <div class="flex gap-2">
        <input
            type="number"
            bind:value={searchValue}
            placeholder="Enter an AS number"
            min="0"
            on:keypress={handleKeyPress}
            class="p-2 text-base border rounded"
        />
        <button 
            on:click={handleSearch}
            class="px-4 py-2 text-base bg-blue-500 text-white rounded cursor-pointer hover:bg-blue-600"
        >
            Search
        </button>
    </div>
</main>

<footer class="fixed bottom-0 left-0 right-0 p-4 bg-gray-100 text-center text-sm">
    <p>Made by <a href="https://bgpkit.com" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">BGPKIT</a> team | Contact: <a href="mailto:contact@bgpkit.com" class="text-blue-600 hover:underline">contact@bgpkit.com</a></p>
</footer>
