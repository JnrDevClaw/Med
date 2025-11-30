<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { goto } from '$app/navigation';
	import { authStore } from '$stores/auth';
	import { api } from '$utils/api';
	import { formatDistanceToNow } from '$utils/date';
	import type { Comment } from '$types';
	import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';

	export let parentType: 'question' | 'answer';
	export let parentId: string;
	export let comments: Comment[] = [];

	const dispatch = createEventDispatcher();

	let showCommentForm = false;
	let newCommentContent = '';
	let submittingComment = false;
	let commentError = '';
	let replyToCommentId: string | null = null;
	let replyToUsername = '';

	// Form validation
	$: commentValid = newCommentContent.trim().length >= 1 && newCommentContent.trim().length <= 1000;

	async function handleSubmitComment() {
		if (!commentValid || submittingComment) return;

		if (!$authStore.isAuthenticated) {
			goto('/auth/login');
			return;
		}

		try {
			submittingComment = true;
			commentError = '';

			const commentData = {
				content: newCommentContent.trim(),
				parentId,
				parentType,
				replyToCommentId
			};

			const response = await api.createComment(commentData);
			
			// Add the new comment to the list
			comments = [...comments, response.comment];
			
			// Reset form
			newCommentContent = '';
			showCommentForm = false;
			replyToCommentId = null;
			replyToUsername = '';
			
			// Dispatch event
			dispatch('commentAdded', response.comment);
		} catch (err: any) {
			commentError = err.message || 'Failed to submit comment';
			console.error('Error creating comment:', err);
		} finally {
			submittingComment = false;
		}
	}

	function handleCancelComment() {
		newCommentContent = '';
		showCommentForm = false;
		replyToCommentId = null;
		replyToUsername = '';
		commentError = '';
	}

	function handleReplyToComment(comment: Comment) {
		replyToCommentId = comment.id;
		replyToUsername = comment.authorUsername;
		newCommentContent = `@${comment.authorUsername} `;
		showCommentForm = true;
	}

	function handleTagUser(username: string) {
		const cursorPos = newCommentContent.length;
		newCommentContent += `@${username} `;
	}

	function handleAuthorClick(username: string) {
		// Navigate to user profile when implemented
		// goto(`/users/${username}`);
	}

	function extractMentions(content: string): { text: string; mentions: string[] } {
		const mentions: string[] = [];
		const text = content.replace(/@(\w+)/g, (match, username) => {
			mentions.push(username);
			return `<span class="text-blue-600 dark:text-blue-400 font-medium">${match}</span>`;
		});
		return { text, mentions };
	}

	// Group comments by thread (replies under parent comments)
	$: commentThreads = (() => {
		const threads: { comment: Comment; replies: Comment[] }[] = [];
		const parentComments = comments.filter(c => !c.replyToCommentId);
		
		parentComments.forEach(parent => {
			const replies = comments.filter(c => c.replyToCommentId === parent.id);
			threads.push({ comment: parent, replies });
		});
		
		return threads;
	})();
</script>

