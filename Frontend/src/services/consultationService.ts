import { api } from '../utils/api';

export class ConsultationService {
  /**
   * Get available doctors for consultation
   */
  static async getAvailableDoctors(filters?: {
    specialties?: string[];
    category?: string;
    maxLoad?: number;
    limit?: number;
  }) {
    const params = new URLSearchParams();
    
    if (filters?.specialties?.length) {
      filters.specialties.forEach(specialty => {
        params.append('specialties', specialty);
      });
    }
    
    if (filters?.category) params.append('category', filters.category);
    if (filters?.maxLoad) params.append('maxLoad', filters.maxLoad.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const response = await api.get(`/consultations/doctors/available?${params.toString()}`);
    return response.data;
  }

  /**
   * Find best matching doctor for consultation
   */
  static async findBestMatchingDoctor(category: string, preferredSpecialties?: string[]) {
    const response = await api.post('/consultations/doctors/find-match', {
      category,
      preferredSpecialties: preferredSpecialties || []
    });
    return response.data;
  }

  /**
   * Get consultation requests for current user
   */
  static async getConsultationRequests(filters?: {
    status?: string;
    category?: string;
    limit?: number;
    offset?: number;
  }) {
    const params = new URLSearchParams();
    
    if (filters?.status) params.append('status', filters.status);
    if (filters?.category) params.append('category', filters.category);
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.offset) params.append('offset', filters.offset.toString());

    const response = await api.get(`/consultations/requests?${params.toString()}`);
    return response.data;
  }

  /**
   * Create a new consultation request
   */
  static async createConsultationRequest(requestData: {
    category: string;
    description: string;
    preferredSpecialties?: string[];
    urgency?: 'low' | 'medium' | 'high' | 'emergency';
    preferredDoctorUsername?: string;
  }) {
    const response = await api.post('/consultations/requests', requestData);
    return response.data;
  }

  /**
   * Update consultation request status (for doctors)
   */
  static async updateRequestStatus(
    requestId: string, 
    status: 'accepted' | 'rejected' | 'completed',
    additionalData?: {
      scheduledAt?: string;
      rejectionReason?: string;
    }
  ) {
    const response = await api.patch(`/consultations/requests/${requestId}/status`, {
      status,
      ...additionalData
    });
    return response.data;
  }

  /**
   * Set doctor availability status
   */
  static async setDoctorAvailability(isOnline: boolean, specialties?: string[]) {
    const response = await api.post('/consultations/doctors/availability', {
      isOnline,
      specialties: specialties || []
    });
    return response.data;
  }

  /**
   * Get available health categories
   */
  static async getHealthCategories() {
    const response = await api.get('/consultations/categories');
    return response.data;
  }

  /**
   * Get suggested specialties for a health category
   */
  static async getCategorySpecialties(category: string) {
    const response = await api.get(`/consultations/categories/${encodeURIComponent(category)}/specialties`);
    return response.data;
  }

  /**
   * Get consultation statistics
   */
  static async getConsultationStats() {
    const response = await api.get('/consultations/stats');
    return response.data;
  }

  /**
   * Schedule a consultation (for accepted requests)
   */
  static async scheduleConsultation(
    requestId: string,
    scheduledAt: string,
    notes?: string
  ) {
    const response = await api.patch(`/consultations/requests/${requestId}/schedule`, {
      scheduledAt,
      notes
    });
    return response.data;
  }

  /**
   * Add note to consultation request
   */
  static async addRequestNote(
    requestId: string,
    content: string,
    type: 'general' | 'medical' | 'administrative' = 'general'
  ) {
    const response = await api.post(`/consultations/requests/${requestId}/notes`, {
      content,
      type
    });
    return response.data;
  }

  /**
   * Reassign consultation request to different doctor
   */
  static async reassignRequest(requestId: string, newDoctorUsername: string) {
    const response = await api.patch(`/consultations/requests/${requestId}/reassign`, {
      newDoctorUsername
    });
    return response.data;
  }

  /**
   * Create video room for consultation
   */
  static async createVideoRoom(consultationId: string) {
    const response = await api.post('/video/room', {
      consultationId
    });
    return response.data;
  }

  /**
   * Join video room
   */
  static async joinVideoRoom(roomId: string) {
    const response = await api.post(`/video/room/${roomId}/join`);
    return response.data;
  }

  /**
   * End video call
   */
  static async endVideoCall(roomId: string) {
    const response = await api.post(`/video/room/${roomId}/end`);
    return response.data;
  }

  /**
   * Get video call quality metrics
   */
  static async getVideoCallQuality(roomId: string) {
    const response = await api.get(`/video/room/${roomId}/quality`);
    return response.data;
  }

  /**
   * Get WebRTC configuration
   */
  static async getWebRTCConfig() {
    const response = await api.get('/webrtc/config');
    return response.data;
  }
}

export default ConsultationService;