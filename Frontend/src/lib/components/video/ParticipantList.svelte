<script lang="ts">
  import type { Participant } from '../../../services/videoCallService';

  export let participants: Participant[];

  let showList = false;

  function getRoleIcon(role: 'doctor' | 'patient'): string {
    return role === 'doctor' ? '👨‍⚕️' : '👤';
  }

  function getRoleColor(role: 'doctor' | 'patient'): string {
    return role === 'doctor' ? 'text-blue-400' : 'text-gray-300';
  }
</script>

<div class="relative">
  <button
    on:click={() => showList = !showList}
    class="flex items-center space-x-2 px-3 py-1 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors"
    title="Participants"
  >
    <svg class="w-5 h-5 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
      <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
    </svg>
    <span class="text-sm text-gray-300">
      {participants.length + 1} {participants.length === 0 ? 'participant' : 'participants'}
    </span>
  </button>

  {#if showList}
    <div class="absolute top-full right-0 mt-2 w-64 bg-gray-800 rounded-lg shadow-lg p-4 z-10">
      <h4 class="text-white font-semibold mb-3">Participants</h4>
      
      <div class="space-y-2">
        <!-- Current user (you) -->
        <div class="flex items-center space-x-3 p-2 bg-gray-700 rounded-lg">
          <span class="text-lg">👤</span>
          <div class="flex-1">
            <div class="text-sm text-white font-medium">You</div>
            <div class="text-xs text-gray-400">Current user</div>
          </div>
          <div class="w-2 h-2 bg-green-500 rounded-full" title="Connected"></div>
        </div>

        <!-- Other participants -->
        {#each participants as participant}
          <div class="flex items-center space-x-3 p-2 bg-gray-700 rounded-lg">
            <span class="text-lg">{getRoleIcon(participant.role)}</span>
            <div class="flex-1">
              <div class="text-sm text-white font-medium">{participant.username}</div>
              <div class="text-xs {getRoleColor(participant.role)} capitalize">
                {participant.role}
              </div>
            </div>
            <div class="w-2 h-2 bg-green-500 rounded-full" title="Connected"></div>
          </div>
        {/each}

        <!-- Empty state -->
        {#if participants.length === 0}
          <div class="text-center py-4">
            <div class="text-gray-400 text-sm">Waiting for other participants...</div>
          </div>
        {/if}
      </div>

      <!-- Consultation Info -->
      <div class="border-t border-gray-700 pt-3 mt-3">
        <div class="text-xs text-gray-400">
          <div class="flex justify-between">
            <span>Status:</span>
            <span class="text-green-400">Active</span>
          </div>
          <div class="flex justify-between mt-1">
            <span>Type:</span>
            <span>Video Consultation</span>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>

<!-- Click outside to close -->
{#if showList}
  <div 
    class="fixed inset-0 z-0" 
    on:click={() => showList = false}
  ></div>
{/if}