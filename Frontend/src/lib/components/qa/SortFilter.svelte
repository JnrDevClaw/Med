<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let selected: 'upvotes' | 'oldest' | 'newest' = 'newest';

	const dispatch = createEventDispatcher();

	const sortOptions = [
		{ value: 'newest', label: 'Newest First' },
		{ value: 'upvotes', label: 'Most Upvoted' },
		{ value: 'oldest', label: 'Oldest First' }
	];

	function handleChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		dispatch('change', target.value);
	}
</script>

<div class="relative">
	<label for="sort-filter" class="sr-only">Sort questions</label>
	<select
		id="sort-filter"
		class="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
		value={selected}
		on:change={handleChange}
	>
		{#each sortOptions as option}
			<option value={option.value}>
				{option.label}
			</option>
		{/each}
	</select>
	
	<!-- Custom dropdown icon -->
	<div class="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
		<svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
		</svg>
	</div>
</div>