<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { authStore } from '$stores/auth';
	import { toastStore } from '$stores/toast';
	import Header from '$components/Header.svelte';
	import Sidebar from '$components/Sidebar.svelte';
	import Icon from '$lib/Icon.svelte';

	let isLoading = $state(false);
	let stats = $state({
		consultations: 0,
		patients: 0,
		messages: 0,
		upcomingAppointments: 0
	});
	let recentActivity = $state<any[]>([]);
	let upcomingAppointments = $state<any[]>([]);

	async function loadDashboardData() {
		if (!$authStore.isAuthenticated) return;

		isLoading = true;
		try {
			// Mock data - in real app, fetch from API
			await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
			
			if ($authStore.user?.role === 'doctor') {
				stats = {
					consultations: 156,
					patients: 89,
					messages: 24,
					upcomingAppointments: 7
				};
				
				recentActivity = [
					{
						id: 1,
						type: 'consultation',
						title: 'Consultation with John Doe',
						time: '2 hours ago',
						status: 'completed'
					},
					{
						id: 2,
						type: 'message',
						title: 'New message from Sarah Wilson',
						time: '4 hours ago',
						status: 'unread'
					},
					{
						id: 3,
						type: 'appointment',
						title: 'Appointment scheduled with Mike Johnson',
						time: '1 day ago',
						status: 'scheduled'
					}
				];
				
				upcomingAppointments = [
					{
						id: 1,
						patient: 'Alice Brown',
						time: 'Today, 2:00 PM',
						type: 'Follow-up',
						status: 'confirmed'
					},
					{
						id: 2,
						patient: 'Robert Davis',
						time: 'Tomorrow, 10:30 AM',
						type: 'Consultation',
						status: 'pending'
					},
					{
						id: 3,
						patient: 'Emma Wilson',
						time: 'Thursday, 3:15 PM',
						type: 'Check-up',
						status: 'confirmed'
					}
				];
			} else {
				// Patient dashboard
				stats = {
					consultations: 12,
					patients: 0, // Not applicable for patients
					messages: 3,
					upcomingAppointments: 2
				};
				
				recentActivity = [
					{
						id: 1,
						type: 'consultation',
						title: 'AI Health Consultation completed',
						time: '1 day ago',
						status: 'completed'
					},
					{
						id: 2,
						type: 'reminder',
						title: 'Medication reminder: Take vitamins',
						time: '2 days ago',
						status: 'active'
					},
					{
						id: 3,
						type: 'appointment',
						title: 'Appointment with Dr. Smith scheduled',
						time: '3 days ago',
						status: 'scheduled'
					}
				];
				
				upcomingAppointments = [
					{
						id: 1,
						doctor: 'Dr. Sarah Smith',
						time: 'Tomorrow, 11:00 AM',
						type: 'General Consultation',
						status: 'confirmed'
					},
					{
						id: 2,
						doctor: 'Dr. Michael Johnson',
						time: 'Friday, 2:30 PM',
						type: 'Follow-up',
						status: 'confirmed'
					}
				];
			}
		} catch (error: any) {
			toastStore.error('Failed to load dashboard', error.message);
		} finally {
			isLoading = false;
		}
	}

	function getActivityIcon(type: string) {
		switch (type) {
			case 'consultation':
				return Stethoscope;
			case 'message':
				return MessageSquare;
			case 'appointment':
				return Calendar;
			case 'reminder':
				return Clock;
			default:
				return Activity;
		}
	}

	function getStatusColor(status: string) {
		switch (status) {
			case 'completed':
				return 'text-success-600 bg-success-100';
			case 'pending':
				return 'text-warning-600 bg-warning-100';
			case 'confirmed':
				return 'text-primary-600 bg-primary-100';
			case 'unread':
				return 'text-error-600 bg-error-100';
			default:
				return 'text-gray-600 bg-gray-100';
		}
	}

	onMount(() => {
		if (!$authStore.isAuthenticated) {
			goto('/auth/login');
			return;
		}
		loadDashboardData();
	});
</script>

<svelte:head>
	<title>Dashboard - MedPlatform</title>
	<meta name="description" content="Your MedPlatform dashboard" />
</svelte:head>

