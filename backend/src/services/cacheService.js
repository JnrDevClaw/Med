import NodeCache from 'node-cache';

/**
 * Cache Service
 * Implements caching strategies for IPFS data and other frequently accessed data
 */
export class CacheService {
  constructor(logger, options = {}) {
    this.logger = logger;
    
    // Initialize different cache instances for different data types
    this.ipfsCache = new NodeCache({
      stdTTL: options.ipfsTTL || 300, // 5 minutes default
      checkperiod: options.ipfsCheckPeriod || 60, // Check for expired keys every minute
      useClones: false, // Don't clone objects for better performance
      maxKeys: options.ipfsMaxKeys || 1000
    });

    this.userProfileCache = new NodeCache({
      stdTTL: options.userProfileTTL || 600, // 10 minutes default
      checkperiod: options.userProfileCheckPeriod || 120,
      useClones: false,
      maxKeys: options.userProfileMaxKeys || 500
    });

    this.queryCache = new NodeCache({
      stdTTL: options.queryTTL || 180, // 3 minutes default
      checkperiod: options.queryCheckPeriod || 60,
      useClones: false,
      maxKeys: options.queryMaxKeys || 2000
    });

    this.notificationCache = new NodeCache({
      stdTTL: options.notificationTTL || 120, // 2 minutes default
      checkperiod: options.notificationCheckPeriod || 30,
      useClones: false,
      maxKeys: options.notificationMaxKeys || 1000
    });

    // Cache statistics
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0
    };

