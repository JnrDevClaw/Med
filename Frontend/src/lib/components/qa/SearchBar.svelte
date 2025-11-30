<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let value: string = '';
	export let placeholder: string = 'Search...';

	const dispatch = createEventDispatcher();

	let inputElement: HTMLInputElement;
	let searchTimeout: NodeJS.Timeout;

	function handleInput(event: Event) {
		const target = event.target as HTMLInputElement;
		value = target.value;
		
		// Debounce search to avoid too many API calls
		clearTimeout(searchTimeout);
		searchTimeout = setTimeout(() => {
			dispatch('search', value);
		}, 300);
	}

	function handleSubmit(event: Event) {
		event.preventDefault();
		clearTimeout(searchTimeout);
		dispatch('search', value);
	}

	function clearSearch() {
		value = '';
		dispatch('search', '');
		inputElement.focus();
	}
</script>

<form on:submit={handleSubmit} class="relative">
	<div class="relative">
		<div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
			<svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
			</svg>
		</div>
		
		<input
			bind:this={inputElement}
			type="text"
			{placeholder}
			{value}
			on:input={handleInput}
			class="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
		/>
		
		{#if value}
			<div class="absolute inset-y-0 right-0 pr-3 flex items-center">
				<button
					type="button"
					class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none focus:text-gray-600 dark:focus:text-gray-300"
					on:click={clearSearch}
					aria-label="Clear search"
				>
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>
		{/if}
	</div>
</form>