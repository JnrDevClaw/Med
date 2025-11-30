<script lang="ts">
  import { onMount } from 'svelte';
  import { authStore } from '../../stores/auth';
  import VerificationGuard from '../../lib/components/VerificationGuard.svelte';
  import VerificationStatus from '../../lib/components/VerificationStatus.svelte';
  import LoadingSpinner from '../../lib/components/LoadingSpinner.svelte';
  import { doctorDiscussionService } from '../../services/doctorDiscussionService';
  import type { DoctorDiscussion, DiscussionCategory } from '../../types';
  import { formatDistanceToNow } from 'date-fns';

  $: user = $authStore.user;

  let discussions: DoctorDiscussion[] = [];
  let categories: DiscussionCategory[] = [];
  let loading = true;
  let error = '';
  let showCreateForm = false;

  // Filters
  let selectedCategory = '';
  let sortBy: 'newest' | 'oldest' | 'mostActive' = 'newest';
  let searchQuery = '';
  let currentPage = 1;
  let totalPages = 1;
  let hasNext = false;

  // Create form
  let newDiscussion = {
    title: '',
    content: '',
    category: '',
    tags: [] as string[]
  };
  let tagInput = '';
  let creating = false;

  onMount(() => {
    loadDiscussions();
    loadCategories();
  });

  async function loadDiscussions() {
    try {
      loading = true;
      const response = await doctorDiscussionService.getDiscussions({
        category: selectedCategory || undefined,
        sortBy,
        search: searchQuery || undefined,
        page: currentPage,
        limit: 10
      });
      
      discussions = response.discussions || [];
      hasNext = response.pagination?.hasNext || false;
      totalPages = Math.ceil((response.pagination?.total || 0) / 10);
    } catch (err: any) {
      error = err.message || 'Failed to load discussions';
      console.error('Error loading discussions:', err);
    } finally {
      loading = false;
    }
  }

  async function loadCategories() {
    try {
      const response = await doctorDiscussionService.getCategories();
      categories = response.categories || [];
    } catch (err) {
      console.error('Error loading categories:', err);
    }
  }

  async function createDiscussion() {
    if (!newDiscussion.title.trim() || !newDiscussion.content.trim() || !newDiscussion.category.trim()) {
      return;
    }

    try {
      creating = true;
      await doctorDiscussionService.createDiscussion(newDiscussion);
      
      // Reset form
      newDiscussion = { title: '', content: '', category: '', tags: [] };
      tagInput = '';
      showCreateForm = false;
      
      // Reload discussions
      currentPage = 1;
      await loadDiscussions();
      await loadCategories();
    } catch (err: any) {
      error = err.message || 'Failed to create discussion';
    } finally {
      creating = false;
    }
  }

  function addTag() {
    if (tagInput.trim() && !newDiscussion.tags.includes(tagInput.trim())) {
      newDiscussion.tags = [...newDiscussion.tags, tagInput.trim()];
      tagInput = '';
    }
  }

  function removeTag(tag: string) {
    newDiscussion.tags = newDiscussion.tags.filter(t => t !== tag);
  }

  function handleKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      addTag();
    }
  }

  function handleFilterChange() {
    currentPage = 1;
    loadDiscussions();
  }

  function nextPage() {
    if (hasNext) {
      currentPage++;
      loadDiscussions();
    }
  }

  function prevPage() {
    if (currentPage > 1) {
      currentPage--;
      loadDiscussions();
    }
  }

  function formatTimeAgo(dateString: string): string {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return 'Unknown time';
    }
  }
</script>

