<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { authStore } from '../../stores/auth';
	import ConsultationService from '../../services/consultationService';
	import LoadingSpinner from '../../lib/components/LoadingSpinner.svelte';
	import VerificationGuard from '../../lib/components/VerificationGuard.svelte';
	import VerificationPrompt from '../../lib/components/VerificationPrompt.svelte';
	import type { ConsultationRequest, DoctorAvailability, HealthCategory } from '../../types';

	let loading = false;
	let error = '';
	let success = '';
	
	// State for consultation requests
	let consultationRequests: ConsultationRequest[] = [];
	let availableDoctors: DoctorAvailability[] = [];
	let healthCategories: HealthCategory[] = [];
	let suggestedSpecialties: string[] = [];
	
	// Form state for creating new consultation request
	let showCreateForm = false;
	let showConfirmationDialog = false;
	let createForm = {
		category: '',
		description: '',
		urgency: 'medium' as 'low' | 'medium' | 'high' | 'emergency',
		preferredSpecialties: [] as string[],
		preferredDoctorUsername: ''
	};
	
	// Filter state
	let statusFilter = '';
	let categoryFilter = '';
	
	// Doctor availability state (for doctors)
	let doctorAvailability = {
		isOnline: false,
		specialties: [] as string[]
	};
	let newSpecialty = '';
	
	// Consultation notes state
	let showNotesDialog = false;
	let selectedRequestForNotes: ConsultationRequest | null = null;
	let newNote = '';
	let noteType: 'general' | 'medical' | 'administrative' = 'general';
	let consultationNotes: { [requestId: string]: any[] } = {};

	$: user = $authStore.user;
	$: isDoctor = user?.role === 'doctor';
	$: isPatient = user?.role === 'patient';

	onMount(async () => {
		await loadInitialData();
	});

	async function loadInitialData() {
		loading = true;
		error = '';
		
		try {
			// Load health categories
			const categoriesResponse = await ConsultationService.getHealthCategories();
			healthCategories = categoriesResponse.categories || [];
			
			// Load consultation requests
			await loadConsultationRequests();
			
			// Load available doctors if patient
			if (isPatient) {
				await loadAvailableDoctors();
			}
			
			// Load doctor availability if doctor
			if (isDoctor) {
				await loadDoctorAvailability();
			}
			
		} catch (err: any) {
			error = err.message || 'Failed to load consultation data';
		} finally {
			loading = false;
		}
	}

	async function loadConsultationRequests() {
		try {
			const filters: any = {};
			if (statusFilter) filters.status = statusFilter;
			if (categoryFilter) filters.category = categoryFilter;
			
			const response = await ConsultationService.getConsultationRequests(filters);
			consultationRequests = response.requests || [];
		} catch (err: any) {
			console.error('Failed to load consultation requests:', err);
		}
	}

	async function loadAvailableDoctors() {
		try {
			const response = await ConsultationService.getAvailableDoctors({ limit: 10 });
			availableDoctors = response.doctors || [];
		} catch (err: any) {
			console.error('Failed to load available doctors:', err);
		}
	}

	async function loadDoctorAvailability() {
		// This would need to be implemented to get current doctor's availability status
		// For now, we'll just set default values
		doctorAvailability = {
			isOnline: false,
			specialties: []
		};
	}

	function showConsultationConfirmation() {
		if (!createForm.category || !createForm.description.trim()) {
			error = 'Please fill in all required fields';
			return;
		}
		showConfirmationDialog = true;
	}

	async function createConsultationRequest() {
		loading = true;
		error = '';
		success = '';
		showConfirmationDialog = false;

		try {
			const response = await ConsultationService.createConsultationRequest({
				category: createForm.category,
				description: createForm.description.trim(),
				urgency: createForm.urgency,
				preferredSpecialties: createForm.preferredSpecialties,
				preferredDoctorUsername: createForm.preferredDoctorUsername || undefined
			});

			success = 'Consultation request created successfully!';
			showCreateForm = false;
			
			// Reset form
			createForm = {
				category: '',
				description: '',
				urgency: 'medium',
				preferredSpecialties: [],
				preferredDoctorUsername: ''
			};
			
			// Reload requests
			await loadConsultationRequests();
			
		} catch (err: any) {
			error = err.message || 'Failed to create consultation request';
		} finally {
			loading = false;
		}
	}

	async function updateRequestStatus(requestId: string, status: 'accepted' | 'rejected' | 'completed', additionalData?: any) {
		loading = true;
		error = '';
		success = '';

		try {
			await ConsultationService.updateRequestStatus(requestId, status, additionalData);
			success = `Request ${status} successfully!`;
			await loadConsultationRequests();
		} catch (err: any) {
			error = err.message || `Failed to ${status} request`;
		} finally {
			loading = false;
		}
	}

	async function setDoctorAvailability() {
		loading = true;
		error = '';
		success = '';

		try {
			await ConsultationService.setDoctorAvailability(
				doctorAvailability.isOnline,
				doctorAvailability.specialties
			);
			success = `Availability set to ${doctorAvailability.isOnline ? 'online' : 'offline'}`;
		} catch (err: any) {
			error = err.message || 'Failed to update availability';
		} finally {
			loading = false;
		}
	}

	function addSpecialty() {
		if (newSpecialty.trim() && !doctorAvailability.specialties.includes(newSpecialty.trim())) {
			doctorAvailability.specialties = [...doctorAvailability.specialties, newSpecialty.trim()];
			newSpecialty = '';
		}
	}

	function removeSpecialty(specialty: string) {
		doctorAvailability.specialties = doctorAvailability.specialties.filter(s => s !== specialty);
	}

	function addPreferredSpecialty() {
		if (newSpecialty.trim() && !createForm.preferredSpecialties.includes(newSpecialty.trim())) {
			createForm.preferredSpecialties = [...createForm.preferredSpecialties, newSpecialty.trim()];
			newSpecialty = '';
		}
	}

	function removePreferredSpecialty(specialty: string) {
		createForm.preferredSpecialties = createForm.preferredSpecialties.filter(s => s !== specialty);
	}

	async function onCategoryChange() {
		if (createForm.category) {
			try {
				const response = await ConsultationService.getCategorySpecialties(createForm.category);
				suggestedSpecialties = response.specialties || [];
			} catch (err) {
				console.error('Failed to load suggested specialties:', err);
				suggestedSpecialties = [];
			}
		} else {
			suggestedSpecialties = [];
		}
	}

	function addSuggestedSpecialty(specialty: string) {
		if (!createForm.preferredSpecialties.includes(specialty)) {
			createForm.preferredSpecialties = [...createForm.preferredSpecialties, specialty];
		}
	}

	function formatDate(dateString: string) {
		return new Date(dateString).toLocaleString();
	}

	function getStatusColor(status: string) {
		switch (status) {
			case 'pending': return 'text-yellow-600 bg-yellow-100';
			case 'assigned': return 'text-blue-600 bg-blue-100';
			case 'accepted': return 'text-green-600 bg-green-100';
			case 'rejected': return 'text-red-600 bg-red-100';
			case 'completed': return 'text-gray-600 bg-gray-100';
			case 'cancelled': return 'text-gray-500 bg-gray-50';
			default: return 'text-gray-600 bg-gray-100';
		}
	}

	function getUrgencyColor(urgency: string) {
		switch (urgency) {
			case 'low': return 'text-green-600 bg-green-100';
			case 'medium': return 'text-yellow-600 bg-yellow-100';
			case 'high': return 'text-orange-600 bg-orange-100';
			case 'emergency': return 'text-red-600 bg-red-100';
			default: return 'text-gray-600 bg-gray-100';
		}
	}

	async function startVideoCall(consultationId: string) {
		try {
			loading = true;
			error = '';

			// Create video room
			const response = await ConsultationService.createVideoRoom(consultationId);
			
			if (response.success) {
				// Navigate to video call page
				goto(`/video/${consultationId}`);
			} else {
				error = 'Failed to create video room';
			}
		} catch (err: any) {
			error = err.message || 'Failed to start video call';
		} finally {
			loading = false;
		}
	}

	function openNotesDialog(request: ConsultationRequest) {
		selectedRequestForNotes = request;
		showNotesDialog = true;
		newNote = '';
		noteType = 'general';
	}

	async function addConsultationNote() {
		if (!selectedRequestForNotes || !newNote.trim()) {
			error = 'Please enter a note';
			return;
		}

		loading = true;
		error = '';

		try {
			await ConsultationService.addRequestNote(
				selectedRequestForNotes.id,
				newNote.trim(),
				noteType
			);

			success = 'Note added successfully';
			newNote = '';
			showNotesDialog = false;
			selectedRequestForNotes = null;
			
			// Reload consultation requests to get updated notes
			await loadConsultationRequests();
		} catch (err: any) {
			error = err.message || 'Failed to add note';
		} finally {
			loading = false;
		}
	}

	function closeNotesDialog() {
		showNotesDialog = false;
		selectedRequestForNotes = null;
		newNote = '';
	}
