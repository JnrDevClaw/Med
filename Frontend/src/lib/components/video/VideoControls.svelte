<script lang="ts">
  export let isVideoEnabled: boolean;
  export let isAudioEnabled: boolean;
  export let isScreenSharing: boolean = false;
  export let onToggleVideo: () => void;
  export let onToggleAudio: () => void;
  export let onToggleScreenShare: () => void;
  export let onEndCall: () => void;

  let showEndCallConfirm = false;

  function handleEndCallClick() {
    showEndCallConfirm = true;
  }

  function confirmEndCall() {
    showEndCallConfirm = false;
    onEndCall();
  }

  function cancelEndCall() {
    showEndCallConfirm = false;
  }
</script>

<div class="bg-gray-800 p-4">
  <div class="flex justify-center items-center space-x-6">
    <!-- Audio Toggle -->
    <button
      on:click={onToggleAudio}
      class="w-12 h-12 rounded-full flex items-center justify-center transition-colors duration-200 {
        isAudioEnabled 
          ? 'bg-gray-600 hover:bg-gray-500 text-white' 
          : 'bg-red-600 hover:bg-red-500 text-white'
      }"
      title={isAudioEnabled ? 'Mute microphone' : 'Unmute microphone'}
    >
      {#if isAudioEnabled}
        <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clip-rule="evenodd" />
        </svg>
      {:else}
        <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M9.383 3.076A1 1 0 0110 4v4a3 3 0 01-4.794 2.402l-.707-.707A1 1 0 014.586 9H4a1 1 0 00-1 1 7.001 7.001 0 006 6.93V19H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07A7.001 7.001 0 0017 10a1 1 0 10-2 0 5 5 0 01-7.54 4.314l-.707-.707A1 1 0 016.586 13H6a3 3 0 01-3-3V4a1 1 0 011.383-.924l12 5a1 1 0 01-.766 1.848L9.383 3.076z" clip-rule="evenodd" />
        </svg>
      {/if}
    </button>

    <!-- Video Toggle -->
    <button
      on:click={onToggleVideo}
      class="w-12 h-12 rounded-full flex items-center justify-center transition-colors duration-200 {
        isVideoEnabled 
          ? 'bg-gray-600 hover:bg-gray-500 text-white' 
          : 'bg-red-600 hover:bg-red-500 text-white'
      }"
      title={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
    >
      {#if isVideoEnabled}
        <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
          <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
        </svg>
      {:else}
        <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A2 2 0 0018 13V7a1 1 0 00-1.447-.894L14 7.382V6a2 2 0 00-2-2H8.586l-.293-.293a1 1 0 00-1.414 0L3.707 2.293zM2 6a2 2 0 012-2h.586l2 2H4v8h6V9.414l2 2V14a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clip-rule="evenodd" />
        </svg>
      {/if}
    </button>

    <!-- End Call -->
    <button
      on:click={handleEndCallClick}
      class="w-12 h-12 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center transition-colors duration-200"
      title="End call"
    >
      <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clip-rule="evenodd" />
      </svg>
    </button>
  </div>

  <!-- Additional Controls Row -->
  <div class="flex justify-center items-center space-x-4 mt-4">
    <!-- Screen Share -->
    <button
      on:click={onToggleScreenShare}
      class="px-4 py-2 rounded-lg transition-colors duration-200 {
        isScreenSharing 
          ? 'bg-blue-600 hover:bg-blue-500 text-white' 
          : 'bg-gray-600 hover:bg-gray-500 text-white'
      }"
      title={isScreenSharing ? 'Stop sharing screen' : 'Share your screen'}
    >
      <svg class="w-5 h-5 inline mr-2" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v8a1 1 0 01-1 1h-5v2h3a1 1 0 110 2H6a1 1 0 110-2h3v-2H4a1 1 0 01-1-1V4zm1 1v6h12V5H4z" clip-rule="evenodd" />
      </svg>
      {isScreenSharing ? 'Stop Sharing' : 'Share Screen'}
    </button>

    <!-- Chat (Future Enhancement) -->
    <button
      disabled
      class="px-4 py-2 bg-gray-600 text-gray-400 rounded-lg cursor-not-allowed"
      title="Chat (coming soon)"
    >
      <svg class="w-5 h-5 inline mr-2" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clip-rule="evenodd" />
      </svg>
      Chat
    </button>
  </div>
</div>

<!-- End Call Confirmation Modal -->
{#if showEndCallConfirm}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg p-6 max-w-sm mx-4">
      <h3 class="text-lg font-semibold text-gray-900 mb-4">End Consultation?</h3>
      <p class="text-gray-600 mb-6">Are you sure you want to end this video consultation? This action cannot be undone.</p>
      
      <div class="flex space-x-4">
        <button
          on:click={cancelEndCall}
          class="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition-colors"
        >
          Cancel
        </button>
        <button
          on:click={confirmEndCall}
          class="flex-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
        >
          End Call
        </button>
      </div>
    </div>
  </div>
{/if}