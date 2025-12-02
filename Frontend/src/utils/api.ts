import { env } from '$env/dynamic/public';

class ApiClient {
	private baseUrl: string;
	private authToken: string | null = null;

	constructor() {
		this.baseUrl = env.PUBLIC_API_URL || 'http://localhost:3001';
	}

	// Ping backend to prevent cold start
	async pingBackend() {
		try {
			const response = await fetch(`${this.baseUrl}/health`, {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json'
				}
			});
			
			if (response.ok) {
				const data = await response.json();
				console.log('Backend ping successful:', data);
				return true;
			}
		} catch (error) {
			console.warn('Backend ping failed:', error);
		}
		return false;
	}

	setAuthToken(token: string) {
		this.authToken = token;
	}

	clearAuthToken() {
		this.authToken = null;
	}

	handleVerificationError(error: any): boolean {
		if (error?.error === 'VERIFICATION_REQUIRED') {
			// Handle verification required error
			const redirectPath = error.details?.redirectTo;
			if (redirectPath) {
				window.location.href = redirectPath;
			}
			return true;
		}
		return false;
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
			
			// Handle verification errors specifically
			if (errorData.error === 'VERIFICATION_REQUIRED') {
				const error = new Error(errorData.message || 'Verification required');
				(error as any).error = errorData.error;
				(error as any).details = errorData.details;
				throw error;
			}
			
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

	async patch(endpoint: string, data?: any) {
		const response = await fetch(`${this.baseUrl}/api${endpoint}`, {
			method: 'PATCH',
			headers: this.getHeaders(),
			body: data ? JSON.stringify(data) : undefined
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

	// Q&A System Methods
	async getQuestions(params?: { 
		category?: string; 
		sortBy?: 'upvotes' | 'oldest' | 'newest'; 
		limit?: number; 
		page?: number; 
		search?: string 
	}) {
		return this.get('/questions', params);
	}

	async getQuestion(id: string) {
		return this.get(`/questions/${id}`);
	}

	async createQuestion(data: { title: string; content: string; category: string; tags?: string[] }) {
		return this.post('/questions', data);
	}

	async updateQuestion(id: string, data: { title?: string; content?: string; category?: string; tags?: string[] }) {
		return this.put(`/questions/${id}`, data);
	}

	async deleteQuestion(id: string) {
		return this.delete(`/questions/${id}`);
	}

	async voteQuestion(id: string, voteType: 'upvote' | 'downvote') {
		return this.post(`/questions/${id}/vote`, { voteType });
	}

	async getUserVoteOnQuestion(id: string) {
		return this.get(`/questions/${id}/vote`);
	}

	async getQuestionCategories() {
		return this.get('/questions/categories/list');
	}

	async getAnswers(questionId: string, params?: { sortBy?: 'upvotes' | 'oldest' | 'newest'; limit?: number }) {
		return this.get(`/answers/question/${questionId}`, params);
	}

	async createAnswer(data: { content: string; questionId: string }) {
		return this.post('/answers', data);
	}

	async updateAnswer(id: string, data: { content: string }) {
		return this.put(`/answers/${id}`, data);
	}

	async deleteAnswer(id: string) {
		return this.delete(`/answers/${id}`);
	}

	async voteAnswer(id: string, voteType: 'upvote' | 'downvote') {
		return this.post(`/answers/${id}/vote`, { voteType });
	}

	async acceptAnswer(id: string, isAccepted: boolean) {
		return this.post(`/answers/${id}/accept`, { isAccepted });
	}

	async getComments(parentType: 'question' | 'answer', parentId: string, params?: { limit?: number }) {
		return this.get(`/comments/${parentType}/${parentId}`, params);
	}

	async createComment(data: { content: string; parentId: string; parentType: 'question' | 'answer'; replyToCommentId?: string }) {
		return this.post('/comments', data);
	}

	async updateComment(id: string, data: { content: string }) {
		return this.put(`/comments/${id}`, data);
	}

	async deleteComment(id: string) {
		return this.delete(`/comments/${id}`);
	}

	async getCommentReplies(id: string, params?: { limit?: number }) {
		return this.get(`/comments/${id}/replies`, params);
	}

	async getTaggedComments(username: string, params?: { limit?: number }) {
		return this.get(`/comments/tagged/${username}`, params);
	}
}

export const api = new ApiClient();
