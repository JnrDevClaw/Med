<script>
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { authStore } from '../stores/auth';
	import Icon from '$lib/Icon.svelte';
	import { onDestroy } from 'svelte';

	export let open = false;
	export let onClose = () => {};

	// subscribe to authStore to get user
	let user = null;
	const unsubscribeAuth = authStore.subscribe(state => {
		user = state?.user || null;
	});

	// subscribe to page store to get current path
	let currentPath = '';
	const unsubscribePage = page.subscribe(p => {
		currentPath = p.url.pathname;
	});

	onDestroy(() => {
		unsubscribeAuth();
		unsubscribePage();
	});

	const patientNavItems = [
		{ href: '/dashboard', icon: 'home', label: 'Dashboard', badge: null },
		{ href: '/consultations', icon: 'message-square', label: 'Consultations', badge: '3' },
		{ href: '/ai-chat', icon: 'brain', label: 'AI Assistant', badge: 'NEW' },
		{ href: '/video-calls', icon: 'video', label: 'Video Calls', badge: null },
		{ href: '/doctors', icon: 'users', label: 'Find Doctors', badge: null },
		{ href: '/reminders', icon: 'bell', label: 'Reminders', badge: '2' },
		{ href: '/health-records', icon: 'file-text', label: 'Health Records', badge: null }
	];

	const doctorNavItems = [
		{ href: '/dashboard', icon: 'home', label: 'Dashboard', badge: null },
		{ href: '/consultations', icon: 'message-square', label: 'Consultations', badge: '5' },
		{ href: '/video-calls', icon: 'video', label: 'Video Calls', badge: null },
		{ href: '/patients', icon: 'users', label: 'Patients', badge: null },
		{ href: '/credentials', icon: 'award', label: 'Credentials', badge: null },
		{ href: '/schedule', icon: 'calendar', label: 'Schedule', badge: 'TODAY' }
	];

	function navItems() {
		return user?.role === 'doctor' ? doctorNavItems : patientNavItems;
	}

	function navigateTo(href) {
		goto(href);
		onClose();
	}

	function isActive(href) {
		return currentPath === href || (currentPath.startsWith(href) && href !== '/dashboard');
	}

	function getStaggerClass(index) {
		const staggerClasses = ['med-animate-stagger-1', 'med-animate-stagger-2', 'med-animate-stagger-3', 'med-animate-stagger-4', 'med-animate-stagger-5'];
		return staggerClasses[index % staggerClasses.length];
	}
</script>

