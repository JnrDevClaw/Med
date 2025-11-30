<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let value: string = '';
	export let placeholder: string = '';
	export let maxLength: number = 5000;
	export let minHeight: string = '200px';

	const dispatch = createEventDispatcher();

	let textareaElement: HTMLTextAreaElement;
	let isFocused = false;

	function handleInput(event: Event) {
		const target = event.target as HTMLTextAreaElement;
		value = target.value;
		dispatch('input', value);
		autoResize();
	}

	function handleFocus() {
		isFocused = true;
	}

	function handleBlur() {
		isFocused = false;
	}

	function autoResize() {
		if (textareaElement) {
			textareaElement.style.height = 'auto';
			textareaElement.style.height = Math.max(parseInt(minHeight), textareaElement.scrollHeight) + 'px';
		}
	}

	function insertText(before: string, after: string = '') {
		if (!textareaElement) return;

		const start = textareaElement.selectionStart;
		const end = textareaElement.selectionEnd;
		const selectedText = value.substring(start, end);
		
		const newText = value.substring(0, start) + before + selectedText + after + value.substring(end);
		
		if (newText.length <= maxLength) {
			value = newText;
			
			// Restore cursor position
			setTimeout(() => {
				textareaElement.focus();
				textareaElement.setSelectionRange(start + before.length, end + before.length);
			}, 0);
		}
	}

	function handleBold() {
		insertText('**', '**');
	}

	function handleItalic() {
		insertText('*', '*');
	}

	function handleLink() {
		const url = prompt('Enter URL:');
		if (url) {
			insertText('[', `](${url})`);
		}
	}

	function handleList() {
		insertText('\n- ');
	}

	function handleNumberedList() {
		insertText('\n1. ');
	}

	// Auto-resize on mount and value changes
	$: if (textareaElement && value !== undefined) {
		setTimeout(autoResize, 0);
	}
</script>

<div class="border border-gray-300 rounded-md focus-within:ring-1 focus-within:ring-blue-500 focus-within:border-blue-500 dark:border-gray-600 dark:focus-within:ring-blue-500 dark:focus-within:border-blue-500">
	<!-- Toolbar -->
	<div class="flex items-center gap-1 p-2 border-b border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 rounded-t-md">
		<button
			type="button"
			class="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
			on:click={handleBold}
			title="Bold (Ctrl+B)"
		>
			<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z" />
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z" />
			</svg>
		</button>

		<button
			type="button"
			class="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
			on:click={handleItalic}
			title="Italic (Ctrl+I)"
		>
			<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 4l4 16M6 8h12M6 16h12" />
			</svg>
		</button>

		<div class="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1"></div>

		<button
			type="button"
			class="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
			on:click={handleLink}
			title="Add Link"
		>
			<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
			</svg>
		</button>

		<button
			type="button"
			class="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
			on:click={handleList}
			title="Bullet List"
		>
			<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
			</svg>
		</button>

		<button
			type="button"
			class="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
			on:click={handleNumberedList}
			title="Numbered List"
		>
			<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v6a2 2 0 002 2h6a2 2 0 002-2V7a2 2 0 00-2-2H9z" />
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 9l2 2 4-4" />
			</svg>
		</button>

		<div class="flex-1"></div>

		<span class="text-xs text-gray-500 dark:text-gray-400">
			Markdown supported
		</span>
	</div>

	<!-- Text Area -->
	<textarea
		bind:this={textareaElement}
		bind:value
		{placeholder}
		{maxlength}
		style="min-height: {minHeight};"
		class="block w-full border-0 resize-none focus:ring-0 focus:outline-none p-3 text-sm dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
		on:input={handleInput}
		on:focus={handleFocus}
		on:blur={handleBlur}
	></textarea>

	<!-- Help Text -->
	{#if isFocused}
		<div class="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600 rounded-b-md">
			<strong>Formatting tips:</strong> **bold**, *italic*, [link](url), - bullet list, 1. numbered list
		</div>
	{/if}
</div>