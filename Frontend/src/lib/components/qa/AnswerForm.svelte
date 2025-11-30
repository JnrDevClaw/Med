<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { authStore } from '$stores/auth';
	import { api } from '$utils/api';
	import type { Answer } from '$types';
	import RichTextEditor from './RichTextEditor.svelte';
	import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';

	export let questionId: string;

	const dispatch = createEventDispatcher();

	let content = '';
	let submitting = false;
	let error = '';
	let showForm = false;

	// Form validation
	$: contentValid = content.trim().length >= 10 && content.trim().length <= 5000;
	$: formValid = contentValid;

	// Character count
	$: contentCount = content.length;

	async function handleSubmit() {
		if (!formValid || submitting) return;

		try {
			submitting = true;
			error = '';

			const answerData = {
				content: content.trim(),
				questionId
			};

			const response = await api.createAnswer(answerData);
			
			// Dispatch the new answer
			dispatch('answerAdded', response.answer);
			
			// Reset form
			content = '';
			showForm = false;
		} catch (err: any) {
			error = err.message || 'Failed to submit answer';
			console.error('Error creating answer:', err);
		} finally {
			submitting = false;
		}
	}

	function handleCancel() {
		if (content.trim()) {
			if (confirm('Are you sure you want to discard your answer?')) {
				content = '';
				showForm = false;
			}
		} else {
			showForm = false;
		}
	}

	function toggleForm() {
		showForm = !showForm;
		if (!showForm) {
			content = '';
			error = '';
		}
	}
</script>

<div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
	<div class="p-6">
		{#if !showForm}
			<!-- Show Answer Button -->
			<button
				type="button"
				class="w-full flex items-center justify-center px-4 py-3 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-600"
				on:click={toggleForm}
			>
				<svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
				</svg>
				Write an Answer
			</button>
		{:else}
			<!-- Answer Form -->
			<div class="space-y-4">
				<div class="flex items-center justify-between">
					<h3 class="text-lg font-medium text-gray-900 dark:text-white">Your Answer</h3>
					<button
						type="button"
						class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
						on:click={handleCancel}
						aria-label="Close"
					>
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>

				<!-- Error Message -->
				{#if error}
					<div class="rounded-md bg-red-50 p-4 dark:bg-red-900/20">
						<div class="flex">
							<div class="flex-shrink-0">
								<svg class="h-5 w-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
								</svg>
							</div>
							<div class="ml-3">
								<h3 class="text-sm font-medium text-red-800 dark:text-red-200">
									Error submitting answer
								</h3>
								<div class="mt-2 text-sm text-red-700 dark:text-red-300">
									{error}
								</div>
							</div>
						</div>
					</div>
				{/if}

				<form on:submit|preventDefault={handleSubmit} class="space-y-4">
					<!-- Content Editor -->
					<div>
						<label for="answer-content" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
							Answer *
						</label>
						<RichTextEditor
							bind:value={content}
							placeholder="Provide a helpful and detailed answer..."
							maxLength={5000}
							minHeight="150px"
							class="{!contentValid && content.length > 0 ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}"
						/>
						<div class="mt-1 flex justify-between text-sm">
							<span class="text-gray-500 dark:text-gray-400">
								{#if !contentValid && content.length > 0}
									{#if content.length < 10}
										Please provide more details (at least 10 characters)
									{:else}
										Answer is too long
									{/if}
								{:else}
									Provide a helpful and detailed answer
								{/if}
							</span>
							<span class="text-gray-400 dark:text-gray-500">
								{contentCount}/5000
							</span>
						</div>
					</div>

					<!-- Guidelines -->
					<div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-4">
						<div class="flex">
							<div class="flex-shrink-0">
								<svg class="h-5 w-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
								</svg>
							</div>
							<div class="ml-3">
								<h3 class="text-sm font-medium text-blue-800 dark:text-blue-200">
									Guidelines for answering
								</h3>
								<div class="mt-2 text-sm text-blue-700 dark:text-blue-300">
									<ul class="list-disc list-inside space-y-1">
										<li>Provide accurate and helpful information</li>
										<li>Be respectful and professional</li>
										<li>Include sources or references when possible</li>
										<li>Remember this is not a substitute for professional medical advice</li>
										{#if $authStore.user?.role === 'doctor'}
											<li class="font-medium">As a verified doctor, your answer will be highlighted</li>
										{/if}
									</ul>
								</div>
							</div>
						</div>
					</div>

					<!-- Actions -->
					<div class="flex flex-col sm:flex-row gap-3 sm:justify-end">
						<button
							type="button"
							class="w-full sm:w-auto inline-flex justify-center items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-600"
							on:click={handleCancel}
							disabled={submitting}
						>
							Cancel
						</button>
						
						<button
							type="submit"
							class="w-full sm:w-auto inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
							disabled={!formValid || submitting}
						>
							{#if submitting}
								<LoadingSpinner size="sm" color="white" />
								<span class="ml-2">Submitting...</span>
							{:else}
								Submit Answer
							{/if}
						</button>
					</div>
				</form>
			</div>
		{/if}
	</div>
</div>