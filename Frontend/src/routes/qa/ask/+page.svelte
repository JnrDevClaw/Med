<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { authStore } from '$stores/auth';
	import { api } from '$utils/api';
	import type { QuestionCategory } from '$types';
	import RichTextEditor from '$lib/components/qa/RichTextEditor.svelte';
	import TagInput from '$lib/components/qa/TagInput.svelte';
	import QuestionPreview from '$lib/components/qa/QuestionPreview.svelte';
	import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';

	let title = '';
	let content = '';
	let category = '';
	let tags: string[] = [];
	let categories: QuestionCategory[] = [];
	let showPreview = false;
	let loading = false;
	let submitting = false;
	let error = '';

	// Form validation
	$: titleValid = title.trim().length >= 5 && title.trim().length <= 200;
	$: contentValid = content.trim().length >= 10 && content.trim().length <= 5000;
	$: categoryValid = category.trim().length > 0;
	$: tagsValid = tags.length <= 10 && tags.every(tag => tag.length <= 30);
	$: formValid = titleValid && contentValid && categoryValid && tagsValid;

	// Character counts
	$: titleCount = title.length;
	$: contentCount = content.length;

	// Redirect if not authenticated
	$: if (!$authStore.isAuthenticated) {
		goto('/auth/login');
	}

	async function loadCategories() {
		try {
			loading = true;
			const response = await api.getQuestionCategories();
			categories = response.categories;
		} catch (err) {
			console.error('Error loading categories:', err);
		} finally {
			loading = false;
		}
	}

	async function handleSubmit() {
		if (!formValid || submitting) return;

		try {
			submitting = true;
			error = '';

			const questionData = {
				title: title.trim(),
				content: content.trim(),
				category: category.trim(),
				tags: tags.filter(tag => tag.trim().length > 0)
			};

			const response = await api.createQuestion(questionData);
			
			// Redirect to the new question
			goto(`/qa/questions/${response.question.id}`);
		} catch (err: any) {
			error = err.message || 'Failed to create question';
			console.error('Error creating question:', err);
		} finally {
			submitting = false;
		}
	}

	function handleCancel() {
		if (title || content || category || tags.length > 0) {
			if (confirm('Are you sure you want to discard your question? All changes will be lost.')) {
				goto('/qa');
			}
		} else {
			goto('/qa');
		}
	}

	function togglePreview() {
		showPreview = !showPreview;
	}

	onMount(() => {
		loadCategories();
	});
</script>

<svelte:head>
	<title>Ask a Question - Med Connect</title>
	<meta name="description" content="Ask a medical question and get answers from doctors and the community" />
</svelte:head>

