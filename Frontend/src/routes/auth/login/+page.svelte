<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { authStore } from '$stores/auth';
	import { toastStore } from '$stores/toast';
	import Icon from '$lib/Icon.svelte';

	let isLoading = false;
	let username = '';
	let password = '';
	let error = '';

	// Password authentication
	async function handleLogin(event) {
		event.preventDefault();
		if (!username.trim()) {
			error = 'Please enter your username';
			return;
		}
		if (!password.trim()) {
			error = 'Please enter your password';
			return;
		}

		isLoading = true;
		error = '';

		try {
			const result = await authStore.login(username, password);

			if (result.success) {
				toastStore.success('Welcome back!', 'You have successfully signed in.');
				goto('/dashboard');
			} else {
				error = result.error || 'Invalid username or password';
			}
		} catch (err) {
			error = err?.message || 'Login failed';
		} finally {
			isLoading = false;
		}
	}

	function goToSignup() {
		goto('/auth/signup');
	}

	function goHome() {
		goto('/');
	}

	// Demo DIDs for testing
</script>

<svelte:head>
	<title>Login - MedConnect</title>
	<meta name="description" content="Login to your MedConnect account" />
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-med-gray-50 to-med-green-50 flex">
	<!-- Left side - Hero section -->
	<div class="hidden lg:flex lg:w-1/2 med-gradient-primary text-white p-12 flex-col justify-center">
		<div class="max-w-md">
			<div class="flex items-center space-x-2 mb-6">
				<div class="w-10 h-10 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
					<Icon name="stethoscope" class="w-6 h-6 text-white" />
				</div>
				<span class="text-2xl font-bold">MedConnect</span>
			</div>
			
			<h1 class="text-4xl font-bold mb-6">
				Welcome Back
			</h1>
			<p class="text-xl mb-8 text-med-green-100">
				Access your secure medical platform with AI-powered healthcare assistance and verified doctor consultations.
			</p>
			
			<div class="space-y-4">
				<div class="flex items-center space-x-3">
					<div class="w-10 h-10 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.031 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
						</svg>
					</div>
					<div>
						<h3 class="font-semibold">Secure & Private</h3>
						<p class="text-sm text-med-green-200">HIPAA compliant platform</p>
					</div>
				</div>
				
				<div class="flex items-center space-x-3">
					<div class="w-10 h-10 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
						</svg>
					</div>
					<div>
						<h3 class="font-semibold">AI Assistant</h3>
						<p class="text-sm text-med-green-200">24/7 medical guidance</p>
					</div>
				</div>
				
				<div class="flex items-center space-x-3">
					<div class="w-10 h-10 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
						<Icon name="video" class="w-5 h-5" />
					</div>
					<div>
						<h3 class="font-semibold">Video Consultations</h3>
						<p class="text-sm text-med-green-200">Connect with verified doctors</p>
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Right side - Login form -->
	<div class="flex-1 flex flex-col justify-center px-6 py-12 lg:px-8">
		<div class="sm:mx-auto sm:w-full sm:max-w-md">
			<div class="text-center mb-8">
				<button 
					class="mx-auto w-12 h-12 bg-med-green-700 rounded-xl flex items-center justify-center mb-4 hover:bg-med-green-600 transition duration-200"
					onclick={goHome}
				>
					<Icon name="stethoscope" class="w-6 h-6 text-white" />
				</button>
				<h2 class="text-3xl font-bold text-med-gray-900">
					Login to your account
				</h2>
				<p class="mt-2 text-med-gray-600">
					Enter your credentials to access your medical dashboard
				</p>
			</div>

				<div class="med-card-elevated">
					<form onsubmit={handleLogin} class="space-y-6">
					<div>
						<label for="username" class="block text-sm font-medium text-med-gray-900 mb-2">
							Username
						</label>
							<input
							id="username"
							name="username"
							type="text"
							required
							bind:value={username}
							placeholder="Enter your username"
								class="med-input {error ? 'border-med-error focus:ring-med-error' : ''}"
							disabled={isLoading}
						/>
					</div>

					<div>
						<label for="password" class="block text-sm font-medium text-med-gray-900 mb-2">
							Password
						</label>
						<input
							id="password"
							name="password"
							type="password"
							required
							bind:value={password}
							placeholder="Enter your password"
							class="med-input {error ? 'border-med-error focus:ring-med-error' : ''}"
							disabled={isLoading}
						/>
					</div>

					{#if error}
						<div class="bg-med-red-700 bg-opacity-10 border border-med-red-700 text-med-red-700 px-4 py-3 rounded-xl">
							<p class="text-sm">{error}</p>
						</div>
					{/if}

					<button
						type="submit"
						class="med-btn med-btn-primary w-full"
						disabled={isLoading}
					>
						{#if isLoading}
							<div class="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
							Signing in...
						{:else}
							Login
						{/if}
					</button>
				</form>

				<div class="mt-6 text-center">
					<p class="text-sm text-med-gray-600">
						Don't have an account?
						<button
							type="button"
							class="font-medium text-med-green-700 hover:text-med-green-600"
							onclick={goToSignup}
						>
							Sign up here
						</button>
					</p>
					<p class="mt-2 text-xs text-med-gray-500">
						<a href="/forgot-password" class="hover:text-med-green-700">Forgot your password?</a>
					</p>
				</div>
			</div>

			<!-- Security notice -->
			<div class="mt-8 text-center">
				<p class="text-xs text-med-gray-500">
					🔒 Your data is protected with end-to-end encryption and blockchain security.
				</p>
			</div>
		</div>
	</div>
</div>
