<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import { toastStore } from '$stores/toast';
	import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-svelte';

	let toast = $toastStore;

	function getIcon(type: string) {
		switch (type) {
			case 'success': return CheckCircle;
			case 'error': return XCircle;
			case 'warning': return AlertTriangle;
			case 'info': return Info;
			default: return Info;
		}
	}

	function getColors(type: string) {
		switch (type) {
			case 'success': return 'bg-success-50 border-success-200 text-success-800';
			case 'error': return 'bg-error-50 border-error-200 text-error-800';
			case 'warning': return 'bg-warning-50 border-warning-200 text-warning-800';
			case 'info': return 'bg-primary-50 border-primary-200 text-primary-800';
			default: return 'bg-primary-50 border-primary-200 text-primary-800';
		}
	}

	function getIconColors(type: string) {
		switch (type) {
			case 'success': return 'text-success-600';
			case 'error': return 'text-error-600';
			case 'warning': return 'text-warning-600';
			case 'info': return 'text-primary-600';
			default: return 'text-primary-600';
		}
	}
</script>

{#if toast}
	<div
		class="fixed top-4 right-4 z-50 max-w-sm w-full"
		in:fly={{ x: 300, duration: 300 }}
		out:fade={{ duration: 200 }}
	>
		<div class="border rounded-lg shadow-lg p-4 {getColors(toast.type)}">
			<div class="flex items-start">
				<div class="flex-shrink-0">
					{@const IconComponent = getIcon(toast.type)}
					<IconComponent class="w-5 h-5 {getIconColors(toast.type)}" />
				</div>
				
				<div class="ml-3 flex-1">
					<h3 class="text-sm font-medium">
						{toast.title}
					</h3>
					
					{#if toast.message}
						<p class="mt-1 text-sm opacity-90">
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
				
				<div class="ml-4 flex-shrink-0">
					<button
						type="button"
						class="inline-flex rounded-md p-1.5 hover:bg-black hover:bg-opacity-10 transition-colors"
						onclick={() => toastStore.hide()}
					>
						<X class="w-4 h-4" />
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
