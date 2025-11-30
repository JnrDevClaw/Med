import fp from 'fastify-plugin';
import DoctorAvailabilityService from '../services/doctorAvailabilityService.js';
import ConsultationRequestService from '../services/consultationRequestService.js';
import ConsultationBackgroundService from '../services/consultationBackgroundService.js';

/**
 * Consultation Plugin
 * Registers consultation-related services with Fastify
 */
async function consultationPlugin(fastify, opts) {
  // Initialize services
  const doctorAvailabilityService = new DoctorAvailabilityService(
    fastify.firestore,
    fastify.log
  );

  const consultationRequestService = new ConsultationRequestService(
    fastify.firestore,
    fastify.log,
    doctorAvailabilityService
  );

  const consultationBackgroundService = new ConsultationBackgroundService(
    doctorAvailabilityService,
    consultationRequestService,
    fastify.log
  );

  // Register services with Fastify
  fastify.decorate('doctorAvailabilityService', doctorAvailabilityService);
  fastify.decorate('consultationRequestService', consultationRequestService);
  fastify.decorate('consultationBackgroundService', consultationBackgroundService);

  // Start background services in production
  if (process.env.NODE_ENV === 'production' || process.env.ENABLE_BACKGROUND_SERVICES === 'true') {
    consultationBackgroundService.start({
      autoAssignIntervalMs: parseInt(process.env.AUTO_ASSIGN_INTERVAL_MS || '30000'),
      cleanupIntervalMs: parseInt(process.env.CLEANUP_INTERVAL_MS || '300000')
    });

    // Graceful shutdown
    fastify.addHook('onClose', async () => {
      consultationBackgroundService.stop();
    });
  }

  fastify.log.info('Consultation plugin registered successfully');
}

export default fp(consultationPlugin, {
  name: 'consultation',
  dependencies: ['firebase']
});