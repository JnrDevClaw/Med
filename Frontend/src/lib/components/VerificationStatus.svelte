<script lang="ts">
  import { authStore } from '../../stores/auth';
  import VerificationService from '../../services/verificationService';
  import type { User } from '$types';

  export let user: User | null = null;
  export let showPrompt: boolean = true;
  export let compact: boolean = false;

  $: currentUser = user || $authStore.user;
  $: verificationStatus = VerificationService.getVerificationStatus(currentUser);
  $: verificationPrompt = VerificationService.getVerificationPrompt(currentUser);

  function handleVerificationAction() {
    if (verificationPrompt.actionPath) {
      window.location.href = verificationPrompt.actionPath;
    }
  }
</script>

{#if currentUser}
  <div class="verification-status">
    <!-- Verification Badge -->
    <div class="flex items-center gap-2">
      <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium {verificationStatus.color === 'green' ? 'bg-green-100 text-green-800' : verificationStatus.color === 'yellow' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'}">
        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          {#if verificationStatus.icon === 'check-circle'}
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
          {:else if verificationStatus.icon === 'exclamation-triangle'}
            <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
          {:else}
            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" />
          {/if}
        </svg>
        <span class="text-sm font-medium">{verificationStatus.label}</span>
      </div>
    </div>

    <!-- Verification Prompt -->
    {#if showPrompt && verificationPrompt.show && !compact}
      <div class="verification-prompt mt-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <div class="flex items-start gap-3">
          <svg class="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
          </svg>
          <div class="flex-1">
            <h4 class="text-sm font-medium text-yellow-800">{verificationPrompt.title}</h4>
            <p class="text-sm text-yellow-700 mt-1">{verificationPrompt.message}</p>
            <button 
              on:click={handleVerificationAction}
              class="mt-3 inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-yellow-800 bg-yellow-100 hover:bg-yellow-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 transition-colors"
            >
              {verificationPrompt.actionText}
            </button>
          </div>
        </div>
      </div>
    {/if}

    <!-- Doctor Requirements (for unverified doctors) -->
    {#if currentUser.role === 'doctor' && !currentUser.verified && !compact}
      <div class="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h5 class="text-sm font-medium text-blue-800 mb-2">Verification Requirements:</h5>
        <ul class="text-sm text-blue-700 space-y-1">
          {#each VerificationService.getDoctorVerificationRequirements() as requirement}
            <li class="flex items-center gap-2">
              <svg class="w-3 h-3 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
              </svg>
              {requirement}
            </li>
          {/each}
        </ul>
      </div>
    {/if}
  </div>
{/if}