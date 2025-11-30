<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let currentPage: number = 1;
	export let totalPages: number = 1;
	export let hasNext: boolean = false;

	const dispatch = createEventDispatcher();

	function goToPage(page: number) {
		if (page >= 1 && page <= totalPages && page !== currentPage) {
			dispatch('pageChange', page);
		}
	}

	function goToPrevious() {
		if (currentPage > 1) {
			goToPage(currentPage - 1);
		}
	}

	function goToNext() {
		if (hasNext && currentPage < totalPages) {
			goToPage(currentPage + 1);
		}
	}

	// Generate page numbers to show
	$: pageNumbers = (() => {
		const pages = [];
		const maxVisible = 7;
		
		if (totalPages <= maxVisible) {
			// Show all pages if total is small
			for (let i = 1; i <= totalPages; i++) {
				pages.push(i);
			}
		} else {
			// Show first page
			pages.push(1);
			
			// Calculate range around current page
			let start = Math.max(2, currentPage - 2);
			let end = Math.min(totalPages - 1, currentPage + 2);
			
			// Add ellipsis if needed
			if (start > 2) {
				pages.push('...');
			}
			
			// Add pages around current
			for (let i = start; i <= end; i++) {
				if (i !== 1 && i !== totalPages) {
					pages.push(i);
				}
			}
			
			// Add ellipsis if needed
			if (end < totalPages - 1) {
				pages.push('...');
			}
			
			// Show last page
			if (totalPages > 1) {
				pages.push(totalPages);
			}
		}
		
		return pages;
	})();
</script>

{#if totalPages > 1}
	<nav class="flex items-center justify-between border-t border-gray-200 dark:border-gray-700 px-4 py-3 sm:px-6" aria-label="Pagination">
		<div class="hidden sm:block">
			<p class="text-sm text-gray-700 dark:text-gray-300">
				Showing page <span class="font-medium">{currentPage}</span> of <span class="font-medium">{totalPages}</span>
			</p>
		</div>
		
		<div class="flex-1 flex justify-between sm:justify-end">
			<!-- Previous Button -->
			<button
				type="button"
				class="relative inline-flex items-center px-4 py-2 text-sm font-medium rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
				disabled={currentPage <= 1}
				on:click={goToPrevious}
			>
				<svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
				</svg>
				Previous
			</button>

			<!-- Page Numbers (Desktop) -->
			<div class="hidden md:flex space-x-1 mx-4">
				{#each pageNumbers as page}
					{#if page === '...'}
						<span class="relative inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300">
							...
						</span>
					{:else}
						<button
							type="button"
							class="relative inline-flex items-center px-4 py-2 text-sm font-medium rounded-md border focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors
								{page === currentPage 
									? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-900 dark:text-blue-200 dark:border-blue-400' 
									: 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700'
								}"
							on:click={() => goToPage(page)}
						>
							{page}
						</button>
					{/if}
				{/each}
			</div>

			<!-- Current Page (Mobile) -->
			<div class="md:hidden flex items-center mx-4">
				<span class="text-sm text-gray-700 dark:text-gray-300">
					{currentPage} / {totalPages}
				</span>
			</div>

			<!-- Next Button -->
			<button
				type="button"
				class="relative inline-flex items-center px-4 py-2 text-sm font-medium rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
				disabled={!hasNext || currentPage >= totalPages}
				on:click={goToNext}
			>
				Next
				<svg class="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
				</svg>
			</button>
		</div>
	</nav>
{/if}