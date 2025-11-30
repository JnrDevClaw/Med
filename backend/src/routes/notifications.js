/**
 * Notification Routes
 * Handles unified notification system endpoints
 */

export default async function notificationRoutes(fastify, options) {
  // Get user notifications
  fastify.get('/', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['notifications'],
      summary: 'Get user notifications',
      querystring: {
        type: 'object',
        properties: {
          unreadOnly: { type: 'boolean', default: false },
          category: { type: 'string' },
          priority: { type: 'string', enum: ['low', 'normal', 'high', 'urgent'] },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            notifications: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  type: { type: 'string' },
                  title: { type: 'string' },
                  message: { type: 'string' },
                  data: { type: 'object' },
                  priority: { type: 'string' },
                  category: { type: 'string' },
                  read: { type: 'boolean' },
                  createdAt: { type: 'string' },
                  readAt: { type: ['string', 'null'] }
                }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { username } = request.user;
      const { unreadOnly, category, priority, limit } = request.query;

      const notifications = await fastify.notificationService.getUserNotifications(username, {
        unreadOnly,
        category,
        priority,
        limit
      });

      return reply.send({
        success: true,
        notifications
      });
    } catch (error) {
      fastify.log.error('Failed to get notifications:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to retrieve notifications'
      });
    }
  });

  // Get notification counts
  fastify.get('/counts', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['notifications'],
      summary: 'Get notification counts by category and priority',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            counts: {
              type: 'object',
              properties: {
                total: { type: 'integer' },
                unread: { type: 'integer' },
                byCategory: { type: 'object' },
                byPriority: { type: 'object' }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { username } = request.user;

      const counts = await fastify.notificationService.getNotificationCounts(username);

      return reply.send({
        success: true,
        counts
      });
    } catch (error) {
      fastify.log.error('Failed to get notification counts:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to retrieve notification counts'
      });
    }
  });

  // Mark notification as read
  fastify.patch('/:notificationId/read', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['notifications'],
      summary: 'Mark notification as read',
      params: {
        type: 'object',
        required: ['notificationId'],
        properties: {
          notificationId: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { username } = request.user;
      const { notificationId } = request.params;

      await fastify.notificationService.markAsRead(notificationId, username);

      return reply.send({
        success: true,
        message: 'Notification marked as read'
      });
    } catch (error) {
      fastify.log.error('Failed to mark notification as read:', error);
      
      if (error.message.includes('not found') || error.message.includes('access denied')) {
        return reply.code(404).send({
          success: false,
          error: 'Notification not found'
        });
      }

      return reply.code(500).send({
        success: false,
        error: 'Failed to mark notification as read'
      });
    }
  });

  // Mark all notifications as read
  fastify.patch('/mark-all-read', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['notifications'],
      summary: 'Mark all notifications as read',
      body: {
        type: 'object',
        properties: {
          category: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            count: { type: 'integer' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { username } = request.user;
      const { category } = request.body;

      const count = await fastify.notificationService.markAllAsRead(username, category);

      return reply.send({
        success: true,
        message: `${count} notifications marked as read`,
        count
      });
    } catch (error) {
      fastify.log.error('Failed to mark all notifications as read:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to mark notifications as read'
      });
    }
  });

  // Send test notification (development only)
  if (process.env.NODE_ENV === 'development') {
    fastify.post('/test', {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['notifications'],
        summary: 'Send test notification (development only)',
        body: {
          type: 'object',
          required: ['title', 'message'],
          properties: {
            title: { type: 'string' },
            message: { type: 'string' },
            type: { type: 'string', default: 'test' },
            priority: { type: 'string', enum: ['low', 'normal', 'high', 'urgent'], default: 'normal' },
            category: { type: 'string', default: 'general' },
            data: { type: 'object', default: {} }
          }
        }
      }
    }, async (request, reply) => {
      try {
        const { username } = request.user;
        const { title, message, type, priority, category, data } = request.body;

        const notificationId = await fastify.notificationService.sendNotification({
          recipientUsername: username,
          type: type || 'test',
          title,
          message,
          data: data || {},
          priority: priority || 'normal',
          category: category || 'general'
        });

        return reply.send({
          success: true,
          message: 'Test notification sent',
          notificationId
        });
      } catch (error) {
        fastify.log.error('Failed to send test notification:', error);
        return reply.code(500).send({
          success: false,
          error: 'Failed to send test notification'
        });
      }
    });
  }

  // Get activity summary
  fastify.get('/activity-summary', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['notifications'],
      summary: 'Get user activity summary',
      querystring: {
        type: 'object',
        properties: {
          days: { type: 'integer', minimum: 1, maximum: 365, default: 30 }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            summary: {
              type: 'object',
              properties: {
                totalActivities: { type: 'integer' },
                activityCounts: { type: 'object' },
                recentActivities: { type: 'array' },
                mostActiveDay: { type: ['string', 'null'] },
                engagementTrend: { type: 'string' }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { username } = request.user;
      const { days } = request.query;

      const summary = await fastify.crossSystemIntegration.getUserActivitySummary(username, days);

      return reply.send({
        success: true,
        summary
      });
    } catch (error) {
      fastify.log.error('Failed to get activity summary:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to retrieve activity summary'
      });
    }
  });
}