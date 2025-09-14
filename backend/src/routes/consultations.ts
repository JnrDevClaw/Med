import { FastifyPluginAsync } from 'fastify';
import { Type, Static } from '@sinclair/typebox';

const CreateReminderSchema = Type.Object({
  title: Type.String({ minLength: 1 }),
  description: Type.Optional(Type.String()),
  type: Type.Union([
    Type.Literal('medication'),
    Type.Literal('appointment'),
    Type.Literal('exercise'),
    Type.Literal('diet'),
    Type.Literal('custom'),
  ]),
  reminderTime: Type.String({ format: 'date-time' }),
  recurrencePattern: Type.Optional(Type.String()),
});

type CreateReminderRequest = Static<typeof CreateReminderSchema>;

const consultationRoutes: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  
  // Get all consultations for user
  fastify.get('/', {
    schema: {
      tags: ['consultations'],
      description: 'Get user consultations',
      headers: Type.Object({
        authorization: Type.String(),
      }),
      querystring: Type.Object({
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
        offset: Type.Optional(Type.Number({ minimum: 0 })),
        type: Type.Optional(Type.Union([
          Type.Literal('ai'),
          Type.Literal('video'),
          Type.Literal('text'),
        ])),
        status: Type.Optional(Type.Union([
          Type.Literal('scheduled'),
          Type.Literal('active'),
          Type.Literal('completed'),
          Type.Literal('cancelled'),
        ])),
      }),
      response: {
        200: Type.Object({
          consultations: Type.Array(Type.Object({
            id: Type.String(),
            type: Type.String(),
            status: Type.String(),
            scheduledAt: Type.Optional(Type.String()),
            startedAt: Type.Optional(Type.String()),
            endedAt: Type.Optional(Type.String()),
            duration: Type.Optional(Type.Number()),
            patientName: Type.Optional(Type.String()),
            doctorName: Type.Optional(Type.String()),
            notes: Type.Optional(Type.String()),
            metadata: Type.Optional(Type.Any()),
          })),
          total: Type.Number(),
        }),
      },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const user = request.user;
    const { limit = 20, offset = 0, type, status } = request.query as any;

    try {
      let query = fastify.db('consultations')
        .leftJoin('users as patient', 'consultations.patient_id', 'patient.id')
        .leftJoin('users as doctor', 'consultations.doctor_id', 'doctor.id')
        .where(function() {
          this.where('consultations.patient_id', user.userId)
            .orWhere('consultations.doctor_id', user.userId);
        });

      if (type) {
        query = query.where('consultations.type', type);
      }

      if (status) {
        query = query.where('consultations.status', status);
      }

      const consultations = await query
        .select([
          'consultations.*',
          'patient.name as patient_name',
          'doctor.name as doctor_name',
        ])
        .orderBy('consultations.created_at', 'desc')
        .limit(limit)
        .offset(offset);

      const [{ count }] = await fastify.db('consultations')
        .where(function() {
          this.where('patient_id', user.userId)
            .orWhere('doctor_id', user.userId);
        })
        .count('* as count');

      return {
        consultations: consultations.map(c => ({
          id: c.id,
          type: c.type,
          status: c.status,
          scheduledAt: c.scheduled_at,
          startedAt: c.started_at,
          endedAt: c.ended_at,
          duration: c.duration_minutes,
          patientName: c.patient_name,
          doctorName: c.doctor_name,
          notes: c.notes,
          metadata: c.metadata,
        })),
        total: parseInt(count as string),
      };

    } catch (error) {
      fastify.log.error('Consultations retrieval error:', error);
      return reply.code(500).send({
        error: 'DATABASE_ERROR',
        message: 'Failed to retrieve consultations',
      });
    }
  });

  // Get specific consultation details
  fastify.get('/:consultationId', {
    schema: {
      tags: ['consultations'],
      description: 'Get consultation details',
      headers: Type.Object({
        authorization: Type.String(),
      }),
      params: Type.Object({
        consultationId: Type.String(),
      }),
      response: {
        200: Type.Object({
          consultation: Type.Object({
            id: Type.String(),
            type: Type.String(),
            status: Type.String(),
            scheduledAt: Type.Optional(Type.String()),
            startedAt: Type.Optional(Type.String()),
            endedAt: Type.Optional(Type.String()),
            duration: Type.Optional(Type.Number()),
            patient: Type.Object({
              id: Type.String(),
              name: Type.String(),
            }),
            doctor: Type.Optional(Type.Object({
              id: Type.String(),
              name: Type.String(),
              verified: Type.Boolean(),
            })),
            notes: Type.Optional(Type.String()),
            metadata: Type.Optional(Type.Any()),
            ceramicRecordId: Type.Optional(Type.String()),
          }),
          messages: Type.Optional(Type.Array(Type.Object({
            id: Type.String(),
            message: Type.String(),
            response: Type.Optional(Type.String()),
            model: Type.Optional(Type.String()),
            confidence: Type.Optional(Type.Number()),
            timestamp: Type.String(),
          }))),
          videoCall: Type.Optional(Type.Object({
            channelName: Type.String(),
            status: Type.String(),
            startedAt: Type.Optional(Type.String()),
            endedAt: Type.Optional(Type.String()),
            duration: Type.Optional(Type.Number()),
          })),
        }),
      },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { consultationId } = request.params as { consultationId: string };
    const user = request.user;

    try {
      // Get consultation
      const consultation = await fastify.db('consultations')
        .leftJoin('users as patient', 'consultations.patient_id', 'patient.id')
        .leftJoin('users as doctor', 'consultations.doctor_id', 'doctor.id')
        .where('consultations.id', consultationId)
        .where(function() {
          this.where('consultations.patient_id', user.userId)
            .orWhere('consultations.doctor_id', user.userId);
        })
        .select([
          'consultations.*',
          'patient.id as patient_id',
          'patient.name as patient_name',
          'doctor.id as doctor_id',
          'doctor.name as doctor_name',
          'doctor.verified as doctor_verified',
        ])
        .first();

      if (!consultation) {
        return reply.code(404).send({
          error: 'CONSULTATION_NOT_FOUND',
          message: 'Consultation not found or access denied',
        });
      }

      // Get AI messages if AI consultation
      let messages = null;
      if (consultation.type === 'ai') {
        messages = await fastify.db('ai_consultations')
          .where('consultation_id', consultationId)
          .select([
            'id',
            'patient_message as message',
            'ai_response as response',
            'model_used as model',
            'confidence_score as confidence',
            'created_at as timestamp',
          ])
          .orderBy('created_at', 'asc');
      }

      // Get video call info if video consultation
      let videoCall = null;
      if (consultation.type === 'video') {
        const videoData = await fastify.db('video_calls')
          .where('consultation_id', consultationId)
          .first();

        if (videoData) {
          videoCall = {
            channelName: videoData.agora_channel_name,
            status: videoData.call_status,
            startedAt: videoData.call_started_at,
            endedAt: videoData.call_ended_at,
            duration: videoData.call_duration_seconds,
          };
        }
      }

      return {
        consultation: {
          id: consultation.id,
          type: consultation.type,
          status: consultation.status,
          scheduledAt: consultation.scheduled_at,
          startedAt: consultation.started_at,
          endedAt: consultation.ended_at,
          duration: consultation.duration_minutes,
          patient: {
            id: consultation.patient_id,
            name: consultation.patient_name,
          },
          doctor: consultation.doctor_id ? {
            id: consultation.doctor_id,
            name: consultation.doctor_name,
            verified: consultation.doctor_verified,
          } : null,
          notes: consultation.notes,
          metadata: consultation.metadata,
          ceramicRecordId: consultation.ceramic_record_id,
        },
        messages,
        videoCall,
      };

    } catch (error) {
      fastify.log.error('Consultation details error:', error);
      return reply.code(500).send({
        error: 'DATABASE_ERROR',
        message: 'Failed to retrieve consultation details',
      });
    }
  });

  // Update consultation notes
  fastify.put('/:consultationId/notes', {
    schema: {
      tags: ['consultations'],
      description: 'Update consultation notes',
      headers: Type.Object({
        authorization: Type.String(),
      }),
      params: Type.Object({
        consultationId: Type.String(),
      }),
      body: Type.Object({
        notes: Type.String(),
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          message: Type.String(),
        }),
      },
    },
    preHandler: [fastify.authenticate, fastify.requireRole('doctor')],
  }, async (request, reply) => {
    const { consultationId } = request.params as { consultationId: string };
    const { notes } = request.body as { notes: string };
    const user = request.user;

    try {
      // Verify doctor is part of this consultation
      const consultation = await fastify.db('consultations')
        .where('id', consultationId)
        .where('doctor_id', user.userId)
        .first();

      if (!consultation) {
        return reply.code(403).send({
          error: 'ACCESS_DENIED',
          message: 'Not authorized to update this consultation',
        });
      }

      // Update notes
      await fastify.db('consultations')
        .where('id', consultationId)
        .update({
          notes,
          updated_at: new Date(),
        });

      return {
        success: true,
        message: 'Consultation notes updated successfully',
      };

    } catch (error) {
      fastify.log.error('Notes update error:', error);
      return reply.code(500).send({
        error: 'UPDATE_ERROR',
        message: 'Failed to update consultation notes',
      });
    }
  });

  // Health reminders endpoints
  
  // Create health reminder
  fastify.post<{ Body: CreateReminderRequest }>('/reminders', {
    schema: {
      tags: ['consultations'],
      description: 'Create health reminder',
      headers: Type.Object({
        authorization: Type.String(),
      }),
      body: CreateReminderSchema,
      response: {
        201: Type.Object({
          reminderId: Type.String(),
          message: Type.String(),
        }),
      },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { title, description, type, reminderTime, recurrencePattern } = request.body;
    const user = request.user;

    try {
      const [reminder] = await fastify.db('health_reminders')
        .insert({
          patient_id: user.userId,
          title,
          description,
          type,
          reminder_time: new Date(reminderTime),
          recurrence_pattern: recurrencePattern,
          is_active: true,
        })
        .returning('*');

      reply.code(201).send({
        reminderId: reminder.id,
        message: 'Health reminder created successfully',
      });

    } catch (error) {
      fastify.log.error('Reminder creation error:', error);
      return reply.code(500).send({
        error: 'CREATION_ERROR',
        message: 'Failed to create health reminder',
      });
    }
  });

  // Get health reminders
  fastify.get('/reminders', {
    schema: {
      tags: ['consultations'],
      description: 'Get health reminders',
      headers: Type.Object({
        authorization: Type.String(),
      }),
      querystring: Type.Object({
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
        offset: Type.Optional(Type.Number({ minimum: 0 })),
        type: Type.Optional(Type.String()),
        active: Type.Optional(Type.Boolean()),
      }),
      response: {
        200: Type.Object({
          reminders: Type.Array(Type.Object({
            id: Type.String(),
            title: Type.String(),
            description: Type.Optional(Type.String()),
            type: Type.String(),
            reminderTime: Type.String(),
            recurrencePattern: Type.Optional(Type.String()),
            isActive: Type.Boolean(),
            isSent: Type.Boolean(),
            sentAt: Type.Optional(Type.String()),
          })),
          total: Type.Number(),
        }),
      },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const user = request.user;
    const { limit = 20, offset = 0, type, active } = request.query as any;

    try {
      let query = fastify.db('health_reminders')
        .where('patient_id', user.userId);

      if (type) {
        query = query.where('type', type);
      }

      if (active !== undefined) {
        query = query.where('is_active', active);
      }

      const reminders = await query
        .orderBy('reminder_time', 'asc')
        .limit(limit)
        .offset(offset);

      const [{ count }] = await fastify.db('health_reminders')
        .where('patient_id', user.userId)
        .count('* as count');

      return {
        reminders: reminders.map(r => ({
          id: r.id,
          title: r.title,
          description: r.description,
          type: r.type,
          reminderTime: r.reminder_time,
          recurrencePattern: r.recurrence_pattern,
          isActive: r.is_active,
          isSent: r.is_sent,
          sentAt: r.sent_at,
        })),
        total: parseInt(count as string),
      };

    } catch (error) {
      fastify.log.error('Reminders retrieval error:', error);
      return reply.code(500).send({
        error: 'DATABASE_ERROR',
        message: 'Failed to retrieve health reminders',
      });
    }
  });

  // Update health reminder
  fastify.put('/reminders/:reminderId', {
    schema: {
      tags: ['consultations'],
      description: 'Update health reminder',
      headers: Type.Object({
        authorization: Type.String(),
      }),
      params: Type.Object({
        reminderId: Type.String(),
      }),
      body: Type.Partial(CreateReminderSchema),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          message: Type.String(),
        }),
      },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { reminderId } = request.params as { reminderId: string };
    const updateData = request.body as any;
    const user = request.user;

    try {
      const reminder = await fastify.db('health_reminders')
        .where('id', reminderId)
        .where('patient_id', user.userId)
        .first();

      if (!reminder) {
        return reply.code(404).send({
          error: 'REMINDER_NOT_FOUND',
          message: 'Health reminder not found',
        });
      }

      const updates: any = { updated_at: new Date() };
      if (updateData.title) updates.title = updateData.title;
      if (updateData.description !== undefined) updates.description = updateData.description;
      if (updateData.type) updates.type = updateData.type;
      if (updateData.reminderTime) updates.reminder_time = new Date(updateData.reminderTime);
      if (updateData.recurrencePattern !== undefined) updates.recurrence_pattern = updateData.recurrencePattern;

      await fastify.db('health_reminders')
        .where('id', reminderId)
        .update(updates);

      return {
        success: true,
        message: 'Health reminder updated successfully',
      };

    } catch (error) {
      fastify.log.error('Reminder update error:', error);
      return reply.code(500).send({
        error: 'UPDATE_ERROR',
        message: 'Failed to update health reminder',
      });
    }
  });

  // Delete health reminder
  fastify.delete('/reminders/:reminderId', {
    schema: {
      tags: ['consultations'],
      description: 'Delete health reminder',
      headers: Type.Object({
        authorization: Type.String(),
      }),
      params: Type.Object({
        reminderId: Type.String(),
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          message: Type.String(),
        }),
      },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { reminderId } = request.params as { reminderId: string };
    const user = request.user;

    try {
      const deleted = await fastify.db('health_reminders')
        .where('id', reminderId)
        .where('patient_id', user.userId)
        .delete();

      if (!deleted) {
        return reply.code(404).send({
          error: 'REMINDER_NOT_FOUND',
          message: 'Health reminder not found',
        });
      }

      return {
        success: true,
        message: 'Health reminder deleted successfully',
      };

    } catch (error) {
      fastify.log.error('Reminder deletion error:', error);
      return reply.code(500).send({
        error: 'DELETION_ERROR',
        message: 'Failed to delete health reminder',
      });
    }
  });
};

export default consultationRoutes;
