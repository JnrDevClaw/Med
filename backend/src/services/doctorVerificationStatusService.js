import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  orderBy
} from 'firebase/firestore';

/**
 * Doctor Verification Status Service
 * Manages doctor verification status, privilege activation, and notifications
 */
export class DoctorVerificationStatusService {
  constructor(firestore, firestoreUserService, logger) {
    this.firestore = firestore;
    this.firestoreUserService = firestoreUserService;
    this.logger = logger;
    this.verificationHistoryCollection = 'doctor_verification_history';
    this.notificationsCollection = 'notifications';
  }

  /**
   * Evaluate doctor's overall verification status based on credentials
   * @param {string} doctorUsername - Doctor's username
   * @returns {Promise<Object>} - Verification evaluation results
   */
  async evaluateDoctorVerification(doctorUsername) {
    try {
      // Get all credentials for the doctor
      const credentialsRef = collection(this.firestore, 'doctor_credentials');
      const q = query(credentialsRef, where('doctorUsername', '==', doctorUsername));
      const credentialsSnapshot = await getDocs(q);
      
      const credentials = [];
      credentialsSnapshot.forEach(doc => {
        credentials.push({ id: doc.id, ...doc.data() });
      });

      // Evaluation criteria
      const evaluation = {
        doctorUsername,
        totalCredentials: credentials.length,
        verifiedCredentials: 0,
        rejectedCredentials: 0,
        pendingCredentials: 0,
        hasRequiredCredentials: false,
        verificationScore: 0,
        isEligibleForVerification: false,
        missingRequirements: [],
        evaluatedAt: new Date().toISOString()
      };

      // Count credential statuses
      credentials.forEach(cred => {
        switch (cred.verificationStatus) {
          case 'verified':
            evaluation.verifiedCredentials++;
            break;
          case 'rejected':
            evaluation.rejectedCredentials++;
            break;
          default:
            evaluation.pendingCredentials++;
        }
      });

      // Check for required credential types
      const requiredTypes = ['medical_license'];
      const optionalHighValueTypes = ['board_certification', 'residency', 'fellowship'];
      
      const verifiedTypes = credentials
        .filter(cred => cred.verificationStatus === 'verified')
        .map(cred => cred.credentialType);

      // Check required credentials
      const hasRequiredLicense = requiredTypes.some(type => verifiedTypes.includes(type));
      evaluation.hasRequiredCredentials = hasRequiredLicense;

      if (!hasRequiredLicense) {
        evaluation.missingRequirements.push('Valid medical license required');
      }

      // Calculate verification score (0-100)
      let score = 0;
      
      // Base score for having required credentials
      if (hasRequiredLicense) {
        score += 60;
      }

      // Additional points for optional high-value credentials
      optionalHighValueTypes.forEach(type => {
        if (verifiedTypes.includes(type)) {
          score += 10;
        }
      });

      // Bonus for multiple verified credentials
      if (evaluation.verifiedCredentials >= 2) {
        score += 10;
      }

      // Penalty for rejected credentials
      score -= (evaluation.rejectedCredentials * 5);

      evaluation.verificationScore = Math.max(0, Math.min(100, score));

      // Determine eligibility (requires minimum score and required credentials)
      evaluation.isEligibleForVerification = evaluation.hasRequiredCredentials && 
                                           evaluation.verificationScore >= 60 &&
                                           evaluation.rejectedCredentials === 0;

      this.logger.info('Doctor verification evaluated', {
        doctorUsername,
        score: evaluation.verificationScore,
        eligible: evaluation.isEligibleForVerification
      });

      return evaluation;

    } catch (error) {
      this.logger.error('Failed to evaluate doctor verification:', error);
      throw error;
    }
  }

