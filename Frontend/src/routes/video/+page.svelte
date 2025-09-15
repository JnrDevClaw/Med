<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { authStore } from '$stores/auth';
	import { toastStore } from '$stores/toast';
	import Header from '$components/Header.svelte';
	import Sidebar from '$components/Sidebar.svelte';
	import Icon from '$lib/Icon.svelte';

	interface CallState {
		isInCall: boolean;
		isVideoEnabled: boolean;
		isAudioEnabled: boolean;
		isScreenSharing: boolean;
		isFullscreen: boolean;
		callDuration: number;
		participantCount: number;
	}

	interface ChatMessage {
		id: string;
		sender: string;
		message: string;
		timestamp: Date;
	}

	let callState = $state<CallState>({
		isInCall: false,
		isVideoEnabled: true,
		isAudioEnabled: true,
		isScreenSharing: false,
		isFullscreen: false,
		callDuration: 0,
		participantCount: 1
	});

	let chatMessages = $state<ChatMessage[]>([]);
	let chatInput = $state('');
	let showChat = $state(false);
	let localVideoRef;
	let remoteVideoRef;
	let localStream: MediaStream | null = null;
	let callTimer: number;
	let roomId = $state('');
	let isJoining = $state(false);

	// Mock participant data
	let participants = $state([
		{
			id: 'user1',
			name: $authStore.user?.name || 'You',
			role: $authStore.user?.role || 'patient',
			isLocal: true,
			isVideoEnabled: true,
			isAudioEnabled: true
		},
		{
			id: 'user2',
			name: 'Dr. Sarah Wilson',
			role: 'doctor',
			isLocal: false,
			isVideoEnabled: true,
			isAudioEnabled: true
		}
	]);

	async function initializeCamera() {
		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				video: callState.isVideoEnabled,
				audio: callState.isAudioEnabled
			});
			
			localStream = stream;
			if (localVideoRef) {
				localVideoRef.srcObject = stream;
			}
			
			return true;
		} catch (error: any) {
			toastStore.error('Camera access denied', 'Please allow camera and microphone access to join the call.');
			return false;
		}
	}

	async function joinCall() {
		if (!roomId.trim()) {
			toastStore.error('Room ID required', 'Please enter a room ID to join the call.');
			return;
		}

		isJoining = true;

		try {
			const cameraInitialized = await initializeCamera();
			if (!cameraInitialized) {
				isJoining = false;
				return;
			}

			// In a real app, this would initialize Agora SDK and join the channel
			await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate connection

			callState.isInCall = true;
			callState.participantCount = 2;
			startCallTimer();

			// Simulate remote video (in real app, this would be handled by Agora)
			if (remoteVideoRef) {
				// Create a mock remote stream for demo purposes
				const canvas = document.createElement('canvas');
				canvas.width = 640;
				canvas.height = 480;
				const ctx = canvas.getContext('2d');
				
				function drawMockVideo() {
					if (!ctx) return;
					ctx.fillStyle = '#4F46E5';
					ctx.fillRect(0, 0, canvas.width, canvas.height);
					ctx.fillStyle = 'white';
					ctx.font = '24px Arial';
					ctx.textAlign = 'center';
					ctx.fillText('Dr. Sarah Wilson', canvas.width / 2, canvas.height / 2);
					ctx.fillText('(Demo Video)', canvas.width / 2, canvas.height / 2 + 30);
				}
				
				drawMockVideo();
				const mockStream = canvas.captureStream();
				remoteVideoRef.srcObject = mockStream;
			}

			toastStore.success('Connected', 'Successfully joined the video call.');
		} catch (error: any) {
			toastStore.error('Connection failed', error.message);
		} finally {
			isJoining = false;
		}
	}

	function leaveCall() {
		callState.isInCall = false;
		callState.callDuration = 0;
		
		if (localStream) {
			localStream.getTracks().forEach(track => track.stop());
			localStream = null;
		}
		
		if (localVideoRef) {
			localVideoRef.srcObject = null;
		}
		
		if (remoteVideoRef) {
			remoteVideoRef.srcObject = null;
		}
		
		if (callTimer) {
			clearInterval(callTimer);
		}
		
		toastStore.info('Call ended', 'You have left the video call.');
	}

	function toggleVideo() {
		callState.isVideoEnabled = !callState.isVideoEnabled;
		
		if (localStream) {
			const videoTrack = localStream.getVideoTracks()[0];
			if (videoTrack) {
				videoTrack.enabled = callState.isVideoEnabled;
			}
		}
	}

	function toggleAudio() {
		callState.isAudioEnabled = !callState.isAudioEnabled;
		
		if (localStream) {
			const audioTrack = localStream.getAudioTracks()[0];
			if (audioTrack) {
				audioTrack.enabled = callState.isAudioEnabled;
			}
		}
	}

	function toggleScreenShare() {
		callState.isScreenSharing = !callState.isScreenSharing;
		
		if (callState.isScreenSharing) {
			// In real app, would start screen sharing via Agora
			toastStore.info('Screen sharing started', 'Your screen is now being shared.');
		} else {
			toastStore.info('Screen sharing stopped', 'Screen sharing has been stopped.');
		}
	}

	function toggleFullscreen() {
		callState.isFullscreen = !callState.isFullscreen;
		
		if (callState.isFullscreen) {
			document.documentElement.requestFullscreen?.();
		} else {
			document.exitFullscreen?.();
		}
	}

	function sendChatMessage() {
		if (!chatInput.trim()) return;
		
		const message: ChatMessage = {
			id: Date.now().toString(),
			sender: $authStore.user?.name || 'You',
			message: chatInput.trim(),
			timestamp: new Date()
		};
		
		chatMessages = [...chatMessages, message];
		chatInput = '';
		
		// Simulate received message after a delay
		setTimeout(() => {
			const response: ChatMessage = {
				id: (Date.now() + 1).toString(),
				sender: 'Dr. Sarah Wilson',
				message: 'Thanks for your message. I can see and hear you clearly.',
				timestamp: new Date()
			};
			chatMessages = [...chatMessages, response];
		}, 2000);
	}

	function startCallTimer() {
		callTimer = setInterval(() => {
			callState.callDuration++;
		}, 1000);
	}

	function formatDuration(seconds: number): string {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
	}

	function generateRoomId(): string {
		return Math.random().toString(36).substr(2, 8).toUpperCase();
	}

	onMount(() => {
		if (!$authStore.isAuthenticated) {
			goto('/auth/login');
			return;
		}

		// Generate a random room ID for demo
		roomId = generateRoomId();
	});

	onDestroy(() => {
		if (callTimer) {
			clearInterval(callTimer);
		}
		
		if (localStream) {
			localStream.getTracks().forEach(track => track.stop());
		}
	});
