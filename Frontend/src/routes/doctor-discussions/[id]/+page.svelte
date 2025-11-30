<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { authStore } from '../../../stores/auth';
  import VerificationGuard from '../../../lib/components/VerificationGuard.svelte';
  import LoadingSpinner from '../../../lib/components/LoadingSpinner.svelte';
  import { doctorDiscussionService } from '../../../services/doctorDiscussionService';
  import type { DoctorDiscussion, DoctorComment } from '../../../types';
  import { formatDistanceToNow } from 'date-fns';

  $: user = $authStore.user;
  $: discussionId = $page.params.id;

  let discussion: DoctorDiscussion | null = null;
  let comments: DoctorComment[] = [];
  let loading = true;
  let commentsLoading = false;
  let error = '';

  // Comment form
  let newComment = {
    content: '',
    parentCommentId: null as string | null,
    taggedDoctors: [] as string[]
  };
  let tagInput = '';
  let submittingComment = false;
  let replyingTo: string | null = null;

  // Doctor search for tagging
  let doctorSearchQuery = '';
  let doctorSearchResults: Array<{ username: string }> = [];
  let showDoctorSearch = false;

  onMount(() => {
    if (discussionId) {
      loadDiscussion();
      loadComments();
    }
  });

  async function loadDiscussion() {
    try {
      loading = true;
      discussion = await doctorDiscussionService.getDiscussion(discussionId);
    } catch (err: any) {
      error = err.message || 'Failed to load discussion';
      console.error('Error loading discussion:', err);
    } finally {
      loading = false;
    }
  }

  async function loadComments() {
    try {
      commentsLoading = true;
      const response = await doctorDiscussionService.getDiscussionComments(discussionId, {
        sortBy: 'oldest',
        limit: 100
      });
      comments = response.comments || [];
    } catch (err: any) {
      console.error('Error loading comments:', err);
    } finally {
      commentsLoading = false;
    }
  }

  async function submitComment() {
    if (!newComment.content.trim()) return;

    try {
      submittingComment = true;
      await doctorDiscussionService.createComment({
        discussionId,
        content: newComment.content,
        parentCommentId: newComment.parentCommentId,
        taggedDoctors: newComment.taggedDoctors
      });

      // Reset form
      newComment = { content: '', parentCommentId: null, taggedDoctors: [] };
      tagInput = '';
      replyingTo = null;
      
      // Reload comments and discussion (to update counts)
      await Promise.all([loadComments(), loadDiscussion()]);
    } catch (err: any) {
      error = err.message || 'Failed to post comment';
    } finally {
      submittingComment = false;
    }
  }

  async function searchDoctors() {
    if (!doctorSearchQuery.trim()) {
      doctorSearchResults = [];
      return;
    }

    try {
      const response = await doctorDiscussionService.searchDoctors(doctorSearchQuery, 10);
      doctorSearchResults = response.doctors || [];
    } catch (err) {
      console.error('Error searching doctors:', err);
      doctorSearchResults = [];
    }
  }

  function addTaggedDoctor(username: string) {
    if (!newComment.taggedDoctors.includes(username)) {
      newComment.taggedDoctors = [...newComment.taggedDoctors, username];
    }
    doctorSearchQuery = '';
    doctorSearchResults = [];
    showDoctorSearch = false;
  }

  function removeTaggedDoctor(username: string) {
    newComment.taggedDoctors = newComment.taggedDoctors.filter(u => u !== username);
  }

  function startReply(commentId: string, authorUsername: string) {
    replyingTo = commentId;
    newComment.parentCommentId = commentId;
    
    // Auto-tag the comment author if not already tagged
    if (!newComment.taggedDoctors.includes(authorUsername)) {
      newComment.taggedDoctors = [...newComment.taggedDoctors, authorUsername];
    }
    
    // Focus on comment input
    setTimeout(() => {
      const commentInput = document.getElementById('comment-content');
      if (commentInput) commentInput.focus();
    }, 100);
  }

  function cancelReply() {
    replyingTo = null;
    newComment.parentCommentId = null;
    newComment.content = '';
    newComment.taggedDoctors = [];
  }

  function formatTimeAgo(dateString: string): string {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return 'Unknown time';
    }
  }

  function getCommentReplies(parentId: string): DoctorComment[] {
    return comments.filter(comment => comment.parentCommentId === parentId);
  }

  function getTopLevelComments(): DoctorComment[] {
    return comments.filter(comment => !comment.parentCommentId);
  }

  async function deleteDiscussion() {
    if (!discussion || discussion.authorUsername !== user?.username) return;
    
    if (confirm('Are you sure you want to delete this discussion? This action cannot be undone.')) {
      try {
        await doctorDiscussionService.deleteDiscussion(discussionId);
        goto('/doctor-discussions');
      } catch (err: any) {
        error = err.message || 'Failed to delete discussion';
      }
    }
  }
