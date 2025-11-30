<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let upvotes: number = 0;
	export let downvotes: number = 0;
	export let userVote: 'upvote' | 'downvote' | null = null;
	export let loading: boolean = false;
	export let size: 'sm' | 'md' | 'lg' = 'md';

	const dispatch = createEventDispatcher();

	function handleUpvote() {
		if (loading) return;
		dispatch('vote', 'upvote');
	}

	function handleDownvote() {
		if (loading) return;
		dispatch('vote', 'downvote');
	}

	$: netVotes = upvotes - downvotes;
	$: sizeClasses = {
		sm: 'w-6 h-6 text-xs',
		md: 'w-8 h-8 text-sm',
		lg: 'w-10 h-10 text-base'
	};
	$: iconSizeClasses = {
		sm: 'w-3 h-3',
		md: 'w-4 h-4',
		lg: 'w-5 h-5'
	};
</script>

<div class="flex flex-col items-center space-y-1">
	<!-- Upvote Button -->
	<button
		type="button"
		class="flex items-center justify-center {sizeClasses[size]} rounded-full border-2 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed
			{userVote === 'upvote' 
				? 'border-green-500 bg-green-500 text-white hover:bg-green-600 hover:border-green-600' 
				: 'border-gray-300 text-gray-600 hover:border-green-500 hover:text-green-500 dark:border-gray-600 dark:text-gray-400 dark:hover:border-green-400 dark:hover:text-green-400'
			}"
		disabled={loading}
		on:click={handleUpvote}
		aria-label="Upvote"
	>
		{#if loading && userVote === 'upvote'}
			<svg class="{iconSizeClasses[size]} animate-spin" fill="none" viewBox="0 0 24 24">
				<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
				<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
			</svg>
		{:else}
			<svg class="{iconSizeClasses[size]}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
			</svg>
		{/if}
	</button>

	<!-- Vote Count -->
	<div class="flex flex-col items-center">
		<span class="font-semibold text-gray-900 dark:text-white {size === 'sm' ? 'text-sm' : size === 'lg' ? 'text-lg' : 'text-base'}">
			{netVotes > 0 ? '+' : ''}{netVotes}
		</span>
		{#if size !== 'sm'}
			<span class="text-xs text-gray-500 dark:text-gray-400">
				{upvotes + downvotes} votes
			</span>
		{/if}
	</div>

	<!-- Downvote Button -->
	<button
		type="button"
		class="flex items-center justify-center {sizeClasses[size]} rounded-full border-2 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed
			{userVote === 'downvote' 
				? 'border-red-500 bg-red-500 text-white hover:bg-red-600 hover:border-red-600' 
				: 'border-gray-300 text-gray-600 hover:border-red-500 hover:text-red-500 dark:border-gray-600 dark:text-gray-400 dark:hover:border-red-400 dark:hover:text-red-400'
			}"
		disabled={loading}
		on:click={handleDownvote}
		aria-label="Downvote"
	>
		{#if loading && userVote === 'downvote'}
			<svg class="{iconSizeClasses[size]} animate-spin" fill="none" viewBox="0 0 24 24">
				<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
				<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
			</svg>
		{:else}
			<svg class="{iconSizeClasses[size]}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
			</svg>
		{/if}
	</button>
</div>