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
 * Doctor Availability Service
 * Manages doctor online status, specialties, and availability for consultations
 */
export class DoctorAvailabilityService {
  constructor(firestore, logger) {
    this.firestore = firestore;
    this.logger = logger;
    this.availabilityCollection = 'doctor_availability';
    this.specialtiesCollection = 'doctor_specialties';
    
    // In-memory cache for online doctors
    this.onlineDoctorsCache = new Map();
    this.cacheTimeout = 30 * 1000; // 30 seconds
  }

  /**
   * Set doctor online status
   * @param {string} doctorUsername - Doctor's username
   * @param {boolean} isOnline - Online status
   * @param {Array<string>} specialties - Doctor's specialties
   * @returns {Promise<void>}
   */
  async setDoctorAvailability(doctorUsername, isOnline, specialties = []) {
    try {
      // Check if doctor exists and is verified
      const doctorQuery = query(
        collection(this.firestore, 'users'),
        where('username', '==', doctorUsername),
        where('role', '==', 'doctor'),
        where('verified', '==', true)
      );
      
      const doctorSnapshot = await getDocs(doctorQuery);
      if (doctorSnapshot.empty) {
        throw new Error(`Verified doctor '${doctorUsername}' not found`);
      }

      // Check if availability record exists
      const availabilityQuery = query(
        collection(this.firestore, this.availabilityCollection),
        where('doctorUsername', '==', doctorUsername)
      );
      
      const availabilitySnapshot = await getDocs(availabilityQuery);
      
      const availabilityData = {
        doctorUsername,
        isOnline,
        specialties,
        currentLoad: 0, // Will be updated when consultations are active
        lastSeen: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      if (availabilitySnapshot.empty) {
        // Create new availability record
        availabilityData.createdAt = serverTimestamp();
        await addDoc(collection(this.firestore, this.availabilityCollection), availabilityData);
        this.logger.info(`Doctor availability created`, { doctorUsername, isOnline });
      } else {
        // Update existing record
        const availabilityDoc = availabilitySnapshot.docs[0];
        await updateDoc(doc(this.firestore, this.availabilityCollection, availabilityDoc.id), availabilityData);
        this.logger.info(`Doctor availability updated`, { doctorUsername, isOnline });
      }

      // Update cache
      if (isOnline) {
        this.onlineDoctorsCache.set(doctorUsername, {
          ...availabilityData,
          timestamp: Date.now()
        });
      } else {
        this.onlineDoctorsCache.delete(doctorUsername);
      }

    } catch (error) {
      this.logger.error('Failed to set doctor availability:', error);
      throw error;
    }
  }

  /**
   * Get online doctors with optional filtering
   * @param {Object} filters - Filtering options
   * @param {Array<string>} filters.specialties - Filter by specialties
   * @param {number} filters.maxLoad - Maximum current consultation load
   * @param {number} filters.limit - Maximum number of doctors to return
   * @returns {Promise<Array>} - Array of available doctors
   */
  async getAvailableDoctors(filters = {}) {
    try {
      const { specialties = [], maxLoad = 5, limit = 10 } = filters;

      // Build query
      let availabilityQuery = query(
        collection(this.firestore, this.availabilityCollection),
        where('isOnline', '==', true)
      );

      // Add load balancing filter
      if (maxLoad !== undefined) {
        availabilityQuery = query(
          availabilityQuery,
          where('currentLoad', '<=', maxLoad)
        );
      }

      // Add ordering and limit
      availabilityQuery = query(
        availabilityQuery,
        orderBy('currentLoad', 'asc'), // Prefer doctors with lower load
        orderBy('lastSeen', 'desc'), // Then by most recently seen
        firestoreLimit(limit)
      );

      const snapshot = await getDocs(availabilityQuery);
      let doctors = [];

      snapshot.forEach(doc => {
        const data = doc.data();
        doctors.push({
          id: doc.id,
          doctorUsername: data.doctorUsername,
          isOnline: data.isOnline,
          specialties: data.specialties || [],
          currentLoad: data.currentLoad || 0,
          lastSeen: data.lastSeen,
          updatedAt: data.updatedAt
        });
      });

      // Filter by specialties if specified (client-side filtering for array contains)
      if (specialties.length > 0) {
        doctors = doctors.filter(doctor => 
          specialties.some(specialty => 
            doctor.specialties.includes(specialty)
          )
        );
      }

      this.logger.info(`Retrieved available doctors`, { 
        count: doctors.length, 
        filters 
      });

      return doctors;

    } catch (error) {
      this.logger.error('Failed to get available doctors:', error);
      throw error;
    }
  }

  /**
   * Find best matching doctor for a consultation request
   * @param {string} category - Health issue category
   * @param {Array<string>} preferredSpecialties - Preferred doctor specialties
   * @returns {Promise<Object|null>} - Best matching doctor or null
   */
  async findBestMatchingDoctor(category, preferredSpecialties = []) {
    try {
      // Get all available doctors
      const availableDoctors = await this.getAvailableDoctors({
        specialties: preferredSpecialties,
        maxLoad: 3, // Prefer doctors with lower load
        limit: 20
      });

      if (availableDoctors.length === 0) {
        return null;
      }

      // Scoring algorithm for doctor matching
      const scoredDoctors = availableDoctors.map(doctor => {
        let score = 0;

        // Base score for being available
        score += 10;

        // Bonus for specialty match
        if (preferredSpecialties.length > 0) {
          const matchingSpecialties = doctor.specialties.filter(specialty =>
            preferredSpecialties.includes(specialty)
          );
          score += matchingSpecialties.length * 20;
        }

        // Penalty for high load (load balancing)
        score -= doctor.currentLoad * 5;

        // Bonus for recent activity
        const lastSeenTime = doctor.lastSeen?.toDate?.() || new Date(doctor.lastSeen);
        const timeSinceLastSeen = Date.now() - lastSeenTime.getTime();
        const minutesSinceLastSeen = timeSinceLastSeen / (1000 * 60);
        
        if (minutesSinceLastSeen < 5) {
          score += 15; // Very recent activity
        } else if (minutesSinceLastSeen < 15) {
          score += 10; // Recent activity
        } else if (minutesSinceLastSeen < 60) {
          score += 5; // Moderately recent
        }

        return {
          ...doctor,
          matchScore: score
        };
      });

      // Sort by score (highest first)
      scoredDoctors.sort((a, b) => b.matchScore - a.matchScore);

      const bestMatch = scoredDoctors[0];
      
      this.logger.info(`Found best matching doctor`, {
        doctorUsername: bestMatch.doctorUsername,
        matchScore: bestMatch.matchScore,
        category,
        preferredSpecialties
      });

      return bestMatch;

    } catch (error) {
      this.logger.error('Failed to find best matching doctor:', error);
      throw error;
    }
  }

  /**
   * Update doctor's current consultation load
   * @param {string} doctorUsername - Doctor's username
   * @param {number} loadChange - Change in load (+1 for new consultation, -1 for completed)
   * @returns {Promise<void>}
   */
  async updateDoctorLoad(doctorUsername, loadChange) {
    try {
      const availabilityQuery = query(
        collection(this.firestore, this.availabilityCollection),
        where('doctorUsername', '==', doctorUsername)
      );
      
      const snapshot = await getDocs(availabilityQuery);
      if (snapshot.empty) {
        throw new Error(`Doctor availability record not found for '${doctorUsername}'`);
      }

      const availabilityDoc = snapshot.docs[0];
      const currentData = availabilityDoc.data();
      const newLoad = Math.max(0, (currentData.currentLoad || 0) + loadChange);

      await updateDoc(doc(this.firestore, this.availabilityCollection, availabilityDoc.id), {
        currentLoad: newLoad,
        updatedAt: serverTimestamp()
      });

      // Update cache if doctor is online
      if (this.onlineDoctorsCache.has(doctorUsername)) {
        const cached = this.onlineDoctorsCache.get(doctorUsername);
        cached.currentLoad = newLoad;
        this.onlineDoctorsCache.set(doctorUsername, cached);
      }

      this.logger.info(`Doctor load updated`, { 
        doctorUsername, 
        loadChange, 
        newLoad 
      });

    } catch (error) {
      this.logger.error('Failed to update doctor load:', error);
      throw error;
    }
  }

  /**
   * Get doctor availability status
   * @param {string} doctorUsername - Doctor's username
   * @returns {Promise<Object|null>} - Doctor availability info or null
   */
  async getDoctorAvailability(doctorUsername) {
    try {
      // Check cache first
      if (this.onlineDoctorsCache.has(doctorUsername)) {
        const cached = this.onlineDoctorsCache.get(doctorUsername);
        if (Date.now() - cached.timestamp < this.cacheTimeout) {
          return cached;
        }
      }

      const availabilityQuery = query(
        collection(this.firestore, this.availabilityCollection),
        where('doctorUsername', '==', doctorUsername)
      );
      
      const snapshot = await getDocs(availabilityQuery);
      if (snapshot.empty) {
        return null;
      }

      const availabilityDoc = snapshot.docs[0];
      const data = availabilityDoc.data();

      const availability = {
        id: availabilityDoc.id,
        doctorUsername: data.doctorUsername,
        isOnline: data.isOnline,
        specialties: data.specialties || [],
        currentLoad: data.currentLoad || 0,
        lastSeen: data.lastSeen,
        updatedAt: data.updatedAt
      };

      // Update cache if online
      if (data.isOnline) {
        this.onlineDoctorsCache.set(doctorUsername, {
          ...availability,
          timestamp: Date.now()
        });
      }

      return availability;

    } catch (error) {
      this.logger.error('Failed to get doctor availability:', error);
      throw error;
    }
  }

  /**
   * Set doctor as offline (cleanup when disconnecting)
   * @param {string} doctorUsername - Doctor's username
   * @returns {Promise<void>}
   */
  async setDoctorOffline(doctorUsername) {
    try {
      await this.setDoctorAvailability(doctorUsername, false);
      this.onlineDoctorsCache.delete(doctorUsername);
      
      this.logger.info(`Doctor set offline`, { doctorUsername });

    } catch (error) {
      this.logger.error('Failed to set doctor offline:', error);
      throw error;
    }
  }

  /**
   * Clean up stale availability records (doctors who haven't been seen recently)
   * @param {number} staleMinutes - Minutes after which to consider a doctor stale
   * @returns {Promise<number>} - Number of records cleaned up
   */
  async cleanupStaleAvailability(staleMinutes = 10) {
    try {
      const staleTime = new Date(Date.now() - staleMinutes * 60 * 1000);
      
      const availabilityQuery = query(
        collection(this.firestore, this.availabilityCollection),
        where('isOnline', '==', true),
        where('lastSeen', '<', staleTime)
      );
      
      const snapshot = await getDocs(availabilityQuery);
      let cleanedCount = 0;

      for (const docSnapshot of snapshot.docs) {
        const data = docSnapshot.data();
        
        // Set as offline
        await updateDoc(doc(this.firestore, this.availabilityCollection, docSnapshot.id), {
          isOnline: false,
          updatedAt: serverTimestamp()
        });

        // Remove from cache
        this.onlineDoctorsCache.delete(data.doctorUsername);
        cleanedCount++;
      }

      if (cleanedCount > 0) {
        this.logger.info(`Cleaned up stale availability records`, { 
          cleanedCount, 
          staleMinutes 
        });
      }

      return cleanedCount;

    } catch (error) {
      this.logger.error('Failed to cleanup stale availability:', error);
      throw error;
    }
  }

  /**
   * Get availability statistics
   * @returns {Promise<Object>} - Availability statistics
   */
  async getAvailabilityStats() {
    try {
      const [onlineQuery, totalQuery] = await Promise.all([
        getDocs(query(
          collection(this.firestore, this.availabilityCollection),
          where('isOnline', '==', true)
        )),
        getDocs(collection(this.firestore, this.availabilityCollection))
      ]);

      const onlineDoctors = [];
      const totalLoad = onlineQuery.docs.reduce((sum, doc) => {
        const data = doc.data();
        onlineDoctors.push(data.doctorUsername);
        return sum + (data.currentLoad || 0);
      }, 0);

      return {
        totalDoctors: totalQuery.size,
        onlineDoctors: onlineQuery.size,
        offlineDoctors: totalQuery.size - onlineQuery.size,
        totalActiveConsultations: totalLoad,
        averageLoad: onlineQuery.size > 0 ? (totalLoad / onlineQuery.size).toFixed(2) : 0,
        cacheSize: this.onlineDoctorsCache.size
      };

    } catch (error) {
      this.logger.error('Failed to get availability statistics:', error);
      throw error;
    }
  }
}

export default DoctorAvailabilityService;