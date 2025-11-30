<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { authStore } from '$stores/auth';
	import { api } from '$utils/api';
	import { formatDistanceToNow } from '$utils/date';
	import type { Question, Answer, Comment, Vote } from '$types';
	import VoteButtons from '$lib/components/qa/VoteButtons.svelte';
	import AnswerCard from '$lib/components/qa/AnswerCard.svelte';
	import AnswerForm from '$lib/components/qa/AnswerForm.svelte';
	import CommentSection from '$lib/components/qa/CommentSection.svelte';
	import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';

	let question: Question | null = null;
	let answers: Answer[] = [];
	let questionComments: Comment[] = [];
	let loading = true;
	let error = '';
	let userVote: Vote | null = null;
	let loadingVote = false;
	let sortBy: 'upvotes' | 'oldest' | 'newest' = 'upvotes';

	$: questionId = $page.params.id;

	async function loadQuestion() {
		if (!questionId) return;

		try {
			loading = true;
			error = '';

			const response = await api.getQuestion(questionId);
			question = response;

			// Load user's vote if authenticated
			if ($authStore.isAuthenticated) {
				try {
					const voteResponse = await api.getUserVoteOnQuestion(questionId);
					userVote = voteResponse.vote;
				} catch (voteError) {
					console.error('Error loading user vote:', voteError);
				}
			}
		} catch (err: any) {
			error = err.message || 'Failed to load question';
			console.error('Error loading question:', err);
		} finally {
			loading = false;
		}
	}

	async function loadAnswers() {
		if (!questionId) return;

		try {
			const response = await api.getAnswers(questionId, { sortBy, limit: 50 });
			answers = response.answers;
		} catch (err) {
			console.error('Error loading answers:', err);
		}
	}

	async function loadQuestionComments() {
		if (!questionId) return;

		try {
			const response = await api.getComments('question', questionId);
			questionComments = response.comments;
		} catch (err) {
			console.error('Error loading question comments:', err);
		}
	}

	async function handleQuestionVote(voteType: 'upvote' | 'downvote') {
		if (!$authStore.isAuthenticated) {
			goto('/auth/login');
			return;
		}

		if (!question) return;

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
		} catch (error: any) {
			console.error('Error voting on question:', error);
		} finally {
			loadingVote = false;
		}
	}

	function handleAnswerAdded(event: CustomEvent<Answer>) {
		answers = [event.detail, ...answers];
		if (question) {
			question.answerCount += 1;
		}
	}

	function handleAnswerUpdated(event: CustomEvent<Answer>) {
		const updatedAnswer = event.detail;
		answers = answers.map(answer => 
			answer.id === updatedAnswer.id ? updatedAnswer : answer
		);
	}

	function handleAnswerDeleted(event: CustomEvent<string>) {
		const deletedAnswerId = event.detail;
		answers = answers.filter(answer => answer.id !== deletedAnswerId);
		if (question) {
			question.answerCount = Math.max(0, question.answerCount - 1);
		}
	}

	function handleCommentAdded() {
		// Reload comments when a new comment is added
		loadQuestionComments();
	}

	function handleSortChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		sortBy = target.value as 'upvotes' | 'oldest' | 'newest';
		loadAnswers();
	}

	function handleTagClick(tag: string) {
		goto(`/qa?search=${encodeURIComponent(tag)}`);
	}

	function handleCategoryClick() {
		if (question) {
			goto(`/qa?category=${encodeURIComponent(question.category)}`);
		}
	}

	function handleAuthorClick() {
		// Navigate to user profile when implemented
		// goto(`/users/${question.authorUsername}`);
	}

	onMount(() => {
		loadQuestion();
		loadAnswers();
		loadQuestionComments();
	});

	// Reload data when question ID changes
	$: if (questionId) {
		loadQuestion();
		loadAnswers();
		loadQuestionComments();
	}
</script>

<svelte:head>
	<title>{question?.title || 'Question'} - Med Connect</title>
	<meta name="description" content={question?.content ? question.content.substring(0, 160) + '...' : 'Medical question and answers'} />
</svelte:head>

