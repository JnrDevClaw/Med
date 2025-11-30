<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { api } from '$utils/api';
	import { authStore } from '$stores/auth';
	import type { Question, QuestionCategory, QuestionsResponse } from '$types';
	import QuestionCard from '$lib/components/qa/QuestionCard.svelte';
	import CategoryFilter from '$lib/components/qa/CategoryFilter.svelte';
	import SortFilter from '$lib/components/qa/SortFilter.svelte';
	import SearchBar from '$lib/components/qa/SearchBar.svelte';
	import Pagination from '$lib/components/qa/Pagination.svelte';
	import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';

	let questions: Question[] = [];
	let categories: QuestionCategory[] = [];
	let loading = true;
	let error = '';
	let pagination = {
		page: 1,
		limit: 20,
		total: 0,
		hasNext: false
	};

	// Filter states
	let selectedCategory = '';
	let sortBy: 'upvotes' | 'oldest' | 'newest' = 'newest';
	let searchQuery = '';

	// Get URL parameters
	$: {
		const urlParams = $page.url.searchParams;
		selectedCategory = urlParams.get('category') || '';
		sortBy = (urlParams.get('sortBy') as any) || 'newest';
		searchQuery = urlParams.get('search') || '';
		pagination.page = parseInt(urlParams.get('page') || '1');
	}

	async function loadQuestions() {
		try {
			loading = true;
			error = '';

			const params: any = {
				limit: pagination.limit,
				page: pagination.page,
				sortBy
			};

			if (selectedCategory) params.category = selectedCategory;
			if (searchQuery) params.search = searchQuery;

			const response: QuestionsResponse = await api.getQuestions(params);
			questions = response.questions;
			pagination = response.pagination;
		} catch (err: any) {
			error = err.message || 'Failed to load questions';
			console.error('Error loading questions:', err);
		} finally {
			loading = false;
		}
	}

	async function loadCategories() {
		try {
			const response = await api.getQuestionCategories();
			categories = response.categories;
		} catch (err) {
			console.error('Error loading categories:', err);
		}
	}

	function updateFilters(newFilters: { category?: string; sortBy?: string; search?: string; page?: number }) {
		const url = new URL($page.url);
		
		if (newFilters.category !== undefined) {
			if (newFilters.category) {
				url.searchParams.set('category', newFilters.category);
			} else {
				url.searchParams.delete('category');
			}
		}
		
		if (newFilters.sortBy) {
			url.searchParams.set('sortBy', newFilters.sortBy);
		}
		
		if (newFilters.search !== undefined) {
			if (newFilters.search) {
				url.searchParams.set('search', newFilters.search);
			} else {
				url.searchParams.delete('search');
			}
		}
		
		if (newFilters.page !== undefined) {
			if (newFilters.page > 1) {
				url.searchParams.set('page', newFilters.page.toString());
			} else {
				url.searchParams.delete('page');
			}
		}

		goto(url.toString(), { replaceState: true });
	}

	function handleCategoryChange(category: string) {
		updateFilters({ category, page: 1 });
	}

	function handleSortChange(sort: string) {
		updateFilters({ sortBy: sort, page: 1 });
	}

	function handleSearch(search: string) {
		updateFilters({ search, page: 1 });
	}

	function handlePageChange(page: number) {
		updateFilters({ page });
	}

	function clearFilters() {
		updateFilters({ category: '', search: '', sortBy: 'newest', page: 1 });
	}

	// Reactive statement to reload questions when URL parameters change
	$: if ($page.url.searchParams) {
		loadQuestions();
	}

	onMount(() => {
		loadCategories();
		loadQuestions();
	});
</script>

<svelte:head>
	<title>Q&A Forum - Med Connect</title>
	<meta name="description" content="Ask medical questions and get answers from doctors and the community" />
</svelte:head>

