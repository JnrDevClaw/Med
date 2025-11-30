import fp from 'fastify-plugin';
import CacheService from '../services/cacheService.js';
import DatabaseOptimizationService from '../services/databaseOptimizationService.js';

/**
 * Performance Plugin
 * Registers caching and database optimization services
 */
async function performancePlugin(fastify, options) {
  // Initialize cache service
  const cacheService = new CacheService(fastify.log, {
    ipfsTTL: parseInt(process.env.CACHE_IPFS_TTL || '300'),
    userProfileTTL: parseInt(process.env.CACHE_USER_PROFILE_TTL || '600'),
    queryTTL: parseInt(process.env.CACHE_QUERY_TTL || '180'),
    notificationTTL: parseInt(process.env.CACHE_NOTIFICATION_TTL || '120'),
    ipfsMaxKeys: parseInt(process.env.CACHE_IPFS_MAX_KEYS || '1000'),
    userProfileMaxKeys: parseInt(process.env.CACHE_USER_PROFILE_MAX_KEYS || '500'),
    queryMaxKeys: parseInt(process.env.CACHE_QUERY_MAX_KEYS || '2000'),
    notificationMaxKeys: parseInt(process.env.CACHE_NOTIFICATION_MAX_KEYS || '1000')
  });

  // Initialize database optimization service
  const dbOptimizationService = new DatabaseOptimizationService(
    fastify.firestore,
    fastify.log,
    cacheService
  );

  // Register services
  fastify.decorate('cacheService', cacheService);
  fastify.decorate('dbOptimization', dbOptimizationService);

  // Inject cache service into user profile service if available
  if (fastify.userProfileService) {
    fastify.userProfileService.setCacheService(cacheService);
  }

  // Add performance monitoring hooks
  fastify.addHook('onRequest', async (request, reply) => {
    request.startTime = Date.now();
  });

  fastify.addHook('onResponse', async (request, reply) => {
    const responseTime = Date.now() - request.startTime;
    
    // Log slow requests
    if (responseTime > 2000) {
      fastify.log.warn('Slow request detected', {
        method: request.method,
        url: request.url,
        responseTime,
        statusCode: reply.statusCode
      });
    }

    // Add performance headers
    reply.header('X-Response-Time', `${responseTime}ms`);
  });

  // Rate limiting helper
  const rateLimiter = dbOptimizationService.createRateLimiter(
    parseInt(process.env.RATE_LIMIT_MAX || '100'),
    parseInt(process.env.RATE_LIMIT_WINDOW || '60000')
  );

  fastify.decorate('checkRateLimit', async function(identifier) {
    return await rateLimiter.checkLimit(identifier);
  });

  // Enhanced pagination helper
  fastify.decorate('getPaginatedResults', async function(collectionName, options = {}) {
    return await dbOptimizationService.getPaginatedResults(collectionName, options);
  });

  // Cached query helper
  fastify.decorate('getCachedQuery', async function(queryKey, fetchFunction, ttl = null) {
    return await cacheService.getQueryResult(queryKey, fetchFunction, ttl);
  });

  // IPFS caching helper
  fastify.decorate('getCachedIPFSData', async function(cid, fetchFunction) {
    return await cacheService.getIPFSData(cid, fetchFunction);
  });

  // User profile caching helper
  fastify.decorate('getCachedUserProfile', async function(username, fetchFunction) {
    return await cacheService.getUserProfile(username, fetchFunction);
  });

  // Cache invalidation helpers
  fastify.decorate('invalidateUserProfileCache', function(username) {
    cacheService.invalidateUserProfile(username);
  });

  fastify.decorate('invalidateQueryCache', function(pattern) {
    cacheService.invalidateQueryCache(pattern);
  });

  fastify.decorate('invalidateNotificationCache', function(username) {
    cacheService.invalidateNotificationCache(username);
  });

  // Lazy loading helper
  fastify.decorate('createLazyLoader', function(collectionName, baseQuery, batchSize = null) {
    return dbOptimizationService.createLazyLoader(collectionName, baseQuery, batchSize);
  });

  // Performance monitoring routes
  fastify.get('/api/performance/stats', {
    schema: {
      tags: ['performance'],
      summary: 'Get performance statistics',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            stats: { type: 'object' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const stats = dbOptimizationService.getPerformanceReport();
      
      return {
        success: true,
        stats
      };
    } catch (error) {
      fastify.log.error('Failed to get performance stats:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to retrieve performance statistics'
      });
    }
  });

  fastify.get('/api/performance/health', {
    schema: {
      tags: ['performance'],
      summary: 'Get system health check',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            health: { type: 'object' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const health = await dbOptimizationService.performHealthCheck();
      
      return {
        success: true,
        health
      };
    } catch (error) {
      fastify.log.error('Failed to perform health check:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to perform health check'
      });
    }
  });

  // Cache management routes (development only)
  if (process.env.NODE_ENV === 'development') {
    fastify.post('/api/performance/cache/clear', {
      schema: {
        tags: ['performance'],
        summary: 'Clear all caches (development only)'
      }
    }, async (request, reply) => {
      try {
        cacheService.clearAllCaches();
        
        return {
          success: true,
          message: 'All caches cleared'
        };
      } catch (error) {
        fastify.log.error('Failed to clear caches:', error);
        return reply.code(500).send({
          success: false,
          error: 'Failed to clear caches'
        });
      }
    });

    fastify.post('/api/performance/cache/cleanup', {
      schema: {
        tags: ['performance'],
        summary: 'Cleanup expired cache keys (development only)'
      }
    }, async (request, reply) => {
      try {
        const cleaned = cacheService.clearExpiredKeys();
        
        return {
          success: true,
          message: `${cleaned} expired keys cleaned`
        };
      } catch (error) {
        fastify.log.error('Failed to cleanup cache:', error);
        return reply.code(500).send({
          success: false,
          error: 'Failed to cleanup cache'
        });
      }
    });

    fastify.get('/api/performance/indexes', {
      schema: {
        tags: ['performance'],
        summary: 'Get recommended database indexes (development only)'
      }
    }, async (request, reply) => {
      try {
        const indexes = dbOptimizationService.getRecommendedIndexes();
        
        return {
          success: true,
          indexes
        };
      } catch (error) {
        fastify.log.error('Failed to get recommended indexes:', error);
        return reply.code(500).send({
          success: false,
          error: 'Failed to get recommended indexes'
        });
      }
    });
  }

  // Periodic cache cleanup
  const cleanupInterval = setInterval(() => {
    try {
      const cleaned = cacheService.clearExpiredKeys();
      if (cleaned > 0) {
        fastify.log.info(`Periodic cache cleanup: ${cleaned} keys removed`);
      }
    } catch (error) {
      fastify.log.error('Periodic cache cleanup failed:', error);
    }
  }, 10 * 60 * 1000); // Every 10 minutes

  // Cleanup on server shutdown
  fastify.addHook('onClose', async () => {
    clearInterval(cleanupInterval);
    cacheService.clearAllCaches();
  });

  // Cache warming on startup
  if (process.env.ENABLE_CACHE_WARMING === 'true') {
    fastify.ready(async () => {
      try {
        await cacheService.warmCache();
        fastify.log.info('Cache warming completed');
      } catch (error) {
        fastify.log.error('Cache warming failed:', error);
      }
    });
  }

  fastify.log.info('Performance plugin registered successfully');
}

export default fp(performancePlugin, {
  name: 'performance',
  dependencies: ['firebase']
});