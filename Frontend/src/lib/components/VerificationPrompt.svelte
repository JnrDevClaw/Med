<script lang="ts">
  import { authStore } from '../../stores/auth';
  import VerificationService from '../../services/verificationService';
  import { createEventDispatcher } from 'svelte';

  export let dismissible: boolean = true;
  export let persistent: boolean = false;

  const dispatch = createEventDispatcher();

  $: user = $authStore.user;
  $: verificationPrompt = VerificationService.getVerificationPrompt(user);
  $: shouldShow = verificationPrompt.show && (!dismissed || persistent);

  let dismissed = false;

  function handleDismiss() {
    if (dismissible) {
      dismissed = true;
      dispatch('dismiss');
    }
  }

  function handleAction() {
    dispatch('action', { path: verificationPrompt.actionPath });
    if (verificationPrompt.actionPath) {
      window.location.href = verificationPrompt.actionPath;
    }
  }
</script>

{#if shouldShow}
  <div class="verification-prompt bg-gradient-to-r from-yellow-50 to-orange-50 border-l-4 border-yellow-400 p-4 mb-6 rounded-r-lg shadow-sm">
    <div class="flex items-start">
      <div class="flex-shrink-0">
        <svg class="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
        </svg>
      </div>
      <div class="ml-3 flex-1">
        <h3 class="text-sm font-medium text-yellow-800">
          {verificationPrompt.title}
        </h3>
        <div class="mt-2 text-sm text-yellow-700">
          <p>{verificationPrompt.message}</p>
        </div>
        <div class="mt-4 flex items-center gap-3">
          <button
            type="button"
            on:click={handleAction}
            class="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-yellow-800 bg-yellow-100 hover:bg-yellow-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 transition-colors"
          >
            {verificationPrompt.actionText}
          </button>
          {#if dismissible}
            <button
              type="button"
              on:click={handleDismiss}
              class="text-sm text-yellow-700 hover:text-yellow-800 underline"
            >
              Dismiss
            </button>
          {/if}
        </div>
      </div>
      {#if dismissible}
        <div class="flex-shrink-0 ml-4">
          <button
            type="button"
            on:click={handleDismiss}
            class="inline-flex text-yellow-400 hover:text-yellow-600 focus:outline-none focus:text-yellow-600"
          >
            <span class="sr-only">Dismiss</span>
            <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
            </svg>
          </button>
        </div>
      {/if}
    </div>
  </div>
{/if}