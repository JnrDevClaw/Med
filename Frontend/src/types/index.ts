export interface User {
	id: string;
	did: string;
	name: string;
	email?: string;
	role: 'patient' | 'doctor';
	verified: boolean;
	createdAt: string;
	profileData?: any;
	ceramicProfile?: {
		streamId?: string;
		lastUpdated?: string;
	};
}

export interface AuthState {
	isAuthenticated: boolean;
	user: User | null;
	accessToken: string | null;
	refreshToken: string | null;
}

export interface LoginRequest {
	did: string;
	signature: string;
	challenge: string;
}

export interface SignupRequest {
	did: string;
	profile: {
		name: string;
		role: 'patient' | 'doctor';
		email?: string;
	};
}

export interface DoctorCredential {
	id: string;
	credentialType: string;
	issuingAuthority: string;
	credentialNumber?: string;
	issuedDate?: string;
	expiryDate?: string;
	status: 'pending' | 'verified' | 'rejected';
	ipfsHash: string;
	ceramicVcId?: string;
	verifiedAt?: string;
	verificationNotes?: string;
}

export interface Consultation {
	id: string;
	type: 'ai' | 'video' | 'text';
	status: 'scheduled' | 'active' | 'completed' | 'cancelled';
	scheduledAt?: string;
	startedAt?: string;
	endedAt?: string;
	duration?: number;
	patientName?: string;
	doctorName?: string;
	notes?: string;
	metadata?: any;
}

export interface AIConsultation {
	id: string;
	date: string;
	model: string;
	message: string;
	response: string;
	confidence: number;
	escalated: boolean;
}

export interface VideoCall {
	consultationId: string;
	channelName: string;
	token: string;
	uid: number;
	appId: string;
	role: string;
	consultation: {
		id: string;
		patientName: string;
		doctorName: string;
		scheduledTime: string;
		status: string;
	};
}

export interface HealthReminder {
	id: string;
	title: string;
	description?: string;
	type: 'medication' | 'appointment' | 'exercise' | 'diet' | 'custom';
	reminderTime: string;
	recurrencePattern?: string;
	isActive: boolean;
	isSent: boolean;
	sentAt?: string;
}

export interface Doctor {
	id: string;
	name: string;
	specializations?: string[];
	experience?: number;
	languages?: string[];
	bio?: string;
	verified: boolean;
	credentialCount: number;
	availability?: any;
}

export interface ToastMessage {
	id: string;
	type: 'success' | 'error' | 'warning' | 'info';
	title: string;
	message?: string;
	duration?: number;
	actions?: Array<{
		label: string;
		action: () => void;
	}>;
}
