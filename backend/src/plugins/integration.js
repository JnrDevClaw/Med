import fp from 'fastify-plugin';
import NotificationService from '../services/notificationService.js';
import CrossSystemIntegrationService from '../services/crossSystemIntegrationService.js';

/**
 * Integration Plugin
 * Registers notification service and cross-system integration service
 */
async function integrationPlugin(fastify, options) {
  // Initialize notification service
  const notificationService = new NotificationService(
    fastify.firestore,
    fastify.log
  );

  // Initialize cross-system integration service
  const crossSystemIntegration = new CrossSystemIntegrationService(
    fastify.firestore,
    fastify.userProfileService,
    notificationService,
    fastify.log
  );

  // Register services
  fastify.decorate('notificationService', notificationService);
  fastify.decorate('crossSystemIntegration', crossSystemIntegration);

  // Add hooks for automatic activity recording
  fastify.addHook('onResponse', async (request, reply) => {
    try {
      // Only record activity for authenticated users
      if (!request.user?.username) return;

      const { method, url } = request;
      const username = request.user.username;

      // Determine activity type based on route
      let activityType = null;
      let activityData = {};

      if (method === 'POST') {
        if (url.includes('/questions')) {
          activityType = 'question_asked';
          activityData = { source: 'qa_system' };
        } else if (url.includes('/answers')) {
          activityType = 'answer_given';
          activityData = { source: 'qa_system' };
        } else if (url.includes('/comments')) {
          activityType = 'comment_posted';
          activityData = { source: 'qa_system' };
        } else if (url.includes('/ai/')) {
          activityType = 'ai_session';
          activityData = { source: 'ai_system' };
        } else if (url.includes('/consultations/requests')) {
          activityType = 'consultation_requested';
          activityData = { source: 'consultation_system' };
        } else if (url.includes('/doctor-discussions')) {
          activityType = 'discussion_created';
          activityData = { source: 'doctor_discussion' };
        }
      } else if (method === 'PATCH' && url.includes('/vote')) {
        activityType = 'vote_cast';
        activityData = { source: 'qa_system' };
      }

      // Record activity if type was determined
      if (activityType && reply.statusCode < 400) {
        await crossSystemIntegration.recordUserActivity(username, activityType, {
          ...activityData,
          method,
          url,
          statusCode: reply.statusCode
        });
      }
    } catch (error) {
      // Don't let activity recording errors affect the response
      fastify.log.warn('Failed to record user activity:', error);
    }
  });

  // Add helper methods to fastify instance
  fastify.decorate('sendNotification', async function(notificationData) {
    return await notificationService.sendNotification(notificationData);
  });

  fastify.decorate('enrichWithUserProfile', async function(item, usernameField = 'authorUsername') {
    if (item[usernameField]) {
      if (item.authorRole === 'doctor' || item.role === 'doctor') {
        return await crossSystemIntegration.enrichAnswerWithUserProfile(item);
      } else {
        return await crossSystemIntegration.enrichQuestionWithUserProfile(item);
      }
    }
    return item;
  });

  fastify.decorate('getAISuggestions', async function(content, category) {
    return await crossSystemIntegration.getAISuggestionsForQuestion(content, category);
  });

  fastify.decorate('getConsultationContext', async function(patientUsername, doctorUsername = null) {
    return await crossSystemIntegration.getConsultationContext(patientUsername, doctorUsername);
  });

  fastify.log.info('Integration plugin registered successfully');
}

export default fp(integrationPlugin, {
  name: 'integration',
  dependencies: ['firebase', 'userProfile']
});