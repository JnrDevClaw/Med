<script lang="ts">
	// Render the dashboard at root — reuse the existing dashboard page component
	import Dashboard from './dashboard/+page.svelte';
	export let data: any;
</script>

<svelte:component this={Dashboard} {data} />
