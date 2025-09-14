<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { authStore } from '$stores/auth';
	import { toastStore } from '$stores/toast';
	import Header from '$components/Header.svelte';
	import Sidebar from '$components/Sidebar.svelte';
	import Icon from '$lib/Icon.svelte';

	interface Message {
		id: string;
		content: string;
		sender: 'user' | 'ai';
		timestamp: Date;
		type?: 'text' | 'suggestions' | 'diagnosis' | 'emergency';
		suggestions?: string[];
		confidence?: number;
	}

	let messages = $state<Message[]>([]);
	let currentMessage = $state('');
	let isLoading = $state(false);
	let isListening = $state(false);
	let messagesContainer: HTMLElement;
	let chatInput: HTMLInputElement;

	// Mock AI responses - in real app, this would call the backend API
	const aiResponses = {
		greeting: "Hello! I'm your AI health assistant. I can help answer general health questions, provide wellness tips, and guide you on when to seek professional medical care. Please remember that I'm not a replacement for professional medical advice. How can I help you today?",
		symptoms: "I understand you're experiencing some symptoms. To better assist you, could you please describe:\n\n1. What specific symptoms are you having?\n2. When did they start?\n3. How severe are they (1-10 scale)?\n4. Any factors that make them better or worse?\n\nThis will help me provide more targeted guidance.",
		emergency: "⚠️ **Important**: Based on what you've described, these could be serious symptoms that require immediate medical attention. Please consider:\n\n- Calling emergency services (911) if symptoms are severe\n- Visiting the nearest emergency room\n- Contacting your doctor immediately\n\nWould you like me to help you find nearby emergency services?",
		general: "Thank you for sharing that information. Based on what you've told me, here are some general recommendations:\n\n• Monitor your symptoms closely\n• Stay hydrated and get adequate rest\n• Consider over-the-counter remedies if appropriate\n\nHowever, if symptoms persist or worsen, I recommend consulting with a healthcare professional. Would you like me to help you find doctors in your area?"
	};

	function generateMessageId(): string {
		return Date.now().toString() + Math.random().toString(36).substr(2, 9);
	}

	function addMessage(content: string, sender: 'user' | 'ai', type: 'text' | 'suggestions' | 'diagnosis' | 'emergency' = 'text', extras?: any) {
		const message: Message = {
			id: generateMessageId(),
			content,
			sender,
			timestamp: new Date(),
			type,
			...extras
		};

		messages = [...messages, message];
		scrollToBottom();
	}

	async function scrollToBottom() {
		await tick();
		if (messagesContainer) {
			messagesContainer.scrollTop = messagesContainer.scrollHeight;
		}
	}

	async function sendMessage() {
		if (!currentMessage.trim() || isLoading) return;

		const userMessage = currentMessage.trim();
		currentMessage = '';
		
		// Add user message
		addMessage(userMessage, 'user');
		
		isLoading = true;

		try {
			// Simulate AI processing time
			await new Promise(resolve => setTimeout(resolve, 1500));

			// Simple AI response logic (in real app, this would call your backend)
			let response = '';
			let messageType: 'text' | 'suggestions' | 'diagnosis' | 'emergency' = 'text';
			let suggestions: string[] = [];
			let confidence = 0;

			const lowerMessage = userMessage.toLowerCase();

			if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage.includes('help')) {
				response = aiResponses.greeting;
				suggestions = [
					"I have symptoms to discuss",
					"I need wellness tips",
					"I want to find a doctor",
					"Emergency guidance"
				];
				messageType = 'suggestions';
			} else if (lowerMessage.includes('chest pain') || lowerMessage.includes('heart attack') || 
					   lowerMessage.includes('difficulty breathing') || lowerMessage.includes('severe pain')) {
				response = aiResponses.emergency;
				messageType = 'emergency';
			} else if (lowerMessage.includes('symptom') || lowerMessage.includes('pain') || 
					   lowerMessage.includes('fever') || lowerMessage.includes('headache')) {
				if (messages.filter(m => m.sender === 'user').length === 1) {
					response = aiResponses.symptoms;
					messageType = 'suggestions';
					suggestions = [
						"I have a headache",
						"I have stomach pain",
						"I have a fever",
						"I'm feeling tired"
					];
				} else {
					response = aiResponses.general;
					messageType = 'diagnosis';
					confidence = 0.75;
					suggestions = [
						"Find nearby doctors",
						"Schedule an appointment",
						"Get more health tips",
						"Start a new conversation"
					];
				}
			} else {
				response = "I understand you're asking about health-related concerns. Could you please provide more specific details about your symptoms or health questions? This will help me give you more accurate and helpful guidance.\n\nRemember, I can provide general health information, but for specific medical concerns, it's always best to consult with a qualified healthcare professional.";
				suggestions = [
					"Tell me about symptoms",
					"I need wellness advice",
					"Find a doctor",
					"Health emergency guidance"
				];
				messageType = 'suggestions';
			}

			// Add AI response
			addMessage(response, 'ai', messageType, { suggestions, confidence });

		} catch (error: any) {
			toastStore.error('Failed to get AI response', error.message);
		} finally {
			isLoading = false;
		}
	}

	function handleSuggestion(suggestion: string) {
		currentMessage = suggestion;
		sendMessage();
	}

	function clearChat() {
		messages = [];
		addMessage(aiResponses.greeting, 'ai', 'suggestions', {
			suggestions: [
				"I have symptoms to discuss",
				"I need wellness tips",
				"I want to find a doctor",
				"Emergency guidance"
			]
		});
	}

	function toggleVoiceInput() {
		if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
			toastStore.error('Voice input not supported', 'Your browser does not support voice recognition.');
			return;
		}

		if (isListening) {
			isListening = false;
			return;
		}

		const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
		const recognition = new SpeechRecognition();

		recognition.continuous = false;
		recognition.interimResults = false;
		recognition.lang = 'en-US';

		recognition.onstart = () => {
			isListening = true;
		};

		recognition.onresult = (event) => {
			const transcript = event.results[0][0].transcript;
			currentMessage = transcript;
			isListening = false;
		};

		recognition.onerror = (event) => {
			isListening = false;
			toastStore.error('Voice recognition error', 'Please try again.');
		};

		recognition.onend = () => {
			isListening = false;
		};

		recognition.start();
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			sendMessage();
		}
	}

	function getMessageIcon(sender: 'user' | 'ai', type?: string) {
		if (sender === 'user') return User;
		if (type === 'emergency') return AlertCircle;
		if (type === 'diagnosis') return CheckCircle;
		return Bot;
	}

	function getMessageColors(sender: 'user' | 'ai', type?: string) {
		if (sender === 'user') return 'bg-primary-600 text-white';
		if (type === 'emergency') return 'bg-error-100 text-error-800 border border-error-200';
		if (type === 'diagnosis') return 'bg-success-100 text-success-800 border border-success-200';
		return 'bg-gray-100 text-gray-800';
	}

	onMount(() => {
		if (!$authStore.isAuthenticated) {
			goto('/auth/login');
			return;
		}

		// Initialize chat with greeting
		clearChat();
	});
