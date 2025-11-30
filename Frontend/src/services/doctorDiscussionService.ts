import { api } from '../utils/api';
import type { 
  DoctorDiscussion, 
  DoctorComment, 
  CreateDiscussionRequest, 
  CreateCommentRequest,
  PaginatedResponse 
} from '../types';

export interface DiscussionFilters {
  category?: string;
  sortBy?: 'newest' | 'oldest' | 'mostActive';
  limit?: number;
  page?: number;
  search?: string;
}

export interface CommentFilters {
  sortBy?: 'newest' | 'oldest';
  limit?: number;
}

class DoctorDiscussionService {
  private baseUrl = '/api/doctor-discussions';
  private commentsUrl = '/api/doctor-comments';

  // Discussion methods
  async getDiscussions(filters: DiscussionFilters = {}): Promise<PaginatedResponse<DoctorDiscussion>> {
    const params = new URLSearchParams();
    
    if (filters.category) params.append('category', filters.category);
    if (filters.sortBy) params.append('sortBy', filters.sortBy);
    if (filters.limit) params.append('limit', filters.limit.toString());
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.search) params.append('search', filters.search);

    const queryString = params.toString();
    const url = queryString ? `${this.baseUrl}?${queryString}` : this.baseUrl;
    
    return api.get(url);
  }

  async getDiscussion(id: string): Promise<DoctorDiscussion> {
    return api.get(`${this.baseUrl}/${id}`);
  }

  async createDiscussion(data: CreateDiscussionRequest): Promise<{ success: boolean; message: string; discussion: DoctorDiscussion }> {
    return api.post(this.baseUrl, data);
  }

  async updateDiscussion(id: string, data: Partial<CreateDiscussionRequest>): Promise<{ success: boolean; message: string; discussion: DoctorDiscussion }> {
    return api.put(`${this.baseUrl}/${id}`, data);
  }

  async deleteDiscussion(id: string): Promise<{ success: boolean; message: string }> {
    return api.delete(`${this.baseUrl}/${id}`);
  }

  async getCategories(): Promise<{ categories: Array<{ name: string; count: number }> }> {
    return api.get(`${this.baseUrl}/categories/list`);
  }

  // Comment methods
  async getDiscussionComments(discussionId: string, filters: CommentFilters = {}): Promise<{ comments: DoctorComment[] }> {
    const params = new URLSearchParams();
    
    if (filters.sortBy) params.append('sortBy', filters.sortBy);
    if (filters.limit) params.append('limit', filters.limit.toString());

    const queryString = params.toString();
    const url = queryString 
      ? `${this.commentsUrl}/discussion/${discussionId}?${queryString}` 
      : `${this.commentsUrl}/discussion/${discussionId}`;
    
    return api.get(url);
  }

  async getCommentReplies(commentId: string, filters: CommentFilters = {}): Promise<{ replies: DoctorComment[] }> {
    const params = new URLSearchParams();
    
    if (filters.sortBy) params.append('sortBy', filters.sortBy);
    if (filters.limit) params.append('limit', filters.limit.toString());

    const queryString = params.toString();
    const url = queryString 
      ? `${this.commentsUrl}/${commentId}/replies?${queryString}` 
      : `${this.commentsUrl}/${commentId}/replies`;
    
    return api.get(url);
  }

  async createComment(data: CreateCommentRequest): Promise<{ success: boolean; message: string; comment: DoctorComment }> {
    return api.post(this.commentsUrl, data);
  }

  async updateComment(id: string, data: Partial<CreateCommentRequest>): Promise<{ success: boolean; message: string; comment: DoctorComment }> {
    return api.put(`${this.commentsUrl}/${id}`, data);
  }

  async deleteComment(id: string): Promise<{ success: boolean; message: string }> {
    return api.delete(`${this.commentsUrl}/${id}`);
  }

  async searchDoctors(query: string, limit: number = 10): Promise<{ doctors: Array<{ username: string }> }> {
    const params = new URLSearchParams();
    params.append('query', query);
    params.append('limit', limit.toString());
    
    return api.get(`${this.commentsUrl}/doctors/search?${params.toString()}`);
  }
}

export const doctorDiscussionService = new DoctorDiscussionService();