<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { authStore } from '../stores/auth';
	import Icon from '$lib/Icon.svelte';
	import { onDestroy } from 'svelte';

	export let open: boolean = false;
	export let onClose: () => void = () => {};

	// subscribe to authStore to get user
	let user: any = null;
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
		{ href: '/dashboard', icon: 'home', label: 'Dashboard' },
		{ href: '/consultations', icon: 'message-square', label: 'Consultations' },
		{ href: '/ai-chat', icon: 'brain', label: 'AI Assistant' },
		{ href: '/video-calls', icon: 'video', label: 'Video Calls' },
		{ href: '/doctors', icon: 'users', label: 'Find Doctors' },
		{ href: '/reminders', icon: 'clock', label: 'Reminders' },
		{ href: '/health-records', icon: 'file-text', label: 'Health Records' }
	];

	const doctorNavItems = [
		{ href: '/dashboard', icon: 'home', label: 'Dashboard' },
		{ href: '/consultations', icon: 'message-square', label: 'Consultations' },
		{ href: '/video-calls', icon: 'video', label: 'Video Calls' },
		{ href: '/patients', icon: 'users', label: 'Patients' },
		{ href: '/credentials', icon: 'award', label: 'Credentials' },
		{ href: '/schedule', icon: 'clock', label: 'Schedule' }
	];

	function navItems() {
		return user?.role === 'doctor' ? doctorNavItems : patientNavItems;
	}

	function navigateTo(href: string) {
		goto(href);
		onClose();
	}

	function isActive(href: string): boolean {
		return currentPath === href || (currentPath.startsWith(href) && href !== '/dashboard');
	}
</script>

<!-- Mobile backdrop -->
{#if open}
	<div
		class="fixed inset-0 bg-gray-600 bg-opacity-75 z-40 lg:hidden"
		onclick={onClose}
	></div>
{/if}

<!-- Sidebar -->
<div class="flex">
	<!-- Mobile sidebar -->
	<div
		class="fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:hidden {open ? 'translate-x-0' : '-translate-x-full'}"
	>
		<div class="flex items-center justify-between p-4 border-b border-gray-200">
			<h2 class="text-lg font-semibold text-gray-900">Menu</h2>
			<button
				type="button"
				class="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100"
				onclick={onClose}
			>
				<Icon name="x" class="w-5 h-5" />
			</button>
		</div>
		
		<nav class="mt-4 px-4">
			{#each navItems as item}
				<button
					type="button"
					class="flex items-center w-full px-3 py-2 mb-1 text-left rounded-lg transition-colors {isActive(item.href) 
						? 'bg-primary-100 text-primary-700 border-r-2 border-primary-600' 
						: 'text-gray-700 hover:bg-gray-100'}"
					onclick={() => navigateTo(item.href)}
				>
					<Icon name={item.icon} class="w-5 h-5 mr-3" />
					{item.label}
				</button>
			{/each}
		</nav>
	</div>

	<!-- Desktop sidebar -->
	<div class="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0">
		<div class="flex flex-col flex-grow bg-white border-r border-gray-200 overflow-y-auto">
			<!-- Logo/Brand -->
			<div class="flex items-center flex-shrink-0 px-6 py-4 border-b border-gray-200">
				<div class="flex items-center">
					<div class="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
						<span class="text-white font-bold text-sm">MP</span>
					</div>
					<span class="ml-3 text-lg font-semibold text-gray-900">MedPlatform</span>
				</div>
			</div>

			<!-- User info -->
			<div class="px-6 py-4 border-b border-gray-200">
				<div class="flex items-center">
					<div class="w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center">
						<span class="text-white font-medium">
							{user?.name?.charAt(0)?.toUpperCase() || 'U'}
						</span>
					</div>
					<div class="ml-3">
						<p class="text-sm font-medium text-gray-900">{user?.name}</p>
						<p class="text-xs text-gray-500 capitalize">{user?.role}</p>
						{#if user?.verified}
							<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-success-100 text-success-800 mt-1">
								Verified
							</span>
						{/if}
					</div>
				</div>
			</div>

			<!-- Navigation -->
			<nav class="flex-1 px-4 py-4 space-y-1">
				{#each navItems as item}
					<button
						type="button"
						class="flex items-center w-full px-3 py-2 text-left rounded-lg transition-colors group {isActive(item.href) 
							? 'bg-primary-100 text-primary-700' 
							: 'text-gray-700 hover:bg-gray-100'}"
						onclick={() => navigateTo(item.href)}
					>
						<Icon name={item.icon} class="w-5 h-5 mr-3 {isActive(item.href) ? 'text-primary-600' : 'text-gray-500 group-hover:text-gray-700'}" />
						{item.label}
					</button>
				{/each}
			</nav>

			<!-- Footer -->
			<div class="flex-shrink-0 px-4 py-4 border-t border-gray-200">
				<p class="text-xs text-gray-500 text-center">
					© 2024 MedPlatform
				</p>
			</div>
		</div>
	</div>
</div>
