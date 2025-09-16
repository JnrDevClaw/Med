<script>
	import { fade, fly } from 'svelte/transition';
	import { toastStore } from '../stores/toast';
	import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-svelte';

	let toast = $toastStore;

	function getIcon(type) {
		switch (type) {
			case 'success': return CheckCircle;
			case 'error': return XCircle;
			case 'warning': return AlertTriangle;
			case 'info': return Info;
			default: return Info;
		}
	}

	function getColors(type) {
		switch (type) {
			case 'success': return 'bg-med-success-50 border-med-success-200 text-med-success-800';
			case 'error': return 'bg-med-error-50 border-med-error-200 text-med-error-800';
			case 'warning': return 'bg-med-warning-50 border-med-warning-200 text-med-warning-800';
			case 'info': return 'bg-med-primary-50 border-med-primary-200 text-med-primary-800';
			default: return 'bg-med-primary-50 border-med-primary-200 text-med-primary-800';
		}
	}

	function getIconColors(type) {
		switch (type) {
			case 'success': return 'text-med-success-600';
			case 'error': return 'text-med-error-600';
			case 'warning': return 'text-med-warning-600';
			case 'info': return 'text-med-primary-600';
			default: return 'text-med-primary-600';
		}
	}

	// compute component to render for the icon; placed here to avoid using {@const} inside markup
	let IconComponent = Info;
	$: IconComponent = toast ? getIcon(toast.type) : Info;
</script>

{#if toast}
	<div
		class="fixed top-4 right-4 z-50 max-w-sm w-full"
		in:fly={{ x: 220, duration: 260 }}
		out:fade={{ duration: 180 }}
	>
		<div class="med-card-elevated p-3 {getColors(toast.type)} shadow-glass animate-slide-in-left">
			<div class="flex items-start space-x-3">
				<div class="flex-shrink-0 mt-0.5">
					<svelte:component this={IconComponent} class="w-5 h-5 {getIconColors(toast.type)}" />
				</div>

				<div class="flex-1 min-w-0">
					<h3 class="text-sm font-semibold leading-5">
						{toast.title}
					</h3>

					{#if toast.message}
						<p class="mt-1 text-sm opacity-90 truncate">
							{toast.message}
						</p>
					{/if}

					{#if toast.actions && toast.actions.length > 0}
						<div class="mt-2 flex space-x-2">
							{#each toast.actions as action}
								<button
									type="button"
									class="text-xs font-medium underline hover:no-underline"
									onclick={action.action}
								>
									{action.label}
								</button>
							{/each}
						</div>
					{/if}
				</div>

				<div class="flex-shrink-0">
					<button
						type="button"
						class="inline-flex rounded-md p-1.5 med-btn-icon"
						onclick={() => toastStore.hide()}
						aria-label="Close"
					>
						<X class="w-4 h-4 text-med-gray-600" />
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
