import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  orderBy,
  limit as firestoreLimit
} from 'firebase/firestore';

/**
 * Consultation Request Service
 * Manages consultation requests between patients and doctors
 */
export class ConsultationRequestService {
  constructor(firestore, logger, doctorAvailabilityService) {
    this.firestore = firestore;
    this.logger = logger;
    this.doctorAvailabilityService = doctorAvailabilityService;
    this.requestsCollection = 'consultation_requests';
    this.categoriesCollection = 'health_categories';
    
    // Health issue categories with related specialties
    this.healthCategories = {
      'General Medicine': {
        description: 'General health concerns, routine checkups, and common illnesses',
        specialties: ['General Practice', 'Internal Medicine', 'Family Medicine']
      },
      'Cardiology': {
        description: 'Heart and cardiovascular system related issues',
        specialties: ['Cardiology', 'Cardiovascular Surgery', 'Interventional Cardiology']
      },
      'Dermatology': {
        description: 'Skin, hair, and nail conditions',
        specialties: ['Dermatology', 'Dermatopathology', 'Cosmetic Dermatology']
      },
      'Pediatrics': {
        description: 'Children\'s health and development',
        specialties: ['Pediatrics', 'Pediatric Cardiology', 'Pediatric Neurology', 'Neonatology']
      },
      'Orthopedics': {
        description: 'Bone, joint, muscle, and skeletal system issues',
        specialties: ['Orthopedics', 'Sports Medicine', 'Rheumatology', 'Physical Medicine']
      },
      'Neurology': {
        description: 'Brain, spinal cord, and nervous system disorders',
        specialties: ['Neurology', 'Neurosurgery', 'Neuropsychology', 'Pain Management']
      },
      'Psychiatry': {
        description: 'Mental health and psychological conditions',
        specialties: ['Psychiatry', 'Psychology', 'Addiction Medicine', 'Child Psychiatry']
      },
      'Gynecology': {
        description: 'Women\'s reproductive health and pregnancy',
        specialties: ['Gynecology', 'Obstetrics', 'Reproductive Endocrinology', 'Maternal-Fetal Medicine']
      },
      'Urology': {
        description: 'Urinary tract and male reproductive system',
        specialties: ['Urology', 'Nephrology', 'Andrology']
      },
      'Ophthalmology': {
        description: 'Eye and vision related problems',
        specialties: ['Ophthalmology', 'Optometry', 'Retinal Surgery', 'Corneal Surgery']
      },
      'ENT': {
        description: 'Ear, nose, throat, and head/neck conditions',
        specialties: ['Otolaryngology', 'Audiology', 'Head and Neck Surgery']
      },
      'Gastroenterology': {
        description: 'Digestive system and gastrointestinal disorders',
        specialties: ['Gastroenterology', 'Hepatology', 'Colorectal Surgery']
      },
      'Pulmonology': {
        description: 'Respiratory system and lung conditions',
        specialties: ['Pulmonology', 'Critical Care Medicine', 'Sleep Medicine']
      },
      'Endocrinology': {
        description: 'Hormonal and metabolic disorders',
        specialties: ['Endocrinology', 'Diabetes Care', 'Thyroid Disorders']
      },
      'Emergency': {
        description: 'Urgent medical situations requiring immediate attention',
        specialties: ['Emergency Medicine', 'Critical Care', 'Trauma Surgery']
      },
      'Other': {
        description: 'Other medical concerns not covered by specific categories',
        specialties: ['General Practice', 'Internal Medicine']
      }
    };
  }

