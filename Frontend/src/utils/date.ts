export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
	const d = typeof date === 'string' ? new Date(date) : date;
	
	const defaultOptions: Intl.DateTimeFormatOptions = {
		year: 'numeric',
		month: 'short',
		day: 'numeric'
	};
	
	return d.toLocaleDateString('en-US', { ...defaultOptions, ...options });
}

export function formatTime(date: string | Date): string {
	const d = typeof date === 'string' ? new Date(date) : date;
	return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

export function formatDateTime(date: string | Date): string {
	const d = typeof date === 'string' ? new Date(date) : date;
	return d.toLocaleString('en-US', {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	});
}

export function formatDuration(minutes: number): string {
	const hours = Math.floor(minutes / 60);
	const mins = minutes % 60;
	
	if (hours > 0) {
		return `${hours}h ${mins}m`;
	}
	return `${mins}m`;
}

export function getRelativeTime(date: string | Date): string {
	const d = typeof date === 'string' ? new Date(date) : date;
	const now = new Date();
	const diffMs = now.getTime() - d.getTime();
	const diffMins = Math.floor(diffMs / 60000);
	const diffHours = Math.floor(diffMins / 60);
	const diffDays = Math.floor(diffHours / 24);
	
	if (diffMins < 1) return 'just now';
	if (diffMins < 60) return `${diffMins}m ago`;
	if (diffHours < 24) return `${diffHours}h ago`;
	if (diffDays < 7) return `${diffDays}d ago`;
	
	return formatDate(d);
}

export function isToday(date: string | Date): boolean {
	const d = typeof date === 'string' ? new Date(date) : date;
	const today = new Date();
	
	return d.getDate() === today.getDate() &&
		d.getMonth() === today.getMonth() &&
		d.getFullYear() === today.getFullYear();
}

export function isTomorrow(date: string | Date): boolean {
	const d = typeof date === 'string' ? new Date(date) : date;
	const tomorrow = new Date();
	tomorrow.setDate(tomorrow.getDate() + 1);
	
	return d.getDate() === tomorrow.getDate() &&
		d.getMonth() === tomorrow.getMonth() &&
		d.getFullYear() === tomorrow.getFullYear();
}

export function getTimeUntil(date: string | Date): string {
	const d = typeof date === 'string' ? new Date(date) : date;
	const now = new Date();
	const diffMs = d.getTime() - now.getTime();
	
	if (diffMs <= 0) return 'overdue';
	
	const diffMins = Math.floor(diffMs / 60000);
	const diffHours = Math.floor(diffMins / 60);
	const diffDays = Math.floor(diffHours / 24);
	
	if (diffDays > 0) return `in ${diffDays} day${diffDays === 1 ? '' : 's'}`;
	if (diffHours > 0) return `in ${diffHours} hour${diffHours === 1 ? '' : 's'}`;
	if (diffMins > 0) return `in ${diffMins} minute${diffMins === 1 ? '' : 's'}`;
	
	return 'soon';
}