</script>

<svelte:head>
	<title>AI Health Assistant - MedPlatform</title>
	<meta name="description" content="Chat with AI for health guidance and medical information" />
</svelte:head>

<div class="min-h-screen bg-gray-50">
	<Header />
	
	<div class="flex">
		<Sidebar />
		
		<main class="flex-1 flex flex-col h-screen">
			<!-- Chat Header -->
			<div class="bg-white border-b border-gray-200 p-4 lg:p-6">
				<div class="flex items-center justify-between">
					<div class="flex items-center space-x-4">
						<div class="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
							<Icon name="bot" class="w-6 h-6 text-primary-600" />
						</div>
						<div>
							<h1 class="text-xl font-semibold text-gray-900">AI Health Assistant</h1>
							<p class="text-sm text-gray-600">Get instant health guidance and advice</p>
						</div>
					</div>
					<button
						type="button"
						class="btn-outline"
						onclick={clearChat}
						title="Clear chat"
					>
						<Icon name="refresh-cw" class="w-4 h-4 mr-2" />
						Clear
					</button>
				</div>
			</div>

			<!-- Messages Container -->
			<div 
				bind:this={messagesContainer}
				class="flex-1 overflow-y-auto p-4 lg:p-6 space-y-4"
			>
				{#each messages as message (message.id)}
					<div class="flex items-start space-x-3 {message.sender === 'user' ? 'justify-end' : ''}">
						{#if message.sender === 'ai'}
							<div class="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
								<svelte:component this={getMessageIcon(message.sender, message.type)} class="w-4 h-4 text-primary-600" />
							</div>
						{/if}
						
						<div class="max-w-2xl {message.sender === 'user' ? 'order-first' : ''}">
							<div class="rounded-lg p-4 {getMessageColors(message.sender, message.type)}">
								<div class="whitespace-pre-wrap text-sm">{message.content}</div>
								
								{#if message.confidence}
									<div class="mt-2 text-xs opacity-75">
										Confidence: {Math.round(message.confidence * 100)}%
									</div>
								{/if}
							</div>
							
							{#if message.suggestions && message.suggestions.length > 0}
								<div class="mt-3 space-y-2">
									{#each message.suggestions as suggestion}
										<button
											type="button"
											class="block w-full text-left text-sm p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
											onclick={() => handleSuggestion(suggestion)}
										>
											{suggestion}
										</button>
									{/each}
								</div>
							{/if}
							
							<div class="mt-2 text-xs text-gray-500">
								{message.timestamp.toLocaleTimeString()}
							</div>
						</div>
						
						{#if message.sender === 'user'}
							<div class="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center flex-shrink-0">
								<Icon name="user" class="w-4 h-4 text-white" />
							</div>
						{/if}
					</div>
				{/each}
				
				{#if isLoading}
					<div class="flex items-start space-x-3">
						<div class="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
							<Icon name="bot" class="w-4 h-4 text-primary-600" />
						</div>
						<div class="bg-gray-100 rounded-lg p-4">
							<div class="flex items-center space-x-2">
								<div class="spinner w-4 h-4"></div>
								<span class="text-sm text-gray-600">AI is thinking...</span>
							</div>
						</div>
					</div>
				{/if}
			</div>

			<!-- Chat Input -->
			<div class="bg-white border-t border-gray-200 p-4 lg:p-6">
				<div class="max-w-4xl mx-auto">
					<!-- Disclaimer -->
					<div class="mb-4 p-3 bg-warning-50 border border-warning-200 rounded-lg">
						<div class="flex items-start">
							<Icon name="alert-circle" class="w-5 h-5 text-warning-600 flex-shrink-0 mt-0.5" />
							<div class="ml-3">
								<p class="text-sm text-warning-800">
									<strong>Medical Disclaimer:</strong> This AI assistant provides general health information only. 
									It is not a substitute for professional medical advice, diagnosis, or treatment. 
									Always consult qualified healthcare providers for medical concerns.
								</p>
							</div>
						</div>
					</div>

					<!-- Input Area -->
					<div class="flex space-x-3">
						<div class="flex-1">
							<div class="relative">
								<input
									bind:this={chatInput}
									bind:value={currentMessage}
									onkeydown={handleKeyDown}
									placeholder="Type your health question or concern..."
									class="input pr-12"
									disabled={isLoading}
								/>
								<button
									type="button"
									class="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-100 rounded transition-colors"
									onclick={toggleVoiceInput}
									disabled={isLoading}
									title={isListening ? 'Stop listening' : 'Voice input'}
								>
									{#if isListening}
										<Icon name="mic-off" class="w-5 h-5 text-error-600" />
									{:else}
										<Icon name="mic" class="w-5 h-5 text-gray-400" />
									{/if}
								</button>
							</div>
						</div>
						<button
							type="button"
							class="btn-primary px-4"
							onclick={sendMessage}
							disabled={isLoading || !currentMessage.trim()}
						>
							{#if isLoading}
								<div class="spinner w-4 h-4"></div>
							{:else}
								<Icon name="send" class="w-4 h-4" />
							{/if}
						</button>
					</div>

					<!-- Quick Actions -->
					<div class="mt-4 flex flex-wrap gap-2">
						<button
							type="button"
							class="btn-outline-sm"
							onclick={() => handleSuggestion("I'm feeling unwell and need guidance")}
							disabled={isLoading}
						>
							I'm feeling unwell
						</button>
						<button
							type="button"
							class="btn-outline-sm"
							onclick={() => handleSuggestion("I need wellness and prevention tips")}
							disabled={isLoading}
						>
							Wellness tips
						</button>
						<button
							type="button"
							class="btn-outline-sm"
							onclick={() => handleSuggestion("How do I know when to see a doctor?")}
							disabled={isLoading}
						>
							When to see a doctor
						</button>
						<button
							type="button"
							class="btn-outline-sm"
							onclick={() => goto('/doctors')}
						>
							Find a doctor
						</button>
					</div>
				</div>
			</div>
		</main>
	</div>
</div>

<style>
	.btn-outline-sm {
		@apply px-3 py-1.5 text-sm border border-gray-300 text-gray-700 bg-white rounded-md hover:bg-gray-50 transition-colors;
	}
</style>
