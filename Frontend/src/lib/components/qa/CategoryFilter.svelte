<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { QuestionCategory } from '$types';

	export let categories: QuestionCategory[] = [];
	export let selected: string = '';

	const dispatch = createEventDispatcher();

	function handleChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		dispatch('change', target.value);
	}
</script>

<div class="relative">
	<label for="category-filter" class="sr-only">Filter by category</label>
	<select
		id="category-filter"
		class="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
		value={selected}
		on:change={handleChange}
	>
		<option value="">All Categories</option>
		{#each categories as category}
			<option value={category.name}>
				{category.name} ({category.count})
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