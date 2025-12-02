<script>
	import { api } from '../../utils/api.ts';
	
	let corsTestResult = null;
	let testing = false;

	async function testCors() {
		testing = true;
		corsTestResult = null;
		
		try {
			const response = await fetch(`${api.baseUrl || 'https://med-qkh3.onrender.com'}/cors-test`, {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json'
				}
			});
			
			if (response.ok) {
				corsTestResult = await response.json();
			} else {
				corsTestResult = { error: `HTTP ${response.status}: ${response.statusText}` };
			}
		} catch (error) {
			corsTestResult = { error: error.message };
		} finally {
			testing = false;
		}
	}
</script>

<div class="cors-test-container">
	<h3>🌐 CORS Connection Test</h3>
	
	<button 
		on:click={testCors} 
		disabled={testing}
		class="test-button"
	>
		{testing ? 'Testing...' : 'Test CORS Connection'}
	</button>
	
	{#if corsTestResult}
		<div class="result-container">
			{#if corsTestResult.error}
				<div class="error">
					❌ CORS Test Failed: {corsTestResult.error}
				</div>
			{:else}
				<div class="success">
					✅ {corsTestResult.message}
					<div class="details">
						<p><strong>Origin:</strong> {corsTestResult.origin}</p>
						<p><strong>Time:</strong> {new Date(corsTestResult.timestamp).toLocaleString()}</p>
						<p><strong>Allowed Origins:</strong></p>
						<ul>
							{#each corsTestResult.allowedOrigins as origin}
								<li>{origin}</li>
							{/each}
						</ul>
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.cors-test-container {
		padding: 1rem;
		border: 1px solid #e2e8f0;
		border-radius: 8px;
		margin: 1rem 0;
		background: #f8fafc;
	}

	.test-button {
		background: #3b82f6;
		color: white;
		border: none;
		padding: 0.5rem 1rem;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.9rem;
	}

	.test-button:hover:not(:disabled) {
		background: #2563eb;
	}

	.test-button:disabled {
		background: #9ca3af;
		cursor: not-allowed;
	}

	.result-container {
		margin-top: 1rem;
		padding: 1rem;
		border-radius: 4px;
	}

	.success {
		background: #dcfce7;
		border: 1px solid #16a34a;
		color: #15803d;
	}

	.error {
		background: #fef2f2;
		border: 1px solid #dc2626;
		color: #dc2626;
	}

	.details {
		margin-top: 0.5rem;
		font-size: 0.85rem;
	}

	.details ul {
		margin: 0.5rem 0;
		padding-left: 1.5rem;
	}

	.details li {
		margin: 0.25rem 0;
	}

	h3 {
		margin: 0 0 1rem 0;
		color: #374151;
	}
</style>