<script lang="ts">
  import type { ConnectionQuality } from '../../../services/videoCallService';

  export let quality: ConnectionQuality | null;

  $: overallQuality = quality ? getOverallQuality(quality) : 'unknown';
  $: qualityColor = getQualityColor(overallQuality);
  $: qualityIcon = getQualityIcon(overallQuality);

  function getOverallQuality(q: ConnectionQuality): 'good' | 'fair' | 'poor' | 'unknown' {
    if (!q) return 'unknown';
    
    const scores = [q.audio.quality, q.video.quality];
    
    if (scores.includes('poor')) return 'poor';
    if (scores.includes('fair')) return 'fair';
    return 'good';
  }

  function getQualityColor(q: string): string {
    switch (q) {
      case 'good': return 'text-green-500';
      case 'fair': return 'text-yellow-500';
      case 'poor': return 'text-red-500';
      default: return 'text-gray-500';
    }
  }

  function getQualityIcon(q: string): string {
    switch (q) {
      case 'good': return '📶';
      case 'fair': return '📶';
      case 'poor': return '📶';
      default: return '❓';
    }
  }

  function formatBitrate(bitrate: number): string {
    if (bitrate < 1000) return `${bitrate} bps`;
    if (bitrate < 1000000) return `${(bitrate / 1000).toFixed(1)} kbps`;
    return `${(bitrate / 1000000).toFixed(1)} Mbps`;
  }

  function formatRTT(rtt: number): string {
    return `${Math.round(rtt * 1000)}ms`;
  }

  let showDetails = false;
</script>

<div class="relative">
  <button
    on:click={() => showDetails = !showDetails}
    class="flex items-center space-x-2 px-3 py-1 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors"
    title="Connection quality"
  >
    <span class="text-lg">{qualityIcon}</span>
    <span class="text-sm {qualityColor} capitalize">
      {overallQuality === 'unknown' ? 'Connecting...' : overallQuality}
    </span>
  </button>

  {#if showDetails && quality}
    <div class="absolute top-full right-0 mt-2 w-80 bg-gray-800 rounded-lg shadow-lg p-4 z-10">
      <h4 class="text-white font-semibold mb-3">Connection Details</h4>
      
      <!-- Audio Quality -->
      <div class="mb-3">
        <div class="flex justify-between items-center mb-1">
          <span class="text-gray-300 text-sm">Audio</span>
          <span class="text-sm {getQualityColor(quality.audio.quality)} capitalize">
            {quality.audio.quality}
          </span>
        </div>
        <div class="text-xs text-gray-400">
          Bitrate: {formatBitrate(quality.audio.bitrate)} | 
          Lost: {quality.audio.packetsLost} packets
        </div>
      </div>

      <!-- Video Quality -->
      <div class="mb-3">
        <div class="flex justify-between items-center mb-1">
          <span class="text-gray-300 text-sm">Video</span>
          <span class="text-sm {getQualityColor(quality.video.quality)} capitalize">
            {quality.video.quality}
          </span>
        </div>
        <div class="text-xs text-gray-400">
          Bitrate: {formatBitrate(quality.video.bitrate)} | 
          Lost: {quality.video.packetsLost} packets
          {#if quality.video.resolution}
            <br>Resolution: {quality.video.resolution.width}x{quality.video.resolution.height}
          {/if}
        </div>
      </div>

      <!-- Connection Stats -->
      <div class="border-t border-gray-700 pt-3">
        <div class="text-gray-300 text-sm mb-2">Connection</div>
        <div class="text-xs text-gray-400 space-y-1">
          <div>Latency: {formatRTT(quality.connection.rtt)}</div>
          <div>Bandwidth: {formatBitrate(quality.connection.bandwidth)}</div>
        </div>
      </div>

      <!-- Quality Recommendations -->
      {#if overallQuality === 'poor' || overallQuality === 'fair'}
        <div class="border-t border-gray-700 pt-3 mt-3">
          <div class="text-yellow-400 text-sm mb-2">💡 Recommendations</div>
          <div class="text-xs text-gray-400">
            {#if quality.connection.rtt > 0.3}
              • High latency detected - consider audio-only mode<br>
            {/if}
            {#if quality.video.packetsLost > 20}
              • Video issues - try reducing video quality<br>
            {/if}
            {#if quality.audio.packetsLost > 10}
              • Audio issues - check internet connection<br>
            {/if}
            {#if quality.connection.bandwidth < 500000}
              • Low bandwidth - consider audio-only consultation
            {/if}
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>

<!-- Click outside to close -->
{#if showDetails}
  <div 
    class="fixed inset-0 z-0" 
    on:click={() => showDetails = false}
  ></div>
{/if}