<script>
	import { Icon } from '$lib/icons';
	import { authStore } from '../stores/auth';
	import { userProfileStore, userDisplayInfo } from '../stores/userProfile';
	import { goto } from '$app/navigation';
	import { createEventDispatcher, onDestroy, onMount } from 'svelte';

	export let onMenuClick = () => {};

	const dispatch = createEventDispatcher();
	let showUserMenu = false;

	let user = null;
	let displayInfo = null;
	let profileError = null;

	const unsubscribeAuth = authStore.subscribe(state => {
		user = state?.user || null;
	});

	const unsubscribeDisplay = userDisplayInfo.subscribe(info => {
		displayInfo = info;
	});

	const unsubscribeProfile = userProfileStore.subscribe(state => {
		profileError = state.error;
	});

	onMount(async () => {
		// Load user profile data from IPFS when component mounts
		if (user) {
			try {
				await userProfileStore.loadCurrentUserProfile();
			} catch (error) {
				console.warn('Failed to load user profile:', error);
				// Continue with basic user data from auth store
			}
		}
	});

	onDestroy(() => {
		unsubscribeAuth();
		unsubscribeDisplay();
		unsubscribeProfile();
	});

	function toggleUserMenu() {
		showUserMenu = !showUserMenu;
	}

	function closeUserMenu() {
		showUserMenu = false;
	}

	async function handleLogout() {
		await authStore.logout();
		goto('/auth/login');
	}

	function goToProfile() {
		closeUserMenu();
		goto('/profile');
	}

	function goToSettings() {
		closeUserMenu();
		goto('/settings');
	}
</script>

