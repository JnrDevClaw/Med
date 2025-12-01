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
  serverTimestamp
} from 'firebase/firestore';

/**
 * Firestore User Service
 * Handles username → IPFS CID mappings and minimal user metadata in Firestore
 */
export class FirestoreUserService {
  constructor(firestore, logger) {
    this.firestore = firestore;
    this.logger = logger;
    this.usersCollection = 'users';
  }

  /**
   * Create user mapping in Firestore (username → IPFS CID)
   * @param {string} username - User's username
   * @param {string} ipfsCid - IPFS CID containing user profile
   * @param {Object} metadata - Minimal metadata (role, verified status, etc.)
   * @returns {Promise<string>} - Firestore document ID
   */
  async createUserMapping(username, ipfsCid, metadata = {}) {
    try {
      // Check if username already exists
      const existingUser = await this.getUserByUsername(username);
      if (existingUser) {
        throw new Error(`User with username '${username}' already exists`);
      }

      // Prepare user document with minimal data
      const userDoc = {
        username,
        ipfsCid,
        role: metadata.role || 'patient',
        verified: metadata.verified || false,
        email: metadata.email || null,
        passwordHash: metadata.passwordHash || null, // Store hashed password
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        // Remove redundant fields that should be stored in IPFS
        // No firstName, lastName, fullName, personalInfo, etc.
      };

      // Add document to Firestore
      const docRef = await addDoc(collection(this.firestore, this.usersCollection), userDoc);
      
      this.logger.info(`User mapping created in Firestore`, { 
        username, 
        ipfsCid, 
        firestoreId: docRef.id 
      });
      
      return docRef.id;
      
    } catch (error) {
      this.logger.error('Failed to create user mapping:', error);
      throw error;
    }
  }