<div class="space-y-4">
	<!-- Existing Comments -->
	{#if commentThreads.length > 0}
		<div class="space-y-3">
			{#each commentThreads as thread}
				<!-- Parent Comment -->
				<div class="flex gap-3">
					<div class="flex-shrink-0">
						<div class="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
							<svg class="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
							</svg>
						</div>
					</div>
					
					<div class="flex-1 min-w-0">
						<div class="text-sm">
							<button
								type="button"
								class="font-medium hover:text-blue-600 dark:hover:text-blue-400 transition-colors {thread.comment.authorRole === 'doctor' ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'}"
								on:click={() => handleAuthorClick(thread.comment.authorUsername)}
							>
								{thread.comment.authorUsername}
								{#if thread.comment.authorRole === 'doctor'}
									<span class="ml-1 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
										Doctor
									</span>
								{/if}
							</button>
							<time class="text-gray-500 dark:text-gray-400 ml-2" datetime={thread.comment.createdAt}>
								{formatDistanceToNow(new Date(thread.comment.createdAt))} ago
							</time>
						</div>
						
						<div class="mt-1 text-sm text-gray-700 dark:text-gray-300">
							{@html extractMentions(thread.comment.content).text}
						</div>
						
						{#if $authStore.isAuthenticated}
							<div class="mt-2">
								<button
									type="button"
									class="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
									on:click={() => handleReplyToComment(thread.comment)}
								>
									Reply
								</button>
							</div>
						{/if}
					</div>
				</div>

				<!-- Replies -->
				{#if thread.replies.length > 0}
					<div class="ml-11 space-y-3">
						{#each thread.replies as reply}
							<div class="flex gap-3">
								<div class="flex-shrink-0">
									<div class="w-6 h-6 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
										<svg class="w-3 h-3 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
										</svg>
									</div>
								</div>
								
								<div class="flex-1 min-w-0">
									<div class="text-sm">
										<button
											type="button"
											class="font-medium hover:text-blue-600 dark:hover:text-blue-400 transition-colors {reply.authorRole === 'doctor' ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'}"
											on:click={() => handleAuthorClick(reply.authorUsername)}
										>
											{reply.authorUsername}
											{#if reply.authorRole === 'doctor'}
												<span class="ml-1 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
													Doctor
												</span>
											{/if}
										</button>
										<time class="text-gray-500 dark:text-gray-400 ml-2" datetime={reply.createdAt}>
											{formatDistanceToNow(new Date(reply.createdAt))} ago
										</time>
									</div>
									
									<div class="mt-1 text-sm text-gray-700 dark:text-gray-300">
										{@html extractMentions(reply.content).text}
									</div>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			{/each}
		</div>
	{/if}

	<!-- Add Comment Form -->
	{#if $authStore.isAuthenticated}
		{#if !showCommentForm}
			<button
				type="button"
				class="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
				on:click={() => showCommentForm = true}
			>
				Add a comment
			</button>
		{:else}
			<div class="space-y-3">
				{#if replyToCommentId}
					<div class="text-sm text-gray-600 dark:text-gray-400">
						Replying to <span class="font-medium">@{replyToUsername}</span>
						<button
							type="button"
							class="ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
							on:click={handleCancelComment}
						>
							Cancel
						</button>
					</div>
				{/if}

				<!-- Error Message -->
				{#if commentError}
					<div class="rounded-md bg-red-50 p-3 dark:bg-red-900/20">
						<div class="text-sm text-red-800 dark:text-red-200">
							{commentError}
						</div>
					</div>
				{/if}

				<form on:submit|preventDefault={handleSubmitComment} class="space-y-3">
					<div>
						<textarea
							bind:value={newCommentContent}
							placeholder="Add a comment..."
							maxlength="1000"
							rows="3"
							class="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400 dark:focus:ring-blue-500 dark:focus:border-blue-500"
							required
						></textarea>
						<div class="mt-1 flex justify-between text-xs text-gray-500 dark:text-gray-400">
							<span>Use @username to mention someone</span>
							<span>{newCommentContent.length}/1000</span>
						</div>
					</div>

					<div class="flex justify-end gap-2">
						<button
							type="button"
							class="px-3 py-1.5 text-sm text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-600"
							on:click={handleCancelComment}
							disabled={submittingComment}
						>
							Cancel
						</button>
						
						<button
							type="submit"
							class="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
							disabled={!commentValid || submittingComment}
						>
							{#if submittingComment}
								<LoadingSpinner size="sm" color="white" />
								<span class="ml-1">Posting...</span>
							{:else}
								Post Comment
							{/if}
						</button>
					</div>
				</form>
			</div>
		{/if}
	{:else}
		<div class="text-sm text-gray-500 dark:text-gray-400">
			<a href="/auth/login" class="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200">Sign in</a> to add a comment
		</div>
	{/if}
</div>