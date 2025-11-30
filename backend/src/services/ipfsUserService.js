import crypto from 'crypto';

/**
 * IPFS User Data Service
 * Handles storing and retrieving complete user profiles on IPFS with encryption
 */
export class IPFSUserService {
  constructor(ipfs, logger) {
    this.ipfs = ipfs;
    this.logger = logger;
    this.algorithm = 'aes-256-gcm';
    this.keyLength = 32; // 256 bits
  }

  /**
   * Generate encryption key from username (deterministic)
   * @param {string} username - User's username
   * @returns {Buffer} - Encryption key
   */
  generateEncryptionKey(username) {
    // Use PBKDF2 to derive a consistent key from username
    const salt = Buffer.from('medconnect-salt-2024', 'utf8'); // Fixed salt for consistency
    return crypto.pbkdf2Sync(username, salt, 100000, this.keyLength, 'sha256');
  }

  /**
   * Encrypt user data before IPFS storage
   * @param {Object} userData - User profile data to encrypt
   * @param {string} username - Username for key derivation
   * @returns {Object} - Encrypted data with metadata
   */
  encryptUserData(userData, username) {
    try {
      const key = this.generateEncryptionKey(username);
      const iv = crypto.randomBytes(16); // Random IV for each encryption
      const cipher = crypto.createCipherGCM(this.algorithm, key, iv);
      cipher.setAAD(Buffer.from(username, 'utf8')); // Additional authenticated data
      
      const dataString = JSON.stringify(userData);
      let encrypted = cipher.update(dataString, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      return {
        encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
        algorithm: this.algorithm,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('Encryption failed:', error);
      throw new Error('Failed to encrypt user data');
    }
  }

  /**
   * Decrypt user data retrieved from IPFS
   * @param {Object} encryptedData - Encrypted data from IPFS
   * @param {string} username - Username for key derivation
   * @returns {Object} - Decrypted user data
   */
  decryptUserData(encryptedData, username) {
    try {
      const key = this.generateEncryptionKey(username);
      const iv = Buffer.from(encryptedData.iv, 'hex');
      const decipher = crypto.createDecipherGCM(encryptedData.algorithm, key, iv);
      
      decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
      decipher.setAAD(Buffer.from(username, 'utf8'));
      
      let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return JSON.parse(decrypted);
    } catch (error) {
      this.logger.error('Decryption failed:', error);
      throw new Error('Failed to decrypt user data');
    }
  }

  /**
   * Store complete user profile on IPFS
   * @param {Object} userProfile - Complete user profile data
   * @param {string} username - Username for encryption and identification
   * @returns {Promise<string>} - IPFS CID of stored data
   */
  async storeUserProfile(userProfile, username) {
    try {
      if (!this.ipfs.isReady()) {
        throw new Error('IPFS service not ready');
      }

      // Validate required fields
      if (!userProfile || !username) {
        throw new Error('User profile and username are required');
      }

      // Add metadata to profile
      const profileWithMetadata = {
        ...userProfile,
        username,
        version: '1.0',
        createdAt: userProfile.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Encrypt the profile data
      const encryptedData = this.encryptUserData(profileWithMetadata, username);
      
      // Convert to buffer for IPFS storage
      const dataBuffer = Buffer.from(JSON.stringify(encryptedData), 'utf8');
      
      // Store on IPFS
      const cid = await this.ipfs.uploadFile(dataBuffer, `${username}_profile_encrypted.json`);
      
      this.logger.info(`User profile stored on IPFS`, { username, cid });
      return cid;
      
    } catch (error) {
      this.logger.error('Failed to store user profile on IPFS:', error);
      throw error;
    }
  }

  /**
   * Retrieve and decrypt user profile from IPFS
   * @param {string} cid - IPFS CID of the stored profile
   * @param {string} username - Username for decryption
   * @returns {Promise<Object>} - Decrypted user profile
   */
  async retrieveUserProfile(cid, username) {
    try {
      if (!this.ipfs.isReady()) {
        throw new Error('IPFS service not ready');
      }

      if (!cid || !username) {
        throw new Error('CID and username are required');
      }

      // Retrieve encrypted data from IPFS
      const encryptedBuffer = await this.ipfs.getFile(cid);
      const encryptedData = JSON.parse(encryptedBuffer.toString('utf8'));
      
      // Decrypt the profile data
      const decryptedProfile = this.decryptUserData(encryptedData, username);
      
      this.logger.info(`User profile retrieved from IPFS`, { username, cid });
      return decryptedProfile;
      
    } catch (error) {
      this.logger.error('Failed to retrieve user profile from IPFS:', error);
      throw error;
    }
  }

  /**
   * Update user profile on IPFS (creates new CID)
   * @param {string} oldCid - Previous IPFS CID
   * @param {Object} updatedProfile - Updated profile data
   * @param {string} username - Username for encryption
   * @returns {Promise<string>} - New IPFS CID
   */
  async updateUserProfile(oldCid, updatedProfile, username) {
    try {
      // Retrieve existing profile
      const existingProfile = await this.retrieveUserProfile(oldCid, username);
      
      // Merge with updates
      const mergedProfile = {
        ...existingProfile,
        ...updatedProfile,
        username, // Ensure username consistency
        updatedAt: new Date().toISOString()
      };
      
      // Store updated profile (creates new CID)
      const newCid = await this.storeUserProfile(mergedProfile, username);
      
      this.logger.info(`User profile updated on IPFS`, { username, oldCid, newCid });
      return newCid;
      
    } catch (error) {
      this.logger.error('Failed to update user profile on IPFS:', error);
      throw error;
    }
  }

  /**
   * Validate user profile structure
   * @param {Object} profile - Profile to validate
   * @returns {boolean} - True if valid
   */
  validateProfile(profile) {
    const requiredFields = ['username', 'role'];
    const validRoles = ['doctor', 'patient'];
    
    if (!profile || typeof profile !== 'object') {
      return false;
    }
    
    for (const field of requiredFields) {
      if (!profile[field]) {
        return false;
      }
    }
    
    if (!validRoles.includes(profile.role)) {
      return false;
    }
    
    return true;
  }
}

export default IPFSUserService;