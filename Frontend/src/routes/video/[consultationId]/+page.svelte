<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import VideoCallInterface from '../../../lib/components/video/VideoCallInterface.svelte';
  import { authStore } from '../../../stores/auth';
  import { get } from 'svelte/store';

  let consultationId: string;
  let isAuthorized = false;
  let isLoading = true;
  let error: string | null = null;

  onMount(async () => {
    consultationId = $page.params.consultationId;
    
    // Check if user is authenticated
    const auth = get(authStore);
    if (!auth.user) {
      goto('/auth/login');
      return;
    }

    try {
      // Verify user has access to this consultation
      const response = await fetch(`/api/consultations/${consultationId}`, {
        headers: {
          'Authorization': `Bearer ${auth.token}`
        }
      });

      if (response.ok) {
        const consultation = await response.json();
        
        // Check if user is either doctor or patient
        if (consultation.doctorUsername === auth.user.username || 
            consultation.patientUsername === auth.user.username) {
          isAuthorized = true;
        } else {
          error = 'You are not authorized to join this consultation';
        }
      } else {
        error = 'Consultation not found or access denied';
      }
    } catch (err) {
      console.error('Authorization check failed:', err);
      error = 'Failed to verify consultation access';
    }

    isLoading = false;
  });

  function handleCallEnded() {
    // Redirect to consultations page after call ends
    goto('/consultations');
  }
</script>

<svelte:head>
  <title>Video Consultation - Med Connect</title>
</svelte:head>

{#if isLoading}
  <div class="min-h-screen bg-gray-900 flex items-center justify-center">
    <div class="text-center">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
      <p class="text-white">Verifying consultation access...</p>
    </div>
  </div>
{:else if error}
  <div class="min-h-screen bg-gray-900 flex items-center justify-center">
    <div class="text-center max-w-md mx-4">
      <div class="text-red-500 text-6xl mb-4">🚫</div>
      <h1 class="text-white text-2xl font-bold mb-4">Access Denied</h1>
      <p class="text-gray-300 mb-6">{error}</p>
      <button
        on:click={() => goto('/consultations')}
        class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        Back to Consultations
      </button>
    </div>
  </div>
{:else if isAuthorized}
  <VideoCallInterface 
    {consultationId} 
    onCallEnded={handleCallEnded}
  />
{/if}