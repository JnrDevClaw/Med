<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { authStore } from '$stores/auth';
	import { toastStore } from '$stores/toast';
	import { validateEmail } from '$utils/helpers';
	import Icon from '$lib/Icon.svelte';

	let isLoading = $state(false);
	let step = $state(1); // 1: role selection, 2: DID generation, 3: profile setup
	let selectedRole = $state<'patient' | 'doctor' | null>(null);
	let generatedDID = $state('');
	let profile = $state({
		name: '',
		email: '',
		bio: '',
		specializations: [] as string[],
		experience: 0
	});
	let errors = $state<Record<string, string>>({});

	// Mock DID generation (in real app, this would use a proper DID library)
	function generateDID(): string {
		const keyId = 'z6Mk' + Math.random().toString(36).substr(2, 40);
		return `did:key:${keyId}`;
	}

	function selectRole(role: 'patient' | 'doctor') {
		selectedRole = role;
		step = 2;
		
		// Generate a new DID
		generatedDID = generateDID();
	}

	function validateProfile(): boolean {
		errors = {};
		
		if (!profile.name.trim()) {
			errors.name = 'Name is required';
		}
		
		if (profile.email && !validateEmail(profile.email)) {
			errors.email = 'Please enter a valid email address';
		}
		
		if (selectedRole === 'doctor') {
			if (!profile.bio.trim()) {
				errors.bio = 'Bio is required for doctors';
			}
			
			if (profile.specializations.length === 0) {
				errors.specializations = 'At least one specialization is required';
			}
			
			if (profile.experience < 0) {
				errors.experience = 'Experience must be a positive number';
			}
		}
		
		return Object.keys(errors).length === 0;
	}

	async function handleSignup(event?: Event) {
		event?.preventDefault?.();
		if (!selectedRole || !validateProfile()) {
			return;
		}

		isLoading = true;

		try {
			const signupData = {
				name: profile.name,
				role: selectedRole,
				email: profile.email || undefined
			};

			const result = await authStore.signup(generatedDID, signupData);

			if (result.success) {
				toastStore.success(
					'Account created successfully!',
					'You can now sign in with your DID.'
				);
				goto('/auth/login');
			} else {
				toastStore.error('Signup failed', result.error);
			}
		} catch (err: any) {
			toastStore.error('Signup failed', err.message);
		} finally {
			isLoading = false;
		}
	}

	function goBack() {
		if (step > 1) {
			step--;
		} else {
			goto('/auth/login');
		}
	}

	function addSpecialization() {
		const input = document.getElementById('specialization-input') as HTMLInputElement;
		const value = input.value.trim();
		
		if (value && !profile.specializations.includes(value)) {
			profile.specializations = [...profile.specializations, value];
			input.value = '';
		}
	}

	function removeSpecialization(spec: string) {
		profile.specializations = profile.specializations.filter(s => s !== spec);
	}

	onMount(() => {
		// If already authenticated, redirect to dashboard
		if ($authStore.isAuthenticated) {
			goto('/dashboard');
		}
	});
</script>

