import fp from 'fastify-plugin';
import VerificationCacheService from '../services/verificationCacheService.js';

/**
 * Verification Cache Plugin
 * Registers the verification cache service for performance optimization
 */
export default fp(async function (fastify, opts) {
  // Initialize verification cache service
  const verificationCache = new VerificationCacheService(fastify.log);

  // Decorate fastify instance with verification cache service
  fastify.decorate('verificationCache', verificationCache);

  // Add hook to invalidate cache when user verification status changes
  fastify.addHook('onRequest', async (request, reply) => {
    // Add cache invalidation method to request for use in routes
    request.invalidateVerificationCache = (userId) => {
      verificationCache.invalidateUser(userId);
    };
  });

  fastify.log.info('Verification cache service initialized');
}, {
  name: 'verificationCache'
});