<div class="min-h-screen bg-gray-50 dark:bg-gray-900">
	<div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
		<!-- Back Button -->
		<div class="mb-6">
			<button
				type="button"
				class="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
				on:click={() => goto('/qa')}
			>
				<svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
				</svg>
				Back to Questions
			</button>
		</div>

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
				<h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">Error Loading Question</h3>
				<p class="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
				<button
					type="button"
					class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-600 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-blue-900 dark:text-blue-200 dark:hover:bg-blue-800"
					on:click={loadQuestion}
				>
					Try Again
				</button>
			</div>
		{:else if question}
			<!-- Question -->
			<article class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
				<div class="p-6">
					<div class="flex gap-4">
						<!-- Vote Section -->
						<div class="flex-shrink-0">
							<VoteButtons
								upvotes={question.upvotes}
								downvotes={question.downvotes}
								userVote={userVote?.voteType}
								loading={loadingVote}
								size="lg"
								on:vote={(e) => handleQuestionVote(e.detail)}
							/>
						</div>

						<!-- Content Section -->
						<div class="flex-1 min-w-0">
							<!-- Title -->
							<h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-4">
								{question.title}
							</h1>

							<!-- Content -->
							<div class="text-gray-700 dark:text-gray-300 mb-6 prose dark:prose-invert max-w-none">
								{@html question.content}
							</div>

							<!-- Tags -->
							{#if question.tags && question.tags.length > 0}
								<div class="flex flex-wrap gap-2 mb-6">
									{#each question.tags as tag}
										<button
											type="button"
											class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 transition-colors"
											on:click={() => handleTagClick(tag)}
										>
											#{tag}
										</button>
									{/each}
								</div>
							{/if}

							<!-- Meta Information -->
							<div class="flex flex-wrap items-center justify-between gap-4 text-sm text-gray-500 dark:text-gray-400 mb-6">
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
								<time datetime={question.createdAt}>
									Asked {formatDistanceToNow(new Date(question.createdAt))} ago
								</time>
							</div>

							<!-- Question Comments -->
							<CommentSection
								parentType="question"
								parentId={question.id}
								comments={questionComments}
								on:commentAdded={handleCommentAdded}
							/>
						</div>
					</div>
				</div>
			</article>

			<!-- Answers Section -->
			<div class="space-y-6">
				<!-- Answers Header -->
				<div class="flex items-center justify-between">
					<h2 class="text-xl font-semibold text-gray-900 dark:text-white">
						{question.answerCount} {question.answerCount === 1 ? 'Answer' : 'Answers'}
					</h2>
					
					{#if answers.length > 1}
						<div class="flex items-center gap-2">
							<label for="sort-answers" class="text-sm text-gray-600 dark:text-gray-400">Sort by:</label>
							<select
								id="sort-answers"
								bind:value={sortBy}
								on:change={handleSortChange}
								class="text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
							>
								<option value="upvotes">Most Upvoted</option>
								<option value="newest">Newest First</option>
								<option value="oldest">Oldest First</option>
							</select>
						</div>
					{/if}
				</div>

				<!-- Answer Form -->
				{#if $authStore.isAuthenticated}
					<AnswerForm
						questionId={question.id}
						on:answerAdded={handleAnswerAdded}
					/>
				{:else}
					<div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-4">
						<div class="flex items-center">
							<svg class="w-5 h-5 text-blue-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
							</svg>
							<div>
								<p class="text-sm text-blue-800 dark:text-blue-200">
									<a href="/auth/login" class="font-medium underline hover:no-underline">Sign in</a> to answer this question
								</p>
							</div>
						</div>
					</div>
				{/if}

				<!-- Answers List -->
				{#if answers.length > 0}
					<div class="space-y-4">
						{#each answers as answer (answer.id)}
							<AnswerCard
								{answer}
								questionAuthor={question.authorUsername}
								on:answerUpdated={handleAnswerUpdated}
								on:answerDeleted={handleAnswerDeleted}
							/>
						{/each}
					</div>
				{:else if question.answerCount === 0}
					<div class="text-center py-8">
						<div class="text-gray-400 dark:text-gray-600 mb-4">
							<svg class="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
							</svg>
						</div>
						<h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">No answers yet</h3>
						<p class="text-gray-600 dark:text-gray-400">
							Be the first to help by answering this question!
						</p>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>