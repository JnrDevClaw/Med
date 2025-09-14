import { env } from '$env/dynamic/public';

class ApiClient {
	private baseUrl: string;
	private authToken: string | null = null;

	constructor() {
		this.baseUrl = env.PUBLIC_API_URL || 'http://localhost:3001';
	}

	setAuthToken(token: string) {
		this.authToken = token;
	}

	clearAuthToken() {
		this.authToken = null;
	}

	private getHeaders(): Record<string, string> {
		const headers: Record<string, string> = {
			'Content-Type': 'application/json'
		};

		if (this.authToken) {
			headers.Authorization = `Bearer ${this.authToken}`;
		}

		return headers;
	}

	private async handleResponse(response: Response) {
		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			throw new Error(errorData.message || `HTTP ${response.status}`);
		}

		const contentType = response.headers.get('content-type');
		if (contentType && contentType.includes('application/json')) {
			return response.json();
		}
		
		return response.text();
	}

	async get(endpoint: string, params?: Record<string, any>) {
		const url = new URL(`${this.baseUrl}/api${endpoint}`);
		
		if (params) {
			Object.entries(params).forEach(([key, value]) => {
				if (value !== undefined && value !== null) {
					url.searchParams.append(key, String(value));
				}
			});
		}

		const response = await fetch(url.toString(), {
			method: 'GET',
			headers: this.getHeaders()
		});

		return this.handleResponse(response);
	}

	async post(endpoint: string, data?: any) {
		const response = await fetch(`${this.baseUrl}/api${endpoint}`, {
			method: 'POST',
			headers: this.getHeaders(),
			body: data ? JSON.stringify(data) : undefined
		});

		return this.handleResponse(response);
	}

	async put(endpoint: string, data?: any) {
		const response = await fetch(`${this.baseUrl}/api${endpoint}`, {
			method: 'PUT',
			headers: this.getHeaders(),
			body: data ? JSON.stringify(data) : undefined
		});

		return this.handleResponse(response);
	}

	async delete(endpoint: string) {
		const response = await fetch(`${this.baseUrl}/api${endpoint}`, {
			method: 'DELETE',
			headers: this.getHeaders()
		});

		return this.handleResponse(response);
	}

	async upload(endpoint: string, formData: FormData) {
		const headers: Record<string, string> = {};
		
		if (this.authToken) {
			headers.Authorization = `Bearer ${this.authToken}`;
		}

		const response = await fetch(`${this.baseUrl}/api${endpoint}`, {
			method: 'POST',
			headers,
			body: formData
		});

		return this.handleResponse(response);
	}

	// Specialized methods for common operations
	
	async getProfile() {
		return this.get('/users/profile');
	}

	async updateProfile(data: any) {
		return this.put('/users/profile', data);
	}

	async getDoctors(params?: { limit?: number; offset?: number; specialization?: string; search?: string }) {
		return this.get('/users/doctors', params);
	}

	async getDoctor(id: string) {
		return this.get(`/users/doctors/${id}`);
	}

	async getConsultations(params?: { limit?: number; offset?: number; type?: string; status?: string }) {
		return this.get('/consultations', params);
	}

	async getConsultation(id: string) {
		return this.get(`/consultations/${id}`);
	}

	async createVideoCall(data: { doctorId: string; scheduledTime?: string; duration?: number }) {
		return this.post('/video/create', data);
	}

	async joinVideoCall(consultationId: string) {
		return this.post('/video/join', { consultationId });
	}

	async endVideoCall(consultationId: string) {
		return this.post(`/video/end/${consultationId}`);
	}

	async sendAIMessage(data: { message: string; model: string; symptoms?: string[]; previousMessages?: any[] }) {
		return this.post('/ai/chat', data);
	}

	async getAIHistory(params?: { limit?: number; offset?: number }) {
		return this.get('/ai/history', params);
	}

	async getCredentials() {
		return this.get('/credentials/my-credentials');
	}

	async uploadCredential(formData: FormData) {
		return this.upload('/credentials/upload', formData);
	}

	async getReminders(params?: { limit?: number; offset?: number; type?: string; active?: boolean }) {
		return this.get('/consultations/reminders', params);
	}

	async createReminder(data: any) {
		return this.post('/consultations/reminders', data);
	}

	async updateReminder(id: string, data: any) {
		return this.put(`/consultations/reminders/${id}`, data);
	}

	async deleteReminder(id: string) {
		return this.delete(`/consultations/reminders/${id}`);
	}
}

export const api = new ApiClient();
