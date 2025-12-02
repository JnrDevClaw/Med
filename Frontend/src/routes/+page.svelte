<script>
	import { goto } from '$app/navigation';
	import Icon from '$lib/Icon.svelte';
	import CorsTest from '$lib/components/CorsTest.svelte';
	import { dev } from '$app/environment';

	let isMenuOpen = false;

	function toggleMenu() {
		isMenuOpen = !isMenuOpen;
	}

	function navigateTo(path) {
		goto(path);
		isMenuOpen = false;
	}
</script>

<svelte:head>
	<title>MedConnect - AI-Powered Medical Platform</title>
	<meta name="description" content="Connect with verified doctors, get AI medical assistance, and manage your health securely." />
</svelte:head>

<!-- Premium Navigation -->
<nav class="bg-white/95 backdrop-blur-md border-b border-neutral-100 sticky top-0 z-50 shadow-premium">
	<div class="med-container">
		<div class="flex justify-between items-center h-20">
			<!-- Premium Logo -->
			<div class="flex items-center space-x-3">
				<div class="w-10 h-10 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-2xl flex items-center justify-center shadow-premium">
					<Icon name="stethoscope" size="1.25em" class="text-white" />
				</div>
				<div>
					<span class="text-2xl font-bold bg-gradient-to-r from-primary-600 to-secondary-600 bg-clip-text text-transparent">MedConnect</span>
					<div class="text-xs text-neutral-500 font-medium">Premium Care</div>
				</div>
			</div>

			<!-- Desktop Navigation -->
			<div class="hidden lg:flex items-center space-x-1">
				<a href="#about" class="med-nav-link">
					<span>About</span>
				</a>
				<a href="#services" class="med-nav-link">
					<span>Services</span>
				</a>
				<a href="#benefits" class="med-nav-link">
					<span>Benefits</span>
				</a>
				<a href="#contact" class="med-nav-link">
					<span>Contact</span>
				</a>
				<div class="flex items-center space-x-3 ml-6">
					<button 
						class="med-btn med-btn-ghost"
						onclick={() => navigateTo('/auth/login')}
					>
						Sign In
					</button>
					<button 
						class="med-btn med-btn-primary"
						onclick={() => navigateTo('/auth/signup')}
					>
						Get Started
					</button>
				</div>
			</div>

			<!-- Mobile menu button -->
			<div class="lg:hidden">
				<button
					type="button"
					class="med-btn-icon text-neutral-600 hover:text-primary-600 hover:bg-primary-50"
					onclick={toggleMenu}
					aria-label="Toggle navigation menu"
					aria-expanded={isMenuOpen}
					aria-controls="mobile-menu"
				>
					<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						{#if isMenuOpen}
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
						{:else}
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
						{/if}
					</svg>
				</button>
			</div>
		</div>

		<!-- Premium Mobile Navigation Menu -->
		{#if isMenuOpen}
			<div id="mobile-menu" class="lg:hidden border-t border-neutral-100 py-6 space-y-2 med-animate-slide-down">
				<a href="#about" class="med-nav-item">
					<span>About</span>
				</a>
				<a href="#services" class="med-nav-item">
					<span>Services</span>
				</a>
				<a href="#benefits" class="med-nav-item">
					<span>Benefits</span>
				</a>
				<a href="#contact" class="med-nav-item">
					<span>Contact</span>
				</a>
				<div class="px-6 pt-4 space-y-3">
					<button 
						class="med-btn med-btn-ghost w-full"
						onclick={() => navigateTo('/auth/login')}
					>
						Sign In
					</button>
					<button 
						class="med-btn med-btn-primary w-full"
						onclick={() => navigateTo('/auth/signup')}
					>
						Get Started
					</button>
				</div>
			</div>
		{/if}
	</div>
</nav>

<!-- Development CORS Test (only shown in dev mode) -->
{#if dev}
	<div class="bg-yellow-50 border-b border-yellow-200 p-4">
		<div class="med-container">
			<CorsTest />
		</div>
	</div>
{/if}

<!-- Premium Hero Section -->
<section class="relative bg-gradient-to-br from-primary-500 via-primary-600 to-secondary-600 text-white overflow-hidden">
	<!-- Background Pattern -->
	<div class="absolute inset-0 opacity-10">
		<div class="absolute inset-0 bg-hero-pattern"></div>
	</div>
	
	<!-- Floating Elements -->
	<div class="absolute top-20 left-10 w-32 h-32 bg-white/5 rounded-full blur-xl animate-pulse"></div>
	<div class="absolute bottom-20 right-10 w-48 h-48 bg-white/5 rounded-full blur-2xl animate-pulse" style="animation-delay: 1s;"></div>
	
	<div class="relative med-container py-24 lg:py-32">
		<div class="text-center max-w-5xl mx-auto med-animate-fade-in">
			<!-- Premium Badge -->
			<div class="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-2 mb-8">
				<div class="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
				<span class="text-sm font-medium text-white/90">Trusted by 10,000+ Patients</span>
			</div>
			
			<!-- Main Headline -->
			<h1 class="med-heading-1 text-5xl lg:text-7xl font-bold mb-8 leading-tight">
				Premium Healthcare,
				<span class="bg-gradient-to-r from-emerald-200 to-green-200 bg-clip-text text-transparent">
					AI-Enhanced
				</span>
			</h1>
			
			<!-- Subheadline -->
			<p class="med-text-body text-xl lg:text-2xl mb-12 text-white/80 max-w-4xl mx-auto leading-relaxed">
				Experience the future of healthcare with our premium platform. Connect with board-certified physicians, 
				get instant AI-powered medical insights, and manage your health journey with confidence.
			</p>
			
			<!-- CTA Buttons -->
			<div class="flex flex-col sm:flex-row gap-6 justify-center items-center mb-16">
				<button 
					class="med-btn med-btn-lg bg-emerald-500 text-white hover:bg-emerald-600 shadow-premium-lg font-semibold med-animate-bounce-in"
					onclick={() => navigateTo('/auth/signup')}
				>
					<span>Start Your Journey</span>
					<svg class="w-5 h-5 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
					</svg>
				</button>
				<button 
					class="med-btn med-btn-lg med-btn-outline border-white/30 text-white hover:bg-white/10 backdrop-blur-sm"
					onclick={() => navigateTo('/auth/login')}
				>
					<svg class="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
					</svg>
					<span>Watch Demo</span>
				</button>
			</div>
			
			<!-- Trust Indicators -->
			<div class="grid grid-cols-2 md:grid-cols-4 gap-8 text-center text-white/70">
				<div>
					<div class="text-3xl font-bold text-white mb-2">24/7</div>
					<div class="text-sm">AI Support</div>
				</div>
				<div>
					<div class="text-3xl font-bold text-white mb-2">500+</div>
					<div class="text-sm">Expert Doctors</div>
				</div>
				<div>
					<div class="text-3xl font-bold text-white mb-2">99.9%</div>
					<div class="text-sm">Uptime</div>
				</div>
				<div>
					<div class="text-3xl font-bold text-white mb-2">HIPAA</div>
					<div class="text-sm">Compliant</div>
				</div>
			</div>
		</div>
	</div>
</section>

<!-- Premium Services Overview -->
<section id="services" class="py-24 bg-neutral-50/50">
	<div class="med-container">
		<div class="text-center mb-16">
			<div class="inline-flex items-center gap-2 bg-primary-100 text-primary-600 rounded-full px-4 py-2 mb-6">
				<Icon name="stethoscope" size="1em" />
				<span class="text-sm font-medium">Premium Services</span>
			</div>
			<h2 class="med-heading-2 mb-6">
				Everything You Need for
				<span class="text-primary-600">Better Health</span>
			</h2>
			<p class="med-text-body max-w-3xl mx-auto">
				Our comprehensive platform combines cutting-edge AI technology with human expertise 
				to deliver personalized, accessible healthcare solutions.
			</p>
		</div>

		<div class="med-grid gap-8">
			<!-- AI Medical Assistant -->
			<div class="med-card-premium p-8 text-center med-animate-slide-up group">
				<div class="w-16 h-16 bg-gradient-to-br from-primary-100 to-primary-200 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
					<svg class="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
					</svg>
				</div>
				<h3 class="med-heading-4 mb-4">AI Health Assistant</h3>
				<p class="med-text-body mb-6">
					Get instant medical insights powered by advanced AI. Upload symptoms, ask questions, 
					and receive preliminary assessments available 24/7.
				</p>
				<div class="flex items-center justify-center gap-2 text-primary-600 font-medium">
					<div class="med-status-online"></div>
					<span class="text-sm">Always Available</span>
				</div>
			</div>

			<!-- Doctor Consultations -->
			<div class="med-card-premium p-8 text-center med-animate-slide-up group" style="animation-delay: 0.1s;">
				<div class="w-16 h-16 bg-gradient-to-br from-secondary-100 to-secondary-200 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
					<Icon name="user" size="2em" class="text-secondary-600" />
				</div>
				<h3 class="med-heading-4 mb-4">Expert Consultations</h3>
				<p class="med-text-body mb-6">
					Connect with board-certified physicians through secure video calls, chat, 
					and comprehensive health assessments.
				</p>
				<div class="flex items-center justify-center gap-2 text-secondary-600 font-medium">
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
					</svg>
					<span class="text-sm">Verified Doctors</span>
				</div>
			</div>

			<!-- Health Records -->
			<div class="med-card-premium p-8 text-center med-animate-slide-up group" style="animation-delay: 0.2s;">
				<div class="w-16 h-16 bg-gradient-to-br from-accent-100 to-accent-200 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
					<svg class="w-8 h-8 text-accent-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
					</svg>
				</div>
				<h3 class="med-heading-4 mb-4">Smart Health Records</h3>
				<p class="med-text-body mb-6">
					Securely store and manage your complete medical history with AI-powered 
					insights and automated health tracking.
				</p>
				<div class="flex items-center justify-center gap-2 text-accent-600 font-medium">
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
					</svg>
					<span class="text-sm">HIPAA Secure</span>
				</div>
			</div>
		</div>
	</div>
</section>

<!-- Premium Benefits Section -->
<section id="benefits" class="py-24 bg-white">
	<div class="med-container">
		<div class="text-center mb-16">
			<h2 class="med-heading-2 mb-6">
				Why Healthcare Professionals 
				<span class="text-primary-600">Choose MedConnect</span>
			</h2>
			<p class="med-text-body max-w-3xl mx-auto">
				Advanced healthcare technology meets compassionate medical care, 
				delivering outcomes that matter to patients and providers alike.
			</p>
		</div>

		<div class="med-grid gap-8">
			<!-- AI-Powered Diagnostics -->
			<div class="med-card text-center p-8 group hover:shadow-premium-lg transition-all duration-300">
				<div class="w-16 h-16 bg-gradient-to-br from-emerald-100 to-emerald-200 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
					<svg class="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
					</svg>
				</div>
				<h3 class="med-heading-4 text-neutral-900 mb-4">AI-Powered Insights</h3>
				<p class="med-text-body mb-6">
					Advanced machine learning algorithms analyze symptoms, medical history, and patterns 
					to provide accurate preliminary assessments and personalized health recommendations.
				</p>
				<div class="med-badge med-badge-success">
					95% Accuracy Rate
				</div>
			</div>

			<!-- Verified Doctors Network -->
			<div class="med-card text-center p-8 group hover:shadow-premium-lg transition-all duration-300">
				<div class="w-16 h-16 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
					<svg class="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.031 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
					</svg>
				</div>
				<h3 class="med-heading-4 text-neutral-900 mb-4">Verified Medical Experts</h3>
				<p class="med-text-body mb-6">
					Connect with board-certified physicians who have undergone rigorous credential verification 
					and background screening to ensure the highest quality care.
				</p>
				<div class="med-badge med-badge-info">
					500+ Certified Doctors
				</div>
			</div>

			<!-- Secure & Private -->
			<div class="med-card text-center p-8 group hover:shadow-premium-lg transition-all duration-300">
				<div class="w-16 h-16 bg-gradient-to-br from-purple-100 to-purple-200 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
					<svg class="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
					</svg>
				</div>
				<h3 class="med-heading-4 text-neutral-900 mb-4">Enterprise Security</h3>
				<p class="med-text-body mb-6">
					Military-grade encryption, blockchain technology, and HIPAA-compliant infrastructure 
					ensure your medical data remains private and secure at all times.
				</p>
				<div class="med-badge med-badge-emerald">
					HIPAA Certified
				</div>
			</div>
		</div>

		<!-- Additional Benefits Grid -->
		<div class="grid md:grid-cols-2 gap-12 mt-20">
			<!-- Left: Stats -->
			<div class="space-y-8">
				<h3 class="med-heading-3">Trusted by Healthcare Leaders</h3>
				<div class="grid grid-cols-2 gap-6">
					<div class="text-center">
						<div class="text-4xl font-bold text-primary-600 mb-2">10,000+</div>
						<div class="med-text-small">Active Patients</div>
					</div>
					<div class="text-center">
						<div class="text-4xl font-bold text-secondary-600 mb-2">500+</div>
						<div class="med-text-small">Medical Experts</div>
					</div>
					<div class="text-center">
						<div class="text-4xl font-bold text-accent-600 mb-2">99.9%</div>
						<div class="med-text-small">Platform Uptime</div>
					</div>
					<div class="text-center">
						<div class="text-4xl font-bold text-emerald-600 mb-2">4.9★</div>
						<div class="med-text-small">Patient Rating</div>
					</div>
				</div>
			</div>
			
			<!-- Right: Key Features -->
			<div class="space-y-6">
				<h3 class="med-heading-3">Why MedConnect Stands Out</h3>
				<div class="space-y-4">
					<div class="flex items-start gap-4">
						<div class="w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
							<svg class="w-3 h-3 text-primary-600" fill="currentColor" viewBox="0 0 20 20">
								<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
							</svg>
						</div>
						<div>
							<h4 class="font-semibold text-neutral-900 mb-1">24/7 AI-Powered Support</h4>
							<p class="med-text-small">Get instant responses to health questions anytime, anywhere.</p>
						</div>
					</div>
					<div class="flex items-start gap-4">
						<div class="w-6 h-6 bg-secondary-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
							<svg class="w-3 h-3 text-secondary-600" fill="currentColor" viewBox="0 0 20 20">
								<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
							</svg>
						</div>
						<div>
							<h4 class="font-semibold text-neutral-900 mb-1">Integrated Health Records</h4>
							<p class="med-text-small">All your medical information in one secure, accessible place.</p>
						</div>
					</div>
					<div class="flex items-start gap-4">
						<div class="w-6 h-6 bg-accent-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
							<svg class="w-3 h-3 text-accent-600" fill="currentColor" viewBox="0 0 20 20">
								<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
							</svg>
						</div>
						<div>
							<h4 class="font-semibold text-neutral-900 mb-1">Smart Health Insights</h4>
							<p class="med-text-small">Personalized recommendations based on your health data and goals.</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</section>

<!-- About Section -->
<section id="about" class="py-20 bg-med-gray-50">
	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
		<div class="grid lg:grid-cols-2 gap-12 items-center">
			<div>
				<h2 class="text-3xl md:text-4xl font-bold text-med-gray-900 mb-6">
					The Future of Healthcare is Here
				</h2>
				<p class="text-lg text-med-gray-600 mb-6">
					MedConnect bridges the gap between patients and healthcare professionals using cutting-edge AI technology and secure blockchain infrastructure.
				</p>
				<div class="space-y-4">
					<div class="flex items-start space-x-3">
						<div class="w-6 h-6 bg-med-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
							<svg class="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
								<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
							</svg>
						</div>
						<p class="text-med-gray-600">24/7 AI-powered medical assistance and symptom analysis</p>
					</div>
					<div class="flex items-start space-x-3">
						<div class="w-6 h-6 bg-med-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
							<svg class="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
								<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
							</svg>
						</div>
						<p class="text-med-gray-600">Video consultations with verified medical professionals</p>
					</div>
					<div class="flex items-start space-x-3">
						<div class="w-6 h-6 bg-med-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
							<svg class="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
								<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
							</svg>
						</div>
						<p class="text-med-gray-600">Secure blockchain-based medical record management</p>
					</div>
				</div>
			</div>
			<div class="relative">
				<div class="bg-gradient-to-br from-med-green-400 to-med-green-600 rounded-2xl p-8 text-white">
					<h3 class="text-2xl font-bold mb-4">Join Thousands of Users</h3>
					<div class="space-y-4">
						<div class="flex items-center space-x-3">
							<div class="w-12 h-12 bg-emerald-500 bg-opacity-80 rounded-full flex items-center justify-center">
								<span class="text-xl font-bold text-white">5K+</span>
							</div>
							<div>
								<p class="font-semibold">Active Patients</p>
								<p class="text-med-green-100 text-sm">Getting better care daily</p>
							</div>
						</div>
						<div class="flex items-center space-x-3">
							<div class="w-12 h-12 bg-emerald-500 bg-opacity-80 rounded-full flex items-center justify-center">
								<span class="text-xl font-bold text-white">200+</span>
							</div>
							<div>
								<p class="font-semibold">Verified Doctors</p>
								<p class="text-med-green-100 text-sm">Ready to help you</p>
							</div>
						</div>
						<div class="flex items-center space-x-3">
							<div class="w-12 h-12 bg-emerald-500 bg-opacity-80 rounded-full flex items-center justify-center">
								<span class="text-xl font-bold text-white">98%</span>
							</div>
							<div>
								<p class="font-semibold">Satisfaction Rate</p>
								<p class="text-med-green-100 text-sm">Trusted by users</p>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</section>

<!-- CTA Section -->
<section class="py-20 bg-med-green-700">
	<div class="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
		<h2 class="text-3xl md:text-4xl font-bold text-white mb-6">
			Ready to Transform Your Healthcare?
		</h2>
		<p class="text-xl text-med-green-100 mb-8">
			Join thousands who trust MedConnect for their medical needs. Get started in less than 2 minutes.
		</p>
		<button 
			class="bg-emerald-500 text-white hover:bg-emerald-600 font-bold py-4 px-8 rounded-xl text-lg transition duration-200"
			onclick={() => navigateTo('/auth/signup')}
		>
			Start Your Free Account
		</button>
	</div>
</section>

<!-- Footer -->
<footer id="contact" class="bg-med-gray-900 text-white py-16">
	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
		<div class="grid md:grid-cols-4 gap-8">
			<div>
				<div class="flex items-center space-x-2 mb-4">
					<div class="w-8 h-8 bg-med-green-500 rounded-full flex items-center justify-center">
						<Icon name="stethoscope" class="w-5 h-5 text-white" />
					</div>
					<span class="text-xl font-bold">MedConnect</span>
				</div>
				<p class="text-gray-400 mb-4">
					AI-powered healthcare platform connecting patients with verified medical professionals.
				</p>
			</div>

			<div>
				<h3 class="font-semibold mb-4">Platform</h3>
				<ul class="space-y-2 text-gray-400">
					<li><a href="/ai-chat" class="hover:text-white">AI Assistant</a></li>
					<li><a href="/video" class="hover:text-white">Video Consults</a></li>
					<li><a href="/dashboard" class="hover:text-white">Dashboard</a></li>
				</ul>
			</div>

			<div>
				<h3 class="font-semibold mb-4">Company</h3>
				<ul class="space-y-2 text-gray-400">
					<li><a href="#about" class="hover:text-white">About Us</a></li>
					<li><a href="/privacy" class="hover:text-white">Privacy Policy</a></li>
					<li><a href="/terms" class="hover:text-white">Terms of Service</a></li>
				</ul>
			</div>

			<div>
				<h3 class="font-semibold mb-4">Connect</h3>
				<div class="flex space-x-4">
					<a href="https://twitter.com/" class="text-gray-400 hover:text-white" aria-label="Twitter - MedConnect" target="_blank" rel="noopener noreferrer">
						<svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
							<path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/>
						</svg>
					</a>
					<a href="https://facebook.com/" class="text-gray-400 hover:text-white" aria-label="Facebook - MedConnect" target="_blank" rel="noopener noreferrer">
						<svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
							<path d="M22.46 6c-.77.35-1.6.58-2.46.69.88-.53 1.56-1.37 1.88-2.38-.83.5-1.75.85-2.72 1.05C18.37 4.5 17.26 4 16 4c-2.35 0-4.27 1.92-4.27 4.29 0 .34.04.67.11.98C8.28 9.09 5.11 7.38 3 4.79c-.37.63-.58 1.37-.58 2.15 0 1.49.75 2.81 1.91 3.56-.71 0-1.37-.2-1.95-.5v.03c0 2.08 1.48 3.82 3.44 4.21a4.22 4.22 0 0 1-1.93.07 4.28 4.28 0 0 0 4 2.98 8.521 8.521 0 0 1-5.33 1.84c-.34 0-.68-.02-1.02-.06C3.44 20.29 5.7 21 8.12 21 16 21 20.33 14.46 20.33 8.79c0-.19 0-.37-.01-.56.84-.6 1.56-1.36 2.14-2.23z"/>
						</svg>
					</a>
				</div>
			</div>
		</div>

		<div class="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
			<p>&copy; 2025 MedConnect. All rights reserved. Built with ❤️ for better healthcare.</p>
		</div>
	</div>
</footer>

<style>
	/* Smooth scrolling for anchor links */
	:global(html) {
		scroll-behavior: smooth;
	}
</style>
