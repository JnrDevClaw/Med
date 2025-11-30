import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  serverTimestamp,
  orderBy,
  limit as firestoreLimit
} from 'firebase/firestore';

/**
 * Unified Notification Service
 * Handles notifications across all systems (Q&A, AI, Video, Verification)
 */
export class NotificationService {
  constructor(firestore, logger) {
    this.firestore = firestore;
    this.logger = logger;
    this.notificationsCollection = 'notifications';
  }

  /**
   * Send notification to user
   * @param {Object} notification - Notification data
   * @returns {Promise<string>} - Notification ID
   */
  async sendNotification({
    recipientUsername,
    type,
    title,
    message,
    data = {},
    priority = 'normal',
    category = 'general'
  }) {
    try {
      const notification = {
        recipientUsername,
        type,
        title,
        message,
        data,
        priority, // 'low', 'normal', 'high', 'urgent'
        category, // 'qa', 'ai', 'video', 'verification', 'general'
        read: false,
        createdAt: serverTimestamp(),
        readAt: null
      };

      const docRef = await addDoc(collection(this.firestore, this.notificationsCollection), notification);
      
      this.logger.info('Notification sent', { 
        id: docRef.id, 
        recipientUsername, 
        type, 
        category 
      });

      return docRef.id;
    } catch (error) {
      this.logger.error('Failed to send notification:', error);
      throw error;
    }
  }

  /**
   * Send Q&A related notifications
   */
  async sendQuestionAnsweredNotification(questionAuthor, answererUsername, questionTitle, questionId) {
    return this.sendNotification({
      recipientUsername: questionAuthor,
      type: 'question_answered',
      title: 'Your question received an answer',
      message: `${answererUsername} answered your question: "${questionTitle}"`,
      data: { questionId, answererUsername },
      category: 'qa',
      priority: 'normal'
    });
  }

  async sendCommentNotification(targetUsername, commenterUsername, content, parentType, parentId) {
    return this.sendNotification({
      recipientUsername: targetUsername,
      type: 'comment_received',
      title: 'New comment on your post',
      message: `${commenterUsername} commented: "${content.substring(0, 100)}${content.length > 100 ? '...' : ''}"`,
      data: { parentType, parentId, commenterUsername },
      category: 'qa',
      priority: 'normal'
    });
  }

  async sendUserTaggedNotification(taggedUsername, taggerUsername, content, parentType, parentId) {
    return this.sendNotification({
      recipientUsername: taggedUsername,
      type: 'user_tagged',
      title: 'You were mentioned in a comment',
      message: `${taggerUsername} mentioned you: "${content.substring(0, 100)}${content.length > 100 ? '...' : ''}"`,
      data: { parentType, parentId, taggerUsername },
      category: 'qa',
      priority: 'high'
    });
  }

  /**
   * Send AI related notifications
   */
  async sendAIResponseNotification(username, promptTitle, responseId) {
    return this.sendNotification({
      recipientUsername: username,
      type: 'ai_response_ready',
      title: 'AI response is ready',
      message: `Your AI consultation response for "${promptTitle}" is ready to view`,
      data: { responseId },
      category: 'ai',
      priority: 'normal'
    });
  }

  /**
   * Send consultation related notifications
   */
  async sendConsultationRequestNotification(doctorUsername, patientUsername, category, requestId) {
    return this.sendNotification({
      recipientUsername: doctorUsername,
      type: 'consultation_request',
      title: 'New consultation request',
      message: `${patientUsername} requested a consultation for ${category}`,
      data: { requestId, patientUsername, category },
      category: 'video',
      priority: 'high'
    });
  }

  async sendConsultationAcceptedNotification(patientUsername, doctorUsername, requestId) {
    return this.sendNotification({
      recipientUsername: patientUsername,
      type: 'consultation_accepted',
      title: 'Consultation request accepted',
      message: `Dr. ${doctorUsername} accepted your consultation request`,
      data: { requestId, doctorUsername },
      category: 'video',
      priority: 'high'
    });
  }

  async sendConsultationRejectedNotification(patientUsername, doctorUsername, reason, requestId) {
    return this.sendNotification({
      recipientUsername: patientUsername,
      type: 'consultation_rejected',
      title: 'Consultation request declined',
      message: `Dr. ${doctorUsername} declined your consultation request. ${reason ? `Reason: ${reason}` : ''}`,
      data: { requestId, doctorUsername, reason },
      category: 'video',
      priority: 'normal'
    });
  }

  async sendVideoCallStartingNotification(username, consultationId, roomId) {
    return this.sendNotification({
      recipientUsername: username,
      type: 'video_call_starting',
      title: 'Video call is starting',
      message: 'Your consultation video call is about to begin',
      data: { consultationId, roomId },
      category: 'video',
      priority: 'urgent'
    });
  }

  /**
   * Send verification related notifications
   */
  async sendVerificationStatusNotification(doctorUsername, isVerified, reason) {
    return this.sendNotification({
      recipientUsername: doctorUsername,
      type: 'verification_status_update',
      title: isVerified ? 'Account Verified!' : 'Verification Status Changed',
      message: isVerified 
        ? 'Congratulations! Your doctor account has been verified. You now have access to all doctor features.'
        : `Your verification status has been updated. ${reason ? `Reason: ${reason}` : ''}`,
      data: { isVerified, reason, privilegesEnabled: isVerified },
      category: 'verification',
      priority: isVerified ? 'high' : 'normal'
    });
  }

