import IPFSUserService from './ipfsUserService.js';
import FirestoreUserService from './firestoreUserService.js';

/**
 * User Profile Service
 * Orchestrates user profile operations between IPFS and Firestore
 * Implements caching and error handling for profile retrieval
 */
export class UserProfileService {
  constructor(ipfs, firestore, logger) {
    this.ipfsService = new IPFSUserService(ipfs, logger);
    this.firestoreService = new FirestoreUserService(firestore, logger);
    this.logger = logger;
    this.cacheService = null; // Will be injected by performance plugin
    
    // In-memory cache for frequently accessed profiles
    this.profileCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    this.maxCacheSize = 100; // Maximum cached profiles
  }

  /**
   * Inject cache service (called by performance plugin)
   */
  setCacheService(cacheService) {
    this.cacheService = cacheService;
    this.logger.info('Cache service injected into UserProfileService');
  }

  /**
   * Create a new user profile
   * @param {string} username - User's username
   * @param {Object} profileData - Complete profile data
   * @returns {Promise<Object>} - Created user info
   */
  async createUserProfile(username, profileData) {
    try {
      // Validate profile data
      if (!this.ipfsService.validateProfile({ username, ...profileData })) {
        throw new Error('Invalid profile data structure');
      }

      // Check if username is available
      const isAvailable = await this.firestoreService.isUsernameAvailable(username);
      if (!isAvailable) {
        throw new Error(`Username '${username}' is already taken`);
      }

      // Store complete profile on IPFS
      const ipfsCid = await this.ipfsService.storeUserProfile(profileData, username);

      // Create mapping in Firestore
      const firestoreId = await this.firestoreService.createUserMapping(
        username,
        ipfsCid,
        {
          role: profileData.role,
          verified: profileData.verified || false,
          email: profileData.email
        }
      );

      this.logger.info(`User profile created successfully`, { 
        username, 
        ipfsCid, 
        firestoreId 
      });

      return {
        id: firestoreId,
        username,
        ipfsCid,
        role: profileData.role,
        verified: profileData.verified || false
      };

    } catch (error) {
      this.logger.error('Failed to create user profile:', error);
      throw error;
    }
  }

  /**
   * Retrieve complete user profile
   * @param {string} username - Username to retrieve
   * @param {boolean} useCache - Whether to use cached data
   * @returns {Promise<Object>} - Complete user profile
   */
  async getUserProfile(username, useCache = true) {
    try {
      // Check cache first
      if (useCache && this.profileCache.has(username)) {
        const cached = this.profileCache.get(username);
        if (Date.now() - cached.timestamp < this.cacheTimeout) {
          this.logger.debug(`Profile retrieved from cache`, { username });
          return cached.profile;
        } else {
          // Remove expired cache entry
          this.profileCache.delete(username);
        }
      }

      // Get CID from Firestore
      const cid = await this.firestoreService.getUserCid(username);
      if (!cid) {
        throw new Error(`User '${username}' not found`);
      }

      // Retrieve profile from IPFS with retry logic
      let profile;
      let retryCount = 0;
      const maxRetries = 3;

      while (retryCount < maxRetries) {
        try {
          profile = await this.ipfsService.retrieveUserProfile(cid, username);
          break;
        } catch (ipfsError) {
          retryCount++;
          if (retryCount >= maxRetries) {
            this.logger.error(`IPFS retrieval failed after ${maxRetries} attempts`, {
              username,
              cid,
              error: ipfsError.message
            });
            throw new Error('Profile temporarily unavailable due to network issues');
          }
          
          // Exponential backoff
          const delay = Math.pow(2, retryCount) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
          this.logger.warn(`IPFS retrieval attempt ${retryCount} failed, retrying...`, {
            username,
            cid,
            delay
          });
        }
      }

      // Cache the retrieved profile
      this.cacheProfile(username, profile);

      this.logger.info(`Profile retrieved successfully`, { username, cid });
      return profile;

    } catch (error) {
      this.logger.error('Failed to retrieve user profile:', error);
      throw error;
    }
  }

