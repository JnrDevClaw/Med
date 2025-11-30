<script>
  import { onMount } from 'svelte';
  import { authStore } from '../../stores/auth.ts';
  import { goto } from '$app/navigation';
  import LoadingSpinner from '../../lib/components/LoadingSpinner.svelte';
  import PromptRefinementInterface from '../../lib/components/ai/PromptRefinementInterface.svelte';
  import AIResponseDisplay from '../../lib/components/ai/AIResponseDisplay.svelte';
  import RefinementHistory from '../../lib/components/ai/RefinementHistory.svelte';

  let user = null;
  let loading = true;
  let activeTab = 'chat'; // chat, history
  let currentSession = null;
  let aiResponse = null;

  onMount(() => {
    const unsubscribe = authStore.subscribe(value => {
      user = value.user;
      loading = value.loading;
      
      if (!loading && !user) {
        goto('/auth/login');
      }
    });

    return unsubscribe;
  });

  function handleSessionCreated(event) {
    currentSession = event.detail.session;
    activeTab = 'chat';
  }

  function handlePromptRefined(event) {
    currentSession = event.detail.session;
  }

  function handleAIResponse(event) {
    aiResponse = event.detail.response;
    currentSession = event.detail.session;
  }

  function handleNewChat() {
    currentSession = null;
    aiResponse = null;
    activeTab = 'chat';
  }

  function handleHistorySelect(event) {
    currentSession = event.detail.session;
    aiResponse = null;
    activeTab = 'chat';
  }
</script>

<svelte:head>
  <title>AI Medical Assistant - Med Connect</title>
  <meta name="description" content="Get AI-powered medical assistance with prompt refinement" />
</svelte:head>

{#if loading}
  <div class="flex justify-center items-center min-h-screen">
    <LoadingSpinner size="large" />
  </div>
{:else if user}
  <div class="container mx-auto px-4 py-8 max-w-6xl">
    <!-- Header -->
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-gray-900 mb-2">AI Medical Assistant</h1>
      <p class="text-gray-600">
        Get personalized medical guidance with AI-powered prompt refinement. 
        Your prompts are refined for better accuracy before being sent to our medical AI.
      </p>
    </div>

    <!-- Navigation Tabs -->
    <div class="mb-6">
      <nav class="flex space-x-8" aria-label="Tabs">
        <button
          class="py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-200 {activeTab === 'chat' 
            ? 'border-blue-500 text-blue-600' 
            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
          on:click={() => activeTab = 'chat'}
        >
          AI Chat
        </button>
        <button
          class="py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-200 {activeTab === 'history' 
            ? 'border-blue-500 text-blue-600' 
            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
          on:click={() => activeTab = 'history'}
        >
          History
        </button>
      </nav>
    </div>

    <!-- Chat Tab -->
    {#if activeTab === 'chat'}
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Main Chat Area -->
        <div class="lg:col-span-2">
          <div class="bg-white rounded-lg shadow-sm border border-gray-200">
            <div class="p-6">
              <!-- New Chat Button -->
              {#if currentSession || aiResponse}
                <div class="mb-4">
                  <button
                    class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
                    on:click={handleNewChat}
                  >
                    <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                    </svg>
                    New Chat
                  </button>
                </div>
              {/if}

              <!-- AI Response Display -->
              {#if aiResponse}
                <div class="mb-6">
                  <AIResponseDisplay 
                    response={aiResponse}
                    session={currentSession}
                  />
                </div>
              {/if}

              <!-- Prompt Refinement Interface -->
              <PromptRefinementInterface
                session={currentSession}
                on:sessionCreated={handleSessionCreated}
                on:promptRefined={handlePromptRefined}
                on:aiResponse={handleAIResponse}
              />
            </div>
          </div>
        </div>

        <!-- Sidebar -->
        <div class="lg:col-span-1">
          <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 class="text-lg font-medium text-gray-900 mb-4">How it works</h3>
            <div class="space-y-4">
              <div class="flex items-start">
                <div class="flex-shrink-0">
                  <div class="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <span class="text-blue-600 font-semibold text-sm">1</span>
                  </div>
                </div>
                <div class="ml-3">
                  <h4 class="text-sm font-medium text-gray-900">Enter your question</h4>
                  <p class="text-sm text-gray-600">Type your medical question or concern</p>
                </div>
              </div>
              
              <div class="flex items-start">
                <div class="flex-shrink-0">
                  <div class="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <span class="text-blue-600 font-semibold text-sm">2</span>
                  </div>
                </div>
                <div class="ml-3">
                  <h4 class="text-sm font-medium text-gray-900">AI refines your prompt</h4>
                  <p class="text-sm text-gray-600">Our AI improves your question for better results</p>
                </div>
              </div>
              
              <div class="flex items-start">
                <div class="flex-shrink-0">
                  <div class="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <span class="text-blue-600 font-semibold text-sm">3</span>
                  </div>
                </div>
                <div class="ml-3">
                  <h4 class="text-sm font-medium text-gray-900">Review and send</h4>
                  <p class="text-sm text-gray-600">Approve the refined prompt or edit the original</p>
                </div>
              </div>
              
              <div class="flex items-start">
                <div class="flex-shrink-0">
                  <div class="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <span class="text-blue-600 font-semibold text-sm">4</span>
                  </div>
                </div>
                <div class="ml-3">
                  <h4 class="text-sm font-medium text-gray-900">Get AI response</h4>
                  <p class="text-sm text-gray-600">Receive personalized medical guidance</p>
                </div>
              </div>
            </div>

            <div class="mt-6 p-4 bg-yellow-50 rounded-md">
              <div class="flex">
                <div class="flex-shrink-0">
                  <svg class="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                  </svg>
                </div>
                <div class="ml-3">
                  <h3 class="text-sm font-medium text-yellow-800">Important Notice</h3>
                  <div class="mt-2 text-sm text-yellow-700">
                    <p>This AI assistant provides general information only. Always consult with healthcare professionals for medical advice, diagnosis, or treatment.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    {/if}

    <!-- History Tab -->
    {#if activeTab === 'history'}
      <RefinementHistory
        on:sessionSelected={handleHistorySelect}
      />
    {/if}
  </div>
{:else}
  <div class="flex justify-center items-center min-h-screen">
    <div class="text-center">
      <h2 class="text-2xl font-bold text-gray-900 mb-4">Authentication Required</h2>
      <p class="text-gray-600 mb-6">Please log in to access the AI Medical Assistant.</p>
      <a
        href="/auth/login"
        class="inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      >
        Log In
      </a>
    </div>
  </div>
{/if}

<style>
  :global(.prose) {
    max-width: none;
  }
</style>