<VerificationGuard requireVerifiedDoctor={true}>
  <div class="container mx-auto px-4 py-8">
    <div class="max-w-6xl mx-auto">
      <!-- Header -->
      <div class="mb-8">
        <div class="flex justify-between items-center">
          <div>
            <h1 class="text-3xl font-bold text-gray-900 mb-2">Doctor Discussions</h1>
            <p class="text-gray-600">Private discussion forum for verified medical professionals</p>
          </div>
          <button
            on:click={() => showCreateForm = !showCreateForm}
            class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            {showCreateForm ? 'Cancel' : 'New Discussion'}
          </button>
        </div>
      </div>

      <!-- Verification Status Display -->
      <div class="mb-6">
        <VerificationStatus {user} showPrompt={false} />
      </div>

      <!-- Error Message -->
      {#if error}
        <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      {/if}

      <!-- Create Discussion Form -->
      {#if showCreateForm}
        <div class="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 class="text-xl font-semibold text-gray-900 mb-4">Create New Discussion</h2>
          
          <div class="space-y-4">
            <div>
              <label for="title" class="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input
                id="title"
                type="text"
                bind:value={newDiscussion.title}
                placeholder="Enter discussion title..."
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                maxlength="200"
              />
            </div>

            <div>
              <label for="category" class="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <input
                id="category"
                type="text"
                bind:value={newDiscussion.category}
                placeholder="e.g., Cardiology, Emergency Medicine..."
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                maxlength="50"
              />
            </div>

            <div>
              <label for="content" class="block text-sm font-medium text-gray-700 mb-1">Content</label>
              <textarea
                id="content"
                bind:value={newDiscussion.content}
                placeholder="Describe your discussion topic, case, or question..."
                rows="6"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                maxlength="10000"
              ></textarea>
            </div>

            <div>
              <label for="tags" class="block text-sm font-medium text-gray-700 mb-1">Tags</label>
              <div class="flex flex-wrap gap-2 mb-2">
                {#each newDiscussion.tags as tag}
                  <span class="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm flex items-center">
                    {tag}
                    <button
                      on:click={() => removeTag(tag)}
                      class="ml-1 text-blue-600 hover:text-blue-800"
                    >
                      ×
                    </button>
                  </span>
                {/each}
              </div>
              <input
                id="tags"
                type="text"
                bind:value={tagInput}
                on:keypress={handleKeyPress}
                placeholder="Add tags (press Enter to add)..."
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                maxlength="30"
              />
            </div>

            <div class="flex justify-end space-x-3">
              <button
                on:click={() => showCreateForm = false}
                class="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                on:click={createDiscussion}
                disabled={creating || !newDiscussion.title.trim() || !newDiscussion.content.trim() || !newDiscussion.category.trim()}
                class="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                {creating ? 'Creating...' : 'Create Discussion'}
              </button>
            </div>
          </div>
        </div>
      {/if}

      <!-- Filters -->
      <div class="bg-white rounded-lg shadow-md p-4 mb-6">
        <div class="flex flex-wrap gap-4 items-center">
          <div>
            <label for="search" class="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <input
              id="search"
              type="text"
              bind:value={searchQuery}
              on:input={handleFilterChange}
              placeholder="Search discussions..."
              class="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label for="category-filter" class="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              id="category-filter"
              bind:value={selectedCategory}
              on:change={handleFilterChange}
              class="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Categories</option>
              {#each categories as category}
                <option value={category.name}>{category.name} ({category.count})</option>
              {/each}
            </select>
          </div>

          <div>
            <label for="sort" class="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
            <select
              id="sort"
              bind:value={sortBy}
              on:change={handleFilterChange}
              class="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="mostActive">Most Active</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Discussions List -->
      {#if loading}
        <div class="flex justify-center py-8">
          <LoadingSpinner />
        </div>
      {:else if discussions.length === 0}
        <div class="bg-white rounded-lg shadow-md p-8 text-center">
          <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h3 class="text-lg font-medium text-gray-900 mb-2">No discussions found</h3>
          <p class="text-gray-600 mb-4">
            {selectedCategory || searchQuery ? 'Try adjusting your filters or search terms.' : 'Be the first to start a discussion!'}
          </p>
          {#if !showCreateForm}
            <button
              on:click={() => showCreateForm = true}
              class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              Create First Discussion
            </button>
          {/if}
        </div>
      {:else}
        <div class="space-y-4">
          {#each discussions as discussion}
            <div class="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
              <div class="flex justify-between items-start mb-3">
                <div class="flex-1">
                  <a
                    href="/doctor-discussions/{discussion.id}"
                    class="text-xl font-semibold text-gray-900 hover:text-blue-600 transition-colors"
                  >
                    {discussion.title}
                  </a>
                  <div class="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                    <span class="bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                      {discussion.category}
                    </span>
                    <span>by @{discussion.authorUsername}</span>
                    <span>{formatTimeAgo(discussion.createdAt)}</span>
                  </div>
                </div>
              </div>

              <p class="text-gray-700 mb-4 line-clamp-3">
                {discussion.content}
              </p>

              {#if discussion.tags.length > 0}
                <div class="flex flex-wrap gap-2 mb-4">
                  {#each discussion.tags as tag}
                    <span class="bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-sm">
                      #{tag}
                    </span>
                  {/each}
                </div>
              {/if}

              <div class="flex items-center justify-between text-sm text-gray-500">
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
          {/each}
        </div>

        <!-- Pagination -->
        {#if totalPages > 1}
          <div class="flex justify-center items-center space-x-4 mt-8">
            <button
              on:click={prevPage}
              disabled={currentPage === 1}
              class="px-4 py-2 text-gray-600 hover:text-gray-800 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <span class="text-gray-600">
              Page {currentPage} of {totalPages}
            </span>
            <button
              on:click={nextPage}
              disabled={!hasNext}
              class="px-4 py-2 text-gray-600 hover:text-gray-800 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        {/if}
      {/if}
    </div>
  </div>
</VerificationGuard>