<script>
	import '../app.css';
	import '$lib/theme.css';
	import favicon from '$lib/assets/favicon.svg';
	import ThemeToggle from '../components/ThemeToggle.svelte';
    
	export let children;
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<ThemeToggle />

{@render children?.()}
