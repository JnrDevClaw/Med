import { writable } from 'svelte/store';
import type { ToastMessage } from '$types';

function createToastStore() {
	const { subscribe, set, update } = writable<ToastMessage | null>(null);

	let timeoutId: number | null = null;

	return {
		subscribe,
		
		show(toast: Omit<ToastMessage, 'id'>) {
			// Clear existing timeout
			if (timeoutId) {
				clearTimeout(timeoutId);
			}

			const id = Math.random().toString(36).substr(2, 9);
			const duration = toast.duration || 5000;

			const fullToast: ToastMessage = {
				id,
				...toast
			};

			set(fullToast);

			// Auto-hide after duration
			timeoutId = setTimeout(() => {
				this.hide();
			}, duration) as any;
		},

		success(title: string, message?: string, duration?: number) {
			this.show({ type: 'success', title, message, duration });
		},

		error(title: string, message?: string, duration?: number) {
			this.show({ type: 'error', title, message, duration: duration || 8000 });
		},

		warning(title: string, message?: string, duration?: number) {
			this.show({ type: 'warning', title, message, duration });
		},

		info(title: string, message?: string, duration?: number) {
			this.show({ type: 'info', title, message, duration });
		},

		hide() {
			if (timeoutId) {
				clearTimeout(timeoutId);
				timeoutId = null;
			}
			set(null);
		}
	};
}

export const toastStore = createToastStore();
