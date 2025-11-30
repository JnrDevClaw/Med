/**
 * Verification Cache Service
 * Caches doctor verification status to reduce database queries
 */
export class VerificationCacheService {
  constructor(logger) {
    this.logger = logger;
    this.cache = new Map();
    this.cacheTTL = 5 * 60 * 1000; // 5 minutes in milliseconds
    
    // Clean up expired entries every minute
    setInterval(() => {
      this.cleanupExpiredEntries();
    }, 60 * 1000);
  }

  /**
   * Get verification status from cache
   * @param {string} userId - User ID
   * @returns {boolean|null} - Verification status or null if not cached/expired
   */
  getVerificationStatus(userId) {
    const entry = this.cache.get(userId);
    
    if (!entry) {
      return null;
    }

    // Check if entry has expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(userId);
      return null;
    }

    this.logger.debug('Verification status retrieved from cache', { userId, verified: entry.verified });
    return entry.verified;
  }

  /**
   * Set verification status in cache
   * @param {string} userId - User ID
   * @param {boolean} verified - Verification status
   */
  setVerificationStatus(userId, verified) {
    const entry = {
      verified,
      cachedAt: Date.now(),
      expiresAt: Date.now() + this.cacheTTL
    };

    this.cache.set(userId, entry);
    this.logger.debug('Verification status cached', { userId, verified, expiresAt: entry.expiresAt });
  }

  /**
   * Invalidate cache entry for a user
   * @param {string} userId - User ID
   */
  invalidateUser(userId) {
    const deleted = this.cache.delete(userId);
    if (deleted) {
      this.logger.debug('Verification cache invalidated for user', { userId });
    }
  }

  /**
   * Clear all cache entries
   */
  clearAll() {
    const size = this.cache.size;
    this.cache.clear();
    this.logger.info('Verification cache cleared', { entriesRemoved: size });
  }

  /**
   * Clean up expired cache entries
   */
  cleanupExpiredEntries() {
    const now = Date.now();
    let removedCount = 0;

    for (const [userId, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(userId);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      this.logger.debug('Expired verification cache entries cleaned up', { removedCount });
    }
  }

  /**
   * Get cache statistics
   * @returns {Object} - Cache statistics
   */
  getStats() {
    const now = Date.now();
    let activeEntries = 0;
    let expiredEntries = 0;

    for (const entry of this.cache.values()) {
      if (now > entry.expiresAt) {
        expiredEntries++;
      } else {
        activeEntries++;
      }
    }

    return {
      totalEntries: this.cache.size,
      activeEntries,
      expiredEntries,
      cacheTTL: this.cacheTTL
    };
  }
}

export default VerificationCacheService;