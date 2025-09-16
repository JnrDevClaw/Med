<script>
	import { icons } from './icons.ts';

	// Accept flexible icon names (kebab or camelCase) to match usages across the codebase
	export let name = '';
	// allow parent to pass class/style/etc via rest props
	export let size = null;

	// helper to convert kebab-case to camelCase keys used in icons map
	function toCamelCase(s) {
		return s.replace(/-([a-z])/g, g => g[1].toUpperCase());
	}

	// reactive iconPath: recompute when `name` changes
	let iconPath = '';
	$: {
		const key = name in icons ? name : toCamelCase(name || '');
		iconPath = icons[key] || '';
	}
</script>

<svg
	{...$$restProps}
	width="1em"
	height="1em"
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="2"
	stroke-linecap="round"
	stroke-linejoin="round"
	style={size ? `font-size: ${size}px` : undefined}
>
	{#if iconPath}
		{@html `<path d="${iconPath}"/>`}
	{/if}
</svg>
