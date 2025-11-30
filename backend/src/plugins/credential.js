import fp from 'fastify-plugin';
import CredentialService from '../services/credentialService.js';

/**
 * Credential Plugin
 * Registers the credential service for doctor verification
 */
export default fp(async function (fastify, opts) {
  // Wait for dependencies
  await fastify.after();

  // Initialize credential service
  const credentialService = new CredentialService(
    fastify.firebase.firestore,
    fastify.ipfs,
    fastify.log,
    process.env.HUGGINGFACE_API_KEY,
    fastify.userProfile.firestoreService
  );

  // Decorate fastify instance with credential service
  fastify.decorate('credentialService', credentialService);

  fastify.log.info('Credential service initialized');
}, {
  name: 'credential',
  dependencies: ['firebase', 'ipfs', 'userProfile']
});