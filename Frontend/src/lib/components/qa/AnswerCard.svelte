<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { goto } from '$app/navigation';
	import { authStore } from '$stores/auth';
	import { api } from '$utils/api';
	import { formatDistanceToNow } from '$utils/date';
	import type { Answer, Comment, Vote } from '$types';
	import VoteButtons from './VoteButtons.svelte';
	import CommentSection from './CommentSection.svelte';
	import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';

	export let answer: Answer;
	export let questionAuthor: string;

	const dispatch = createEventDispatcher();

	let userVote: Vote | null = null;
	let loadingVote = false;
	let comments: Comment[] = [];
	let loadingComments = false;
	let showComments = false;
	let acceptingAnswer = false;

	// Load user's vote on this answer if authenticated
	$: if ($authStore.isAuthenticated && answer.id) {
		loadUserVote();
	}

	// Load comments for this answer
	$: if (answer.id) {
		loadComments();
	}

	async function loadUserVote() {
		if (!$authStore.isAuthenticated) return;
		
		try {
			// Note: We need to add this API method for answers
			// const response = await api.getUserVoteOnAnswer(answer.id);
			// userVote = response.vote;
		} catch (error) {
			console.error('Error loading user vote:', error);
		}
	}

	async function loadComments() {
		try {
			loadingComments = true;
			const response = await api.getComments('answer', answer.id);
			comments = response.comments;
		} catch (error) {
			console.error('Error loading comments:', error);
		} finally {
			loadingComments = false;
		}
	}

	async function handleVote(voteType: 'upvote' | 'downvote') {
		if (!$authStore.isAuthenticated) {
			goto('/auth/login');
			return;
		}

		try {
			loadingVote = true;
			const response = await api.voteAnswer(answer.id, voteType);
			
			// Update answer vote counts
			answer.upvotes = response.vote.upvotes;
			answer.downvotes = response.vote.downvotes;
			
			// Update user vote state
			userVote = response.vote.voteType === 'removed' ? null : {
				voteType: response.vote.voteType as 'upvote' | 'downvote',
				upvotes: response.vote.upvotes,
				downvotes: response.vote.downvotes
			};

			// Dispatch update event
			dispatch('answerUpdated', answer);
		} catch (error: any) {
			console.error('Error voting on answer:', error);
		} finally {
			loadingVote = false;
		}
	}

	async function handleAcceptAnswer() {
		if (!$authStore.isAuthenticated) {
			goto('/auth/login');
			return;
		}

		try {
			acceptingAnswer = true;
			const response = await api.acceptAnswer(answer.id, !answer.isAccepted);
			
			// Update answer acceptance status
			answer.isAccepted = response.isAccepted;
			
			// Dispatch update event
			dispatch('answerUpdated', answer);
		} catch (error: any) {
			console.error('Error accepting answer:', error);
		} finally {
			acceptingAnswer = false;
		}
	}

	function toggleComments() {
		showComments = !showComments;
	}

	function handleCommentAdded() {
		loadComments();
		answer.commentCount += 1;
		dispatch('answerUpdated', answer);
	}

	function handleAuthorClick() {
		// Navigate to user profile when implemented
		// goto(`/users/${answer.authorUsername}`);
	}

	// Check if current user can accept this answer (question author only)
	$: canAcceptAnswer = $authStore.isAuthenticated && 
		$authStore.user?.username === questionAuthor && 
		$authStore.user?.username !== answer.authorUsername;
</script>

<article class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 {answer.isAccepted ? 'ring-2 ring-green-500 dark:ring-green-400' : ''}">
	<div class="p-6">
		<div class="flex gap-4">
			<!-- Vote Section -->
			<div class="flex-shrink-0">
				<VoteButtons
					upvotes={answer.upvotes}
					downvotes={answer.downvotes}
					userVote={userVote?.voteType}
					loading={loadingVote}
					on:vote={(e) => handleVote(e.detail)}
				/>
			</div>

			<!-- Content Section -->
			<div class="flex-1 min-w-0">
				<!-- Accepted Answer Badge -->
				{#if answer.isAccepted}
					<div class="flex items-center mb-3">
						<div class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
							<svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
								<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
							</svg>
							Accepted Answer
						</div>
					</div>
				{/if}

				<!-- Answer Content -->
				<div class="text-gray-700 dark:text-gray-300 mb-4 prose dark:prose-invert max-w-none">
					{@html answer.content}
				</div>

				<!-- Actions -->
				<div class="flex items-center justify-between mb-4">
					<div class="flex items-center gap-4">
						<!-- Accept Answer Button (for question author) -->
						{#if canAcceptAnswer}
							<button
								type="button"
								class="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed
									{answer.isAccepted 
										? 'text-green-800 bg-green-100 hover:bg-green-200 dark:bg-green-900 dark:text-green-200 dark:hover:bg-green-800' 
										: 'text-green-600 bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/40'
									}"
								disabled={acceptingAnswer}
								on:click={handleAcceptAnswer}
							>
								{#if acceptingAnswer}
									<LoadingSpinner size="sm" />
									<span class="ml-1">
										{answer.isAccepted ? 'Unaccepting...' : 'Accepting...'}
									</span>
								{:else}
									<svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
										<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
									</svg>
									{answer.isAccepted ? 'Unaccept' : 'Accept Answer'}
								{/if}
							</button>
						{/if}

						<!-- Comments Toggle -->
						<button
							type="button"
							class="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
							on:click={toggleComments}
						>
							<svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
							</svg>
							{answer.commentCount} {answer.commentCount === 1 ? 'comment' : 'comments'}
						</button>
					</div>

					<!-- Author and Timestamp -->
					<div class="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
						<button
							type="button"
							class="inline-flex items-center hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
							on:click={handleAuthorClick}
						>
							<svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
							</svg>
							<span class="font-medium {answer.authorRole === 'doctor' ? 'text-green-600 dark:text-green-400' : ''}">
								{answer.authorUsername}
								{#if answer.authorRole === 'doctor'}
									<span class="ml-1 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
										Doctor
									</span>
								{/if}
							</span>
						</button>

						<time datetime={answer.createdAt}>
							{formatDistanceToNow(new Date(answer.createdAt))} ago
						</time>
					</div>
				</div>

				<!-- Comments Section -->
				{#if showComments}
					<div class="border-t border-gray-200 dark:border-gray-700 pt-4">
						{#if loadingComments}
							<div class="flex justify-center py-4">
								<LoadingSpinner />
							</div>
						{:else}
							<CommentSection
								parentType="answer"
								parentId={answer.id}
								{comments}
								on:commentAdded={handleCommentAdded}
							/>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	</div>
</article>