  /**
   * Send doctor discussion notifications
   */
  async sendDiscussionCommentNotification(discussionAuthor, commenterUsername, discussionTitle, discussionId) {
    return this.sendNotification({
      recipientUsername: discussionAuthor,
      type: 'discussion_comment',
      title: 'New comment on your discussion',
      message: `Dr. ${commenterUsername} commented on your discussion: "${discussionTitle}"`,
      data: { discussionId, commenterUsername },
      category: 'doctor_discussion',
      priority: 'normal'
    });
  }

  /**
   * Get user notifications
   * @param {string} username - User's username
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - User notifications
   */
  async getUserNotifications(username, options = {}) {
    try {
      const {
        unreadOnly = false,
        category = null,
        limit = 50,
        priority = null
      } = options;

      const notificationsRef = collection(this.firestore, this.notificationsCollection);
      let constraints = [
        where('recipientUsername', '==', username),
        orderBy('createdAt', 'desc')
      ];

      if (unreadOnly) {
        constraints.push(where('read', '==', false));
      }

      if (category) {
        constraints.push(where('category', '==', category));
      }

      if (priority) {
        constraints.push(where('priority', '==', priority));
      }

      constraints.push(firestoreLimit(limit));

      const q = query(notificationsRef, ...constraints);
      const snapshot = await getDocs(q);
      
      const notifications = [];
      snapshot.forEach(doc => {
        notifications.push({ id: doc.id, ...doc.data() });
      });

      return notifications;
    } catch (error) {
      this.logger.error('Failed to get user notifications:', error);
      throw error;
    }
  }

  /**
   * Mark notification as read
   * @param {string} notificationId - Notification ID
   * @param {string} username - User's username (for verification)
   * @returns {Promise<void>}
   */
  async markAsRead(notificationId, username) {
    try {
      const notificationRef = doc(this.firestore, this.notificationsCollection, notificationId);
      
      // Verify notification belongs to user
      const notificationDoc = await getDocs(
        query(
          collection(this.firestore, this.notificationsCollection),
          where('__name__', '==', notificationId),
          where('recipientUsername', '==', username)
        )
      );

      if (notificationDoc.empty) {
        throw new Error('Notification not found or access denied');
      }

      await updateDoc(notificationRef, {
        read: true,
        readAt: serverTimestamp()
      });

      this.logger.info('Notification marked as read', { notificationId, username });
    } catch (error) {
      this.logger.error('Failed to mark notification as read:', error);
      throw error;
    }
  }

  /**
   * Mark all notifications as read for user
   * @param {string} username - User's username
   * @param {string} category - Optional category filter
   * @returns {Promise<number>} - Number of notifications marked as read
   */
  async markAllAsRead(username, category = null) {
    try {
      let constraints = [
        where('recipientUsername', '==', username),
        where('read', '==', false)
      ];

      if (category) {
        constraints.push(where('category', '==', category));
      }

      const q = query(collection(this.firestore, this.notificationsCollection), ...constraints);
      const snapshot = await getDocs(q);
      
      const updatePromises = [];
      snapshot.forEach(doc => {
        updatePromises.push(
          updateDoc(doc.ref, {
            read: true,
            readAt: serverTimestamp()
          })
        );
      });

      await Promise.all(updatePromises);
      
      this.logger.info('All notifications marked as read', { 
        username, 
        category, 
        count: snapshot.size 
      });

      return snapshot.size;
    } catch (error) {
      this.logger.error('Failed to mark all notifications as read:', error);
      throw error;
    }
  }

  /**
   * Get notification counts by category
   * @param {string} username - User's username
   * @returns {Promise<Object>} - Notification counts
   */
  async getNotificationCounts(username) {
    try {
      const notificationsRef = collection(this.firestore, this.notificationsCollection);
      const q = query(
        notificationsRef,
        where('recipientUsername', '==', username)
      );

      const snapshot = await getDocs(q);
      
      const counts = {
        total: 0,
        unread: 0,
        byCategory: {},
        byPriority: {}
      };

      snapshot.forEach(doc => {
        const notification = doc.data();
        counts.total++;
        
        if (!notification.read) {
          counts.unread++;
        }

        // Count by category
        const category = notification.category || 'general';
        if (!counts.byCategory[category]) {
          counts.byCategory[category] = { total: 0, unread: 0 };
        }
        counts.byCategory[category].total++;
        if (!notification.read) {
          counts.byCategory[category].unread++;
        }

        // Count by priority
        const priority = notification.priority || 'normal';
        if (!counts.byPriority[priority]) {
          counts.byPriority[priority] = { total: 0, unread: 0 };
        }
        counts.byPriority[priority].total++;
        if (!notification.read) {
          counts.byPriority[priority].unread++;
        }
      });

      return counts;
    } catch (error) {
      this.logger.error('Failed to get notification counts:', error);
      throw error;
    }
  }

  /**
   * Delete old notifications (cleanup)
   * @param {number} daysOld - Delete notifications older than this many days
   * @returns {Promise<number>} - Number of notifications deleted
   */
  async cleanupOldNotifications(daysOld = 90) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const q = query(
        collection(this.firestore, this.notificationsCollection),
        where('createdAt', '<', cutoffDate)
      );

      const snapshot = await getDocs(q);
      
      const deletePromises = [];
      snapshot.forEach(doc => {
        deletePromises.push(doc.ref.delete());
      });

      await Promise.all(deletePromises);
      
      this.logger.info('Old notifications cleaned up', { 
        count: snapshot.size, 
        daysOld 
      });

      return snapshot.size;
    } catch (error) {
      this.logger.error('Failed to cleanup old notifications:', error);
      throw error;
    }
  }
}

export default NotificationService;