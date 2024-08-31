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

<main class="flex justify-center items-center h-screen">
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
