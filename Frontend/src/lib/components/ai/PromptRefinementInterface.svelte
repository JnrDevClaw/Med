<script>
  import { createEventDispatcher } from 'svelte';
  import { authStore } from '../../../stores/auth.ts';
  import { api } from '../../../utils/api.ts';
  import LoadingSpinner from '../LoadingSpinner.svelte';

  export let session = null;

  const dispatch = createEventDispatcher();

  let originalPrompt = '';
  let refinedPrompt = '';
  let isRefining = false;
  let isSending = false;
  let error = null;
  let improvements = [];
  let showComparison = false;

  $: if (session) {
    originalPrompt = session.originalPrompt || '';
    refinedPrompt = session.refinedPrompt || '';
    showComparison = !!session.refinedPrompt;
  }

  async function createRefinementSession() {
    if (!originalPrompt.trim()) {
      error = 'Please enter a medical question or concern';
      return;
    }

    if (originalPrompt.length > 2000) {
      error = 'Prompt is too long. Please keep it under 2000 characters.';
      return;
    }

    error = null;
    isRefining = true;

    try {
      const response = await api.post('/ai/refine/create', { prompt: originalPrompt });

      if (response.success) {
        session = {
          sessionId: response.sessionId,
          originalPrompt: response.originalPrompt,
          preprocessedPrompt: response.preprocessedPrompt,
          status: response.status
        };

        dispatch('sessionCreated', { session });
      } else {
        throw new Error(response.message || 'Failed to create refinement session');
      }
    } catch (err) {
      console.error('Error creating refinement session:', err);
      error = err.message || 'Failed to create refinement session';
    } finally {
      isRefining = false;
    }
  }

  async function refinePrompt() {
    if (!session?.sessionId) {
      error = 'No active session';
      return;
    }

    error = null;
    isRefining = true;

    try {
      const response = await api.post(`/ai/refine/${session.sessionId}`);

      if (response.success) {
        session = {
          ...session,
          refinedPrompt: response.refinedPrompt,
          status: response.status
        };
        refinedPrompt = response.refinedPrompt;
        improvements = response.improvements || [];
        showComparison = true;

        dispatch('promptRefined', { session, improvements });
      } else {
        throw new Error(response.message || 'Failed to refine prompt');
      }
    } catch (err) {
      console.error('Error refining prompt:', err);
      error = err.message || 'Failed to refine prompt';
    } finally {
      isRefining = false;
    }
  }

  async function updateAndRefinePrompt() {
    if (!session?.sessionId) {
      error = 'No active session';
      return;
    }

    if (!originalPrompt.trim()) {
      error = 'Please enter a medical question or concern';
      return;
    }

    if (originalPrompt.length > 2000) {
      error = 'Prompt is too long. Please keep it under 2000 characters.';
      return;
    }

    error = null;
    isRefining = true;

    try {
      const response = await api.put(`/ai/refine/${session.sessionId}`, { prompt: originalPrompt });

      if (response.success) {
        session = {
          ...session,
          originalPrompt: response.originalPrompt,
          refinedPrompt: response.refinedPrompt,
          status: response.status
        };
        refinedPrompt = response.refinedPrompt;
        showComparison = true;

        dispatch('promptRefined', { session });
      } else {
        throw new Error(response.message || 'Failed to update and refine prompt');
      }
    } catch (err) {
      console.error('Error updating and refining prompt:', err);
      error = err.message || 'Failed to update and refine prompt';
    } finally {
      isRefining = false;
    }
  }

  async function sendRefinedPrompt() {
    if (!session?.sessionId || !session.refinedPrompt) {
      error = 'No refined prompt to send';
      return;
    }

    error = null;
    isSending = true;

    try {
      const response = await api.post(`/ai/refine/${session.sessionId}/send`);

      if (response.success) {
        session = {
          ...session,
          status: 'sent'
        };

        dispatch('aiResponse', { 
          response: response.response,
          session,
          validation: response.validation
        });
      } else {
        throw new Error(response.message || 'Failed to send refined prompt');
      }
    } catch (err) {
      console.error('Error sending refined prompt:', err);
      error = err.message || 'Failed to send refined prompt';
    } finally {
      isSending = false;
    }
  }

  function handleKeydown(event) {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      if (!session) {
        createRefinementSession();
      } else if (session.status === 'pending') {
        refinePrompt();
      }
    }
  }
