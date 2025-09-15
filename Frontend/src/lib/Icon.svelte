<script lang="ts">
	import { icons } from './icons.ts';
	import { onMount } from 'svelte';

	export interface Props {
		name: keyof typeof icons;
		class?: string;
		size?: number;
	}

	export let name: keyof typeof icons;
	export let className: string = '';
	export let size: number = 24;

	// compute icon path without using legacy `$:` reactive rune
	let iconPath = '';
	onMount(() => {
		iconPath = icons[name] || '';
	});
</script>

<svg
	class={className}
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="2"
	stroke-linecap="round"
	stroke-linejoin="round"
>
	{#if iconPath}
		{@html `<path d="${iconPath}"/>`}
	{/if}
</svg>