<svelte:head>
	<title>Create Account - MedPlatform</title>
	<meta name="description" content="Create your secure MedPlatform account with decentralized identity" />
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-primary-800 via-primary-700 to-secondary-900 flex flex-col justify-center px-6 py-12 text-white">
	<div class="sm:mx-auto sm:w-full sm:max-w-2xl">
		<!-- Header -->
		<div class="text-center mb-10">
			<div class="mx-auto w-16 h-16 bg-gradient-to-br from-yellow-400 to-pink-500 rounded-2xl flex items-center justify-center mb-4 shadow-xl">
				<span class="text-white font-extrabold text-xl">MP</span>
			</div>
			<h2 class="text-4xl font-extrabold tracking-tight">
				Create your MedPlatform account
			</h2>
			<p class="mt-2 text-primary-200 max-w-xl mx-auto">
				Join the decentralized healthcare platform with enterprise-grade privacy and AI assistance.
			</p>
		</div>

	<div class="card glass p-8 shadow-2xl border border-white/10 bg-white/5">
			<!-- Progress indicator -->
			<div class="mb-6">
				<div class="flex items-center justify-between text-sm">
					<span class="text-gray-500">Step {step} of 3</span>
					<button
						type="button"
						class="text-primary-600 hover:text-primary-500 flex items-center"
						onclick={goBack}
					>
						<Icon name="arrow-left" class="w-4 h-4 mr-1" />
						Back
					</button>
				</div>
				<div class="mt-2 w-full bg-gray-200 rounded-full h-2">
					<div
						class="bg-primary-600 h-2 rounded-full transition-all duration-300"
						style="width: {(step / 3) * 100}%"
					></div>
				</div>
			</div>

			{#if step === 1}
				<!-- Step 1: Role Selection -->
				<div class="space-y-4">
					<h3 class="text-lg font-medium text-gray-900 text-center mb-6">
						What describes you best?
					</h3>
					
					<button
						type="button"
						class="w-full p-6 rounded-lg bg-white/5 hover:bg-white/10 transition-shadow border border-white/10 shadow-sm text-left"
						onclick={() => selectRole('patient')}
					>
						<div class="flex items-start space-x-4">
							<div class="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
								<Icon name="user" class="w-6 h-6 text-primary-600" />
							</div>
							<div>
								<h4 class="text-lg font-medium text-gray-900">I'm a Patient</h4>
								<p class="text-gray-600">
									Looking for medical consultations, AI assistance, and healthcare services
								</p>
							</div>
						</div>
					</button>
					
					<button
						type="button"
						class="w-full p-6 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 transition-colors text-left text-white shadow-lg"
						onclick={() => selectRole('doctor')}
					>
						<div class="flex items-start space-x-4">
							<div class="w-12 h-12 bg-success-100 rounded-lg flex items-center justify-center">
								<Icon name="stethoscope" class="w-6 h-6 text-success-600" />
							</div>
							<div>
								<h4 class="text-lg font-medium text-gray-900">I'm a Healthcare Provider</h4>
								<p class="text-gray-600">
									Offering medical consultations and healthcare services to patients
								</p>
							</div>
						</div>
					</button>
				</div>

			{:else if step === 2}
				<!-- Step 2: DID Generation -->
				<div class="space-y-6">
					<div class="text-center">
						<h3 class="text-lg font-medium text-gray-900 mb-2">
							Your Decentralized Identity
						</h3>
						<p class="text-gray-600 text-sm">
							We've generated a unique DID for you. This is your secure, decentralized identity.
						</p>
					</div>
					
					<div class="bg-white/5 p-4 rounded-lg border border-white/6">
						<label class="label text-primary-100">Your DID</label>
						<div class="flex items-center space-x-2">
							<input
								type="text"
								value={generatedDID}
								readonly
								class="input bg-transparent text-white border-white/10"
							/>
							<button
								type="button"
								class="btn-primary-outline px-3 py-2 text-sm text-white/90 border-white/10"
								onclick={() => navigator.clipboard.writeText(generatedDID)}
							>
								Copy
							</button>
						</div>
						<p class="text-xs text-primary-200 mt-2">
							💡 Save this DID safely. You'll need it to sign in to your account.
						</p>
					</div>
					
					<div class="bg-warning-900/20 border border-warning-800 rounded-lg p-4">
						<div class="flex items-start">
							<div class="flex-shrink-0">
								<span class="text-warning-600">⚠️</span>
							</div>
							<div class="ml-3">
								<h4 class="text-sm font-medium text-warning-800">Important</h4>
								<p class="text-sm text-warning-700 mt-1">
									Your DID is your only way to access your account. Make sure to save it securely 
									before proceeding.
								</p>
							</div>
						</div>
					</div>
					
					<button
						type="button"
						class="btn-primary w-full"
						onclick={() => step = 3}
					>
						I've saved my DID - Continue
					</button>
				</div>

			{:else if step === 3}
				<!-- Step 3: Profile Setup -->
				<form onsubmit={handleSignup} class="space-y-6">
					<div class="text-center mb-4">
						<h3 class="text-lg font-medium text-gray-900">
							Complete your profile
						</h3>
						<p class="text-gray-600 text-sm">
							Role: <span class="font-medium capitalize">{selectedRole}</span>
						</p>
					</div>
					
					<!-- Basic Information -->
					<div class="space-y-4">
						<div>
							<label for="name" class="label">Full Name *</label>
							<input
								id="name"
								type="text"
								required
								bind:value={profile.name}
								placeholder="Enter your full name"
								class="input {errors.name ? 'input-error' : ''}"
							/>
							{#if errors.name}
								<p class="mt-1 text-sm text-error-600">{errors.name}</p>
							{/if}
						</div>
						
						<div>
							<label for="email" class="label">Email (Optional)</label>
							<input
								id="email"
								type="email"
								bind:value={profile.email}
								placeholder="your@email.com"
								class="input {errors.email ? 'input-error' : ''}"
							/>
							{#if errors.email}
								<p class="mt-1 text-sm text-error-600">{errors.email}</p>
							{/if}
						</div>
					</div>
					
					{#if selectedRole === 'doctor'}
						<!-- Doctor-specific fields -->
						<div class="space-y-4 pt-4 border-t border-gray-200">
							<h4 class="font-medium text-gray-900">Professional Information</h4>
							
							<div>
								<label for="bio" class="label">Professional Bio *</label>
								<textarea
									id="bio"
									bind:value={profile.bio}
									placeholder="Tell patients about your experience and expertise..."
									rows="3"
									class="input {errors.bio ? 'input-error' : ''}"
								></textarea>
								{#if errors.bio}
									<p class="mt-1 text-sm text-error-600">{errors.bio}</p>
								{/if}
							</div>
							
							<div>
								<label for="specializations" class="label">Specializations *</label>
								<div class="flex space-x-2 mb-2">
									<input
										id="specialization-input"
										type="text"
										placeholder="Add a specialization..."
										class="input flex-1"
										onkeydown={(e) => e.key === 'Enter' && (e.preventDefault(), addSpecialization())}
									/>
									<button
										type="button"
										class="btn-outline px-4"
										onclick={addSpecialization}
									>
										Add
									</button>
								</div>
								{#if profile.specializations.length > 0}
									<div class="flex flex-wrap gap-2">
										{#each profile.specializations as spec}
											<span class="badge-primary flex items-center">
												{spec}
												<button
													type="button"
													class="ml-1 text-primary-600 hover:text-primary-800"
													onclick={() => removeSpecialization(spec)}
												>
													×
												</button>
											</span>
										{/each}
									</div>
								{/if}
								{#if errors.specializations}
									<p class="mt-1 text-sm text-error-600">{errors.specializations}</p>
								{/if}
							</div>
							
							<div>
								<label for="experience" class="label">Years of Experience</label>
								<input
									id="experience"
									type="number"
									min="0"
									bind:value={profile.experience}
									placeholder="0"
									class="input {errors.experience ? 'input-error' : ''}"
								/>
								{#if errors.experience}
									<p class="mt-1 text-sm text-error-600">{errors.experience}</p>
								{/if}
							</div>
						</div>
					{/if}
					
					<button
						type="submit"
						class="btn-primary w-full"
						disabled={isLoading}
					>
						{#if isLoading}
							<div class="spinner w-4 h-4 mr-2"></div>
							Creating account...
						{:else}
							Create Account
						{/if}
					</button>
				</form>
			{/if}

			<!-- Login link -->
			<div class="mt-6 text-center">
				<p class="text-sm text-gray-600">
					Already have an account?
					<button
						type="button"
						class="font-medium text-primary-600 hover:text-primary-500"
						onclick={() => goto('/auth/login')}
					>
						Sign in
					</button>
				</p>
			</div>
		</div>
	</div>
</div>
