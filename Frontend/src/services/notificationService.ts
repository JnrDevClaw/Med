import { api } from '../utils/api';

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  data: any;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  category: string;
  read: boolean;
  createdAt: string;
  readAt?: string;
}

export interface NotificationCounts {
  total: number;
  unread: number;
  byCategory: Record<string, { total: number; unread: number }>;
  byPriority: Record<string, { total: number; unread: number }>;
}

export interface ActivitySummary {
  totalActivities: number;
  activityCounts: Record<string, number>;
  recentActivities: any[];
  mostActiveDay: string | null;
  engagementTrend: string;
}

export class NotificationService {
  /**
   * Get user notifications
   */
  static async getNotifications(options: {
    unreadOnly?: boolean;
    category?: string;
    priority?: string;
    limit?: number;
  } = {}): Promise<Notification[]> {
    const params = new URLSearchParams();
    
    if (options.unreadOnly) params.append('unreadOnly', 'true');
    if (options.category) params.append('category', options.category);
    if (options.priority) params.append('priority', options.priority);
    if (options.limit) params.append('limit', options.limit.toString());

    const response = await api.get(`/notifications?${params.toString()}`);
    return response.notifications;
  }

  /**
   * Get notification counts
   */
  static async getNotificationCounts(): Promise<NotificationCounts> {
    const response = await api.get('/notifications/counts');
    return response.counts;
  }

  /**
   * Mark notification as read
   */
  static async markAsRead(notificationId: string): Promise<void> {
    await api.patch(`/notifications/${notificationId}/read`);
  }

  /**
   * Mark all notifications as read
   */
  static async markAllAsRead(category?: string): Promise<{ count: number }> {
    const response = await api.patch('/notifications/mark-all-read', {
      category
    });
    return { count: response.count };
  }

  /**
   * Get activity summary
   */
  static async getActivitySummary(days: number = 30): Promise<ActivitySummary> {
    const response = await api.get(`/notifications/activity-summary?days=${days}`);
    return response.summary;
  }

  /**
   * Send test notification (development only)
   */
  static async sendTestNotification(notification: {
    title: string;
    message: string;
    type?: string;
    priority?: string;
    category?: string;
    data?: any;
  }): Promise<{ notificationId: string }> {
    const response = await api.post('/notifications/test', notification);
    return { notificationId: response.notificationId };
  }

  /**
   * Get unread notification count for badge
   */
  static async getUnreadCount(): Promise<number> {
    const counts = await this.getNotificationCounts();
    return counts.unread;
  }

  /**
   * Get notifications by category
   */
  static async getNotificationsByCategory(category: string, limit: number = 20): Promise<Notification[]> {
    return this.getNotifications({ category, limit });
  }

  /**
   * Get high priority notifications
   */
  static async getHighPriorityNotifications(): Promise<Notification[]> {
    return this.getNotifications({ 
      priority: 'high',
      unreadOnly: true,
      limit: 10 
    });
  }

  /**
   * Get urgent notifications
   */
  static async getUrgentNotifications(): Promise<Notification[]> {
    return this.getNotifications({ 
      priority: 'urgent',
      unreadOnly: true,
      limit: 5 
    });
  }

  /**
   * Format notification for display
   */
  static formatNotification(notification: Notification): {
    title: string;
    message: string;
    timeAgo: string;
    icon: string;
    color: string;
  } {
    const timeAgo = this.getTimeAgo(new Date(notification.createdAt));
    
    const iconMap: Record<string, string> = {
      'question_answered': 'message-circle',
      'comment_received': 'message-square',
      'user_tagged': 'at-sign',
      'ai_response_ready': 'brain',
      'consultation_request': 'video',
      'consultation_accepted': 'check-circle',
      'consultation_rejected': 'x-circle',
      'video_call_starting': 'phone-call',
      'verification_status_update': 'shield-check',
      'discussion_comment': 'users',
      'default': 'bell'
    };

    const colorMap: Record<string, string> = {
      'urgent': 'text-red-600',
      'high': 'text-orange-600',
      'normal': 'text-blue-600',
      'low': 'text-gray-600'
    };

    return {
      title: notification.title,
      message: notification.message,
      timeAgo,
      icon: iconMap[notification.type] || iconMap.default,
      color: colorMap[notification.priority] || colorMap.normal
    };
  }

  /**
   * Get time ago string
   */
  private static getTimeAgo(date: Date): string {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return 'Just now';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else if (diffInSeconds < 604800) {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days} day${days > 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString();
    }
  }

  /**
   * Group notifications by category
   */
  static groupNotificationsByCategory(notifications: Notification[]): Record<string, Notification[]> {
    return notifications.reduce((groups, notification) => {
      const category = notification.category || 'general';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(notification);
      return groups;
    }, {} as Record<string, Notification[]>);
  }

  /**
   * Filter notifications by date range
   */
  static filterNotificationsByDateRange(
    notifications: Notification[], 
    startDate: Date, 
    endDate: Date
  ): Notification[] {
    return notifications.filter(notification => {
      const notificationDate = new Date(notification.createdAt);
      return notificationDate >= startDate && notificationDate <= endDate;
    });
  }

  /**
   * Get notification action URL
   */
  static getNotificationActionUrl(notification: Notification): string | null {
    const { type, data } = notification;

    switch (type) {
      case 'question_answered':
        return data.questionId ? `/qa/questions/${data.questionId}` : null;
      case 'comment_received':
      case 'user_tagged':
        if (data.parentType === 'question' && data.parentId) {
          return `/qa/questions/${data.parentId}`;
        }
        return null;
      case 'ai_response_ready':
        return '/ai';
      case 'consultation_request':
      case 'consultation_accepted':
      case 'consultation_rejected':
        return '/consultations';
      case 'video_call_starting':
        return data.roomId ? `/video/${data.roomId}` : '/consultations';
      case 'verification_status_update':
        return '/profile/verification';
      case 'discussion_comment':
        return data.discussionId ? `/doctor-discussions/${data.discussionId}` : '/doctor-discussions';
      default:
        return null;
    }
  }
}

export default NotificationService;