  /**
   * Create a new consultation request
   * @param {string} patientUsername - Patient's username
   * @param {Object} requestData - Request details
   * @param {string} requestData.category - Health issue category
   * @param {string} requestData.description - Issue description
   * @param {Array<string>} requestData.preferredSpecialties - Preferred doctor specialties
   * @param {string} requestData.urgency - Urgency level (low, medium, high, emergency)
   * @param {string} requestData.preferredDoctorUsername - Specific doctor preference (optional)
   * @returns {Promise<Object>} - Created consultation request
   */
  async createConsultationRequest(patientUsername, requestData) {
    try {
      const {
        category,
        description,
        preferredSpecialties = [],
        urgency = 'medium',
        preferredDoctorUsername = null
      } = requestData;

      // Validate category
      if (!this.healthCategories[category]) {
        throw new Error(`Invalid health category: ${category}`);
      }

      // Validate patient exists
      const patientQuery = query(
        collection(this.firestore, 'users'),
        where('username', '==', patientUsername),
        where('role', '==', 'patient')
      );
      
      const patientSnapshot = await getDocs(patientQuery);
      if (patientSnapshot.empty) {
        throw new Error(`Patient '${patientUsername}' not found`);
      }

      let assignedDoctorUsername = null;
      let status = 'pending';

      // Try to find and assign a doctor automatically
      if (preferredDoctorUsername) {
        // Check if preferred doctor is available
        const doctorAvailability = await this.doctorAvailabilityService.getDoctorAvailability(preferredDoctorUsername);
        if (doctorAvailability && doctorAvailability.isOnline && doctorAvailability.currentLoad < 5) {
          assignedDoctorUsername = preferredDoctorUsername;
          status = 'assigned';
        }
      } else {
        // Get suggested specialties for the category if no preferred specialties provided
        const suggestedSpecialties = preferredSpecialties.length > 0 
          ? preferredSpecialties 
          : this.getSuggestedSpecialties(category);

        // Find best matching doctor
        const bestDoctor = await this.doctorAvailabilityService.findBestMatchingDoctor(
          category,
          suggestedSpecialties
        );
        
        if (bestDoctor) {
          assignedDoctorUsername = bestDoctor.doctorUsername;
          status = 'assigned';
        }
      }

      // Create consultation request
      const requestDoc = {
        patientUsername,
        assignedDoctorUsername,
        category,
        description,
        preferredSpecialties,
        urgency,
        status, // pending, assigned, accepted, rejected, completed, cancelled
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        scheduledAt: null,
        acceptedAt: null,
        completedAt: null,
        rejectionReason: null,
        notes: []
      };

      const docRef = await addDoc(collection(this.firestore, this.requestsCollection), requestDoc);

      // Update doctor load if assigned
      if (assignedDoctorUsername) {
        await this.doctorAvailabilityService.updateDoctorLoad(assignedDoctorUsername, 1);
      }

      const createdRequest = {
        id: docRef.id,
        ...requestDoc
      };

      this.logger.info(`Consultation request created`, {
        requestId: docRef.id,
        patientUsername,
        assignedDoctorUsername,
        category,
        status
      });

      return createdRequest;

    } catch (error) {
      this.logger.error('Failed to create consultation request:', error);
      throw error;
    }
  }

  /**
   * Get consultation requests for a user (patient or doctor)
   * @param {string} username - Username
   * @param {string} role - User role ('patient' or 'doctor')
   * @param {Object} filters - Filtering options
   * @returns {Promise<Array>} - Array of consultation requests
   */
  async getConsultationRequests(username, role, filters = {}) {
    try {
      const { status, category, limit = 20, offset = 0 } = filters;

      let requestQuery;
      
      if (role === 'patient') {
        requestQuery = query(
          collection(this.firestore, this.requestsCollection),
          where('patientUsername', '==', username)
        );
      } else if (role === 'doctor') {
        requestQuery = query(
          collection(this.firestore, this.requestsCollection),
          where('assignedDoctorUsername', '==', username)
        );
      } else {
        throw new Error(`Invalid role: ${role}`);
      }

      // Add status filter
      if (status) {
        requestQuery = query(requestQuery, where('status', '==', status));
      }

      // Add category filter
      if (category) {
        requestQuery = query(requestQuery, where('category', '==', category));
      }

      // Add ordering
      requestQuery = query(
        requestQuery,
        orderBy('createdAt', 'desc'),
        firestoreLimit(limit)
      );

      const snapshot = await getDocs(requestQuery);
      const requests = [];

      snapshot.forEach(doc => {
        const data = doc.data();
        requests.push({
          id: doc.id,
          patientUsername: data.patientUsername,
          assignedDoctorUsername: data.assignedDoctorUsername,
          category: data.category,
          description: data.description,
          preferredSpecialties: data.preferredSpecialties || [],
          urgency: data.urgency,
          status: data.status,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          scheduledAt: data.scheduledAt,
          acceptedAt: data.acceptedAt,
          completedAt: data.completedAt,
          rejectionReason: data.rejectionReason,
          notes: data.notes || []
        });
      });

      this.logger.info(`Retrieved consultation requests`, {
        username,
        role,
        count: requests.length,
        filters
      });

      return requests;

    } catch (error) {
      this.logger.error('Failed to get consultation requests:', error);
      throw error;
    }
  }

