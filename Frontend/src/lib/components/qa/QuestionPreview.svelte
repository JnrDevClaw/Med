<script lang="ts">
	export let title: string;
	export let content: string;
	export let category: string;
	export let tags: string[];
	export let authorUsername: string;
	export let authorRole: 'doctor' | 'patient';

	function formatContent(text: string): string {
		// Simple markdown-like formatting
		return text
			.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
			.replace(/\*(.*?)\*/g, '<em>$1</em>')
			.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-blue-600 hover:text-blue-800 underline" target="_blank" rel="noopener noreferrer">$1</a>')
			.replace(/^- (.+)$/gm, '<li>$1</li>')
			.replace(/^(\d+)\. (.+)$/gm, '<li>$1. $2</li>')
			.replace(/\n/g, '<br>');
	}

	$: formattedContent = formatContent(content);
</script>

<div class="space-y-6">
	<div class="text-center">
		<h2 class="text-lg font-medium text-gray-900 dark:text-white mb-2">Question Preview</h2>
		<p class="text-sm text-gray-600 dark:text-gray-400">
			This is how your question will appear to other users
		</p>
	</div>

	<div class="bg-gray-50 dark:bg-gray-900 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
		<article class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
			<div class="p-6">
				<div class="flex gap-4">
					<!-- Vote Section (Preview) -->
					<div class="flex-shrink-0">
						<div class="flex flex-col items-center space-y-1">
							<button
								type="button"
								class="flex items-center justify-center w-8 h-8 rounded-full border-2 border-gray-300 text-gray-600 dark:border-gray-600 dark:text-gray-400"
								disabled
							>
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
								</svg>
							</button>
							
							<div class="flex flex-col items-center">
								<span class="font-semibold text-gray-900 dark:text-white text-base">0</span>
								<span class="text-xs text-gray-500 dark:text-gray-400">0 votes</span>
							</div>
							
							<button
								type="button"
								class="flex items-center justify-center w-8 h-8 rounded-full border-2 border-gray-300 text-gray-600 dark:border-gray-600 dark:text-gray-400"
								disabled
							>
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
								</svg>
							</button>
						</div>
					</div>

					<!-- Content Section -->
					<div class="flex-1 min-w-0">
						<!-- Title -->
						{#if title}
							<h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
								{title}
							</h2>
						{:else}
							<h2 class="text-lg font-semibold text-gray-400 dark:text-gray-600 mb-2 italic">
								Your question title will appear here
							</h2>
						{/if}

						<!-- Content -->
						{#if content}
							<div class="text-gray-700 dark:text-gray-300 mb-4 prose dark:prose-invert max-w-none">
								{@html formattedContent}
							</div>
						{:else}
							<div class="text-gray-400 dark:text-gray-600 mb-4 italic">
								Your question details will appear here
							</div>
						{/if}

						<!-- Tags -->
						{#if tags && tags.length > 0}
							<div class="flex flex-wrap gap-2 mb-4">
								{#each tags as tag}
									<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
										#{tag}
									</span>
								{/each}
							</div>
						{/if}

						<!-- Meta Information -->
						<div class="flex flex-wrap items-center justify-between gap-4 text-sm text-gray-500 dark:text-gray-400">
							<div class="flex flex-wrap items-center gap-4">
								<!-- Category -->
								{#if category}
									<span class="inline-flex items-center">
										<svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
										</svg>
										{category}
									</span>
								{:else}
									<span class="inline-flex items-center text-gray-400 dark:text-gray-600">
										<svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
										</svg>
										Category
									</span>
								{/if}

								<!-- Answer Count -->
								<span class="inline-flex items-center">
									<svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
									</svg>
									0 answers
								</span>

								<!-- Author -->
								<span class="inline-flex items-center">
									<svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
									</svg>
									<span class="font-medium {authorRole === 'doctor' ? 'text-green-600 dark:text-green-400' : ''}">
										{authorUsername}
										{#if authorRole === 'doctor'}
											<span class="ml-1 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
												Doctor
											</span>
										{/if}
									</span>
								</span>
							</div>

							<!-- Timestamp -->
							<time class="flex-shrink-0">
								just now
							</time>
						</div>
					</div>
				</div>
			</div>
		</article>
	</div>
</div>