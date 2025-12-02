<script>
  import { onMount, createEventDispatcher } from 'svelte';
  import { api } from '../../../utils/api.ts';
  import LoadingSpinner from '../LoadingSpinner.svelte';

  const dispatch = createEventDispatcher();

  let sessions = [];
  let loading = true;
  let error = null;
  let selectedSession = null;

  onMount(() => {
    loadHistory();
  });

  async function loadHistory() {
    loading = true;
    error = null;

    try {
      const response = await api.get('/ai/refine/history', { limit: 20 });

      if (response.success) {
        sessions = response.sessions;
      } else {
        throw new Error(response.message || 'Failed to load history');
      }
    } catch (err) {
      console.error('Error loading refinement history:', err);
      error = err.message || 'Failed to load refinement history';
    } finally {
      loading = false;
    }
  }

  async function loadSessionDetails(sessionId) {
    try {
      const response = await api.get(`/ai/refine/${sessionId}`);

      if (response.success) {
        selectedSession = response.session;
        dispatch('sessionSelected', { session: response.session });
      } else {
        throw new Error(response.message || 'Failed to load session details');
      }
    } catch (err) {
      console.error('Error loading session details:', err);
      error = err.message || 'Failed to load session details';
    }
  }

  function getStatusColor(status) {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'refined':
        return 'bg-blue-100 text-blue-800';
      case 'sent':
        return 'bg-green-100 text-green-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  function getStatusIcon(status) {
    switch (status) {
      case 'pending':
        return 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z';
      case 'refined':
        return 'M13 10V3L4 14h7v7l9-11h-7z';
      case 'sent':
        return 'M5 13l4 4L19 7';
      case 'error':
        return 'M6 18L18 6M6 6l12 12';
      default:
        return 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
    }
  }

  function formatDate(dateString) {
    if (!dateString) return 'Unknown';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)} hours ago`;
    } else if (diffInHours < 168) { // 7 days
      return `${Math.floor(diffInHours / 24)} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  }
</script>

<div class="bg-white rounded-lg shadow-sm border border-gray-200">
  <div class="px-6 py-4 border-b border-gray-200">
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-medium text-gray-900">Refinement History</h2>
      <button
        type="button"
        class="inline-flex items-center px-3 py-1 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
        on:click={loadHistory}
        disabled={loading}
      >
        {#if loading}
          <LoadingSpinner size="small" class="mr-2" />
        {:else}
          <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        {/if}
        Refresh
      </button>
    </div>
  </div>

  <div class="p-6">
    {#if loading}
      <div class="flex justify-center items-center py-12">
        <LoadingSpinner size="large" />
      </div>
    {:else if error}
      <div class="rounded-md bg-red-50 p-4">
        <div class="flex">
          <div class="flex-shrink-0">
            <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
            </svg>
          </div>
          <div class="ml-3">
            <h3 class="text-sm font-medium text-red-800">Error</h3>
            <div class="mt-2 text-sm text-red-700">
              <p>{error}</p>
            </div>
          </div>
        </div>
      </div>
    {:else if sessions.length === 0}
      <div class="text-center py-12">
        <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <h3 class="mt-2 text-sm font-medium text-gray-900">No refinement history</h3>
        <p class="mt-1 text-sm text-gray-500">Start a conversation with the AI to see your history here.</p>
      </div>
    {:else}
      <div class="space-y-4">
        {#each sessions as session}
          <div class="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors duration-200 cursor-pointer"
               on:click={() => loadSessionDetails(session.sessionId)}
               on:keydown={(e) => e.key === 'Enter' && loadSessionDetails(session.sessionId)}
               tabindex="0"
               role="button">
            <div class="flex items-start justify-between">
              <div class="flex-1 min-w-0">
                <div class="flex items-center space-x-2 mb-2">
                  <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {getStatusColor(session.status)}">
                    <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="{getStatusIcon(session.status)}" />
                    </svg>
                    {session.status}
                  </span>
                  <span class="text-xs text-gray-500">{formatDate(session.createdAt)}</span>
                </div>
                
                <p class="text-sm text-gray-900 line-clamp-2 mb-2">
                  {session.originalPrompt}
                </p>
                
                <div class="flex items-center text-xs text-gray-500">
                  <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                  Session ID: {session.sessionId.substring(0, 8)}...
                </div>
              </div>
              
              <div class="flex-shrink-0 ml-4">
                <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>