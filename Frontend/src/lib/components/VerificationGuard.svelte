<script lang="ts">
  import { authStore } from '../../stores/auth';
  import VerificationService from '../../services/verificationService';
  import VerificationStatus from './VerificationStatus.svelte';
  import type { User } from '$types';

  export let requireVerified: boolean = false;
  export let requireVerifiedDoctor: boolean = false;
  export let fallbackMessage: string = '';
  export let showVerificationStatus: boolean = true;

  $: user = $authStore.user;
  $: canAccess = checkAccess(user);

  function checkAccess(user: User | null): boolean {
    if (!user) return false;
    
    if (requireVerifiedDoctor) {
      return VerificationService.isVerifiedDoctor(user);
    }
    
    if (requireVerified) {
      return VerificationService.isVerified(user);
    }
    
    return true;
  }

  function getAccessMessage(user: User | null): string {
    if (fallbackMessage) return fallbackMessage;
    
    if (!user) return 'Please log in to access this feature.';
    
    if (requireVerifiedDoctor) {
      if (user.role !== 'doctor') {
        return 'This feature is only available to doctors.';
      }
      return 'This feature requires doctor verification. Please upload your credentials to get verified.';
    }
    
    if (requireVerified) {
      return 'This feature requires account verification. Please verify your account to continue.';
    }
    
    return 'Access denied.';
  }
</script>

{#if canAccess}
  <slot />
{:else}
  <div class="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-md mx-auto text-center p-6">
      <!-- Access Denied Icon -->
      <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
        <svg class="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      </div>

      <!-- Access Message -->
      <h3 class="text-lg font-medium text-gray-900 mb-2">Access Restricted</h3>
      <p class="text-sm text-gray-600 mb-6">{getAccessMessage(user)}</p>

      <!-- Verification Status -->
      {#if showVerificationStatus && user}
        <div class="mb-6">
          <VerificationStatus {user} showPrompt={true} />
        </div>
      {/if}

      <!-- Action Buttons -->
      <div class="flex flex-col sm:flex-row gap-3 justify-center">
        {#if !user}
          <a 
            href="/auth/login" 
            class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Log In
          </a>
        {:else if requireVerifiedDoctor && user.role !== 'doctor'}
          <a 
            href="/auth/signup" 
            class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Register as Doctor
          </a>
        {:else if !user.verified}
          <a 
            href={VerificationService.getVerificationRedirectPath(user)} 
            class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            {user.role === 'doctor' ? 'Upload Credentials' : 'Verify Account'}
          </a>
        {/if}
        
        <a 
          href="/" 
          class="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Go Home
        </a>
      </div>
    </div>
  </div>
{/if}