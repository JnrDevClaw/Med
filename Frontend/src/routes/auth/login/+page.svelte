<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { authStore } from '$stores/auth';
	import { toastStore } from '$stores/toast';
	import Icon from '$lib/Icon.svelte';

	let isLoading = $state(false);
	let did = $state('');
	let error = $state('');

	// Mock DID authentication for demo
	// In a real app, this would integrate with a DID wallet/provider
	async function handleDIDLogin() {
		if (!did.trim()) {
			error = 'Please enter a DID';
			return;
		}

		isLoading = true;
		error = '';

		try {
			// Step 1: Get challenge from server
			const challengeResponse = await fetch('/api/auth/challenge');
			const { challenge } = await challengeResponse.json();

			// Step 2: Mock signature (in real app, this would be signed by DID wallet)
			const mockSignature = `signature_${Date.now()}`;

			// Step 3: Login with DID
			const result = await authStore.login(did, mockSignature, challenge);

			if (result.success) {
				toastStore.success('Welcome back!', 'You have successfully signed in.');
				goto('/dashboard');
			} else {
				error = result.error || 'Login failed';
			}
		} catch (err: any) {
			error = err.message || 'Login failed';
		} finally {
			isLoading = false;
		}
	}

	function goToSignup() {
		goto('/auth/signup');
	}

	// Demo DIDs for testing
	const demoDIDs = [
		'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK', // Patient
		'did:key:z6MktiSzqF9kqwdU8VkdBKx56EYzXfpgnNPUAGznpicNiWfn'  // Doctor
	];

	function useDemoPatient() {
		did = demoDIDs[0];
	}

	function useDemoDoctor() {
		did = demoDIDs[1];
	}

	onMount(() => {
		// If already authenticated, redirect to dashboard
		if ($authStore.isAuthenticated) {
			goto('/dashboard');
		}
	});
</script>

<svelte:head>
	<title>Sign In - MedPlatform</title>
	<meta name="description" content="Sign in to your MedPlatform account using decentralized identity" />
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-100 flex">
	<!-- Left side - Hero section -->
	<div class="hidden lg:flex lg:w-1/2 bg-primary-600 text-white p-12 flex-col justify-center">
		<div class="max-w-md">
			<h1 class="text-4xl font-bold mb-6">
				Welcome to MedPlatform
			</h1>
			<p class="text-xl mb-8 text-primary-100">
				Secure, decentralized healthcare consultations powered by blockchain technology and AI.
			</p>
			
			<div class="space-y-4">
				<div class="flex items-center space-x-3">
					<div class="w-10 h-10 bg-primary-500 rounded-lg flex items-center justify-center">
						<Icon name="shield" class="w-5 h-5" />
					</div>
					<div>
						<h3 class="font-semibold">Decentralized Identity</h3>
						<p class="text-sm text-primary-200">Your data, your control</p>
					</div>
				</div>
				
				<div class="flex items-center space-x-3">
					<div class="w-10 h-10 bg-primary-500 rounded-lg flex items-center justify-center">
						<Icon name="brain" class="w-5 h-5" />
					</div>
					<div>
						<h3 class="font-semibold">AI Medical Assistant</h3>
						<p class="text-sm text-primary-200">24/7 AI-powered consultations</p>
					</div>
				</div>
				
				<div class="flex items-center space-x-3">
					<div class="w-10 h-10 bg-primary-500 rounded-lg flex items-center justify-center">
						<Icon name="video" class="w-5 h-5" />
					</div>
					<div>
						<h3 class="font-semibold">Telemedicine</h3>
						<p class="text-sm text-primary-200">Connect with verified doctors</p>
					</div>
				</div>
				
				<div class="flex items-center space-x-3">
					<div class="w-10 h-10 bg-primary-500 rounded-lg flex items-center justify-center">
						<Icon name="users" class="w-5 h-5" />
					</div>
					<div>
						<h3 class="font-semibold">Community</h3>
						<p class="text-sm text-primary-200">Global healthcare network</p>
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Right side - Login form -->
	<div class="flex-1 flex flex-col justify-center px-6 py-12 lg:px-8">
		<div class="sm:mx-auto sm:w-full sm:max-w-md">
			<div class="text-center mb-8">
				<div class="mx-auto w-12 h-12 bg-primary-600 rounded-xl flex items-center justify-center mb-4">
					<span class="text-white font-bold text-lg">MP</span>
				</div>
				<h2 class="text-3xl font-bold text-gray-900">
					Sign in to your account
				</h2>
				<p class="mt-2 text-gray-600">
					Use your decentralized identity (DID) to access your secure medical platform
				</p>
			</div>

			<div class="card">
				<form onsubmit|preventDefault={handleDIDLogin} class="space-y-6">
					<div>
						<label for="did" class="label">
							Decentralized Identity (DID)
						</label>
						<input
							id="did"
							name="did"
							type="text"
							required
							bind:value={did}
							placeholder="did:key:z6Mk..."
							class="input {error ? 'input-error' : ''}"
							disabled={isLoading}
						/>
						{#if error}
							<p class="mt-1 text-sm text-error-600">{error}</p>
						{/if}
					</div>

					<button
						type="submit"
						class="btn-primary w-full"
						disabled={isLoading}
					>
						{#if isLoading}
							<div class="spinner w-4 h-4 mr-2"></div>
							Authenticating...
						{:else}
							Sign in with DID
						{/if}
					</button>
				</form>

				<!-- Demo section -->
				<div class="mt-6 pt-6 border-t border-gray-200">
					<p class="text-sm text-gray-600 text-center mb-4">
						Quick demo access:
					</p>
					<div class="flex space-x-2">
						<button
							type="button"
							class="btn-outline flex-1 text-xs"
							onclick={useDemoPatient}
							disabled={isLoading}
						>
							Demo Patient
						</button>
						<button
							type="button"
							class="btn-outline flex-1 text-xs"
							onclick={useDemoDoctor}
							disabled={isLoading}
						>
							Demo Doctor
						</button>
					</div>
				</div>

				<div class="mt-6 text-center">
					<p class="text-sm text-gray-600">
						Don't have a DID?
						<button
							type="button"
							class="font-medium text-primary-600 hover:text-primary-500"
							onclick={goToSignup}
						>
							Create account
						</button>
					</p>
				</div>
			</div>

			<!-- Security notice -->
			<div class="mt-8 text-center">
				<p class="text-xs text-gray-500">
					🔒 Your identity is secured by decentralized technology. We never store your private keys.
				</p>
			</div>
		</div>
	</div>
</div>