<!-- Mobile backdrop with glassmorphism -->
{#if open}
	<button
		type="button"
		class="fixed inset-0 bg-black bg-opacity-20 backdrop-blur-sm z-40 lg:hidden med-animate-fade-in-up"
		aria-label="Close menu"
		onclick={onClose}
	></button>
{/if}

<!-- Sidebar -->
<div class="flex">
	<!-- Mobile sidebar -->
	<div
		class="fixed inset-y-0 left-0 z-50 w-80 glass-sidebar transform transition-all duration-500 ease-spring lg:hidden {open ? 'translate-x-0' : '-translate-x-full'}"
	>
		<!-- Mobile Header -->
		<div class="flex items-center justify-between p-6 border-b border-primary-100">
			<div class="flex items-center space-x-3">
				<div class="w-10 h-10 rounded-2xl med-gradient-primary flex items-center justify-center shadow-medical">
					<Icon name="activity" class="w-6 h-6 text-white" />
				</div>
				<h2 class="text-lg font-bold text-med-text-primary">MedPlatform</h2>
			</div>
			<button
				type="button"
				class="p-2 rounded-xl text-med-text-secondary hover:text-primary-600 hover:bg-primary-50 transition-all duration-300 transform hover:scale-105"
				onclick={onClose}
			>
				<Icon name="x" class="w-5 h-5" />
			</button>
		</div>

		<!-- Mobile User Profile -->
		<div class="p-6 border-b border-primary-100">
			<div class="flex items-center space-x-4">
				<div class="relative">
					<div class="w-14 h-14 med-gradient-primary rounded-2xl flex items-center justify-center shadow-medical">
						<span class="text-lg font-semibold text-white">
							{user?.name?.charAt(0)?.toUpperCase() || 'U'}
						</span>
					</div>
					<div class="absolute -bottom-1 -right-1 w-4 h-4 bg-success-500 rounded-full border-2 border-white shadow-sm"></div>
				</div>
				<div class="flex-1">
					<p class="font-semibold text-med-text-primary">{user?.name || 'User Name'}</p>
					<p class="text-sm text-med-text-muted">{user?.email || 'user@example.com'}</p>
					<div class="flex items-center space-x-2 mt-2">
						<div class="med-badge med-badge-success text-xs">
							{user?.role === 'doctor' ? 'Doctor' : 'Patient'}
						</div>
						{#if user?.verified}
							<div class="med-badge med-badge-info text-xs">
								Verified
							</div>
						{/if}
					</div>
				</div>
			</div>
		</div>
		
		<!-- Mobile Navigation -->
		<nav class="flex-1 p-6 space-y-2">
			{#each navItems() as item, index}
				<button
					type="button"
					class="flex items-center justify-between w-full p-4 text-left rounded-2xl transition-all duration-300 med-nav-item group {getStaggerClass(index)} {isActive(item.href) 
						? 'active med-gradient-glass border border-primary-200 shadow-medical' 
						: 'hover:bg-primary-50 hover:shadow-soft'}"
					onclick={() => navigateTo(item.href)}
				>
					<div class="flex items-center space-x-4">
						<div class="w-10 h-10 rounded-xl {isActive(item.href) ? 'bg-primary-100 text-primary-600' : 'bg-neutral-100 text-med-text-muted group-hover:bg-primary-100 group-hover:text-primary-600'} flex items-center justify-center transition-all duration-300">
							<Icon name={item.icon} class="w-5 h-5" />
						</div>
						<span class="font-medium {isActive(item.href) ? 'text-primary-700' : 'text-med-text-secondary group-hover:text-primary-700'}">
							{item.label}
						</span>
					</div>
					{#if item.badge}
						<div class="med-badge {item.badge === 'NEW' ? 'med-badge-success' : 'med-badge-info'} text-xs">
							{item.badge}
						</div>
					{/if}
				</button>
			{/each}
		</nav>
	</div>

	<!-- Desktop sidebar -->
	<div class="hidden lg:flex lg:w-80 lg:flex-col lg:fixed lg:inset-y-0 lg:z-30">
		<div class="flex flex-col flex-grow glass-sidebar overflow-y-auto">
			<!-- Desktop Logo/Brand -->
			<div class="flex items-center flex-shrink-0 px-8 py-6 border-b border-primary-100">
				<div class="flex items-center space-x-4">
					<div class="w-12 h-12 rounded-2xl med-gradient-primary flex items-center justify-center shadow-medical">
						<Icon name="activity" class="w-7 h-7 text-white" />
					</div>
					<div>
						<span class="text-xl font-bold text-med-text-primary">MedPlatform</span>
						<p class="text-xs text-med-text-muted mt-0.5">Healthcare Platform</p>
					</div>
				</div>
			</div>

			<!-- Desktop User info -->
			<div class="px-8 py-6 border-b border-primary-100">
				<div class="flex items-center space-x-4">
					<div class="relative">
						<div class="w-16 h-16 med-gradient-primary rounded-2xl flex items-center justify-center shadow-medical">
							<span class="text-xl font-semibold text-white">
								{user?.name?.charAt(0)?.toUpperCase() || 'U'}
							</span>
						</div>
						<div class="absolute -bottom-1 -right-1 w-5 h-5 bg-success-500 rounded-full border-2 border-white shadow-sm animate-pulse"></div>
					</div>
					<div class="flex-1">
						<p class="font-semibold text-med-text-primary text-base">{user?.name || 'User Name'}</p>
						<p class="text-sm text-med-text-muted">{user?.email || 'user@example.com'}</p>
						<div class="flex items-center space-x-2 mt-3">
							<div class="med-badge med-badge-success">
								{user?.role === 'doctor' ? 'Doctor' : 'Patient'}
							</div>
							{#if user?.verified}
								<div class="med-badge med-badge-info">
									<Icon name="check-circle" class="w-3 h-3 mr-1" />
									Verified
								</div>
							{/if}
						</div>
					</div>
				</div>
			</div>

			<!-- Desktop Navigation -->
			<nav class="flex-1 px-6 py-6 space-y-3">
				{#each navItems() as item, index}
					<button
						type="button"
						class="flex items-center justify-between w-full p-4 text-left rounded-2xl transition-all duration-300 med-nav-item group {getStaggerClass(index)} {isActive(item.href) 
							? 'active med-gradient-glass border border-primary-200 shadow-medical' 
							: 'hover:bg-primary-50 hover:shadow-soft hover:transform hover:scale-105'}"
						onclick={() => navigateTo(item.href)}
					>
						<div class="flex items-center space-x-4">
							<div class="w-12 h-12 rounded-xl {isActive(item.href) ? 'bg-primary-500 text-white shadow-medical' : 'bg-neutral-100 text-med-text-muted group-hover:bg-primary-100 group-hover:text-primary-600'} flex items-center justify-center transition-all duration-300">
								<Icon name={item.icon} class="w-6 h-6" />
							</div>
							<div class="flex-1">
								<span class="font-semibold text-base {isActive(item.href) ? 'text-primary-700' : 'text-med-text-secondary group-hover:text-primary-700'}">
									{item.label}
								</span>
								{#if isActive(item.href)}
									<p class="text-xs text-primary-500 mt-0.5">Active</p>
								{/if}
							</div>
						</div>
						{#if item.badge}
							<div class="med-badge {item.badge === 'NEW' ? 'med-badge-success animate-pulse' : item.badge === 'TODAY' ? 'med-badge-warning' : 'med-badge-info'}">
								{item.badge}
							</div>
						{/if}
					</button>
				{/each}
			</nav>

			<!-- Enhanced Footer with Quick Actions -->
			<div class="flex-shrink-0 p-6 border-t border-primary-100">
				<div class="space-y-4">
					<!-- Quick Actions -->
					<div class="flex justify-between items-center">
						<button class="p-3 rounded-xl bg-primary-50 text-primary-600 hover:bg-primary-100 transition-all duration-300 transform hover:scale-105 med-focus-ring">
							<Icon name="settings" class="w-5 h-5" />
						</button>
						<button class="p-3 rounded-xl bg-primary-50 text-primary-600 hover:bg-primary-100 transition-all duration-300 transform hover:scale-105 med-focus-ring">
							<Icon name="help-circle" class="w-5 h-5" />
						</button>
						<button class="p-3 rounded-xl bg-primary-50 text-primary-600 hover:bg-primary-100 transition-all duration-300 transform hover:scale-105 med-focus-ring">
							<Icon name="bell" class="w-5 h-5" />
						</button>
					</div>
					
					<!-- Copyright -->
					<div class="text-center">
						<p class="text-xs text-med-text-muted">
							© 2024 MedPlatform
						</p>
						<p class="text-xs text-med-text-muted mt-1">
							Built with ❤️ for healthcare
						</p>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
