<script>
	import '../app.css';
	import '$lib/theme.css';
	import favicon from '$lib/assets/favicon.svg';
	import ThemeToggle from '../components/ThemeToggle.svelte';
	import { onMount, onDestroy } from 'svelte';
	import { backendPing } from '../utils/backendPing.js';
    
	export let children;

	// Use the dedicated backend ping service
	onMount(async () => {
		console.log('🚀 App starting - initializing backend ping service');
		
		// The backendPing service auto-starts when imported
		// Test the connection immediately
		await backendPing.testConnection();
	});

	// Cleanup on component destroy
	onDestroy(() => {
		backendPing.stopPinging();
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<ThemeToggle />

{@render children?.()}
