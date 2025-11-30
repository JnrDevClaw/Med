<script>
  export let response;
  export let session;

  $: validation = response?.validation || {};
  $: hasWarnings = validation.warnings && validation.warnings.length > 0;
  $: hasErrors = validation.errors && validation.errors.length > 0;

  function formatResponse(text) {
    if (!text) return '';
    
    // Simple formatting for better readability
    return text
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>');
  }

  function copyToClipboard() {
    if (navigator.clipboard && response?.response) {
      navigator.clipboard.writeText(response.response).then(() => {
        // Could add a toast notification here
        console.log('Response copied to clipboard');
      }).catch(err => {
        console.error('Failed to copy to clipboard:', err);
      });
    }
  }
</script>

<div class="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200">
  <!-- Header -->
  <div class="flex items-center justify-between mb-4">
    <div class="flex items-center">
      <div class="flex-shrink-0">
        <div class="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
          <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </div>
      </div>
      <div class="ml-3">
        <h3 class="text-lg font-medium text-gray-900">AI Medical Response</h3>
        <p class="text-sm text-gray-600">Based on your refined prompt</p>
      </div>
    </div>
    
    <button
      type="button"
      class="inline-flex items-center p-2 border border-transparent rounded-md text-gray-400 hover:text-gray-600 hover:bg-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
      on:click={copyToClipboard}
      title="Copy response to clipboard"
    >
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    </button>
  </div>

  <!-- Validation Warnings -->
  {#if hasWarnings}
    <div class="mb-4 rounded-md bg-yellow-50 p-4">
      <div class="flex">
        <div class="flex-shrink-0">
          <svg class="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
          </svg>
        </div>
        <div class="ml-3">
          <h3 class="text-sm font-medium text-yellow-800">Response Warnings</h3>
          <div class="mt-2 text-sm text-yellow-700">
            <ul class="list-disc list-inside space-y-1">
              {#each validation.warnings as warning}
                <li>{warning}</li>
              {/each}
            </ul>
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- Validation Errors -->
  {#if hasErrors}
    <div class="mb-4 rounded-md bg-red-50 p-4">
      <div class="flex">
        <div class="flex-shrink-0">
          <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
          </svg>
        </div>
        <div class="ml-3">
          <h3 class="text-sm font-medium text-red-800">Response Issues</h3>
          <div class="mt-2 text-sm text-red-700">
            <ul class="list-disc list-inside space-y-1">
              {#each validation.errors as error}
                <li>{error}</li>
              {/each}
            </ul>
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- AI Response Content -->
  <div class="bg-white rounded-md p-4 border border-gray-200">
    <div class="prose prose-sm max-w-none">
      <p>{@html formatResponse(response?.response || '')}</p>
    </div>
  </div>

  <!-- Disclaimer -->
  <div class="mt-4 p-4 bg-blue-50 rounded-md border border-blue-200">
    <div class="flex">
      <div class="flex-shrink-0">
        <svg class="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
        </svg>
      </div>
      <div class="ml-3">
        <h3 class="text-sm font-medium text-blue-800">Medical Disclaimer</h3>
        <div class="mt-2 text-sm text-blue-700">
          <p>
            This AI-generated response is for informational purposes only and should not replace professional medical advice, diagnosis, or treatment. 
            Always consult with qualified healthcare professionals for medical concerns.
          </p>
        </div>
      </div>
    </div>
  </div>

  <!-- Response Metadata -->
  {#if session}
    <div class="mt-4 text-xs text-gray-500 border-t border-gray-200 pt-4">
      <div class="flex justify-between items-center">
        <span>Session ID: {session.sessionId}</span>
        <span>Status: {session.status}</span>
      </div>
    </div>
  {/if}
</div>