  /**
   * Update user profile
   * @param {string} username - Username to update
   * @param {Object} updates - Profile updates
   * @returns {Promise<string>} - New IPFS CID
   */
  async updateUserProfile(username, updates) {
    try {
      // Get current CID
      const currentCid = await this.firestoreService.getUserCid(username);
      if (!currentCid) {
        throw new Error(`User '${username}' not found`);
      }

      // Update profile on IPFS (creates new CID)
      const newCid = await this.ipfsService.updateUserProfile(currentCid, updates, username);

      // Update CID mapping in Firestore
      await this.firestoreService.updateUserCid(username, newCid);

      // Update metadata in Firestore if needed
      const metadataUpdates = {};
      if (updates.role) metadataUpdates.role = updates.role;
      if (updates.verified !== undefined) metadataUpdates.verified = updates.verified;
      if (updates.email) metadataUpdates.email = updates.email;

      if (Object.keys(metadataUpdates).length > 0) {
        await this.firestoreService.updateUserMetadata(username, metadataUpdates);
      }

      // Invalidate cache
      this.profileCache.delete(username);

      this.logger.info(`Profile updated successfully`, { 
        username, 
        oldCid: currentCid, 
        newCid 
      });

      return newCid;

    } catch (error) {
      this.logger.error('Failed to update user profile:', error);
      throw error;
    }
  }

  /**
   * Get user metadata (from Firestore only)
   * @param {string} username - Username to get metadata for
   * @returns {Promise<Object>} - User metadata
   */
  async getUserMetadata(username) {
    try {
      const user = await this.firestoreService.getUserByUsername(username);
      if (!user) {
        throw new Error(`User '${username}' not found`);
      }

      return {
        id: user.id,
        username: user.username,
        role: user.role,
        verified: user.verified,
        email: user.email,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      };

    } catch (error) {
      this.logger.error('Failed to get user metadata:', error);
      throw error;
    }
  }

  /**
   * Cache user profile
   * @param {string} username - Username
   * @param {Object} profile - Profile data to cache
   */
  cacheProfile(username, profile) {
    // Implement LRU cache behavior
    if (this.profileCache.size >= this.maxCacheSize) {
      // Remove oldest entry
      const firstKey = this.profileCache.keys().next().value;
      this.profileCache.delete(firstKey);
    }

    this.profileCache.set(username, {
      profile,
      timestamp: Date.now()
    });

    this.logger.debug(`Profile cached`, { username, cacheSize: this.profileCache.size });
  }

  /**
   * Clear profile cache
   * @param {string} username - Specific username to clear, or null for all
   */
  clearCache(username = null) {
    if (username) {
      this.profileCache.delete(username);
      this.logger.debug(`Cache cleared for user`, { username });
    } else {
      this.profileCache.clear();
      this.logger.debug(`All profile cache cleared`);
    }
  }

  /**
   * Get cache statistics
   * @returns {Object} - Cache statistics
   */
  getCacheStats() {
    const now = Date.now();
    let validEntries = 0;
    let expiredEntries = 0;

    for (const [username, cached] of this.profileCache.entries()) {
      if (now - cached.timestamp < this.cacheTimeout) {
        validEntries++;
      } else {
        expiredEntries++;
      }
    }

    return {
      totalEntries: this.profileCache.size,
      validEntries,
      expiredEntries,
      maxSize: this.maxCacheSize,
      cacheTimeout: this.cacheTimeout
    };
  }

  /**
   * Health check for IPFS network
   * @returns {Promise<Object>} - Health status
   */
  async healthCheck() {
    try {
      const isIpfsReady = this.ipfsService.ipfs.isReady();
      
      let ipfsLatency = null;
      if (isIpfsReady) {
        const start = Date.now();
        try {
          // Test IPFS with a small test file
          const testData = { test: 'health-check', timestamp: Date.now() };
          const testCid = await this.ipfsService.ipfs.uploadFile(
            Buffer.from(JSON.stringify(testData)), 
            'health-check.json'
          );
          await this.ipfsService.ipfs.getFile(testCid);
          ipfsLatency = Date.now() - start;
        } catch (testError) {
          this.logger.warn('IPFS health check test failed:', testError);
        }
      }

      const cacheStats = this.getCacheStats();

      return {
        status: isIpfsReady ? 'healthy' : 'degraded',
        ipfs: {
          ready: isIpfsReady,
          latency: ipfsLatency
        },
        cache: cacheStats,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      this.logger.error('Health check failed:', error);
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Batch retrieve multiple user profiles
   * @param {Array<string>} usernames - Array of usernames
   * @returns {Promise<Object>} - Map of username to profile
   */
  async batchGetUserProfiles(usernames) {
    try {
      const results = {};
      const promises = usernames.map(async (username) => {
        try {
          const profile = await this.getUserProfile(username);
          results[username] = profile;
        } catch (error) {
          this.logger.warn(`Failed to retrieve profile for ${username}:`, error);
          results[username] = { error: error.message };
        }
      });

      await Promise.all(promises);
      return results;

    } catch (error) {
      this.logger.error('Batch profile retrieval failed:', error);
      throw error;
    }
  }
}

export default UserProfileService;