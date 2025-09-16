<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { authStore } from '$stores/auth';
	import { toastStore } from '$stores/toast';
	import Icon from '$lib/Icon.svelte';

	let activeTab = 'patient';
	let isLoading = false;
	let error = '';

	// Common fields
	let email = '';
	let password = '';
	let confirmPassword = '';
	let firstName = '';
	let lastName = '';
	let phone = '';

	// Doctor-specific reactive state
	let medicalLicense = '';
	let specialization = '';
	let yearsExperience = '';
	let certificates = null;
	let certificatePreview = [];

	// Doctor-specific fields
	function switchTab(tab) {
		activeTab = tab;
		clearForm();
	}

	function clearForm() {
		email = '';
		password = '';
		confirmPassword = '';
		firstName = '';
		lastName = '';
		phone = '';
		medicalLicense = '';
		specialization = '';
		yearsExperience = '';
		certificates = null;
		certificatePreview = [];
		error = '';
	}

	function handleCertificateUpload(event) {
		const target = event.target;
		certificates = target && target.files ? target.files : null;
		
		if (certificates) {
			certificatePreview = [];
			Array.from(certificates).forEach(file => {
				if (file.type.startsWith('image/')) {
					const reader = new FileReader();
					reader.onload = (e) => {
						if (e && e.target && e.target.result) {
							certificatePreview = [...certificatePreview, e.target.result];
						}
					};
					reader.readAsDataURL(file);
				} else {
					certificatePreview = [...certificatePreview, '📄 ' + file.name];
				}
			});
		}
	}

	async function handleSignup(event) {
		event.preventDefault();
		
		if (!validateForm()) return;

		isLoading = true;
		error = '';

		try {
			const formData = new FormData();
			formData.append('userType', activeTab);
			formData.append('email', email);
			formData.append('password', password);
			formData.append('firstName', firstName);
			formData.append('lastName', lastName);
			formData.append('phone', phone);

			if (activeTab === 'doctor') {
				formData.append('medicalLicense', medicalLicense);
				formData.append('specialization', specialization);
				formData.append('yearsExperience', yearsExperience);
				
				if (certificates) {
					Array.from(certificates).forEach(file => {
						formData.append('certificates', file);
					});
				}
			}

			const result = await authStore.register(formData);

			if (result.success) {
				toastStore.success(
					'Registration successful!', 
					activeTab === 'doctor' 
						? 'Your account is pending verification. You will receive an email once approved.'
						: 'Welcome to MedConnect! You can now access your dashboard.'
				);
				goto(activeTab === 'doctor' ? '/auth/login' : '/dashboard');
			} else {
				error = result.error || 'Registration failed';
			}
		} catch (err) {
			error = err?.message || 'Registration failed';
		} finally {
			isLoading = false;
		}
	}

	function validateForm() {
		if (!email || !password || !confirmPassword || !firstName || !lastName || !phone) {
			error = 'Please fill in all required fields';
			return false;
		}

		if (password !== confirmPassword) {
			error = 'Passwords do not match';
			return false;
		}

		if (password.length < 8) {
			error = 'Password must be at least 8 characters long';
			return false;
		}

		if (activeTab === 'doctor' && (!medicalLicense || !specialization || !yearsExperience)) {
			error = 'Please fill in all doctor-specific fields';
			return false;
		}

		return true;
	}

	function goToLogin() {
		goto('/auth/login');
	}

	function goHome() {
		goto('/');
	}

	onMount(() => {
		// If already authenticated, redirect to dashboard
		if ($authStore.isAuthenticated) {
			goto('/dashboard');
		}
	});
</script>