  /**
   * Update doctor's verification status and activate privileges
   * @param {string} doctorUsername - Doctor's username
   * @param {boolean} isVerified - Whether to verify or unverify
   * @param {string} reason - Reason for status change
   * @returns {Promise<void>}
   */
  async updateDoctorVerificationStatus(doctorUsername, isVerified, reason = '') {
    try {
      // Get current user data
      const currentUser = await this.firestoreUserService.getUserByUsername(doctorUsername);
      if (!currentUser) {
        throw new Error('Doctor not found');
      }

      if (currentUser.role !== 'doctor') {
        throw new Error('User is not a doctor');
      }

      // Update user's verified status
      await this.firestoreUserService.updateUserMetadata(doctorUsername, {
        verified: isVerified
      });

      // Record verification history
      await this.recordVerificationHistory(doctorUsername, isVerified, reason);

      // Send notification
      await this.sendVerificationNotification(doctorUsername, isVerified, reason);

      // Log privilege activation/deactivation
      this.logger.info('Doctor verification status updated', {
        doctorUsername,
        isVerified,
        reason,
        privilegesActivated: isVerified
      });

    } catch (error) {
      this.logger.error('Failed to update doctor verification status:', error);
      throw error;
    }
  }

  /**
   * Record verification status change in history
   * @param {string} doctorUsername - Doctor's username
   * @param {boolean} isVerified - New verification status
   * @param {string} reason - Reason for change
   * @returns {Promise<void>}
   */
  async recordVerificationHistory(doctorUsername, isVerified, reason) {
    try {
      const historyRecord = {
        doctorUsername,
        action: isVerified ? 'verified' : 'unverified',
        reason,
        timestamp: serverTimestamp(),
        metadata: {
          systemGenerated: true,
          source: 'credential_verification'
        }
      };

      await addDoc(collection(this.firestore, this.verificationHistoryCollection), historyRecord);
      
      this.logger.info('Verification history recorded', { doctorUsername, action: historyRecord.action });
    } catch (error) {
      this.logger.error('Failed to record verification history:', error);
      throw error;
    }
  }

  /**
   * Send verification status notification to doctor
   * @param {string} doctorUsername - Doctor's username
   * @param {boolean} isVerified - Verification status
   * @param {string} reason - Reason for status change
   * @returns {Promise<void>}
   */
  async sendVerificationNotification(doctorUsername, isVerified, reason) {
    try {
      const notification = {
        recipientUsername: doctorUsername,
        type: 'verification_status_update',
        title: isVerified ? 'Account Verified!' : 'Verification Status Changed',
        message: isVerified 
          ? 'Congratulations! Your doctor account has been verified. You now have access to all doctor features.'
          : `Your verification status has been updated. Reason: ${reason}`,
        data: {
          isVerified,
          reason,
          privilegesEnabled: isVerified
        },
        read: false,
        createdAt: serverTimestamp()
      };

      await addDoc(collection(this.firestore, this.notificationsCollection), notification);
      
      this.logger.info('Verification notification sent', { doctorUsername, isVerified });
    } catch (error) {
      this.logger.error('Failed to send verification notification:', error);
      // Don't throw error - notification failure shouldn't block verification
    }
  }

  /**
   * Get doctor's verification history
   * @param {string} doctorUsername - Doctor's username
   * @param {number} limit - Maximum number of records to return
   * @returns {Promise<Array>} - Verification history records
   */
  async getDoctorVerificationHistory(doctorUsername, limit = 50) {
    try {
      const historyRef = collection(this.firestore, this.verificationHistoryCollection);
      const q = query(
        historyRef,
        where('doctorUsername', '==', doctorUsername),
        orderBy('timestamp', 'desc')
      );

      const historySnapshot = await getDocs(q);
      const history = [];

      historySnapshot.forEach(doc => {
        if (history.length < limit) {
          history.push({ id: doc.id, ...doc.data() });
        }
      });

      return history;
    } catch (error) {
      this.logger.error('Failed to get verification history:', error);
      throw error;
    }
  }