</script>

<VerificationGuard requireVerifiedDoctor={true}>
  <div class="container mx-auto px-4 py-8">
    <div class="max-w-4xl mx-auto">
      <!-- Back Button -->
      <div class="mb-6">
        <a
          href="/doctor-discussions"
          class="inline-flex items-center text-blue-600 hover:text-blue-800 transition-colors"
        >
          <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="19 12H5m7-7l-7 7 7 7" />
          </svg>
          Back to Discussions
        </a>
      </div>

      <!-- Error Message -->
      {#if error}
        <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      {/if}

      {#if loading}
        <div class="flex justify-center py-8">
          <LoadingSpinner />
        </div>
      {:else if !discussion}
        <div class="bg-white rounded-lg shadow-md p-8 text-center">
          <h2 class="text-xl font-semibold text-gray-900 mb-2">Discussion Not Found</h2>
          <p class="text-gray-600">The discussion you're looking for doesn't exist or has been removed.</p>
        </div>
      {:else}
        <!-- Discussion Content -->
        <div class="bg-white rounded-lg shadow-md p-6 mb-8">
          <div class="flex justify-between items-start mb-4">
            <div class="flex-1">
              <h1 class="text-2xl font-bold text-gray-900 mb-3">{discussion.title}</h1>
              <div class="flex items-center space-x-4 text-sm text-gray-500">
                <span class="bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                  {discussion.category}
                </span>
                <span>by @{discussion.authorUsername}</span>
                <span>{formatTimeAgo(discussion.createdAt)}</span>
                {#if discussion.updatedAt !== discussion.createdAt}
                  <span>(edited {formatTimeAgo(discussion.updatedAt)})</span>
                {/if}
              </div>
            </div>
            
            {#if user?.username === discussion.authorUsername}
              <div class="flex space-x-2">
                <button
                  on:click={deleteDiscussion}
                  class="text-red-600 hover:text-red-800 p-2 rounded-lg hover:bg-red-50 transition-colors"
                  title="Delete discussion"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            {/if}
          </div>

          <div class="prose max-w-none mb-6">
            <p class="text-gray-700 whitespace-pre-wrap">{discussion.content}</p>
          </div>

          {#if discussion.tags.length > 0}
            <div class="flex flex-wrap gap-2 mb-4">
              {#each discussion.tags as tag}
                <span class="bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-sm">
                  #{tag}
                </span>
              {/each}
            </div>
          {/if}

          <div class="flex items-center justify-between text-sm text-gray-500 pt-4 border-t">
            <div class="flex items-center space-x-4">
              <span class="flex items-center">
                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                {discussion.commentCount} comments
              </span>
              <span class="flex items-center">
                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
                {discussion.participantCount} participants
              </span>
            </div>
            <span>Last activity {formatTimeAgo(discussion.lastActivity)}</span>
          </div>
        </div>

        <!-- Comment Form -->
        <div class="bg-white rounded-lg shadow-md p-6 mb-8">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">
            {replyingTo ? 'Reply to Comment' : 'Add Comment'}
          </h3>

          {#if replyingTo}
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <div class="flex justify-between items-center">
                <span class="text-blue-800 text-sm">Replying to comment</span>
                <button
                  on:click={cancelReply}
                  class="text-blue-600 hover:text-blue-800"
                >
                  Cancel
                </button>
              </div>
            </div>
          {/if}

          <div class="space-y-4">
            <div>
              <label for="comment-content" class="block text-sm font-medium text-gray-700 mb-1">Comment</label>
              <textarea
                id="comment-content"
                bind:value={newComment.content}
                placeholder="Share your thoughts, insights, or questions..."
                rows="4"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                maxlength="2000"
              ></textarea>
            </div>

            <!-- Tagged Doctors -->
            {#if newComment.taggedDoctors.length > 0}
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Tagged Doctors</label>
                <div class="flex flex-wrap gap-2">
                  {#each newComment.taggedDoctors as username}
                    <span class="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm flex items-center">
                      @{username}
                      <button
                        on:click={() => removeTaggedDoctor(username)}
                        class="ml-1 text-blue-600 hover:text-blue-800"
                      >
                        ×
                      </button>
                    </span>
                  {/each}
                </div>
              </div>
            {/if}

            <!-- Doctor Search -->
            <div class="relative">
              <label for="doctor-search" class="block text-sm font-medium text-gray-700 mb-1">Tag Doctors</label>
              <input
                id="doctor-search"
                type="text"
                bind:value={doctorSearchQuery}
                on:input={searchDoctors}
                on:focus={() => showDoctorSearch = true}
                placeholder="Search for doctors to tag..."
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              
              {#if showDoctorSearch && doctorSearchResults.length > 0}
                <div class="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg">
                  {#each doctorSearchResults as doctor}
                    <button
                      on:click={() => addTaggedDoctor(doctor.username)}
                      class="w-full px-3 py-2 text-left hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg"
                    >
                      @{doctor.username}
                    </button>
                  {/each}
                </div>
              {/if}
            </div>

            <div class="flex justify-end">
              <button
                on:click={submitComment}
                disabled={submittingComment || !newComment.content.trim()}
                class="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                {submittingComment ? 'Posting...' : (replyingTo ? 'Post Reply' : 'Post Comment')}
              </button>
            </div>
          </div>
        </div>

        <!-- Comments Section -->
        <div class="bg-white rounded-lg shadow-md p-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-6">
            Comments ({discussion.commentCount})
          </h3>

          {#if commentsLoading}
            <div class="flex justify-center py-4">
              <LoadingSpinner />
            </div>
          {:else if comments.length === 0}
            <div class="text-center py-8">
              <p class="text-gray-600">No comments yet. Be the first to share your thoughts!</p>
            </div>
          {:else}
            <div class="space-y-6">
              {#each getTopLevelComments() as comment}
                <div class="border-l-2 border-gray-200 pl-4">
                  <div class="flex justify-between items-start mb-2">
                    <div class="flex items-center space-x-2">
                      <span class="font-medium text-gray-900">@{comment.authorUsername}</span>
                      <span class="text-sm text-gray-500">{formatTimeAgo(comment.createdAt)}</span>
                      {#if comment.updatedAt !== comment.createdAt}
                        <span class="text-sm text-gray-500">(edited)</span>
                      {/if}
                    </div>
                    <button
                      on:click={() => startReply(comment.id, comment.authorUsername)}
                      class="text-blue-600 hover:text-blue-800 text-sm transition-colors"
                    >
                      Reply
                    </button>
                  </div>

                  <div class="prose max-w-none mb-3">
                    <p class="text-gray-700 whitespace-pre-wrap">{comment.content}</p>
                  </div>

                  {#if comment.taggedDoctors.length > 0}
                    <div class="flex flex-wrap gap-1 mb-3">
                      {#each comment.taggedDoctors as username}
                        <span class="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">
                          @{username}
                        </span>
                      {/each}
                    </div>
                  {/if}

                  <!-- Replies -->
                  {#each getCommentReplies(comment.id) as reply}
                    <div class="ml-6 mt-4 border-l-2 border-gray-100 pl-4">
                      <div class="flex justify-between items-start mb-2">
                        <div class="flex items-center space-x-2">
                          <span class="font-medium text-gray-900">@{reply.authorUsername}</span>
                          <span class="text-sm text-gray-500">{formatTimeAgo(reply.createdAt)}</span>
                          {#if reply.updatedAt !== reply.createdAt}
                            <span class="text-sm text-gray-500">(edited)</span>
                          {/if}
                        </div>
                      </div>

                      <div class="prose max-w-none mb-3">
                        <p class="text-gray-700 whitespace-pre-wrap">{reply.content}</p>
                      </div>

                      {#if reply.taggedDoctors.length > 0}
                        <div class="flex flex-wrap gap-1">
                          {#each reply.taggedDoctors as username}
                            <span class="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">
                              @{username}
                            </span>
                          {/each}
                        </div>
                      {/if}
                    </div>
                  {/each}
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </div>
</VerificationGuard>

<!-- Click outside to close doctor search -->
<svelte:window on:click={() => showDoctorSearch = false} />