<svelte:head>
	<title>Sign Up - MedConnect</title>
	<meta name="description" content="Create your MedConnect account as a patient or medical professional" />
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-med-gray-50 to-med-green-50">
	<!-- Navigation -->
	<nav class="bg-white shadow-sm">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
			<div class="flex justify-between items-center h-16">
				<button 
					class="flex items-center space-x-2"
					onclick={goHome}
				>
					<div class="w-8 h-8 bg-med-green-700 rounded-full flex items-center justify-center">
						<Icon name="stethoscope" class="w-5 h-5 text-white" />
					</div>
					<span class="text-xl font-bold text-med-gray-900">MedConnect</span>
				</button>
				<button 
					class="text-med-gray-600 hover:text-med-green-700 font-medium"
					onclick={goToLogin}
				>
					Already have an account? Login
				</button>
			</div>
		</div>
	</nav>

	<div class="flex flex-col justify-center px-6 py-12 lg:px-8">
		<div class="sm:mx-auto sm:w-full sm:max-w-2xl">
			<div class="text-center mb-8">
				<h2 class="text-3xl font-bold text-med-gray-900">
					Create your MedConnect account
				</h2>
				<p class="mt-2 text-med-gray-600">
					Join our secure healthcare platform and connect with medical professionals
				</p>
			</div>

			<!-- Tab Switcher -->
			<div class="mb-8">
				<div class="bg-white rounded-xl shadow-md p-1 flex max-w-md mx-auto">
					<button
						class="flex-1 py-2 px-4 text-sm font-medium rounded-lg transition duration-200 {activeTab === 'patient' 
							? 'bg-med-green-700 text-white' 
							: 'text-med-gray-600 hover:text-med-green-700'}"
						onclick={() => switchTab('patient')}
					>
						<div class="flex items-center justify-center space-x-2">
							<Icon name="user" class="w-4 h-4" />
							<span>I'm a Patient</span>
						</div>
					</button>
					<button
						class="flex-1 py-2 px-4 text-sm font-medium rounded-lg transition duration-200 {activeTab === 'doctor' 
							? 'bg-med-green-700 text-white' 
							: 'text-med-gray-600 hover:text-med-green-700'}"
						onclick={() => switchTab('doctor')}
					>
						<div class="flex items-center justify-center space-x-2">
							<Icon name="stethoscope" class="w-4 h-4" />
							<span>I'm a Doctor</span>
						</div>
					</button>
				</div>
			</div>

			<div class="card">
				<form onsubmit={handleSignup} class="space-y-6">
					<!-- Basic Information -->
					<div>
						<h3 class="text-lg font-medium text-med-gray-900 mb-4">Basic Information</h3>
						<div class="grid md:grid-cols-2 gap-4">
							<div>
								<label for="firstName" class="block text-sm font-medium text-med-gray-900 mb-2">
									First Name *
								</label>
								<input
									id="firstName"
									type="text"
									required
									bind:value={firstName}
									placeholder="John"
									class="input-field"
									disabled={isLoading}
								/>
							</div>
							<div>
								<label for="lastName" class="block text-sm font-medium text-med-gray-900 mb-2">
									Last Name *
								</label>
								<input
									id="lastName"
									type="text"
									required
									bind:value={lastName}
									placeholder="Doe"
									class="input-field"
									disabled={isLoading}
								/>
							</div>
						</div>
						
						<div class="mt-4">
							<label for="email" class="block text-sm font-medium text-med-gray-900 mb-2">
								Email Address *
							</label>
							<input
								id="email"
								type="email"
								required
								bind:value={email}
								placeholder="john@example.com"
								class="input-field"
								disabled={isLoading}
							/>
						</div>

						<div class="mt-4">
							<label for="phone" class="block text-sm font-medium text-med-gray-900 mb-2">
								Phone Number *
							</label>
							<input
								id="phone"
								type="tel"
								required
								bind:value={phone}
								placeholder="+1 (555) 123-4567"
								class="input-field"
								disabled={isLoading}
							/>
						</div>

						<div class="grid md:grid-cols-2 gap-4 mt-4">
							<div>
								<label for="password" class="block text-sm font-medium text-med-gray-900 mb-2">
									Password *
								</label>
								<input
									id="password"
									type="password"
									required
									bind:value={password}
									placeholder="Min. 8 characters"
									class="input-field"
									disabled={isLoading}
								/>
							</div>
							<div>
								<label for="confirmPassword" class="block text-sm font-medium text-med-gray-900 mb-2">
									Confirm Password *
								</label>
								<input
									id="confirmPassword"
									type="password"
									required
									bind:value={confirmPassword}
									placeholder="Repeat password"
									class="input-field"
									disabled={isLoading}
								/>
							</div>
						</div>
					</div>

					<!-- Doctor-specific fields -->
					{#if activeTab === 'doctor'}
						<div class="pt-6 border-t border-gray-200">
							<h3 class="text-lg font-medium text-med-gray-900 mb-4">
								Medical Credentials
								<span class="badge-verified ml-2">
									<svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
										<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
									</svg>
									Verification Required
								</span>
							</h3>

							<div class="space-y-4">
								<div>
									<label for="medicalLicense" class="block text-sm font-medium text-med-gray-900 mb-2">
										Medical License Number *
									</label>
									<input
										id="medicalLicense"
										type="text"
										required
										bind:value={medicalLicense}
										placeholder="e.g., MD123456"
										class="input-field"
										disabled={isLoading}
									/>
								</div>

								<div class="grid md:grid-cols-2 gap-4">
									<div>
										<label for="specialization" class="block text-sm font-medium text-med-gray-900 mb-2">
											Specialization *
										</label>
										<select
											id="specialization"
											required
											bind:value={specialization}
											class="input-field"
											disabled={isLoading}
										>
											<option value="">Select specialization</option>
											<option value="cardiology">Cardiology</option>
											<option value="dermatology">Dermatology</option>
											<option value="endocrinology">Endocrinology</option>
											<option value="family-medicine">Family Medicine</option>
											<option value="gastroenterology">Gastroenterology</option>
											<option value="general-surgery">General Surgery</option>
											<option value="internal-medicine">Internal Medicine</option>
											<option value="neurology">Neurology</option>
											<option value="oncology">Oncology</option>
											<option value="pediatrics">Pediatrics</option>
											<option value="psychiatry">Psychiatry</option>
											<option value="radiology">Radiology</option>
											<option value="orthopedics">Orthopedics</option>
											<option value="other">Other</option>
										</select>
									</div>

									<div>
										<label for="yearsExperience" class="block text-sm font-medium text-med-gray-900 mb-2">
											Years of Experience *
										</label>
										<select
											id="yearsExperience"
											required
											bind:value={yearsExperience}
											class="input-field"
											disabled={isLoading}
										>
											<option value="">Select experience</option>
											<option value="0-2">0-2 years</option>
											<option value="3-5">3-5 years</option>
											<option value="6-10">6-10 years</option>
											<option value="11-15">11-15 years</option>
											<option value="16-20">16-20 years</option>
											<option value="20+">20+ years</option>
										</select>
									</div>
								</div>

								<div>
									<label for="certificates" class="block text-sm font-medium text-med-gray-900 mb-2">
										Upload Medical Certificates (Optional)
									</label>
									<div class="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-xl hover:border-med-green-500 transition duration-200">
										<div class="text-center">
											<svg class="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
												<path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
											</svg>
											<p class="mt-2 text-sm text-gray-600">
												<label for="certificates" class="cursor-pointer font-medium text-med-green-700 hover:text-med-green-600">
													Upload files
												</label>
												or drag and drop
											</p>
											<p class="text-xs text-gray-500">PNG, JPG, PDF up to 10MB each</p>
										</div>
									</div>
									<input
										id="certificates"
										type="file"
										multiple
										accept="image/*,.pdf"
										class="hidden"
										onchange={handleCertificateUpload}
										disabled={isLoading}
									/>

									{#if certificatePreview.length > 0}
										<div class="mt-3 grid grid-cols-2 gap-2">
											{#each certificatePreview as preview}
												<div class="flex items-center space-x-2 p-2 bg-med-green-50 rounded-lg">
													{#if preview.startsWith('data:image')}
														<img src={preview} alt="Certificate" class="w-10 h-10 object-cover rounded" />
													{:else}
														<span class="text-sm">{preview}</span>
													{/if}
												</div>
											{/each}
										</div>
									{/if}
								</div>

								<div class="bg-blue-50 border border-blue-200 rounded-xl p-4">
									<div class="flex items-start">
										<svg class="w-5 h-5 text-blue-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
											<path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
										</svg>
										<div class="ml-3">
											<h4 class="text-sm font-medium text-blue-800">Doctor Verification Process</h4>
											<p class="text-sm text-blue-700 mt-1">
												Your account will be reviewed by our medical team. This usually takes 1-2 business days. You'll receive an email once verified.
											</p>
										</div>
									</div>
								</div>
							</div>
						</div>
					{/if}

					{#if error}
						<div class="bg-med-red-700 bg-opacity-10 border border-med-red-700 text-med-red-700 px-4 py-3 rounded-xl">
							<p class="text-sm">{error}</p>
						</div>
					{/if}

					<button
						type="submit"
						class="btn-primary w-full"
						disabled={isLoading}
					>
						{#if isLoading}
							<div class="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
							Creating account...
						{:else}
							Create {activeTab === 'doctor' ? 'Doctor' : 'Patient'} Account
						{/if}
					</button>
				</form>

				<div class="mt-6 text-center">
					<p class="text-sm text-med-gray-600">
						Already have an account?
						<button
							type="button"
							class="font-medium text-med-green-700 hover:text-med-green-600"
										onclick={goToLogin}
						>
							Sign in here
						</button>
					</p>
				</div>
			</div>

			<!-- Terms notice -->
			<div class="mt-8 text-center">
				<p class="text-xs text-med-gray-500">
					By creating an account, you agree to our 
					and 
					  <a href="/terms" class="text-med-green-700 hover:text-med-green-600">Terms of Service</a>
		  <a href="/privacy" class="text-med-green-700 hover:text-med-green-600">Privacy Policy</a>
				</p>
			</div>
		</div>
	</div>
</div>