  /**
   * Get doctor's notifications
   * @param {string} doctorUsername - Doctor's username
   * @param {boolean} unreadOnly - Only return unread notifications
   * @param {number} limit - Maximum number of notifications to return
   * @returns {Promise<Array>} - Notification records
   */
  async getDoctorNotifications(doctorUsername, unreadOnly = false, limit = 50) {
    try {
      const notificationsRef = collection(this.firestore, this.notificationsCollection);
      let q = query(
        notificationsRef,
        where('recipientUsername', '==', doctorUsername),
        orderBy('createdAt', 'desc')
      );

      if (unreadOnly) {
        q = query(
          notificationsRef,
          where('recipientUsername', '==', doctorUsername),
          where('read', '==', false),
          orderBy('createdAt', 'desc')
        );
      }

      const notificationsSnapshot = await getDocs(q);
      const notifications = [];

      notificationsSnapshot.forEach(doc => {
        if (notifications.length < limit) {
          notifications.push({ id: doc.id, ...doc.data() });
        }
      });

      return notifications;
    } catch (error) {
      this.logger.error('Failed to get doctor notifications:', error);
      throw error;
    }
  }

  /**
   * Mark notification as read
   * @param {string} notificationId - Notification ID
   * @param {string} doctorUsername - Doctor's username (for verification)
   * @returns {Promise<void>}
   */
  async markNotificationAsRead(notificationId, doctorUsername) {
    try {
      const notificationRef = doc(this.firestore, this.notificationsCollection, notificationId);
      const notificationDoc = await getDoc(notificationRef);

      if (!notificationDoc.exists()) {
        throw new Error('Notification not found');
      }

      const notification = notificationDoc.data();
      if (notification.recipientUsername !== doctorUsername) {
        throw new Error('Access denied');
      }

      await updateDoc(notificationRef, {
        read: true,
        readAt: serverTimestamp()
      });

      this.logger.info('Notification marked as read', { notificationId, doctorUsername });
    } catch (error) {
      this.logger.error('Failed to mark notification as read:', error);
      throw error;
    }
  }

  /**
   * Get verification statistics
   * @returns {Promise<Object>} - Verification statistics
   */
  async getVerificationStatistics() {
    try {
      // Get all doctors
      const doctors = await this.firestoreUserService.getUsersByRole('doctor');
      
      const stats = {
        totalDoctors: doctors.length,
        verifiedDoctors: doctors.filter(d => d.verified).length,
        unverifiedDoctors: doctors.filter(d => !d.verified).length,
        verificationRate: 0,
        recentVerifications: 0
      };

      stats.verificationRate = stats.totalDoctors > 0 
        ? (stats.verifiedDoctors / stats.totalDoctors * 100).toFixed(1)
        : 0;

      // Get recent verifications (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const historyRef = collection(this.firestore, this.verificationHistoryCollection);
      const recentQuery = query(
        historyRef,
        where('action', '==', 'verified'),
        where('timestamp', '>=', thirtyDaysAgo)
      );

      const recentSnapshot = await getDocs(recentQuery);
      stats.recentVerifications = recentSnapshot.size;

      return stats;
    } catch (error) {
      this.logger.error('Failed to get verification statistics:', error);
      throw error;
    }
  }

  /**
   * Process automatic verification for eligible doctors
   * @returns {Promise<Array>} - List of doctors processed
   */
  async processAutomaticVerifications() {
    try {
      // Get all unverified doctors
      const unverifiedDoctors = await this.firestoreUserService.getUsersByRole('doctor', false);
      const processedDoctors = [];

      for (const doctor of unverifiedDoctors) {
        if (doctor.verified) continue; // Skip already verified doctors

        try {
          // Evaluate verification eligibility
          const evaluation = await this.evaluateDoctorVerification(doctor.username);

          if (evaluation.isEligibleForVerification) {
            // Automatically verify the doctor
            await this.updateDoctorVerificationStatus(
              doctor.username,
              true,
              'Automatic verification based on credential validation'
            );

            processedDoctors.push({
              username: doctor.username,
              action: 'verified',
              score: evaluation.verificationScore
            });

            this.logger.info('Doctor automatically verified', {
              username: doctor.username,
              score: evaluation.verificationScore
            });
          }
        } catch (error) {
          this.logger.error('Failed to process automatic verification for doctor:', {
            username: doctor.username,
            error: error.message
          });
        }
      }

      this.logger.info('Automatic verification processing completed', {
        processedCount: processedDoctors.length
      });

      return processedDoctors;
    } catch (error) {
      this.logger.error('Failed to process automatic verifications:', error);
      throw error;
    }
  }
}

export default DoctorVerificationStatusService;