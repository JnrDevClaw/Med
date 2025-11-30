<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { videoCallService, type ConnectionQuality, type Participant } from '../../../services/videoCallService';
  import VideoControls from './VideoControls.svelte';
  import ConnectionQualityIndicator from './ConnectionQualityIndicator.svelte';
  import ParticipantList from './ParticipantList.svelte';

  export let consultationId: string;
  export let onCallEnded: (() => void) | null = null;

  let localVideoElement: HTMLVideoElement;
  let remoteVideoElement: HTMLVideoElement;
  let localStream: MediaStream | null = null;
  let remoteStream: MediaStream | null = null;
  let participants: Participant[] = [];
  let connectionQuality: ConnectionQuality | null = null;
  let isVideoEnabled = true;
  let isAudioEnabled = true;
  let isConnecting = true;
  let error: string | null = null;
  let callDuration = 0;
  let callStartTime: number | null = null;

  let durationInterval: number;

  onMount(async () => {
    try {
      // Set up event handlers
      videoCallService.onRemoteStream = (stream) => {
        remoteStream = stream;
        if (remoteVideoElement) {
          remoteVideoElement.srcObject = stream;
        }
      };

      videoCallService.onParticipantJoined = (participant) => {
        participants = [...participants, participant];
        if (!callStartTime) {
          callStartTime = Date.now();
          startDurationTimer();
        }
      };

      videoCallService.onParticipantLeft = (participant) => {
        participants = participants.filter(p => p.socketId !== participant.socketId);
      };

      videoCallService.onConnectionQualityUpdate = (quality) => {
        connectionQuality = quality;
      };

      videoCallService.onCallEnded = () => {
        handleCallEnd();
      };

      videoCallService.onError = (errorMessage) => {
        error = errorMessage;
        isConnecting = false;
      };

      // Start local video
      localStream = await videoCallService.startLocalVideo(isVideoEnabled, isAudioEnabled);
      if (localVideoElement) {
        localVideoElement.srcObject = localStream;
      }

      // Join consultation
      await videoCallService.joinConsultation(consultationId);
      isConnecting = false;
      
    } catch (err) {
      console.error('Failed to initialize video call:', err);
      error = err instanceof Error ? err.message : 'Failed to initialize video call';
      isConnecting = false;
    }
  });

  onDestroy(() => {
    if (durationInterval) {
      clearInterval(durationInterval);
    }
    videoCallService.endCall();
  });

  function startDurationTimer() {
    durationInterval = setInterval(() => {
      if (callStartTime) {
        callDuration = Math.floor((Date.now() - callStartTime) / 1000);
      }
    }, 1000);
  }

  function formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }

  function handleToggleAudio() {
    isAudioEnabled = !isAudioEnabled;
    videoCallService.toggleAudio(isAudioEnabled);
  }

  function handleToggleVideo() {
    isVideoEnabled = !isVideoEnabled;
    videoCallService.toggleVideo(isVideoEnabled);
  }

  async function handleEndCall() {
    await videoCallService.endCall();
    handleCallEnd();
  }

  function handleCallEnd() {
    if (durationInterval) {
      clearInterval(durationInterval);
    }
    if (onCallEnded) {
      onCallEnded();
    }
  }
</script>

<div class="video-call-interface h-screen bg-gray-900 flex flex-col">
  <!-- Header -->
  <div class="bg-gray-800 p-4 flex justify-between items-center">
    <div class="flex items-center space-x-4">
      <h2 class="text-white text-lg font-semibold">Video Consultation</h2>
      {#if callStartTime}
        <span class="text-gray-300 text-sm">
          Duration: {formatDuration(callDuration)}
        </span>
      {/if}
    </div>
    
    <div class="flex items-center space-x-4">
      <ConnectionQualityIndicator quality={connectionQuality} />
      <ParticipantList {participants} />
    </div>
  </div>

  <!-- Video Area -->
  <div class="flex-1 relative">
    {#if isConnecting}
      <div class="absolute inset-0 flex items-center justify-center bg-gray-800">
        <div class="text-center">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p class="text-white">Connecting to consultation...</p>
        </div>
      </div>
    {:else if error}
      <div class="absolute inset-0 flex items-center justify-center bg-gray-800">
        <div class="text-center">
          <div class="text-red-500 text-6xl mb-4">⚠️</div>
          <p class="text-white text-lg mb-2">Connection Error</p>
          <p class="text-gray-300">{error}</p>
          <button 
            on:click={handleCallEnd}
            class="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Close
          </button>
        </div>
      </div>
    {:else}
      <!-- Remote Video (Main) -->
      <div class="w-full h-full relative">
        {#if remoteStream}
          <video
            bind:this={remoteVideoElement}
            autoplay
            playsinline
            class="w-full h-full object-cover"
          ></video>
        {:else}
          <div class="w-full h-full bg-gray-700 flex items-center justify-center">
            <div class="text-center">
              <div class="text-gray-400 text-6xl mb-4">👤</div>
              <p class="text-gray-300">Waiting for other participant...</p>
            </div>
          </div>
        {/if}

        <!-- Local Video (Picture-in-Picture) -->
        <div class="absolute top-4 right-4 w-48 h-36 bg-gray-800 rounded-lg overflow-hidden shadow-lg">
          {#if localStream}
            <video
              bind:this={localVideoElement}
              autoplay
              playsinline
              muted
              class="w-full h-full object-cover {!isVideoEnabled ? 'hidden' : ''}"
            ></video>
          {/if}
          {#if !isVideoEnabled}
            <div class="w-full h-full bg-gray-700 flex items-center justify-center">
              <div class="text-gray-400 text-2xl">📹</div>
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>

  <!-- Controls -->
  {#if !isConnecting && !error}
    <VideoControls
      {isVideoEnabled}
      {isAudioEnabled}
      onToggleVideo={handleToggleVideo}
      onToggleAudio={handleToggleAudio}
      onEndCall={handleEndCall}
    />
  {/if}
</div>

<style>
  .video-call-interface {
    user-select: none;
  }
</style>