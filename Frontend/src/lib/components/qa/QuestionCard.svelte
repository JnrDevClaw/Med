<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { goto } from '$app/navigation';
	import { authStore } from '$stores/auth';
	import { api } from '$utils/api';
	import { formatDistanceToNow } from '$utils/date';
	import type { Question, Vote } from '$types';
	import VoteButtons from './VoteButtons.svelte';

	export let question: Question;
	export let showFullContent = false;

	const dispatch = createEventDispatcher();

	let userVote: Vote | null = null;
	let loadingVote = false;

	// Load user's vote on this question if authenticated
	$: if ($authStore.isAuthenticated && question.id) {
		loadUserVote();
	}

	async function loadUserVote() {
		if (!$authStore.isAuthenticated) return;
		
		try {
			const response = await api.getUserVoteOnQuestion(question.id);
			userVote = response.vote;
		} catch (error) {
			console.error('Error loading user vote:', error);
		}
	}

	async function handleVote(voteType: 'upvote' | 'downvote') {
		if (!$authStore.isAuthenticated) {
			goto('/auth/login');
			return;
		}

		try {
			loadingVote = true;
			const response = await api.voteQuestion(question.id, voteType);
			
			// Update question vote counts
			question.upvotes = response.vote.upvotes;
			question.downvotes = response.vote.downvotes;
			
			// Update user vote state
			userVote = response.vote.voteType === 'removed' ? null : {
				voteType: response.vote.voteType as 'upvote' | 'downvote',
				upvotes: response.vote.upvotes,
				downvotes: response.vote.downvotes
			};

			dispatch('voteChanged', { questionId: question.id, vote: response.vote });
		} catch (error: any) {
			console.error('Error voting on question:', error);
			// You might want to show a toast notification here
		} finally {
			loadingVote = false;
		}
	}

	function handleQuestionClick() {
		goto(`/qa/questions/${question.id}`);
	}

	function handleTagClick(tag: string, event: Event) {
		event.stopPropagation();
		goto(`/qa?search=${encodeURIComponent(tag)}`);
	}

	function handleCategoryClick(event: Event) {
		event.stopPropagation();
		goto(`/qa?category=${encodeURIComponent(question.category)}`);
	}

	function handleAuthorClick(event: Event) {
		event.stopPropagation();
		// Navigate to user profile when implemented
		// goto(`/users/${question.authorUsername}`);
	}

	function truncateContent(content: string, maxLength: number = 200): string {
		if (content.length <= maxLength) return content;
		return content.substring(0, maxLength).trim() + '...';
	}
</script>

<article class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow duration-200">
	<div class="p-6">
		<div class="flex gap-4">
			<!-- Vote Section -->
			<div class="flex-shrink-0">
				<VoteButtons
					upvotes={question.upvotes}
					downvotes={question.downvotes}
					userVote={userVote?.voteType}
					loading={loadingVote}
					on:vote={(e) => handleVote(e.detail)}
				/>
			</div>

			<!-- Content Section -->
			<div class="flex-1 min-w-0">
				<!-- Title -->
				<h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-2 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors" on:click={handleQuestionClick}>
					{question.title}
				</h2>

				<!-- Content Preview -->
				<div class="text-gray-700 dark:text-gray-300 mb-4 cursor-pointer" on:click={handleQuestionClick}>
					{#if showFullContent}
						<div class="prose dark:prose-invert max-w-none">
							{@html question.content}
						</div>
					{:else}
						<p>{truncateContent(question.content)}</p>
					{/if}
				</div>

				<!-- Tags -->
				{#if question.tags && question.tags.length > 0}
					<div class="flex flex-wrap gap-2 mb-4">
						{#each question.tags as tag}
							<button
								type="button"
								class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 transition-colors"
								on:click={(e) => handleTagClick(tag, e)}
							>
								#{tag}
							</button>
						{/each}
					</div>
				{/if}

				<!-- Meta Information -->
				<div class="flex flex-wrap items-center justify-between gap-4 text-sm text-gray-500 dark:text-gray-400">
					<div class="flex flex-wrap items-center gap-4">
						<!-- Category -->
						<button
							type="button"
							class="inline-flex items-center hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
							on:click={handleCategoryClick}
						>
							<svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
							</svg>
							{question.category}
						</button>

						<!-- Answer Count -->
						<span class="inline-flex items-center">
							<svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
							</svg>
							{question.answerCount} {question.answerCount === 1 ? 'answer' : 'answers'}
						</span>

						<!-- Author -->
						<button
							type="button"
							class="inline-flex items-center hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
							on:click={handleAuthorClick}
						>
							<svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
							</svg>
							<span class="font-medium {question.authorRole === 'doctor' ? 'text-green-600 dark:text-green-400' : ''}">
								{question.authorUsername}
								{#if question.authorRole === 'doctor'}
									<span class="ml-1 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
										Doctor
									</span>
								{/if}
							</span>
						</button>
					</div>

					<!-- Timestamp -->
					<time class="flex-shrink-0" datetime={question.createdAt}>
						{formatDistanceToNow(new Date(question.createdAt))} ago
					</time>
				</div>
			</div>
		</div>
	</div>
</article>