  /**
   * Update consultation request status
   * @param {string} requestId - Request ID
   * @param {string} newStatus - New status
   * @param {string} updatedBy - Username of user making the update
   * @param {Object} additionalData - Additional data for the update
   * @returns {Promise<Object>} - Updated request
   */
  async updateRequestStatus(requestId, newStatus, updatedBy, additionalData = {}) {
    try {
      const requestRef = doc(this.firestore, this.requestsCollection, requestId);
      const requestDoc = await getDoc(requestRef);

      if (!requestDoc.exists()) {
        throw new Error(`Consultation request '${requestId}' not found`);
      }

      const currentData = requestDoc.data();
      const updateData = {
        status: newStatus,
        updatedAt: serverTimestamp()
      };

      // Handle status-specific updates
      switch (newStatus) {
        case 'accepted':
          updateData.acceptedAt = serverTimestamp();
          if (additionalData.scheduledAt) {
            updateData.scheduledAt = new Date(additionalData.scheduledAt);
          }
          break;

        case 'rejected':
          updateData.rejectionReason = additionalData.rejectionReason || 'No reason provided';
          // Update doctor load (decrease)
          if (currentData.assignedDoctorUsername) {
            await this.doctorAvailabilityService.updateDoctorLoad(
              currentData.assignedDoctorUsername, 
              -1
            );
          }
          break;

        case 'completed':
          updateData.completedAt = serverTimestamp();
          // Update doctor load (decrease)
          if (currentData.assignedDoctorUsername) {
            await this.doctorAvailabilityService.updateDoctorLoad(
              currentData.assignedDoctorUsername, 
              -1
            );
          }
          break;

        case 'cancelled':
          // Update doctor load (decrease)
          if (currentData.assignedDoctorUsername) {
            await this.doctorAvailabilityService.updateDoctorLoad(
              currentData.assignedDoctorUsername, 
              -1
            );
          }
          break;
      }

      // Add note about the status change
      const statusNote = {
        type: 'status_change',
        content: `Status changed from '${currentData.status}' to '${newStatus}' by ${updatedBy}`,
        createdBy: updatedBy,
        createdAt: serverTimestamp()
      };

      updateData.notes = [...(currentData.notes || []), statusNote];

      await updateDoc(requestRef, updateData);

      const updatedRequest = {
        id: requestId,
        ...currentData,
        ...updateData
      };

      this.logger.info(`Consultation request status updated`, {
        requestId,
        oldStatus: currentData.status,
        newStatus,
        updatedBy
      });

      return updatedRequest;

    } catch (error) {
      this.logger.error('Failed to update request status:', error);
      throw error;
    }
  }

  /**
   * Add note to consultation request
   * @param {string} requestId - Request ID
   * @param {string} content - Note content
   * @param {string} createdBy - Username of note creator
   * @param {string} type - Note type ('general', 'medical', 'administrative')
   * @returns {Promise<void>}
   */
  async addRequestNote(requestId, content, createdBy, type = 'general') {
    try {
      const requestRef = doc(this.firestore, this.requestsCollection, requestId);
      const requestDoc = await getDoc(requestRef);

      if (!requestDoc.exists()) {
        throw new Error(`Consultation request '${requestId}' not found`);
      }

      const currentData = requestDoc.data();
      const newNote = {
        type,
        content,
        createdBy,
        createdAt: serverTimestamp()
      };

      const updatedNotes = [...(currentData.notes || []), newNote];

      await updateDoc(requestRef, {
        notes: updatedNotes,
        updatedAt: serverTimestamp()
      });

      this.logger.info(`Note added to consultation request`, {
        requestId,
        noteType: type,
        createdBy
      });

    } catch (error) {
      this.logger.error('Failed to add request note:', error);
      throw error;
    }
  }

  /**
   * Reassign consultation request to different doctor
   * @param {string} requestId - Request ID
   * @param {string} newDoctorUsername - New doctor's username
   * @param {string} reassignedBy - Username of user making the reassignment
   * @returns {Promise<Object>} - Updated request
   */
  async reassignRequest(requestId, newDoctorUsername, reassignedBy) {
    try {
      const requestRef = doc(this.firestore, this.requestsCollection, requestId);
      const requestDoc = await getDoc(requestRef);

      if (!requestDoc.exists()) {
        throw new Error(`Consultation request '${requestId}' not found`);
      }

      const currentData = requestDoc.data();

      // Check if new doctor is available
      const doctorAvailability = await this.doctorAvailabilityService.getDoctorAvailability(newDoctorUsername);
      if (!doctorAvailability || !doctorAvailability.isOnline) {
        throw new Error(`Doctor '${newDoctorUsername}' is not available`);
      }

      if (doctorAvailability.currentLoad >= 5) {
        throw new Error(`Doctor '${newDoctorUsername}' has reached maximum consultation load`);
      }

      // Update doctor loads
      if (currentData.assignedDoctorUsername) {
        await this.doctorAvailabilityService.updateDoctorLoad(
          currentData.assignedDoctorUsername, 
          -1
        );
      }

      await this.doctorAvailabilityService.updateDoctorLoad(newDoctorUsername, 1);

      // Add reassignment note
      const reassignmentNote = {
        type: 'reassignment',
        content: `Request reassigned from '${currentData.assignedDoctorUsername || 'unassigned'}' to '${newDoctorUsername}' by ${reassignedBy}`,
        createdBy: reassignedBy,
        createdAt: serverTimestamp()
      };

      const updateData = {
        assignedDoctorUsername: newDoctorUsername,
        status: 'assigned',
        updatedAt: serverTimestamp(),
        notes: [...(currentData.notes || []), reassignmentNote]
      };

      await updateDoc(requestRef, updateData);

      const updatedRequest = {
        id: requestId,
        ...currentData,
        ...updateData
      };

      this.logger.info(`Consultation request reassigned`, {
        requestId,
        oldDoctor: currentData.assignedDoctorUsername,
        newDoctor: newDoctorUsername,
        reassignedBy
      });

      return updatedRequest;

    } catch (error) {
      this.logger.error('Failed to reassign request:', error);
      throw error;
    }
  }