<div class="min-h-screen bg-gray-50 dark:bg-gray-900">
	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
		<!-- Header -->
		<div class="mb-8">
			<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
				<div>
					<h1 class="text-3xl font-bold text-gray-900 dark:text-white">Q&A Forum</h1>
					<p class="mt-2 text-gray-600 dark:text-gray-400">
						Ask medical questions and get answers from doctors and the community
					</p>
				</div>
				
				{#if $authStore.isAuthenticated}
					<a
						href="/qa/ask"
						class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
					>
						<svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
						</svg>
						Ask Question
					</a>
				{/if}
			</div>
		</div>

		<!-- Filters -->
		<div class="mb-6 space-y-4">
			<div class="flex flex-col lg:flex-row gap-4">
				<div class="flex-1">
					<SearchBar 
						value={searchQuery} 
						on:search={(e) => handleSearch(e.detail)} 
						placeholder="Search questions..."
					/>
				</div>
				
				<div class="flex flex-col sm:flex-row gap-4">
					<CategoryFilter 
						{categories}
						selected={selectedCategory}
						on:change={(e) => handleCategoryChange(e.detail)}
					/>
					
					<SortFilter 
						selected={sortBy}
						on:change={(e) => handleSortChange(e.detail)}
					/>
				</div>
			</div>

			<!-- Active filters -->
			{#if selectedCategory || searchQuery}
				<div class="flex flex-wrap items-center gap-2">
					<span class="text-sm text-gray-600 dark:text-gray-400">Active filters:</span>
					
					{#if selectedCategory}
						<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
							Category: {selectedCategory}
							<button
								type="button"
								class="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full text-blue-400 hover:bg-blue-200 hover:text-blue-600 focus:outline-none focus:bg-blue-200 focus:text-blue-600"
								on:click={() => handleCategoryChange('')}
							>
								<svg class="w-2 h-2" stroke="currentColor" fill="none" viewBox="0 0 8 8">
									<path stroke-linecap="round" stroke-width="1.5" d="m1 1 6 6m0-6-6 6" />
								</svg>
							</button>
						</span>
					{/if}
					
					{#if searchQuery}
						<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
							Search: "{searchQuery}"
							<button
								type="button"
								class="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full text-green-400 hover:bg-green-200 hover:text-green-600 focus:outline-none focus:bg-green-200 focus:text-green-600"
								on:click={() => handleSearch('')}
							>
								<svg class="w-2 h-2" stroke="currentColor" fill="none" viewBox="0 0 8 8">
									<path stroke-linecap="round" stroke-width="1.5" d="m1 1 6 6m0-6-6 6" />
								</svg>
							</button>
						</span>
					{/if}
					
					<button
						type="button"
						class="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
						on:click={clearFilters}
					>
						Clear all
					</button>
				</div>
			{/if}
		</div>

		<!-- Content -->
		{#if loading}
			<div class="flex justify-center py-12">
				<LoadingSpinner size="lg" />
			</div>
		{:else if error}
			<div class="text-center py-12">
				<div class="text-red-600 dark:text-red-400 mb-4">
					<svg class="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
				</div>
				<h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">Error Loading Questions</h3>
				<p class="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
				<button
					type="button"
					class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-600 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-blue-900 dark:text-blue-200 dark:hover:bg-blue-800"
					on:click={loadQuestions}
				>
					Try Again
				</button>
			</div>
		{:else if questions.length === 0}
			<div class="text-center py-12">
				<div class="text-gray-400 dark:text-gray-600 mb-4">
					<svg class="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
				</div>
				<h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">No Questions Found</h3>
				<p class="text-gray-600 dark:text-gray-400 mb-4">
					{#if selectedCategory || searchQuery}
						Try adjusting your filters or search terms.
					{:else}
						Be the first to ask a question!
					{/if}
				</p>
				{#if $authStore.isAuthenticated}
					<a
						href="/qa/ask"
						class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-600 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-blue-900 dark:text-blue-200 dark:hover:bg-blue-800"
					>
						Ask a Question
					</a>
				{/if}
			</div>
		{:else}
			<!-- Questions List -->
			<div class="space-y-4">
				{#each questions as question (question.id)}
					<QuestionCard {question} />
				{/each}
			</div>

			<!-- Pagination -->
			{#if pagination.total > pagination.limit}
				<div class="mt-8">
					<Pagination 
						currentPage={pagination.page}
						totalPages={Math.ceil(pagination.total / pagination.limit)}
						hasNext={pagination.hasNext}
						on:pageChange={(e) => handlePageChange(e.detail)}
					/>
				</div>
			{/if}
		{/if}
	</div>
</div>