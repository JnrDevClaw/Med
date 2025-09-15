const consultationRoutes = async (fastify, opts) => {
  
  // Get all consultations for user
  fastify.get('/', {
    schema: {
      tags: ['consultations'],
      description: 'Get user consultations',
      headers: {
        type: 'object',
        properties: {
          authorization: { type: 'string' }
        }
      },
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'number', minimum: 1, maximum: 100 },
          offset: { type: 'number', minimum: 0 },
          type: { type: 'string', enum: ['ai', 'video', 'text'] },
          status: { type: 'string', enum: ['scheduled', 'active', 'completed', 'cancelled'] }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            consultations: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  type: { type: 'string' },
                  status: { type: 'string' },
                  scheduledAt: { type: 'string' },
                  duration: { type: 'number' },
                  doctorName: { type: 'string' },
                  patientName: { type: 'string' },
                  summary: { type: 'string' }
                }
              }
            },
            total: { type: 'number' }
          }
        }
      },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const user = request.user;
    const { limit = 20, offset = 0, type, status } = request.query;

    try {
      let query = fastify.db('consultations')
        .where(function() {
          this.where('doctor_id', user.userId)
            .orWhere('patient_id', user.userId);
        });

      if (type) {
        query = query.where('type', type);
      }

      if (status) {
        query = query.where('status', status);
      }

      const consultations = await query
        .leftJoin('users as doctors', 'consultations.doctor_id', 'doctors.id')
        .leftJoin('users as patients', 'consultations.patient_id', 'patients.id')
        .select([
          'consultations.*',
          'doctors.name as doctor_name',
          'patients.name as patient_name',
        ])
        .orderBy('consultations.scheduled_at', 'desc')
        .limit(limit)
        .offset(offset);

      const [{ count }] = await fastify.db('consultations')
        .where(function() {
          this.where('doctor_id', user.userId)
            .orWhere('patient_id', user.userId);
        })
        .count('* as count');

      return {
        consultations: consultations.map(c => ({
          id: c.id,
          type: c.type,
          status: c.status,
          scheduledAt: c.scheduled_at,
          duration: c.duration,
          doctorName: c.doctor_name,
          patientName: c.patient_name,
          summary: c.summary,
        })),
        total: parseInt(count),
      };

    } catch (error) {
      fastify.log.error('Consultations retrieval error:', error);
      return reply.code(500).send({
        error: 'DATABASE_ERROR',
        message: 'Failed to retrieve consultations',
      });
    }
  });

  // Create a new consultation
  fastify.post('/', {
    schema: {
      tags: ['consultations'],
      description: 'Create new consultation',
      headers: {
        type: 'object',
        properties: {
          authorization: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        required: ['doctorId', 'scheduledAt', 'type'],
        properties: {
          doctorId: { type: 'string' },
          scheduledAt: { type: 'string', format: 'date-time' },
          type: { type: 'string', enum: ['ai', 'video', 'text'] },
          description: { type: 'string' }
        }
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            consultation: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                doctorId: { type: 'string' },
                patientId: { type: 'string' },
                scheduledAt: { type: 'string' },
                type: { type: 'string' },
                status: { type: 'string' }
              }
            }
          }
        }
      },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const user = request.user;
    const { doctorId, scheduledAt, type, description } = request.body;

    try {
      const [consultation] = await fastify.db('consultations')
        .insert({
          doctor_id: doctorId,
          patient_id: user.userId,
          scheduled_at: new Date(scheduledAt),
          type,
          description,
          status: 'scheduled',
          created_at: new Date(),
        })
        .returning('*');

      return reply.code(201).send({
        success: true,
        consultation: {
          id: consultation.id,
          doctorId: consultation.doctor_id,
          patientId: consultation.patient_id,
          scheduledAt: consultation.scheduled_at,
          type: consultation.type,
          status: consultation.status,
        },
      });

    } catch (error) {
      fastify.log.error('Consultation creation error:', error);
      return reply.code(500).send({
        error: 'CREATION_ERROR',
        message: 'Failed to create consultation',
      });
    }
  });

  // Additional consultation routes would go here...
};

export default consultationRoutes;
