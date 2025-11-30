<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let tags: string[] = [];
	export let placeholder: string = 'Add tags...';
	export let maxTags: number = 10;
	export let maxTagLength: number = 30;

	const dispatch = createEventDispatcher();

	let inputValue = '';
	let inputElement: HTMLInputElement;
	let suggestions: string[] = [];
	let showSuggestions = false;
	let selectedSuggestionIndex = -1;

	// Common medical tags for suggestions
	const commonTags = [
		'headache', 'fever', 'pain', 'medication', 'symptoms', 'diagnosis',
		'treatment', 'chronic', 'acute', 'infection', 'allergy', 'pregnancy',
		'diabetes', 'hypertension', 'anxiety', 'depression', 'fatigue',
		'nausea', 'dizziness', 'chest-pain', 'back-pain', 'joint-pain',
		'skin-condition', 'respiratory', 'digestive', 'cardiovascular',
		'neurological', 'pediatric', 'geriatric', 'mental-health'
	];

	function addTag(tag: string) {
		const trimmedTag = tag.trim().toLowerCase();
		
		if (!trimmedTag) return;
		if (trimmedTag.length > maxTagLength) return;
		if (tags.length >= maxTags) return;
		if (tags.includes(trimmedTag)) return;

		tags = [...tags, trimmedTag];
		inputValue = '';
		showSuggestions = false;
		selectedSuggestionIndex = -1;
		
		dispatch('change', tags);
	}

	function removeTag(index: number) {
		tags = tags.filter((_, i) => i !== index);
		dispatch('change', tags);
	}

	function handleInput(event: Event) {
		const target = event.target as HTMLInputElement;
		inputValue = target.value;
		
		if (inputValue.trim()) {
			updateSuggestions(inputValue.trim());
		} else {
			showSuggestions = false;
		}
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ',') {
			event.preventDefault();
			if (selectedSuggestionIndex >= 0 && suggestions[selectedSuggestionIndex]) {
				addTag(suggestions[selectedSuggestionIndex]);
			} else if (inputValue.trim()) {
				addTag(inputValue);
			}
		} else if (event.key === 'Backspace' && !inputValue && tags.length > 0) {
			removeTag(tags.length - 1);
		} else if (event.key === 'ArrowDown') {
			event.preventDefault();
			if (showSuggestions && suggestions.length > 0) {
				selectedSuggestionIndex = Math.min(selectedSuggestionIndex + 1, suggestions.length - 1);
			}
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			if (showSuggestions && suggestions.length > 0) {
				selectedSuggestionIndex = Math.max(selectedSuggestionIndex - 1, -1);
			}
		} else if (event.key === 'Escape') {
			showSuggestions = false;
			selectedSuggestionIndex = -1;
		}
	}

	function updateSuggestions(query: string) {
		const lowerQuery = query.toLowerCase();
		suggestions = commonTags
			.filter(tag => 
				tag.includes(lowerQuery) && 
				!tags.includes(tag) &&
				tag !== lowerQuery
			)
			.slice(0, 5);
		
		showSuggestions = suggestions.length > 0;
		selectedSuggestionIndex = -1;
	}

	function selectSuggestion(tag: string) {
		addTag(tag);
		inputElement.focus();
	}

	function handleFocus() {
		if (inputValue.trim()) {
			updateSuggestions(inputValue.trim());
		}
	}

	function handleBlur() {
		// Delay hiding suggestions to allow clicking on them
		setTimeout(() => {
			showSuggestions = false;
			selectedSuggestionIndex = -1;
		}, 200);
	}
</script>

<div class="relative">
	<div class="flex flex-wrap items-center gap-2 p-3 border border-gray-300 rounded-md focus-within:ring-1 focus-within:ring-blue-500 focus-within:border-blue-500 dark:border-gray-600 dark:focus-within:ring-blue-500 dark:focus-within:border-blue-500 bg-white dark:bg-gray-800">
		<!-- Existing Tags -->
		{#each tags as tag, index}
			<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
				#{tag}
				<button
					type="button"
					class="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full text-blue-400 hover:bg-blue-200 hover:text-blue-600 focus:outline-none focus:bg-blue-200 focus:text-blue-600 dark:text-blue-300 dark:hover:bg-blue-800 dark:hover:text-blue-200"
					on:click={() => removeTag(index)}
					aria-label="Remove tag"
				>
					<svg class="w-2 h-2" stroke="currentColor" fill="none" viewBox="0 0 8 8">
						<path stroke-linecap="round" stroke-width="1.5" d="m1 1 6 6m0-6-6 6" />
					</svg>
				</button>
			</span>
		{/each}

		<!-- Input -->
		<input
			bind:this={inputElement}
			type="text"
			bind:value={inputValue}
			{placeholder}
			maxlength={maxTagLength}
			class="flex-1 min-w-0 border-0 p-0 text-sm focus:ring-0 focus:outline-none bg-transparent dark:text-white dark:placeholder-gray-400"
			disabled={tags.length >= maxTags}
			on:input={handleInput}
			on:keydown={handleKeyDown}
			on:focus={handleFocus}
			on:blur={handleBlur}
		/>
	</div>

	<!-- Suggestions Dropdown -->
	{#if showSuggestions && suggestions.length > 0}
		<div class="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg">
			<ul class="py-1">
				{#each suggestions as suggestion, index}
					<li>
						<button
							type="button"
							class="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:bg-gray-100 dark:focus:bg-gray-700 text-gray-900 dark:text-white
								{index === selectedSuggestionIndex ? 'bg-gray-100 dark:bg-gray-700' : ''}"
							on:click={() => selectSuggestion(suggestion)}
						>
							#{suggestion}
						</button>
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	<!-- Help Text -->
	<div class="mt-1 text-xs text-gray-500 dark:text-gray-400">
		Press Enter or comma to add tags. {tags.length}/{maxTags} tags used.
	</div>
</div>