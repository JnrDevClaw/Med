<script lang="ts">
	import { icons } from './icons.ts';
	
	interface Props {
		name: keyof typeof icons;
		class?: string;
		size?: number;
	}
	
	let { name, class: className = '', size = 24 }: Props = $props();
	
	$: iconPath = icons[name] || '';
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