  /**
   * Get user by username
   * @param {string} username - Username to search for
   * @returns {Promise<Object|null>} - User document or null if not found
   */
  async getUserByUsername(username) {
    try {
      const usersRef = collection(this.firestore, this.usersCollection);
      const q = query(usersRef, where('username', '==', username));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return null;
      }
      
      const userDoc = querySnapshot.docs[0];
      return {
        id: userDoc.id,
        ...userDoc.data()
      };
      
    } catch (error) {
      this.logger.error('Failed to get user by username:', error);
      throw error;
    }
  }

  /**
   * Get user by Firestore document ID
   * @param {string} userId - Firestore document ID
   * @returns {Promise<Object|null>} - User document or null if not found
   */
  async getUserById(userId) {
    try {
      const userDoc = await getDoc(doc(this.firestore, this.usersCollection, userId));
      
      if (!userDoc.exists()) {
        return null;
      }
      
      return {
        id: userDoc.id,
        ...userDoc.data()
      };
      
    } catch (error) {
      this.logger.error('Failed to get user by ID:', error);
      throw error;
    }
  }

  /**
   * Update IPFS CID for user (when profile is updated)
   * @param {string} username - Username to update
   * @param {string} newIpfsCid - New IPFS CID
   * @returns {Promise<void>}
   */
  async updateUserCid(username, newIpfsCid) {
    try {
      const user = await this.getUserByUsername(username);
      if (!user) {
        throw new Error(`User with username '${username}' not found`);
      }

      const userDocRef = doc(this.firestore, this.usersCollection, user.id);
      await updateDoc(userDocRef, {
        ipfsCid: newIpfsCid,
        updatedAt: serverTimestamp()
      });
      
      this.logger.info(`User CID updated in Firestore`, { 
        username, 
        oldCid: user.ipfsCid, 
        newCid: newIpfsCid 
      });
      
    } catch (error) {
      this.logger.error('Failed to update user CID:', error);
      throw error;
    }
  }

  /**
   * Update user metadata (role, verified status, etc.)
   * @param {string} username - Username to update
   * @param {Object} updates - Fields to update
   * @returns {Promise<void>}
   */
  async updateUserMetadata(username, updates) {
    try {
      const user = await this.getUserByUsername(username);
      if (!user) {
        throw new Error(`User with username '${username}' not found`);
      }

      // Filter allowed metadata fields (prevent storing profile data in Firestore)
      const allowedFields = ['role', 'verified', 'email', 'passwordHash'];
      const filteredUpdates = {};
      
      for (const [key, value] of Object.entries(updates)) {
        if (allowedFields.includes(key)) {
          filteredUpdates[key] = value;
        }
      }
      
      if (Object.keys(filteredUpdates).length === 0) {
        this.logger.warn('No valid metadata fields to update', { username, updates });
        return;
      }

      filteredUpdates.updatedAt = serverTimestamp();

      const userDocRef = doc(this.firestore, this.usersCollection, user.id);
      await updateDoc(userDocRef, filteredUpdates);
      
      this.logger.info(`User metadata updated in Firestore`, { 
        username, 
        updates: filteredUpdates 
      });
      
    } catch (error) {
      this.logger.error('Failed to update user metadata:', error);
      throw error;
    }
  }

  /**
   * Get IPFS CID for username
   * @param {string} username - Username to get CID for
   * @returns {Promise<string|null>} - IPFS CID or null if not found
   */
  async getUserCid(username) {
    try {
      const user = await this.getUserByUsername(username);
      return user ? user.ipfsCid : null;
      
    } catch (error) {
      this.logger.error('Failed to get user CID:', error);
      throw error;
    }
  }

  /**
   * Delete user mapping (for cleanup/testing)
   * @param {string} username - Username to delete
   * @returns {Promise<void>}
   */
  async deleteUser(username) {
    try {
      const user = await this.getUserByUsername(username);
      if (!user) {
        throw new Error(`User with username '${username}' not found`);
      }

      const userDocRef = doc(this.firestore, this.usersCollection, user.id);
      await deleteDoc(userDocRef);
      
      this.logger.info(`User deleted from Firestore`, { username, id: user.id });
      
    } catch (error) {
      this.logger.error('Failed to delete user:', error);
      throw error;
    }
  }

  /**
   * Get users by role
   * @param {string} role - Role to filter by ('doctor' or 'patient')
   * @param {boolean} verifiedOnly - Only return verified users
   * @returns {Promise<Array>} - Array of user documents
   */
  async getUsersByRole(role, verifiedOnly = false) {
    try {
      const usersRef = collection(this.firestore, this.usersCollection);
      let q = query(usersRef, where('role', '==', role));
      
      if (verifiedOnly) {
        q = query(usersRef, where('role', '==', role), where('verified', '==', true));
      }
      
      const querySnapshot = await getDocs(q);
      const users = [];
      
      querySnapshot.forEach(doc => {
        users.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      return users;
      
    } catch (error) {
      this.logger.error('Failed to get users by role:', error);
      throw error;
    }
  }

  /**
   * Check if username is available
   * @param {string} username - Username to check
   * @returns {Promise<boolean>} - True if available, false if taken
   */
  async isUsernameAvailable(username) {
    try {
      const user = await this.getUserByUsername(username);
      return user === null;
      
    } catch (error) {
      this.logger.error('Failed to check username availability:', error);
      throw error;
    }
  }

  /**
   * Get user statistics
   * @returns {Promise<Object>} - Statistics about users
   */
  async getUserStats() {
    try {
      const [doctors, patients, verifiedDoctors] = await Promise.all([
        this.getUsersByRole('doctor'),
        this.getUsersByRole('patient'),
        this.getUsersByRole('doctor', true)
      ]);
      
      return {
        totalUsers: doctors.length + patients.length,
        totalDoctors: doctors.length,
        totalPatients: patients.length,
        verifiedDoctors: verifiedDoctors.length,
        unverifiedDoctors: doctors.length - verifiedDoctors.length
      };
      
    } catch (error) {
      this.logger.error('Failed to get user statistics:', error);
      throw error;
    }
  }
}

export default FirestoreUserService;