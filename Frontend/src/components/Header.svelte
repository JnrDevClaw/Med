<script lang="ts">
	import { Icon } from '$lib/icons';
	import { authStore } from '../stores/auth';
	import { goto } from '$app/navigation';
	import { createEventDispatcher, onDestroy } from 'svelte';

	export let onMenuClick: () => void = () => {};

	const dispatch = createEventDispatcher();
	let showUserMenu = false;

	let user: any = null;
	const unsubscribe = authStore.subscribe(state => {
		user = state?.user || null;
	});

	onDestroy(() => unsubscribe());

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

<header class="bg-white shadow-sm border-b border-gray-200">
	<div class="flex items-center justify-between px-6 py-4">
		<!-- Left side - Menu button and title -->
		<div class="flex items-center space-x-4">
			<button
				type="button"
				class="lg:hidden p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
				onclick={onMenuClick}
			>
				<Icon name="menu" class="w-5 h-5" />
			</button>
			
			<h1 class="text-xl font-semibold text-gray-900">
				MedPlatform
			</h1>
		</div>

		<!-- Right side - Notifications and user menu -->
		<div class="flex items-center space-x-4">
			<!-- Notifications -->
			<button
				type="button"
				class="relative p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
			>
				<Icon name="bell" class="w-5 h-5" />
				<!-- Notification badge -->
				<span class="absolute top-1 right-1 w-2 h-2 bg-error-500 rounded-full"></span>
			</button>

			<!-- User menu -->
			<div class="relative">
				<button
					type="button"
					class="flex items-center space-x-3 p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
					onclick={toggleUserMenu}
				>
					<div class="flex items-center space-x-2">
						<div class="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center">
							<span class="text-sm font-medium text-white">
								{user?.name?.charAt(0)?.toUpperCase() || 'U'}
							</span>
						</div>
						<div class="hidden md:block text-left">
							<p class="text-sm font-medium text-gray-900">{user?.name}</p>
							<p class="text-xs text-gray-500 capitalize">{user?.role}</p>
						</div>
					</div>
				</button>

				<!-- User dropdown menu -->
				{#if showUserMenu}
					<div
						class="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-50"
						class:hidden={!showUserMenu}
					>
						<div class="py-1">
							<button
								type="button"
								class="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
								onclick={goToProfile}
							>
								<Icon name="user" class="w-4 h-4 mr-3" />
								Profile
							</button>
							
							<button
								type="button"
								class="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
								onclick={goToSettings}
							>
								<Icon name="settings" class="w-4 h-4 mr-3" />
								Settings
							</button>
							
							<hr class="my-1" />
							
							<button
								type="button"
								class="flex items-center w-full px-4 py-2 text-sm text-error-700 hover:bg-error-50 transition-colors"
								onclick={handleLogout}
							>
								<Icon name="log-out" class="w-4 h-4 mr-3" />
								Sign out
							</button>
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>
</header>

<!-- Click outside to close user menu -->
{#if showUserMenu}
	<div
		class="fixed inset-0 z-40"
		onclick={closeUserMenu}
	></div>
{/if}
