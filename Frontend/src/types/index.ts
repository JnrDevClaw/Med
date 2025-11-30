export interface User {
	id: string;
	username: string;
	email?: string;
	role: 'patient' | 'doctor';
	verified: boolean;
	createdAt?: string;
	updatedAt?: string;
	profileData?: any;
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

// Q&A System Types
export interface Question {
	id: string;
	title: string;
	content: string;
	category: string;
	authorUsername: string;
	authorRole: 'doctor' | 'patient';
	upvotes: number;
	downvotes: number;
	answerCount: number;
	tags: string[];
	createdAt: string;
	updatedAt: string;
}

export interface Answer {
	id: string;
	content: string;
	questionId: string;
	authorUsername: string;
	authorRole: 'doctor' | 'patient';
	upvotes: number;
	downvotes: number;
	isAccepted: boolean;
	commentCount: number;
	createdAt: string;
	updatedAt: string;
}

export interface Comment {
	id: string;
	content: string;
	parentId: string;
	parentType: 'question' | 'answer';
	authorUsername: string;
	authorRole: 'doctor' | 'patient';
	taggedUsers: string[];
	replyToCommentId?: string;
	createdAt: string;
	updatedAt: string;
}

export interface Vote {
	voteType: 'upvote' | 'downvote' | 'removed';
	upvotes: number;
	downvotes: number;
}

export interface QuestionCategory {
	name: string;
	count: number;
}

export interface QuestionsResponse {
	questions: Question[];
	pagination: {
		page: number;
		limit: number;
		total: number;
		hasNext: boolean;
	};
}

// Consultation System Types
export interface DoctorAvailability {
	id: string;
	doctorUsername: string;
	isOnline: boolean;
	specialties: string[];
	currentLoad: number;
	lastSeen: string;
	updatedAt: string;
	matchScore?: number;
}

export interface ConsultationRequest {
	id: string;
	patientUsername: string;
	assignedDoctorUsername?: string;
	category: string;
	description: string;
	preferredSpecialties: string[];
	urgency: 'low' | 'medium' | 'high' | 'emergency';
	status: 'pending' | 'assigned' | 'accepted' | 'rejected' | 'completed' | 'cancelled';
	createdAt: string;
	updatedAt: string;
	scheduledAt?: string;
	acceptedAt?: string;
	completedAt?: string;
	rejectionReason?: string;
	notes: ConsultationNote[];
}

export interface ConsultationNote {
	type: 'general' | 'medical' | 'administrative' | 'status_change' | 'reassignment';
	content: string;
	createdBy: string;
	createdAt: string;
}

export interface HealthCategory {
	name: string;
	description?: string;
	specialties?: string[];
}

export interface ConsultationStats {
	availability: {
		totalDoctors: number;
		onlineDoctors: number;
		offlineDoctors: number;
		totalActiveConsultations: number;
		averageLoad: number;
	};
	requests: {
		pendingRequests: number;
		assignedRequests: number;
		completedRequests: number;
		totalRequests: number;
	};
}
// Doctor Discussion System Types
export interface DoctorDiscussion {
	id: string;
	title: string;
	content: string;
	category: string;
	authorUsername: string;
	participantCount: number;
	commentCount: number;
	tags: string[];
	createdAt: string;
	updatedAt: string;
	lastActivity: string;
}

export interface DoctorComment {
	id: string;
	discussionId: string;
	content: string;
	authorUsername: string;
	taggedDoctors: string[];
	parentCommentId?: string | null;
	replyCount: number;
	createdAt: string;
	updatedAt: string;
}

export interface CreateDiscussionRequest {
	title: string;
	content: string;
	category: string;
	tags?: string[];
}

export interface CreateCommentRequest {
	discussionId: string;
	content: string;
	parentCommentId?: string | null;
	taggedDoctors?: string[];
}

export interface DiscussionCategory {
	name: string;
	count: number;
}

export interface PaginatedResponse<T> {
	[key: string]: T[] | any;
	pagination: {
		page: number;
		limit: number;
		total: number;
		hasNext: boolean;
	};
}