</script>

<div class="space-y-6">
  <!-- Original Prompt Input -->
  <div>
    <label for="original-prompt" class="block text-sm font-medium text-gray-700 mb-2">
      Your Medical Question
    </label>
    <div class="relative">
      <textarea
        id="original-prompt"
        bind:value={originalPrompt}
        on:keydown={handleKeydown}
        placeholder="Describe your symptoms, concerns, or medical questions here..."
        rows="4"
        class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm resize-none"
        disabled={isRefining || isSending}
        maxlength="2000"
      ></textarea>
      <div class="absolute bottom-2 right-2 text-xs text-gray-400">
        {originalPrompt.length}/2000
      </div>
    </div>
    <p class="mt-1 text-xs text-gray-500">
      Press Ctrl+Enter to quickly refine your prompt
    </p>
  </div>

  <!-- Action Buttons -->
  <div class="flex flex-wrap gap-3">
    {#if !session}
      <button
        type="button"
        class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
        on:click={createRefinementSession}
        disabled={isRefining || !originalPrompt.trim()}
      >
        {#if isRefining}
          <LoadingSpinner size="small" class="mr-2" />
        {:else}
          <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        {/if}
        Refine Prompt
      </button>
    {:else if session.status === 'pending'}
      <button
        type="button"
        class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
        on:click={refinePrompt}
        disabled={isRefining}
      >
        {#if isRefining}
          <LoadingSpinner size="small" class="mr-2" />
        {:else}
          <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        {/if}
        Refine Prompt
      </button>
    {:else if session.status === 'refined'}
      <button
        type="button"
        class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
        on:click={sendRefinedPrompt}
        disabled={isSending}
      >
        {#if isSending}
          <LoadingSpinner size="small" class="mr-2" />
        {:else}
          <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        {/if}
        Send to AI
      </button>
      
      <button
        type="button"
        class="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
        on:click={updateAndRefinePrompt}
        disabled={isRefining || isSending}
      >
        {#if isRefining}
          <LoadingSpinner size="small" class="mr-2" />
        {:else}
          <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        {/if}
        Edit & Re-refine
      </button>
    {/if}
  </div>

  <!-- Error Display -->
  {#if error}
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
  {/if}

  <!-- Prompt Comparison -->
  {#if showComparison && refinedPrompt}
    <div class="bg-gray-50 rounded-lg p-6">
      <h3 class="text-lg font-medium text-gray-900 mb-4">Prompt Comparison</h3>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- Original Prompt -->
        <div>
          <h4 class="text-sm font-medium text-gray-700 mb-2">Original Prompt</h4>
          <div class="bg-white p-4 rounded-md border border-gray-200">
            <p class="text-sm text-gray-900 whitespace-pre-wrap">{originalPrompt}</p>
          </div>
        </div>

        <!-- Refined Prompt -->
        <div>
          <h4 class="text-sm font-medium text-gray-700 mb-2">Refined Prompt</h4>
          <div class="bg-blue-50 p-4 rounded-md border border-blue-200">
            <p class="text-sm text-gray-900 whitespace-pre-wrap">{refinedPrompt}</p>
          </div>
        </div>
      </div>

      <!-- Improvements -->
      {#if improvements.length > 0}
        <div class="mt-4">
          <h4 class="text-sm font-medium text-gray-700 mb-2">Improvements Made</h4>
          <ul class="list-disc list-inside space-y-1">
            {#each improvements as improvement}
              <li class="text-sm text-green-700">{improvement}</li>
            {/each}
          </ul>
        </div>
      {/if}
    </div>
  {/if}
</div>