<header class="glass-header sticky top-0 z-40 transition-all duration-300">
	<div class="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
		<!-- Left side - Menu button and title -->
		<div class="flex items-center space-x-4 med-animate-fade-in-up">
			<button
				type="button"
				class="lg:hidden p-2 rounded-xl text-med-text-secondary hover:text-primary-600 hover:bg-primary-50 transition-all duration-300 transform hover:scale-105"
				onclick={onMenuClick}
			>
				<Icon name="menu" class="w-5 h-5" />
			</button>
			
			<div class="flex items-center space-x-3">
				<div class="w-10 h-10 rounded-2xl med-gradient-primary flex items-center justify-center shadow-medical">
					<Icon name="activity" class="w-6 h-6 text-white" />
				</div>
				<h1 class="text-xl font-bold text-med-text-primary tracking-tight">
					MedPlatform
				</h1>
			</div>
		</div>

		<!-- Right side - Search, Notifications and user menu -->
		<div class="flex items-center space-x-4 med-animate-stagger-1">
			<!-- Search bar (desktop) -->
			<div class="hidden md:flex items-center">
				<div class="relative">
					<div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
						<Icon name="search" class="w-4 h-4 text-med-text-muted" />
					</div>
					<input
						type="text"
						class="med-input-glass w-64 pl-10 py-2.5 text-sm placeholder-med-text-muted focus:w-80 transition-all duration-300"
						placeholder="Search patients, records..."
					/>
				</div>
			</div>

			<!-- Notifications -->
			<button
				type="button"
				class="relative p-2.5 rounded-xl text-med-text-secondary hover:text-primary-600 hover:bg-primary-50 transition-all duration-300 transform hover:scale-105 med-focus-ring"
			>
				<Icon name="bell" class="w-5 h-5" />
				<!-- Notification badge with pulse animation -->
				<span class="absolute top-2 right-2 w-2.5 h-2.5 bg-error-500 rounded-full animate-pulse shadow-glow"></span>
			</button>

			<!-- User menu -->
			<div class="relative">
				<button
					type="button"
					class="flex items-center space-x-3 p-2 rounded-2xl text-med-text-secondary hover:bg-primary-50 transition-all duration-300 transform hover:scale-105 med-focus-ring"
					onclick={toggleUserMenu}
				>
					<div class="flex items-center space-x-3">
						<!-- Enhanced user avatar with medical status -->
						<div class="relative">
							<div class="w-10 h-10 med-gradient-primary rounded-2xl flex items-center justify-center shadow-medical">
								{#if displayInfo?.loading}
									<div class="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
								{:else}
									<span class="text-sm font-semibold text-white">
										{displayInfo?.initials || 'U'}
									</span>
								{/if}
							</div>
							<!-- Online status indicator -->
							<div class="absolute -bottom-1 -right-1 w-3 h-3 bg-success-500 rounded-full border-2 border-white shadow-sm"></div>
						</div>
						
						<div class="hidden md:block text-left">
							<p class="text-sm font-semibold text-med-text-primary">
								{displayInfo?.displayName || 'User'}
								{#if profileError}
									<span class="text-xs text-error-500 ml-1" title="Profile load error">⚠</span>
								{/if}
							</p>
							<p class="text-xs text-med-text-muted capitalize med-badge med-badge-info inline-flex">
								{displayInfo?.role || 'Patient'}
								{#if displayInfo?.verified}
									<span class="ml-1">✓</span>
								{/if}
							</p>
						</div>
						
						<Icon name="chevron-down" class={"w-4 h-4 text-med-text-muted transition-transform duration-200 " + (showUserMenu ? 'rotate-180' : '')} />
					</div>
				</button>

				<!-- Enhanced user dropdown menu with glassmorphism -->
				{#if showUserMenu}
					<div
						class="absolute right-0 mt-2 w-64 glass-card p-1 z-50 med-animate-fade-in-down"
					>
						<div class="p-3 border-b border-primary-100 mb-1">
							<div class="flex items-center space-x-3">
								<div class="w-12 h-12 med-gradient-primary rounded-2xl flex items-center justify-center">
									{#if displayInfo?.loading}
										<div class="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
									{:else}
										<span class="text-base font-semibold text-white">
											{displayInfo?.initials || 'U'}
										</span>
									{/if}
								</div>
								<div>
									<p class="font-semibold text-med-text-primary">
										{displayInfo?.displayName || 'User Name'}
										{#if profileError}
											<span class="text-xs text-error-500 ml-1" title="Profile load error">⚠</span>
										{/if}
									</p>
									<p class="text-xs text-med-text-muted">{displayInfo?.email || 'user@example.com'}</p>
									<div class="flex items-center space-x-2 mt-1">
										<div class="med-badge med-badge-success text-xs">
											{displayInfo?.role || 'Patient'}
										</div>
										{#if displayInfo?.verified}
											<div class="med-badge med-badge-info text-xs">
												Verified
											</div>
										{/if}
									</div>
									{#if displayInfo?.bio}
										<p class="text-xs text-med-text-muted mt-1 truncate max-w-48">{displayInfo.bio}</p>
									{/if}
								</div>
							</div>
						</div>

						<div class="py-1 space-y-1">
							<button
								type="button"
								class="flex items-center w-full px-4 py-3 text-sm text-med-text-secondary hover:bg-primary-50 hover:text-primary-700 transition-all duration-200 rounded-xl group"
								onclick={goToProfile}
							>
								<Icon name="user" class="w-4 h-4 mr-3 group-hover:text-primary-600" />
								<span class="font-medium">Profile</span>
								<Icon name="arrow-right" class="w-4 h-4 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
							</button>
							
							<button
								type="button"
								class="flex items-center w-full px-4 py-3 text-sm text-med-text-secondary hover:bg-primary-50 hover:text-primary-700 transition-all duration-200 rounded-xl group"
								onclick={goToSettings}
							>
								<Icon name="settings" class="w-4 h-4 mr-3 group-hover:text-primary-600" />
								<span class="font-medium">Settings</span>
								<Icon name="arrow-right" class="w-4 h-4 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
							</button>

							<button
								type="button"
								class="flex items-center w-full px-4 py-3 text-sm text-med-text-secondary hover:bg-primary-50 hover:text-primary-700 transition-all duration-200 rounded-xl group"
							>
								<Icon name="help-circle" class="w-4 h-4 mr-3 group-hover:text-primary-600" />
								<span class="font-medium">Help & Support</span>
								<Icon name="arrow-right" class="w-4 h-4 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
							</button>
							
							<div class="border-t border-primary-100 my-2"></div>
							
							<button
								type="button"
								class="flex items-center w-full px-4 py-3 text-sm text-error-600 hover:bg-error-50 hover:text-error-700 transition-all duration-200 rounded-xl group"
								onclick={handleLogout}
							>
								<Icon name="log-out" class="w-4 h-4 mr-3 group-hover:text-error-700" />
								<span class="font-medium">Sign out</span>
								<Icon name="arrow-right" class="w-4 h-4 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
							</button>
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>
</header>

<!-- Click outside to close user menu with glass overlay -->
{#if showUserMenu}
	<button
		type="button"
		class="fixed inset-0 z-30 bg-black bg-opacity-20 backdrop-blur-sm"
		aria-label="Close user menu"
		onclick={closeUserMenu}
	></button>
{/if}
