import fp from 'fastify-plugin';
import UserProfileService from '../services/userProfileService.js';

/**
 * User Profile Plugin
 * Registers the UserProfileService with Fastify
 */
export default fp(async function (fastify, opts) {
  // Wait for dependencies to be ready
  await fastify.after(['ipfs', 'firebase']);

  // Create and register the user profile service
  const userProfileService = new UserProfileService(
    fastify.ipfs,
    fastify.firestore,
    fastify.log
  );

  // Decorate fastify with the service
  fastify.decorate('userProfile', userProfileService);

  // Add health check route
  fastify.get('/health/user-profile', {
    schema: {
      tags: ['health'],
      description: 'User profile service health check',
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            ipfs: { type: 'object' },
            cache: { type: 'object' },
            timestamp: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const health = await userProfileService.healthCheck();
    const statusCode = health.status === 'healthy' ? 200 : 503;
    return reply.code(statusCode).send(health);
  });

  fastify.log.info('User Profile Service registered');
}, {
  name: 'userProfile',
  dependencies: ['ipfs', 'firebase']
});