  /**
   * Get pending requests that need doctor assignment
   * @param {number} limit - Maximum number of requests to return
   * @returns {Promise<Array>} - Array of pending requests
   */
  async getPendingRequests(limit = 10) {
    try {
      const pendingQuery = query(
        collection(this.firestore, this.requestsCollection),
        where('status', '==', 'pending'),
        orderBy('createdAt', 'asc'), // Oldest first
        firestoreLimit(limit)
      );

      const snapshot = await getDocs(pendingQuery);
      const requests = [];

      snapshot.forEach(doc => {
        const data = doc.data();
        requests.push({
          id: doc.id,
          ...data
        });
      });

      return requests;

    } catch (error) {
      this.logger.error('Failed to get pending requests:', error);
      throw error;
    }
  }

  /**
   * Auto-assign pending requests to available doctors
   * @returns {Promise<number>} - Number of requests assigned
   */
  async autoAssignPendingRequests() {
    try {
      const pendingRequests = await this.getPendingRequests(20);
      let assignedCount = 0;

      for (const request of pendingRequests) {
        try {
          const bestDoctor = await this.doctorAvailabilityService.findBestMatchingDoctor(
            request.category,
            request.preferredSpecialties
          );

          if (bestDoctor) {
            await this.updateRequestStatus(request.id, 'assigned', 'system', {
              assignedDoctorUsername: bestDoctor.doctorUsername
            });

            // Update the request object for load balancing
            await updateDoc(doc(this.firestore, this.requestsCollection, request.id), {
              assignedDoctorUsername: bestDoctor.doctorUsername
            });

            await this.doctorAvailabilityService.updateDoctorLoad(bestDoctor.doctorUsername, 1);
            assignedCount++;
          }
        } catch (assignError) {
          this.logger.warn(`Failed to auto-assign request ${request.id}:`, assignError);
        }
      }

      if (assignedCount > 0) {
        this.logger.info(`Auto-assigned pending requests`, { assignedCount });
      }

      return assignedCount;

    } catch (error) {
      this.logger.error('Failed to auto-assign pending requests:', error);
      throw error;
    }
  }

  /**
   * Get consultation request statistics
   * @returns {Promise<Object>} - Request statistics
   */
  async getRequestStats() {
    try {
      const [pendingQuery, assignedQuery, completedQuery] = await Promise.all([
        getDocs(query(
          collection(this.firestore, this.requestsCollection),
          where('status', '==', 'pending')
        )),
        getDocs(query(
          collection(this.firestore, this.requestsCollection),
          where('status', '==', 'assigned')
        )),
        getDocs(query(
          collection(this.firestore, this.requestsCollection),
          where('status', '==', 'completed')
        ))
      ]);

      return {
        pendingRequests: pendingQuery.size,
        assignedRequests: assignedQuery.size,
        completedRequests: completedQuery.size,
        totalRequests: pendingQuery.size + assignedQuery.size + completedQuery.size
      };

    } catch (error) {
      this.logger.error('Failed to get request statistics:', error);
      throw error;
    }
  }

  /**
   * Get available health categories
   * @returns {Array<Object>} - Array of health categories with descriptions and specialties
   */
  getHealthCategories() {
    return Object.entries(this.healthCategories).map(([name, details]) => ({
      name,
      description: details.description,
      specialties: details.specialties
    }));
  }

  /**
   * Get category names only
   * @returns {Array<string>} - Array of category names
   */
  getCategoryNames() {
    return Object.keys(this.healthCategories);
  }

  /**
   * Get suggested specialties for a health category
   * @param {string} category - Health category
   * @returns {Array<string>} - Array of suggested specialties
   */
  getSuggestedSpecialties(category) {
    const categoryData = this.healthCategories[category];
    return categoryData ? categoryData.specialties : [];
  }
}

export default ConsultationRequestService;