    // Set up cache event listeners
    this.setupEventListeners();
  }

  setupEventListeners() {
    // IPFS Cache events
    this.ipfsCache.on('set', (key, value) => {
      this.stats.sets++;
      this.logger.debug('IPFS cache set', { key, size: JSON.stringify(value).length });
    });

    this.ipfsCache.on('del', (key, value) => {
      this.stats.deletes++;
      this.logger.debug('IPFS cache delete', { key });
    });

    this.ipfsCache.on('expired', (key, value) => {
      this.logger.debug('IPFS cache expired', { key });
    });

    // User Profile Cache events
    this.userProfileCache.on('set', (key, value) => {
      this.logger.debug('User profile cache set', { key });
    });

    this.userProfileCache.on('expired', (key, value) => {
      this.logger.debug('User profile cache expired', { key });
    });

    // Query Cache events
    this.queryCache.on('set', (key, value) => {
      this.logger.debug('Query cache set', { key });
    });

    this.queryCache.on('expired', (key, value) => {
      this.logger.debug('Query cache expired', { key });
    });
  }

  /**
   * IPFS Data Caching
   */
  async getIPFSData(cid, fetchFunction) {
    const key = `ipfs:${cid}`;
    
    // Try to get from cache first
    const cached = this.ipfsCache.get(key);
    if (cached) {
      this.stats.hits++;
      this.logger.debug('IPFS cache hit', { cid });
      return cached;
    }

    // Cache miss - fetch data
    this.stats.misses++;
    this.logger.debug('IPFS cache miss', { cid });
    
    try {
      const data = await fetchFunction(cid);
      
      // Cache the data with longer TTL for larger objects
      const dataSize = JSON.stringify(data).length;
      const ttl = dataSize > 10000 ? 600 : 300; // 10 minutes for large objects, 5 for small
      
      this.ipfsCache.set(key, data, ttl);
      return data;
    } catch (error) {
      this.logger.error('Failed to fetch IPFS data', { cid, error: error.message });
      throw error;
    }
  }

  /**
   * User Profile Caching
   */
  async getUserProfile(username, fetchFunction) {
    const key = `profile:${username}`;
    
    const cached = this.userProfileCache.get(key);
    if (cached) {
      this.stats.hits++;
      return cached;
    }

    this.stats.misses++;
    
    try {
      const profile = await fetchFunction(username);
      this.userProfileCache.set(key, profile);
      return profile;
    } catch (error) {
      this.logger.error('Failed to fetch user profile', { username, error: error.message });
      throw error;
    }
  }

  /**
   * Query Result Caching
   */
  async getQueryResult(queryKey, fetchFunction, ttl = null) {
    const key = `query:${queryKey}`;
    
    const cached = this.queryCache.get(key);
    if (cached) {
      this.stats.hits++;
      return cached;
    }

    this.stats.misses++;
    
    try {
      const result = await fetchFunction();
      this.queryCache.set(key, result, ttl || 180);
      return result;
    } catch (error) {
      this.logger.error('Failed to execute query', { queryKey, error: error.message });
      throw error;
    }
  }

  /**
   * Notification Caching
   */
  async getNotifications(username, options, fetchFunction) {
    const key = `notifications:${username}:${JSON.stringify(options)}`;
    
    const cached = this.notificationCache.get(key);
    if (cached) {
      this.stats.hits++;
      return cached;
    }

    this.stats.misses++;
    
    try {
      const notifications = await fetchFunction(username, options);
      this.notificationCache.set(key, notifications);
      return notifications;
    } catch (error) {
      this.logger.error('Failed to fetch notifications', { username, error: error.message });
      throw error;
    }
  }

  /**
   * Cache Management
   */
  invalidateIPFSCache(cid) {
    const key = `ipfs:${cid}`;
    this.ipfsCache.del(key);
    this.logger.debug('IPFS cache invalidated', { cid });
  }

  invalidateUserProfile(username) {
    const key = `profile:${username}`;
    this.userProfileCache.del(key);
    this.logger.debug('User profile cache invalidated', { username });
  }

  invalidateQueryCache(pattern) {
    const keys = this.queryCache.keys();
    const matchingKeys = keys.filter(key => key.includes(pattern));
    
    matchingKeys.forEach(key => {
      this.queryCache.del(key);
    });
    
    this.logger.debug('Query cache invalidated', { pattern, count: matchingKeys.length });
  }

  invalidateNotificationCache(username) {
    const keys = this.notificationCache.keys();
    const matchingKeys = keys.filter(key => key.includes(`notifications:${username}`));
    
    matchingKeys.forEach(key => {
      this.notificationCache.del(key);
    });
    
    this.logger.debug('Notification cache invalidated', { username, count: matchingKeys.length });
  }

  /**
   * Bulk Cache Operations
   */
  preloadUserProfiles(usernames, fetchFunction) {
    const promises = usernames.map(async (username) => {
      try {
        await this.getUserProfile(username, fetchFunction);
      } catch (error) {
        this.logger.warn('Failed to preload user profile', { username, error: error.message });
      }
    });

    return Promise.allSettled(promises);
  }

  preloadIPFSData(cids, fetchFunction) {
    const promises = cids.map(async (cid) => {
      try {
        await this.getIPFSData(cid, fetchFunction);
      } catch (error) {
        this.logger.warn('Failed to preload IPFS data', { cid, error: error.message });
      }
    });

    return Promise.allSettled(promises);
  }

  /**
   * Cache Statistics and Monitoring
   */
  getStats() {
    return {
      ...this.stats,
      hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0,
      caches: {
        ipfs: {
          keys: this.ipfsCache.keys().length,
          stats: this.ipfsCache.getStats()
        },
        userProfile: {
          keys: this.userProfileCache.keys().length,
          stats: this.userProfileCache.getStats()
        },
        query: {
          keys: this.queryCache.keys().length,
          stats: this.queryCache.getStats()
        },
        notification: {
          keys: this.notificationCache.keys().length,
          stats: this.notificationCache.getStats()
        }
      }
    };
  }

  /**
   * Cache Warming Strategies
   */
  async warmCache() {
    this.logger.info('Starting cache warming...');
    
    try {
      // Warm up frequently accessed data
      // This would be called during application startup
      
      this.logger.info('Cache warming completed');
    } catch (error) {
      this.logger.error('Cache warming failed', { error: error.message });
    }
  }

  /**
   * Memory Management
   */
  clearAllCaches() {
    this.ipfsCache.flushAll();
    this.userProfileCache.flushAll();
    this.queryCache.flushAll();
    this.notificationCache.flushAll();
    
    this.logger.info('All caches cleared');
  }

  clearExpiredKeys() {
    const beforeKeys = this.getTotalKeys();
    
    // Force cleanup of expired keys
    [this.ipfsCache, this.userProfileCache, this.queryCache, this.notificationCache]
      .forEach(cache => cache.keys()); // This triggers cleanup
    
    const afterKeys = this.getTotalKeys();
    const cleaned = beforeKeys - afterKeys;
    
    this.logger.info('Expired keys cleaned', { cleaned, remaining: afterKeys });
    return cleaned;
  }

  getTotalKeys() {
    return this.ipfsCache.keys().length + 
           this.userProfileCache.keys().length + 
           this.queryCache.keys().length + 
           this.notificationCache.keys().length;
  }

  /**
   * Cache Health Check
   */
  healthCheck() {
    const stats = this.getStats();
    const totalKeys = this.getTotalKeys();
    const hitRate = stats.hitRate;
    
    const health = {
      status: 'healthy',
      totalKeys,
      hitRate: Math.round(hitRate * 100),
      issues: []
    };

    // Check for potential issues
    if (hitRate < 0.5) {
      health.issues.push('Low cache hit rate');
      health.status = 'warning';
    }

    if (totalKeys > 3000) {
      health.issues.push('High memory usage');
      health.status = 'warning';
    }

    if (totalKeys > 5000) {
      health.status = 'critical';
    }

    return health;
  }

  /**
   * Adaptive TTL based on access patterns
   */
  setAdaptiveTTL(key, value, accessCount = 1) {
    let ttl = 300; // Default 5 minutes
    
    // Increase TTL for frequently accessed items
    if (accessCount > 10) {
      ttl = 900; // 15 minutes
    } else if (accessCount > 5) {
      ttl = 600; // 10 minutes
    }
    
    // Adjust TTL based on data size
    const dataSize = JSON.stringify(value).length;
    if (dataSize > 50000) { // Large objects
      ttl = Math.min(ttl * 2, 1800); // Max 30 minutes
    }
    
    return ttl;
  }
}

export default CacheService;