</script>

<svelte:head>
	<title>Video Consultation - MedPlatform</title>
	<meta name="description" content="Join video consultations with healthcare providers" />
</svelte:head>

<div class="min-h-screen bg-gray-900">
	{#if !callState.isInCall}
		<Header />
		<div class="flex">
			<Sidebar />
			
			<main class="flex-1 p-6 lg:p-8">
				<div class="max-w-2xl mx-auto">
					<!-- Pre-call Setup -->
					<div class="card p-8">
						<div class="text-center mb-8">
							<div class="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
								<Icon name="video" class="w-8 h-8 text-primary-600" />
							</div>
							<h1 class="text-2xl font-bold text-gray-900 mb-2">Video Consultation</h1>
							<p class="text-gray-600">
								Connect with healthcare providers through secure video calls
							</p>
						</div>

						<!-- Camera Preview -->
						<div class="mb-6">
							<h3 class="text-lg font-medium text-gray-900 mb-4">Camera Preview</h3>
							<div class="relative bg-gray-900 rounded-lg overflow-hidden aspect-video">
								<video
									bind:this={localVideoRef}
									autoplay
									muted
									playsInline
									class="w-full h-full object-cover"
								></video>
								<div class="absolute bottom-4 left-4 right-4 flex justify-center space-x-4">
									<button
										type="button"
										class="p-3 rounded-full {callState.isVideoEnabled ? 'bg-white/20 text-white' : 'bg-error-600 text-white'}"
										onclick={toggleVideo}
									>
										{#if callState.isVideoEnabled}
											<Icon name="video" class="w-5 h-5" />
										{:else}
											<Icon name="video-off" class="w-5 h-5" />
										{/if}
									</button>
									<button
										type="button"
										class="p-3 rounded-full {callState.isAudioEnabled ? 'bg-white/20 text-white' : 'bg-error-600 text-white'}"
										onclick={toggleAudio}
									>
										{#if callState.isAudioEnabled}
											<Icon name="mic" class="w-5 h-5" />
										{:else}
											<Icon name="mic-off" class="w-5 h-5" />
										{/if}
									</button>
								</div>
							</div>
						</div>

						<!-- Room Settings -->
						<div class="space-y-4 mb-6">
							<div>
								<label for="roomId" class="label">Room ID</label>
								<div class="flex space-x-2">
									<input
										id="roomId"
										type="text"
										bind:value={roomId}
										placeholder="Enter room ID or generate new"
										class="input flex-1"
									/>
									<button
										type="button"
										class="btn-outline px-4"
										onclick={() => roomId = generateRoomId()}
									>
										Generate
									</button>
								</div>
								<p class="text-sm text-gray-600 mt-1">
									Share this room ID with the person you want to call
								</p>
							</div>
						</div>

						<!-- Join Call Button -->
						<button
							type="button"
							class="btn-primary w-full py-3"
							onclick={joinCall}
							disabled={isJoining || !roomId.trim()}
						>
							{#if isJoining}
								<div class="spinner w-5 h-5 mr-2"></div>
								Connecting...
							{:else}
								<Icon name="video" class="w-5 h-5 mr-2" />
								Join Call
							{/if}
						</button>

						<!-- Quick Actions -->
						<div class="mt-6 p-4 bg-gray-50 rounded-lg">
							<h4 class="font-medium text-gray-900 mb-3">Quick Actions</h4>
							<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
								<button
									type="button"
									class="btn-outline text-left p-3"
									onclick={() => goto('/doctors')}
								>
									<div class="flex items-center space-x-3">
										<Icon name="users" class="w-5 h-5 text-gray-600" />
										<div>
											<p class="font-medium">Find Doctors</p>
											<p class="text-sm text-gray-600">Browse available providers</p>
										</div>
									</div>
								</button>
								<button
									type="button"
									class="btn-outline text-left p-3"
									onclick={() => goto('/appointments')}
								>
									<div class="flex items-center space-x-3">
										<Icon name="video" class="w-5 h-5 text-gray-600" />
										<div>
											<p class="font-medium">Schedule Call</p>
											<p class="text-sm text-gray-600">Book appointment</p>
										</div>
									</div>
								</button>
							</div>
						</div>
					</div>
				</div>
			</main>
		</div>
	{:else}
		<!-- In-Call Interface -->
		<div class="h-screen flex flex-col bg-gray-900">
			<!-- Call Header -->
			<div class="bg-gray-800 text-white p-4 flex items-center justify-between">
				<div class="flex items-center space-x-4">
					<div class="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center">
							<Icon name="video" class="w-4 h-4" />
					</div>
					<div>
						<h2 class="font-medium">Video Consultation</h2>
						<p class="text-sm text-gray-300">
							{formatDuration(callState.callDuration)} • {callState.participantCount} participants
						</p>
					</div>
				</div>
				
				<div class="flex items-center space-x-2">
					<button
						type="button"
						class="p-2 hover:bg-gray-700 rounded"
						onclick={() => showChat = !showChat}
					>
							<Icon name="message-square" class="w-5 h-5" />
					</button>
					<button
						type="button"
						class="p-2 hover:bg-gray-700 rounded"
						onclick={toggleFullscreen}
					>
						{#if callState.isFullscreen}
								<Icon name="minimize-2" class="w-5 h-5" />
						{:else}
								<Icon name="maximize-2" class="w-5 h-5" />
						{/if}
					</button>
				</div>
			</div>

			<!-- Video Grid -->
			<div class="flex-1 flex {showChat ? 'pr-80' : ''}">
				<div class="flex-1 relative">
					<!-- Remote Video (Main) -->
					<video
						bind:this={remoteVideoRef}
						autoplay
						playsInline
						class="w-full h-full object-cover bg-gray-800"
					>
						<track kind="captions" srclang="en" label="English captions" />
					</video>
					
					<!-- Local Video (Picture-in-Picture) -->
					<div class="absolute top-4 right-4 w-48 h-36 bg-gray-800 rounded-lg overflow-hidden border-2 border-white/20">
						<video
							bind:this={localVideoRef}
							autoplay
							muted
							playsInline
							class="w-full h-full object-cover"
						>
							<track kind="captions" srclang="en" label="Local captions" />
						</video>
						<div class="absolute bottom-2 right-2 text-white text-xs bg-black/50 px-2 py-1 rounded">
							You
						</div>
					</div>

					<!-- Participant Info Overlay -->
					<div class="absolute bottom-4 left-4">
						<div class="bg-black/50 text-white px-3 py-2 rounded-lg">
							<p class="font-medium">Dr. Sarah Wilson</p>
							<p class="text-sm text-gray-300">Cardiologist</p>
						</div>
					</div>
				</div>

				<!-- Chat Sidebar -->
				{#if showChat}
					<div class="w-80 bg-white border-l border-gray-200 flex flex-col">
						<div class="p-4 border-b border-gray-200">
							<h3 class="font-medium text-gray-900">Chat</h3>
						</div>
						
						<!-- Chat Messages -->
						<div class="flex-1 overflow-y-auto p-4 space-y-3">
							{#each chatMessages as message}
								<div class="flex flex-col">
									<div class="flex items-center space-x-2 mb-1">
										<span class="text-sm font-medium text-gray-900">{message.sender}</span>
										<span class="text-xs text-gray-500">
											{message.timestamp.toLocaleTimeString()}
										</span>
									</div>
									<div class="bg-gray-100 rounded-lg p-2 text-sm">
										{message.message}
									</div>
								</div>
							{/each}
						</div>
						
						<!-- Chat Input -->
						<div class="p-4 border-t border-gray-200">
							<div class="flex space-x-2">
								<input
									bind:value={chatInput}
									placeholder="Type a message..."
									class="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
									onkeydown={(e) => e.key === 'Enter' && sendChatMessage()}
								/>
								<button
									type="button"
									class="btn-primary px-3 py-2"
									onclick={sendChatMessage}
									disabled={!chatInput.trim()}
								>
									Send
								</button>
							</div>
						</div>
					</div>
				{/if}
			</div>

			<!-- Call Controls -->
			<div class="bg-gray-800 p-6">
				<div class="flex justify-center items-center space-x-4">
					<button
						type="button"
						class="p-4 rounded-full {callState.isVideoEnabled ? 'bg-gray-700 text-white hover:bg-gray-600' : 'bg-error-600 text-white hover:bg-error-700'}"
						onclick={toggleVideo}
					>
						{#if callState.isVideoEnabled}
								<Icon name="video" class="w-6 h-6" />
						{:else}
								<Icon name="video-off" class="w-6 h-6" />
						{/if}
					</button>

					<button
						type="button"
						class="p-4 rounded-full {callState.isAudioEnabled ? 'bg-gray-700 text-white hover:bg-gray-600' : 'bg-error-600 text-white hover:bg-error-700'}"
						onclick={toggleAudio}
					>
						{#if callState.isAudioEnabled}
								<Icon name="mic" class="w-6 h-6" />
						{:else}
								<Icon name="mic-off" class="w-6 h-6" />
						{/if}
					</button>

					<button
						type="button"
						class="p-4 rounded-full {callState.isScreenSharing ? 'bg-primary-600 text-white hover:bg-primary-700' : 'bg-gray-700 text-white hover:bg-gray-600'}"
						onclick={toggleScreenShare}
					>
						{#if callState.isScreenSharing}
								<Icon name="monitor-off" class="w-6 h-6" />
						{:else}
								<Icon name="monitor" class="w-6 h-6" />
						{/if}
					</button>

					<button
						type="button"
						class="p-4 rounded-full bg-error-600 text-white hover:bg-error-700"
						onclick={leaveCall}
					>
						<PhoneOff class="w-6 h-6" />
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>