<div class="min-h-screen bg-gray-50">
	<Header />
	
	<div class="flex">
		<Sidebar />
		
		<main class="flex-1 p-6 lg:p-8">
			{#if isLoading}
				<div class="flex items-center justify-center h-64">
					<div class="spinner w-8 h-8"></div>
				</div>
			{:else}
				<!-- Welcome Section -->
				<div class="mb-8">
					<h1 class="text-2xl lg:text-3xl font-bold text-gray-900 mb-2">
						Welcome back, {$authStore.user?.name || 'User'}!
					</h1>
					<p class="text-gray-600">
						{#if $authStore.user?.role === 'doctor'}
							Here's what's happening with your patients today.
						{:else}
							Here's an overview of your health journey.
						{/if}
					</p>
				</div>

				<!-- Stats Grid -->
				<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
					{#if $authStore.user?.role === 'doctor'}
						<div class="card p-6">
							<div class="flex items-center justify-between">
								<div>
									<p class="text-sm font-medium text-gray-600">Total Consultations</p>
									<p class="text-2xl font-bold text-gray-900">{stats.consultations}</p>
								</div>
								<div class="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
									<Icon name="stethoscope" class="w-6 h-6 text-primary-600" />
								</div>
							</div>
							<div class="mt-4 flex items-center">
								<Icon name="trending-up" class="w-4 h-4 text-success-500 mr-1" />
								<span class="text-sm text-success-600">+12% from last month</span>
							</div>
						</div>

						<div class="card p-6">
							<div class="flex items-center justify-between">
								<div>
									<p class="text-sm font-medium text-gray-600">Active Patients</p>
									<p class="text-2xl font-bold text-gray-900">{stats.patients}</p>
								</div>
								<div class="w-12 h-12 bg-success-100 rounded-lg flex items-center justify-center">
									<Icon name="users" class="w-6 h-6 text-success-600" />
								</div>
							</div>
							<div class="mt-4 flex items-center">
								<Icon name="trending-up" class="w-4 h-4 text-success-500 mr-1" />
								<span class="text-sm text-success-600">+5 new this week</span>
							</div>
						</div>
					{:else}
						<div class="card p-6">
							<div class="flex items-center justify-between">
								<div>
									<p class="text-sm font-medium text-gray-600">Health Score</p>
									<p class="text-2xl font-bold text-gray-900">85</p>
								</div>
								<div class="w-12 h-12 bg-success-100 rounded-lg flex items-center justify-center">
									<Icon name="heart" class="w-6 h-6 text-success-600" />
								</div>
							</div>
							<div class="mt-4 flex items-center">
								<Icon name="trending-up" class="w-4 h-4 text-success-500 mr-1" />
								<span class="text-sm text-success-600">Good progress</span>
							</div>
						</div>

						<div class="card p-6">
							<div class="flex items-center justify-between">
								<div>
									<p class="text-sm font-medium text-gray-600">Consultations</p>
									<p class="text-2xl font-bold text-gray-900">{stats.consultations}</p>
								</div>
								<div class="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
									<Icon name="stethoscope" class="w-6 h-6 text-primary-600" />
								</div>
							</div>
							<div class="mt-4 flex items-center">
								<span class="text-sm text-gray-600">Total completed</span>
							</div>
						</div>
					{/if}

					<div class="card p-6">
						<div class="flex items-center justify-between">
							<div>
								<p class="text-sm font-medium text-gray-600">Messages</p>
								<p class="text-2xl font-bold text-gray-900">{stats.messages}</p>
							</div>
							<div class="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
								<Icon name="message-square" class="w-6 h-6 text-blue-600" />
							</div>
						</div>
						<div class="mt-4 flex items-center">
							<span class="text-sm text-gray-600">Unread messages</span>
						</div>
					</div>

					<div class="card p-6">
						<div class="flex items-center justify-between">
							<div>
								<p class="text-sm font-medium text-gray-600">Appointments</p>
								<p class="text-2xl font-bold text-gray-900">{stats.upcomingAppointments}</p>
							</div>
							<div class="w-12 h-12 bg-warning-100 rounded-lg flex items-center justify-center">
								<Icon name="calendar" class="w-6 h-6 text-warning-600" />
							</div>
						</div>
						<div class="mt-4 flex items-center">
							<span class="text-sm text-gray-600">This week</span>
						</div>
					</div>
				</div>

				<!-- Main Content Grid -->
				<div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
					<!-- Recent Activity -->
					<div class="lg:col-span-2">
						<div class="card">
							<div class="p-6 border-b border-gray-200">
								<h2 class="text-lg font-medium text-gray-900">Recent Activity</h2>
							</div>
							<div class="p-6">
								{#if recentActivity.length === 0}
									<p class="text-gray-500 text-center py-8">No recent activity</p>
								{:else}
									<div class="space-y-4">
										{#each recentActivity as activity}
											<div class="flex items-start space-x-4">
												<div class="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
													<svelte:component this={getActivityIcon(activity.type)} class="w-5 h-5 text-gray-600" />
												</div>
												<div class="flex-1 min-w-0">
													<p class="text-sm font-medium text-gray-900">
														{activity.title}
													</p>
													<p class="text-sm text-gray-500">{activity.time}</p>
												</div>
												<span class="badge {getStatusColor(activity.status)} text-xs">
													{activity.status}
												</span>
											</div>
										{/each}
									</div>
								{/if}
							</div>
						</div>
					</div>

					<!-- Upcoming Appointments -->
					<div>
						<div class="card">
							<div class="p-6 border-b border-gray-200">
								<h2 class="text-lg font-medium text-gray-900">Upcoming Appointments</h2>
							</div>
							<div class="p-6">
								{#if upcomingAppointments.length === 0}
									<p class="text-gray-500 text-center py-8">No upcoming appointments</p>
								{:else}
									<div class="space-y-4">
										{#each upcomingAppointments as appointment}
											<div class="flex items-start space-x-3">
												<div class="w-2 h-2 bg-primary-600 rounded-full mt-2 flex-shrink-0"></div>
												<div class="flex-1 min-w-0">
													<p class="text-sm font-medium text-gray-900">
														{#if $authStore.user?.role === 'doctor'}
															{appointment.patient}
														{:else}
															{appointment.doctor}
														{/if}
													</p>
													<p class="text-sm text-gray-600">{appointment.type}</p>
													<p class="text-xs text-gray-500">{appointment.time}</p>
												</div>
												<span class="badge {getStatusColor(appointment.status)} text-xs">
													{appointment.status}
												</span>
											</div>
										{/each}
									</div>
								{/if}
								
								<div class="mt-4 pt-4 border-t border-gray-200">
									<button
										type="button"
										class="btn-outline w-full"
										onclick={() => goto('/appointments')}
									>
										View All Appointments
									</button>
								</div>
							</div>
						</div>
					</div>
				</div>

				<!-- Quick Actions -->
				<div class="mt-8">
					<h2 class="text-lg font-medium text-gray-900 mb-4">Quick Actions</h2>
					<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
						{#if $authStore.user?.role === 'doctor'}
							<button
								type="button"
								class="card p-4 hover:shadow-md transition-shadow text-left"
								onclick={() => goto('/consultations/new')}
							>
								<div class="flex items-center space-x-3">
									<div class="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
										<Icon name="stethoscope" class="w-5 h-5 text-primary-600" />
									</div>
									<div>
										<p class="font-medium text-gray-900">New Consultation</p>
										<p class="text-sm text-gray-600">Start a patient consultation</p>
									</div>
								</div>
							</button>

							<button
								type="button"
								class="card p-4 hover:shadow-md transition-shadow text-left"
								onclick={() => goto('/patients')}
							>
								<div class="flex items-center space-x-3">
									<div class="w-10 h-10 bg-success-100 rounded-lg flex items-center justify-center">
										<Icon name="users" class="w-5 h-5 text-success-600" />
									</div>
									<div>
										<p class="font-medium text-gray-900">View Patients</p>
										<p class="text-sm text-gray-600">Manage patient records</p>
									</div>
								</div>
							</button>
						{:else}
							<button
								type="button"
								class="card p-4 hover:shadow-md transition-shadow text-left"
								onclick={() => goto('/ai-chat')}
							>
								<div class="flex items-center space-x-3">
									<div class="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
										<Icon name="message-square" class="w-5 h-5 text-primary-600" />
									</div>
									<div>
										<p class="font-medium text-gray-900">AI Health Chat</p>
										<p class="text-sm text-gray-600">Get instant health advice</p>
									</div>
								</div>
							</button>

							<button
								type="button"
								class="card p-4 hover:shadow-md transition-shadow text-left"
								onclick={() => goto('/doctors')}
							>
								<div class="flex items-center space-x-3">
									<div class="w-10 h-10 bg-success-100 rounded-lg flex items-center justify-center">
										<Icon name="stethoscope" class="w-5 h-5 text-success-600" />
									</div>
									<div>
										<p class="font-medium text-gray-900">Find Doctors</p>
										<p class="text-sm text-gray-600">Book a consultation</p>
									</div>
								</div>
							</button>
						{/if}

						<button
							type="button"
							class="card p-4 hover:shadow-md transition-shadow text-left"
							onclick={() => goto('/video')}
						>
							<div class="flex items-center space-x-3">
								<div class="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
									<Icon name="video" class="w-5 h-5 text-blue-600" />
								</div>
								<div>
									<p class="font-medium text-gray-900">Video Call</p>
									<p class="text-sm text-gray-600">Start or join a call</p>
								</div>
							</div>
						</button>

						<button
							type="button"
							class="card p-4 hover:shadow-md transition-shadow text-left"
							onclick={() => goto('/records')}
						>
							<div class="flex items-center space-x-3">
								<div class="w-10 h-10 bg-warning-100 rounded-lg flex items-center justify-center">
									<Icon name="file-text" class="w-5 h-5 text-warning-600" />
								</div>
								<div>
									<p class="font-medium text-gray-900">Health Records</p>
									<p class="text-sm text-gray-600">View medical history</p>
								</div>
							</div>
						</button>
					</div>
				</div>
			{/if}
		</main>
	</div>
</div>