</script>

{#if isDoctor}
	<!-- Verification Guard for Doctor Features -->
	<VerificationGuard requireVerifiedDoctor={true}>
		<div class="container mx-auto px-4 py-8">
			<div class="max-w-6xl mx-auto">
				<!-- Header -->
				<div class="mb-8">
					<h1 class="text-3xl font-bold text-gray-900 mb-2">Doctor Dashboard</h1>
					<p class="text-gray-600">Manage your availability and consultation requests</p>
				</div>

				<!-- Verification Prompt for Unverified Doctors -->
				<VerificationPrompt />

		<!-- Error/Success Messages -->
		{#if error}
			<div class="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
				{error}
			</div>
		{/if}

		{#if success}
			<div class="mb-6 p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg">
				{success}
			</div>
		{/if}

		<!-- Doctor Dashboard -->
		{#if isDoctor}
			<!-- Doctor Availability Section -->
			<div class="mb-8 bg-white rounded-lg shadow-md p-6">
				<div class="flex justify-between items-center mb-4">
					<h2 class="text-xl font-semibold">Your Availability</h2>
					<div class="flex items-center space-x-2">
						<div class="w-3 h-3 rounded-full {doctorAvailability.isOnline ? 'bg-green-400' : 'bg-gray-400'}"></div>
						<span class="text-sm font-medium {doctorAvailability.isOnline ? 'text-green-600' : 'text-gray-600'}">
							{doctorAvailability.isOnline ? 'Online' : 'Offline'}
						</span>
					</div>
				</div>
				
				<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
					<div class="space-y-4">
						<div class="flex items-center space-x-4">
							<label class="flex items-center">
								<input 
									type="checkbox" 
									bind:checked={doctorAvailability.isOnline}
									class="mr-2 text-green-600"
								>
								<span class="font-medium">
									Available for consultations
								</span>
							</label>
						</div>

						<div>
							<label class="block text-sm font-medium text-gray-700 mb-2">
								Your Specialties
							</label>
							<div class="flex flex-wrap gap-2 mb-2">
								{#each doctorAvailability.specialties as specialty}
									<span class="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800">
										{specialty}
										<button 
											type="button"
											on:click={() => removeSpecialty(specialty)}
											class="ml-2 text-blue-600 hover:text-blue-800"
										>
											×
										</button>
									</span>
								{/each}
							</div>
							<div class="flex space-x-2">
								<input
									type="text"
									bind:value={newSpecialty}
									placeholder="Add specialty"
									class="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									on:keypress={(e) => e.key === 'Enter' && addSpecialty()}
								>
								<button
									type="button"
									on:click={addSpecialty}
									class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
								>
									Add
								</button>
							</div>
						</div>

						<button
							type="button"
							on:click={setDoctorAvailability}
							disabled={loading}
							class="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
						>
							{loading ? 'Updating...' : 'Update Availability'}
						</button>
					</div>

					<!-- Quick Stats -->
					<div class="bg-gray-50 rounded-lg p-4">
						<h3 class="font-semibold text-gray-900 mb-3">Today's Overview</h3>
						<div class="space-y-2">
							<div class="flex justify-between">
								<span class="text-sm text-gray-600">Pending Requests:</span>
								<span class="font-medium text-yellow-600">
									{consultationRequests.filter(r => r.status === 'assigned' && r.assignedDoctorUsername === user?.username).length}
								</span>
							</div>
							<div class="flex justify-between">
								<span class="text-sm text-gray-600">Active Consultations:</span>
								<span class="font-medium text-green-600">
									{consultationRequests.filter(r => r.status === 'accepted' && r.assignedDoctorUsername === user?.username).length}
								</span>
							</div>
							<div class="flex justify-between">
								<span class="text-sm text-gray-600">Completed Today:</span>
								<span class="font-medium text-blue-600">
									{consultationRequests.filter(r => r.status === 'completed' && r.assignedDoctorUsername === user?.username).length}
								</span>
							</div>
						</div>
					</div>
				</div>
			</div>

			<!-- Incoming Requests Management -->
			<div class="mb-8 bg-white rounded-lg shadow-md">
				<div class="p-6 border-b border-gray-200">
					<div class="flex justify-between items-center">
						<h2 class="text-xl font-semibold">Incoming Consultation Requests</h2>
						<div class="flex items-center space-x-2">
							<span class="text-sm text-gray-600">Auto-refresh:</span>
							<button
								type="button"
								class="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200"
								on:click={loadConsultationRequests}
							>
								Refresh Now
							</button>
						</div>
					</div>
				</div>

				<div class="p-6">
					{#if consultationRequests.filter(r => r.status === 'assigned' && r.assignedDoctorUsername === user?.username).length > 0}
						{@const pendingRequests = consultationRequests.filter(r => r.status === 'assigned' && r.assignedDoctorUsername === user?.username)}
						<div class="space-y-4">
							{#each pendingRequests as request}
								<div class="border border-yellow-200 bg-yellow-50 rounded-lg p-4">
									<div class="flex justify-between items-start mb-3">
										<div>
											<h3 class="font-semibold text-lg text-gray-900">{request.category}</h3>
											<p class="text-sm text-gray-600">Patient: {request.patientUsername}</p>
											<p class="text-xs text-gray-500">Requested: {formatDate(request.createdAt)}</p>
										</div>
										<div class="flex space-x-2">
											<span class="px-3 py-1 rounded-full text-sm {getUrgencyColor(request.urgency)}">
												{request.urgency}
											</span>
										</div>
									</div>

									<div class="mb-4">
										<h4 class="font-medium text-gray-700 mb-2">Patient's Description:</h4>
										<p class="text-gray-700 bg-white p-3 rounded border">{request.description}</p>
									</div>

									{#if request.preferredSpecialties.length > 0}
										<div class="mb-4">
											<span class="text-sm font-medium text-gray-700">Requested Specialties:</span>
											<div class="flex flex-wrap gap-1 mt-1">
												{#each request.preferredSpecialties as specialty}
													<span class="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
														{specialty}
													</span>
												{/each}
											</div>
										</div>
									{/if}

									<div class="flex space-x-3">
										<button
											type="button"
											on:click={() => updateRequestStatus(request.id, 'accepted')}
											disabled={loading}
											class="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 flex items-center space-x-2"
										>
											<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
												<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
											</svg>
											<span>Accept</span>
										</button>
										<button
											type="button"
											on:click={() => updateRequestStatus(request.id, 'rejected', { rejectionReason: 'Unable to take consultation at this time' })}
											disabled={loading}
											class="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 flex items-center space-x-2"
										>
											<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
												<path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
											</svg>
											<span>Decline</span>
										</button>
									</div>
								</div>
							{/each}
						</div>
					{:else}
						<div class="text-center py-8 text-gray-500">
							<svg class="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2M4 13h2m13-8l-4 4m0 0l-4-4m4 4V3" />
							</svg>
							<p class="text-lg font-medium mb-2">No pending requests</p>
							<p class="text-sm">New consultation requests will appear here</p>
						</div>
					{/if}
				</div>
			</div>

			<!-- Consultation History -->
			<div class="mb-8 bg-white rounded-lg shadow-md">
				<div class="p-6 border-b border-gray-200">
					<h2 class="text-xl font-semibold">Consultation History</h2>
				</div>

				<div class="p-6">
					{#if consultationRequests.filter(r => 
						(r.status === 'accepted' || r.status === 'completed' || r.status === 'rejected') && 
						r.assignedDoctorUsername === user?.username
					).length > 0}
						{@const historyRequests = consultationRequests.filter(r => 
							(r.status === 'accepted' || r.status === 'completed' || r.status === 'rejected') && 
							r.assignedDoctorUsername === user?.username
						)}
						<div class="space-y-4">
							{#each historyRequests as request}
								<div class="border border-gray-200 rounded-lg p-4 {request.status === 'completed' ? 'bg-green-50' : request.status === 'rejected' ? 'bg-red-50' : 'bg-blue-50'}">
									<div class="flex justify-between items-start mb-3">
										<div>
											<h3 class="font-semibold text-lg text-gray-900">{request.category}</h3>
											<p class="text-sm text-gray-600">Patient: {request.patientUsername}</p>
											<p class="text-xs text-gray-500">
												{formatDate(request.createdAt)} - {formatDate(request.updatedAt)}
											</p>
										</div>
										<div class="flex flex-col items-end space-y-2">
											<span class="px-3 py-1 rounded-full text-sm {getStatusColor(request.status)}">
												{request.status}
											</span>
											<span class="px-2 py-1 rounded-full text-xs {getUrgencyColor(request.urgency)}">
												{request.urgency}
											</span>
										</div>
									</div>

									<div class="mb-3">
										<h4 class="font-medium text-gray-700 mb-1">Patient's Issue:</h4>
										<p class="text-gray-700 text-sm bg-white p-2 rounded border">
											{request.description}
										</p>
									</div>

									{#if request.preferredSpecialties.length > 0}
										<div class="mb-3">
											<span class="text-sm font-medium text-gray-700">Specialties:</span>
											<div class="flex flex-wrap gap-1 mt-1">
												{#each request.preferredSpecialties as specialty}
													<span class="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded">
														{specialty}
													</span>
												{/each}
											</div>
										</div>
									{/if}

									{#if request.rejectionReason}
										<div class="mb-3 p-2 bg-red-100 border border-red-200 rounded">
											<span class="text-sm font-medium text-red-700">Rejection Reason:</span>
											<p class="text-sm text-red-600 mt-1">{request.rejectionReason}</p>
										</div>
									{/if}

									{#if request.scheduledAt}
										<div class="mb-3">
											<span class="text-sm font-medium text-gray-700">Scheduled:</span>
											<span class="ml-2 text-sm text-gray-900">{formatDate(request.scheduledAt)}</span>
										</div>
									{/if}

									<div class="flex justify-between items-center">
										<div class="text-xs text-gray-500">
											Duration: {Math.round((new Date(request.updatedAt).getTime() - new Date(request.createdAt).getTime()) / (1000 * 60))} minutes
										</div>
										<div class="flex space-x-2">
											{#if request.status === 'accepted'}
												<button
													type="button"
													on:click={() => startVideoCall(request.id)}
													disabled={loading}
													class="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
												>
													Resume Call
												</button>
											{/if}
											<button
												type="button"
												on:click={() => openNotesDialog(request)}
												class="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
											>
												{request.status === 'completed' ? 'View Notes' : 'Add Notes'}
											</button>
										</div>
									</div>
								</div>
							{/each}
						</div>
					{:else}
						<div class="text-center py-8 text-gray-500">
							<svg class="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
							</svg>
							<p class="text-lg font-medium mb-2">No consultation history</p>
							<p class="text-sm">Completed consultations will appear here</p>
						</div>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Pre-call verification prompts -->
		{#if isPatient}
			<div class="mb-8 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
				<h2 class="text-xl font-semibold text-yellow-800 mb-4">Before Requesting a Consultation</h2>
				<p class="text-yellow-700 mb-4">
					We recommend trying these resources first, as they may provide the answers you need:
				</p>
				<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
					<a 
						href="/qa" 
						class="flex items-center p-4 bg-white border border-yellow-300 rounded-lg hover:bg-yellow-50 transition-colors"
					>
						<div class="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
							<svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
							</svg>
						</div>
						<div>
							<h3 class="font-semibold text-gray-900">Q&A Forum</h3>
							<p class="text-sm text-gray-600">Ask questions and get answers from the community</p>
						</div>
					</a>
					<a 
						href="/ai" 
						class="flex items-center p-4 bg-white border border-yellow-300 rounded-lg hover:bg-yellow-50 transition-colors"
					>
						<div class="flex-shrink-0 w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mr-3">
							<svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
							</svg>
						</div>
						<div>
							<h3 class="font-semibold text-gray-900">AI Assistant</h3>
							<p class="text-sm text-gray-600">Get instant AI-powered medical guidance</p>
						</div>
					</a>
				</div>
				<div class="flex items-center text-sm text-yellow-700">
					<svg class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
						<path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
					</svg>
					Video consultations are for cases that require direct doctor interaction
				</div>
			</div>

			<!-- Patient: Create Consultation Request -->
			<div class="mb-8">
				<div class="flex justify-between items-center mb-4">
					<h2 class="text-xl font-semibold">Request Video Consultation</h2>
					<button
						type="button"
						on:click={() => showCreateForm = !showCreateForm}
						class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
					>
						{showCreateForm ? 'Cancel' : 'New Request'}
					</button>
				</div>

				{#if showCreateForm}
					<div class="bg-white rounded-lg shadow-md p-6">
						<!-- Pre-consultation checklist -->
						<div class="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
							<h3 class="font-semibold text-blue-800 mb-3">Pre-Consultation Checklist</h3>
							<div class="space-y-2">
								<label class="flex items-center">
									<input type="checkbox" required class="mr-2 text-blue-600">
									<span class="text-sm text-blue-700">I have searched the <a href="/qa" class="underline font-medium">Q&A forum</a> for similar questions</span>
								</label>
								<label class="flex items-center">
									<input type="checkbox" required class="mr-2 text-blue-600">
									<span class="text-sm text-blue-700">I have tried the <a href="/ai" class="underline font-medium">AI assistant</a> for initial guidance</span>
								</label>
								<label class="flex items-center">
									<input type="checkbox" required class="mr-2 text-blue-600">
									<span class="text-sm text-blue-700">My concern requires direct doctor consultation</span>
								</label>
							</div>
						</div>

						<form on:submit|preventDefault={createConsultationRequest} class="space-y-4">
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-2">
									Health Category *
								</label>
								<select
									bind:value={createForm.category}
									on:change={onCategoryChange}
									required
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
								>
									<option value="">Select category</option>
									{#each healthCategories as category}
										<option value={category.name}>{category.name}</option>
									{/each}
								</select>
								{#if createForm.category}
									{@const selectedCategory = healthCategories.find(c => c.name === createForm.category)}
									{#if selectedCategory}
										<p class="mt-1 text-sm text-gray-600">{selectedCategory.description}</p>
									{/if}
								{/if}
							</div>

							<div>
								<label class="block text-sm font-medium text-gray-700 mb-2">
									Description *
								</label>
								<textarea
									bind:value={createForm.description}
									required
									rows="4"
									placeholder="Describe your health concern in detail..."
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
								></textarea>
							</div>

							<div>
								<label class="block text-sm font-medium text-gray-700 mb-2">
									Urgency
								</label>
								<select
									bind:value={createForm.urgency}
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
								>
									<option value="low">Low</option>
									<option value="medium">Medium</option>
									<option value="high">High</option>
									<option value="emergency">Emergency</option>
								</select>
							</div>

							<div>
								<label class="block text-sm font-medium text-gray-700 mb-2">
									Preferred Specialties
								</label>
								
								<!-- Suggested specialties for selected category -->
								{#if suggestedSpecialties.length > 0}
									<div class="mb-3">
										<p class="text-sm text-gray-600 mb-2">Suggested specialties for {createForm.category}:</p>
										<div class="flex flex-wrap gap-2">
											{#each suggestedSpecialties as specialty}
												<button
													type="button"
													on:click={() => addSuggestedSpecialty(specialty)}
													disabled={createForm.preferredSpecialties.includes(specialty)}
													class="px-3 py-1 text-sm border border-blue-300 text-blue-700 rounded-full hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
												>
													+ {specialty}
												</button>
											{/each}
										</div>
									</div>
								{/if}

								<div class="flex flex-wrap gap-2 mb-2">
									{#each createForm.preferredSpecialties as specialty}
										<span class="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800">
											{specialty}
											<button 
												type="button"
												on:click={() => removePreferredSpecialty(specialty)}
												class="ml-2 text-blue-600 hover:text-blue-800"
											>
												×
											</button>
										</span>
									{/each}
								</div>
								<div class="flex space-x-2">
									<input
										type="text"
										bind:value={newSpecialty}
										placeholder="Add custom specialty"
										class="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
										on:keypress={(e) => e.key === 'Enter' && addPreferredSpecialty()}
									>
									<button
										type="button"
										on:click={addPreferredSpecialty}
										class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
									>
										Add
									</button>
								</div>
							</div>

							<div>
								<label class="block text-sm font-medium text-gray-700 mb-2">
									Preferred Doctor (optional)
								</label>
								<input
									type="text"
									bind:value={createForm.preferredDoctorUsername}
									placeholder="Enter doctor's username"
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
								>
							</div>

							<div class="flex space-x-4">
								<button
									type="button"
									on:click={showConsultationConfirmation}
									disabled={loading}
									class="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
								>
									Review Request
								</button>
								<button
									type="button"
									on:click={() => showCreateForm = false}
									class="px-6 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
								>
									Cancel
								</button>
							</div>
						</form>
					</div>
				{/if}
			</div>
		{/if}

		<!-- Doctor Search and Selection -->
		{#if isPatient}
			<div class="mb-8 bg-white rounded-lg shadow-md p-6">
				<div class="flex justify-between items-center mb-4">
					<h2 class="text-xl font-semibold">Find Available Doctors</h2>
					<button
						type="button"
						on:click={loadAvailableDoctors}
						disabled={loading}
						class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
					>
						{loading ? 'Refreshing...' : 'Refresh'}
					</button>
				</div>

				<!-- Doctor Search Filters -->
				<div class="mb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
					<div>
						<label class="block text-sm font-medium text-gray-700 mb-2">
							Search by Specialty
						</label>
						<input
							type="text"
							placeholder="e.g., Cardiology, Dermatology"
							class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
						>
					</div>
					<div>
						<label class="block text-sm font-medium text-gray-700 mb-2">
							Max Current Load
						</label>
						<select class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
							<option value="5">Any load (up to 5)</option>
							<option value="3">Light load (up to 3)</option>
							<option value="1">Very light load (up to 1)</option>
						</select>
					</div>
					<div>
						<label class="block text-sm font-medium text-gray-700 mb-2">
							Sort By
						</label>
						<select class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
							<option value="load">Current Load (Low to High)</option>
							<option value="recent">Recently Active</option>
							<option value="specialties">Most Specialties</option>
						</select>
					</div>
				</div>

				{#if availableDoctors.length > 0}
					<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
						{#each availableDoctors as doctor}
							<div class="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors">
								<div class="flex justify-between items-start mb-3">
									<div>
										<h3 class="font-semibold text-lg text-gray-900">{doctor.doctorUsername}</h3>
										<div class="flex items-center mt-1">
											<div class="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
											<span class="text-sm text-green-600 font-medium">Online</span>
										</div>
									</div>
									<div class="text-right">
										<div class="text-sm text-gray-600">Current Load</div>
										<div class="text-lg font-semibold {doctor.currentLoad <= 2 ? 'text-green-600' : doctor.currentLoad <= 4 ? 'text-yellow-600' : 'text-red-600'}">
											{doctor.currentLoad}/5
										</div>
									</div>
								</div>

								{#if doctor.specialties.length > 0}
									<div class="mb-3">
										<div class="text-sm font-medium text-gray-700 mb-1">Specialties:</div>
										<div class="flex flex-wrap gap-1">
											{#each doctor.specialties.slice(0, 3) as specialty}
												<span class="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
													{specialty}
												</span>
											{/each}
											{#if doctor.specialties.length > 3}
												<span class="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">
													+{doctor.specialties.length - 3} more
												</span>
											{/if}
										</div>
									</div>
								{/if}

								<div class="flex justify-between items-center text-xs text-gray-500 mb-3">
									<span>Last seen: {formatDate(doctor.lastSeen)}</span>
								</div>

								<button
									type="button"
									on:click={() => {
										createForm.preferredDoctorUsername = doctor.doctorUsername;
										showCreateForm = true;
									}}
									class="w-full px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
								>
									Request Consultation
								</button>
							</div>
						{/each}
					</div>
				{:else if !loading}
					<div class="text-center py-8 text-gray-500">
						<svg class="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
						</svg>
						<p class="text-lg font-medium mb-2">No doctors currently available</p>
						<p class="text-sm">Try refreshing or check back later</p>
					</div>
				{/if}
			</div>
		{/if}

		<!-- Consultation Requests -->
		<div class="bg-white rounded-lg shadow-md">
			<div class="p-6 border-b border-gray-200">
				<div class="flex justify-between items-center mb-4">
					<h2 class="text-xl font-semibold">
						{isDoctor ? 'Consultation Requests' : 'Your Requests'}
					</h2>
				</div>

				<!-- Filters -->
				<div class="flex space-x-4">
					<select
						bind:value={statusFilter}
						on:change={loadConsultationRequests}
						class="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
					>
						<option value="">All Statuses</option>
						<option value="pending">Pending</option>
						<option value="assigned">Assigned</option>
						<option value="accepted">Accepted</option>
						<option value="rejected">Rejected</option>
						<option value="completed">Completed</option>
						<option value="cancelled">Cancelled</option>
					</select>

					<select
						bind:value={categoryFilter}
						on:change={loadConsultationRequests}
						class="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
					>
						<option value="">All Categories</option>
						{#each healthCategories as category}
							<option value={category.name}>{category.name}</option>
						{/each}
					</select>
				</div>
			</div>

			<div class="p-6">
				{#if loading}
					<div class="flex justify-center py-8">
						<LoadingSpinner />
					</div>
				{:else if consultationRequests.length === 0}
					<div class="text-center py-8 text-gray-500">
						No consultation requests found.
					</div>
				{:else}
					<div class="space-y-4">
						{#each consultationRequests as request}
							<div class="border border-gray-200 rounded-lg p-6">
								<div class="flex justify-between items-start mb-4">
									<div>
										<h3 class="text-lg font-semibold">{request.category}</h3>
										<p class="text-sm text-gray-600">
											{isDoctor ? `Patient: ${request.patientUsername}` : `Request ID: ${request.id.slice(0, 8)}`}
										</p>
									</div>
									<div class="flex space-x-2">
										<span class="px-3 py-1 rounded-full text-sm {getStatusColor(request.status)}">
											{request.status}
										</span>
										<span class="px-3 py-1 rounded-full text-sm {getUrgencyColor(request.urgency)}">
											{request.urgency}
										</span>
									</div>
								</div>

								<p class="text-gray-700 mb-4">{request.description}</p>

								{#if request.preferredSpecialties.length > 0}
									<div class="mb-4">
										<span class="text-sm font-medium text-gray-700">Preferred Specialties:</span>
										<div class="flex flex-wrap gap-1 mt-1">
											{#each request.preferredSpecialties as specialty}
												<span class="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded">
													{specialty}
												</span>
											{/each}
										</div>
									</div>
								{/if}

								{#if request.assignedDoctorUsername}
									<p class="text-sm text-gray-600 mb-2">
										Assigned Doctor: {request.assignedDoctorUsername}
									</p>
								{/if}

								{#if request.scheduledAt}
									<p class="text-sm text-gray-600 mb-2">
										Scheduled: {formatDate(request.scheduledAt)}
									</p>
								{/if}

								{#if request.rejectionReason}
									<p class="text-sm text-red-600 mb-2">
										Rejection Reason: {request.rejectionReason}
									</p>
								{/if}

								<div class="flex justify-between items-center text-sm text-gray-500">
									<span>Created: {formatDate(request.createdAt)}</span>
									<span>Updated: {formatDate(request.updatedAt)}</span>
								</div>

								<!-- Doctor Actions -->
								{#if isDoctor && request.status === 'assigned' && request.assignedDoctorUsername === user?.username}
									<div class="mt-4 flex flex-wrap gap-2">
										<button
											type="button"
											on:click={() => updateRequestStatus(request.id, 'accepted')}
											disabled={loading}
											class="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 flex items-center space-x-2"
										>
											<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
												<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
											</svg>
											<span>Accept</span>
										</button>
										<button
											type="button"
											on:click={() => updateRequestStatus(request.id, 'rejected', { rejectionReason: 'Unable to take consultation at this time' })}
											disabled={loading}
											class="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 flex items-center space-x-2"
										>
											<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
												<path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
											</svg>
											<span>Decline</span>
										</button>
										<button
											type="button"
											on:click={() => openNotesDialog(request)}
											class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center space-x-2"
										>
											<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
											</svg>
											<span>Add Note</span>
										</button>
									</div>
								{/if}

								{#if isDoctor && request.status === 'accepted' && request.assignedDoctorUsername === user?.username}
									<div class="mt-4 flex flex-wrap gap-2">
										<button
											type="button"
											on:click={() => startVideoCall(request.id)}
											disabled={loading}
											class="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 flex items-center space-x-2"
										>
											<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
												<path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
											</svg>
											<span>Start Video Call</span>
										</button>
										<button
											type="button"
											on:click={() => updateRequestStatus(request.id, 'completed')}
											disabled={loading}
											class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
										>
											Mark as Completed
										</button>
										<button
											type="button"
											on:click={() => openNotesDialog(request)}
											class="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 flex items-center space-x-2"
										>
											<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
											</svg>
											<span>Add Note</span>
										</button>
									</div>
								{/if}

								{#if isDoctor && request.status === 'completed' && request.assignedDoctorUsername === user?.username}
									<div class="mt-4">
										<button
											type="button"
											on:click={() => openNotesDialog(request)}
											class="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 flex items-center space-x-2"
										>
											<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
											</svg>
											<span>View/Add Notes</span>
										</button>
									</div>
								{/if}

								<!-- Patient Video Call Button -->
								{#if isPatient && request.status === 'accepted' && request.patientUsername === user?.username}
									<div class="mt-4">
										<button
											type="button"
											on:click={() => startVideoCall(request.id)}
											disabled={loading}
											class="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 flex items-center space-x-2"
										>
											<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
												<path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
											</svg>
											<span>Join Video Call</span>
										</button>
									</div>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</div>
			</div>
		</div>
	</VerificationGuard>
{:else}
	<div class="container mx-auto px-4 py-8">
		<div class="max-w-6xl mx-auto">
			<!-- Header -->
			<div class="mb-8">
				<h1 class="text-3xl font-bold text-gray-900 mb-2">Consultations</h1>
				<p class="text-gray-600">Request consultations with verified doctors</p>
			</div>

			<!-- Error/Success Messages -->
			{#if error}
				<div class="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
					{error}
				</div>
			{/if}

			{#if success}
				<div class="mb-6 p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg">
					{success}
				</div>
			{/if}

			<!-- Pre-call verification prompts -->
			<div class="mb-8 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
				<h2 class="text-xl font-semibold text-yellow-800 mb-4">Before Requesting a Consultation</h2>
				<p class="text-yellow-700 mb-4">
					We recommend trying these resources first, as they may provide the answers you need:
				</p>
				<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
					<a 
						href="/qa" 
						class="flex items-center p-4 bg-white border border-yellow-300 rounded-lg hover:bg-yellow-50 transition-colors"
					>
						<div class="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
							<svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
							</svg>
						</div>
						<div>
							<h3 class="font-semibold text-gray-900">Q&A Forum</h3>
							<p class="text-sm text-gray-600">Ask questions and get answers from the community</p>
						</div>
					</a>
					<a 
						href="/ai" 
						class="flex items-center p-4 bg-white border border-yellow-300 rounded-lg hover:bg-yellow-50 transition-colors"
					>
						<div class="flex-shrink-0 w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mr-3">
							<svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
							</svg>
						</div>
						<div>
							<h3 class="font-semibold text-gray-900">AI Assistant</h3>
							<p class="text-sm text-gray-600">Get instant AI-powered medical guidance</p>
						</div>
					</a>
				</div>
				<div class="flex items-center text-sm text-yellow-700">
					<svg class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
						<path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
					</svg>
					Video consultations are for cases that require direct doctor interaction
				</div>
			</div>

			<!-- Patient: Create Consultation Request -->
			<div class="mb-8">
				<div class="flex justify-between items-center mb-4">
					<h2 class="text-xl font-semibold">Request Video Consultation</h2>
					<button
						type="button"
						on:click={() => showCreateForm = !showCreateForm}
						class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
					>
						{showCreateForm ? 'Cancel' : 'New Request'}
					</button>
				</div>

				{#if showCreateForm}
					<!-- Form content will be here -->
				{/if}
			</div>

			<!-- Doctor Search and Selection -->
			<div class="mb-8 bg-white rounded-lg shadow-md p-6">
				<div class="flex justify-between items-center mb-4">
					<h2 class="text-xl font-semibold">Find Available Doctors</h2>
					<button
						type="button"
						on:click={loadAvailableDoctors}
						disabled={loading}
						class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
					>
						{loading ? 'Refreshing...' : 'Refresh'}
					</button>
				</div>
				<!-- Doctor list content -->
			</div>

			<!-- Consultation Requests -->
			<div class="bg-white rounded-lg shadow-md">
				<div class="p-6 border-b border-gray-200">
					<div class="flex justify-between items-center mb-4">
						<h2 class="text-xl font-semibold">Your Requests</h2>
					</div>

					<!-- Filters -->
					<div class="flex space-x-4">
						<select
							bind:value={statusFilter}
							on:change={loadConsultationRequests}
							class="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
						>
							<option value="">All Statuses</option>
							<option value="pending">Pending</option>
							<option value="assigned">Assigned</option>
							<option value="accepted">Accepted</option>
							<option value="rejected">Rejected</option>
							<option value="completed">Completed</option>
							<option value="cancelled">Cancelled</option>
						</select>

						<select
							bind:value={categoryFilter}
							on:change={loadConsultationRequests}
							class="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
						>
							<option value="">All Categories</option>
							{#each healthCategories as category}
								<option value={category.name}>{category.name}</option>
							{/each}
						</select>
					</div>
				</div>

				<div class="p-6">
					{#if loading}
						<div class="flex justify-center py-8">
							<LoadingSpinner />
						</div>
					{:else if consultationRequests.length === 0}
						<div class="text-center py-8 text-gray-500">
							No consultation requests found.
						</div>
					{:else}
						<!-- Request list content -->
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}

<!-- Consultation Request Confirmation Dialog -->
{#if showConfirmationDialog}
	<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
		<div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
			<div class="p-6">
				<h3 class="text-lg font-semibold text-gray-900 mb-4">Confirm Consultation Request</h3>
				
				<div class="mb-6">
					<div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
						<div class="flex items-start">
							<svg class="w-5 h-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
								<path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
							</svg>
							<div>
								<h4 class="font-medium text-yellow-800 mb-2">Before proceeding, consider these alternatives:</h4>
								<div class="space-y-2">
									<a 
										href="/qa" 
										class="flex items-center text-sm text-yellow-700 hover:text-yellow-900 underline"
										target="_blank"
									>
										<svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-2M7 7h10v10M7 7l10 10" />
										</svg>
										Search Q&A Forum for similar questions
									</a>
									<a 
										href="/ai" 
										class="flex items-center text-sm text-yellow-700 hover:text-yellow-900 underline"
										target="_blank"
									>
										<svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-2M7 7h10v10M7 7l10 10" />
										</svg>
										Try AI Assistant for instant guidance
									</a>
								</div>
							</div>
						</div>
					</div>

					<div class="space-y-3">
						<div>
							<span class="font-medium text-gray-700">Category:</span>
							<span class="ml-2 text-gray-900">{createForm.category}</span>
						</div>
						<div>
							<span class="font-medium text-gray-700">Urgency:</span>
							<span class="ml-2 px-2 py-1 rounded-full text-sm {getUrgencyColor(createForm.urgency)}">
								{createForm.urgency}
							</span>
						</div>
						{#if createForm.preferredDoctorUsername}
							<div>
								<span class="font-medium text-gray-700">Preferred Doctor:</span>
								<span class="ml-2 text-gray-900">{createForm.preferredDoctorUsername}</span>
							</div>
						{/if}
						<div>
							<span class="font-medium text-gray-700">Description:</span>
							<p class="mt-1 text-gray-900 text-sm bg-gray-50 p-2 rounded">
								{createForm.description}
							</p>
						</div>
					</div>
				</div>

				<div class="flex space-x-3">
					<button
						type="button"
						on:click={createConsultationRequest}
						disabled={loading}
						class="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
					>
						{loading ? 'Creating...' : 'Confirm Request'}
					</button>
					<button
						type="button"
						on:click={() => showConfirmationDialog = false}
						class="flex-1 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
					>
						Go Back
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<!-- Consultation Notes Dialog -->
{#if showNotesDialog && selectedRequestForNotes}
	<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
		<div class="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
			<div class="p-6">
				<div class="flex justify-between items-center mb-4">
					<h3 class="text-lg font-semibold text-gray-900">
						Consultation Notes - {selectedRequestForNotes.category}
					</h3>
					<button
						type="button"
						on:click={closeNotesDialog}
						class="text-gray-400 hover:text-gray-600"
					>
						<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>

				<!-- Patient Information -->
				<div class="mb-6 p-4 bg-gray-50 rounded-lg">
					<h4 class="font-medium text-gray-900 mb-2">Patient Information</h4>
					<div class="grid grid-cols-2 gap-4 text-sm">
						<div>
							<span class="font-medium text-gray-700">Patient:</span>
							<span class="ml-2 text-gray-900">{selectedRequestForNotes.patientUsername}</span>
						</div>
						<div>
							<span class="font-medium text-gray-700">Request Date:</span>
							<span class="ml-2 text-gray-900">{formatDate(selectedRequestForNotes.createdAt)}</span>
						</div>
						<div>
							<span class="font-medium text-gray-700">Category:</span>
							<span class="ml-2 text-gray-900">{selectedRequestForNotes.category}</span>
						</div>
						<div>
							<span class="font-medium text-gray-700">Urgency:</span>
							<span class="ml-2 px-2 py-1 rounded-full text-xs {getUrgencyColor(selectedRequestForNotes.urgency)}">
								{selectedRequestForNotes.urgency}
							</span>
						</div>
					</div>
					<div class="mt-3">
						<span class="font-medium text-gray-700">Patient's Description:</span>
						<p class="mt-1 text-gray-900 text-sm bg-white p-2 rounded border">
							{selectedRequestForNotes.description}
						</p>
					</div>
				</div>

				<!-- Existing Notes (if any) -->
				{#if consultationNotes[selectedRequestForNotes.id]?.length > 0}
					<div class="mb-6">
						<h4 class="font-medium text-gray-900 mb-3">Previous Notes</h4>
						<div class="space-y-3 max-h-40 overflow-y-auto">
							{#each consultationNotes[selectedRequestForNotes.id] as note}
								<div class="p-3 bg-gray-50 rounded border-l-4 {note.type === 'medical' ? 'border-red-400' : note.type === 'administrative' ? 'border-blue-400' : 'border-gray-400'}">
									<div class="flex justify-between items-start mb-1">
										<span class="text-xs font-medium text-gray-600 uppercase">
											{note.type} Note
										</span>
										<span class="text-xs text-gray-500">
											{formatDate(note.createdAt)}
										</span>
									</div>
									<p class="text-sm text-gray-900">{note.content}</p>
									<p class="text-xs text-gray-600 mt-1">By: {note.authorUsername}</p>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Add New Note -->
				<div class="space-y-4">
					<h4 class="font-medium text-gray-900">Add New Note</h4>
					
					<div>
						<label class="block text-sm font-medium text-gray-700 mb-2">
							Note Type
						</label>
						<select
							bind:value={noteType}
							class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
						>
							<option value="general">General</option>
							<option value="medical">Medical</option>
							<option value="administrative">Administrative</option>
						</select>
					</div>

					<div>
						<label class="block text-sm font-medium text-gray-700 mb-2">
							Note Content
						</label>
						<textarea
							bind:value={newNote}
							rows="4"
							placeholder="Enter your consultation note here..."
							class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
						></textarea>
					</div>

					<div class="flex space-x-3">
						<button
							type="button"
							on:click={addConsultationNote}
							disabled={loading || !newNote.trim()}
							class="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
						>
							{loading ? 'Adding...' : 'Add Note'}
						</button>
						<button
							type="button"
							on:click={closeNotesDialog}
							class="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
						>
							Close
						</button>
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}