<div class="min-h-screen bg-gray-50 dark:bg-gray-900">
	<div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
		<!-- Header -->
		<div class="mb-8">
			<div class="flex items-center justify-between">
				<div>
					<h1 class="text-3xl font-bold text-gray-900 dark:text-white">Ask a Question</h1>
					<p class="mt-2 text-gray-600 dark:text-gray-400">
						Get help from doctors and the community
					</p>
				</div>
				
				<button
					type="button"
					class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
					on:click={handleCancel}
					aria-label="Close"
				>
					<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>
		</div>

		{#if loading}
			<div class="flex justify-center py-12">
				<LoadingSpinner size="lg" />
			</div>
		{:else}
			<div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
				<div class="p-6">
					<!-- Preview Toggle -->
					<div class="flex justify-end mb-6">
						<button
							type="button"
							class="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-600"
							on:click={togglePreview}
						>
							{showPreview ? 'Edit' : 'Preview'}
						</button>
					</div>

					{#if showPreview}
						<!-- Preview Mode -->
						<QuestionPreview 
							{title}
							{content}
							{category}
							{tags}
							authorUsername={$authStore.user?.username || ''}
							authorRole={$authStore.user?.role || 'patient'}
						/>
					{:else}
						<!-- Edit Mode -->
						<form on:submit|preventDefault={handleSubmit} class="space-y-6">
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
												Error creating question
											</h3>
											<div class="mt-2 text-sm text-red-700 dark:text-red-300">
												{error}
											</div>
										</div>
									</div>
								</div>
							{/if}

							<!-- Title -->
							<div>
								<label for="title" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
									Question Title *
								</label>
								<input
									id="title"
									type="text"
									bind:value={title}
									placeholder="What's your medical question?"
									maxlength="200"
									class="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400 dark:focus:ring-blue-500 dark:focus:border-blue-500
										{!titleValid && title.length > 0 ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}"
									required
								/>
								<div class="mt-1 flex justify-between text-sm">
									<span class="text-gray-500 dark:text-gray-400">
										{#if !titleValid && title.length > 0}
											{#if title.length < 5}
												Title must be at least 5 characters
											{:else}
												Title is too long
											{/if}
										{:else}
											Be specific and clear about your question
										{/if}
									</span>
									<span class="text-gray-400 dark:text-gray-500">
										{titleCount}/200
									</span>
								</div>
							</div>

							<!-- Category -->
							<div>
								<label for="category" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
									Category *
								</label>
								<select
									id="category"
									bind:value={category}
									class="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
									required
								>
									<option value="">Select a category</option>
									{#each categories as cat}
										<option value={cat.name}>{cat.name}</option>
									{/each}
									<option value="General">General</option>
									<option value="Cardiology">Cardiology</option>
									<option value="Dermatology">Dermatology</option>
									<option value="Neurology">Neurology</option>
									<option value="Pediatrics">Pediatrics</option>
									<option value="Mental Health">Mental Health</option>
									<option value="Nutrition">Nutrition</option>
									<option value="Emergency">Emergency</option>
								</select>
								<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
									Choose the most relevant medical category
								</p>
							</div>

							<!-- Content -->
							<div>
								<label for="content" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
									Question Details *
								</label>
								<RichTextEditor
									bind:value={content}
									placeholder="Describe your question in detail. Include relevant symptoms, duration, and any other important information..."
									maxLength={5000}
									class="{!contentValid && content.length > 0 ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}"
								/>
								<div class="mt-1 flex justify-between text-sm">
									<span class="text-gray-500 dark:text-gray-400">
										{#if !contentValid && content.length > 0}
											{#if content.length < 10}
												Please provide more details (at least 10 characters)
											{:else}
												Content is too long
											{/if}
										{:else}
											Provide as much relevant detail as possible
										{/if}
									</span>
									<span class="text-gray-400 dark:text-gray-500">
										{contentCount}/5000
									</span>
								</div>
							</div>

							<!-- Tags -->
							<div>
								<label for="tags" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
									Tags (Optional)
								</label>
								<TagInput
									bind:tags
									placeholder="Add relevant tags (e.g., headache, fever, medication)"
									maxTags={10}
									maxTagLength={30}
								/>
								<div class="mt-1 flex justify-between text-sm">
									<span class="text-gray-500 dark:text-gray-400">
										{#if !tagsValid}
											{#if tags.length > 10}
												Maximum 10 tags allowed
											{:else}
												Some tags are too long (max 30 characters each)
											{/if}
										{:else}
											Add tags to help others find your question
										{/if}
									</span>
									<span class="text-gray-400 dark:text-gray-500">
										{tags.length}/10 tags
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
											Guidelines for asking questions
										</h3>
										<div class="mt-2 text-sm text-blue-700 dark:text-blue-300">
											<ul class="list-disc list-inside space-y-1">
												<li>Be specific about your symptoms and concerns</li>
												<li>Include relevant medical history if applicable</li>
												<li>Mention any medications you're currently taking</li>
												<li>This is not a substitute for emergency medical care</li>
												<li>For urgent medical issues, contact emergency services</li>
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
										<span class="ml-2">Publishing...</span>
									{:else}
										Publish Question
									{/if}
								</button>
							</div>
						</form>
					{/if}
				</div>
			</div>
		{/if}
	</div>
</div>