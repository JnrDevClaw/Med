const videoRoutes = async (fastify, opts) => {
  
  // Create video room for consultation
  fastify.post('/room', {
    schema: {
      tags: ['video'],
      description: 'Create video room for consultation',
      headers: {
        type: 'object',
        properties: {
          authorization: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        required: ['consultationId'],
        properties: {
          consultationId: { type: 'string' }
        }
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            roomId: { type: 'string' },
            accessToken: { type: 'string' }
          }
        }
      },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const user = request.user;
    const { consultationId } = request.body;

    try {
      // Verify user has access to this consultation
      const consultation = await fastify.db('consultations')
        .where('id', consultationId)
        .where(function() {
          this.where('doctor_id', user.userId)
            .orWhere('patient_id', user.userId);
        })
        .first();

      if (!consultation) {
        return reply.code(404).send({
          error: 'CONSULTATION_NOT_FOUND',
          message: 'Consultation not found or access denied',
        });
      }

      // Generate room ID and access token
      const roomId = `room_${consultationId}_${Date.now()}`;
      const accessToken = fastify.jwt.sign(
        { 
          userId: user.userId,
          consultationId,
          roomId,
          type: 'video_access',
        },
        { expiresIn: '2h' }
      );

      // Update consultation with room info
      await fastify.db('consultations')
        .where('id', consultationId)
        .update({
          room_id: roomId,
          status: 'active',
          updated_at: new Date(),
        });

      return reply.code(201).send({
        success: true,
        roomId,
        accessToken,
      });

    } catch (error) {
      fastify.log.error('Video room creation error:', error);
      return reply.code(500).send({
        error: 'CREATION_ERROR',
        message: 'Failed to create video room',
      });
    }
  });

  // Join video room
  fastify.post('/room/:roomId/join', {
    schema: {
      tags: ['video'],
      description: 'Join video room',
      headers: {
        type: 'object',
        properties: {
          authorization: { type: 'string' }
        }
      },
      params: {
        type: 'object',
        properties: {
          roomId: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            participant: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                role: { type: 'string' }
              }
            }
          }
        }
      },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const user = request.user;
    const { roomId } = request.params;

    try {
      // Verify room exists and user has access
      const consultation = await fastify.db('consultations')
        .where('room_id', roomId)
        .where(function() {
          this.where('doctor_id', user.userId)
            .orWhere('patient_id', user.userId);
        })
        .first();

      if (!consultation) {
        return reply.code(404).send({
          error: 'ROOM_NOT_FOUND',
          message: 'Video room not found or access denied',
        });
      }

      // Get user details
      const userData = await fastify.db('users')
        .where('id', user.userId)
        .first();

      return {
        success: true,
        participant: {
          id: user.userId,
          name: userData.name,
          role: userData.role,
        },
      };

    } catch (error) {
      fastify.log.error('Video room join error:', error);
      return reply.code(500).send({
        error: 'JOIN_ERROR',
        message: 'Failed to join video room',
      });
    }
  });

  // End video call
  fastify.post('/room/:roomId/end', {
    schema: {
      tags: ['video'],
      description: 'End video call',
      headers: {
        type: 'object',
        properties: {
          authorization: { type: 'string' }
        }
      },
      params: {
        type: 'object',
        properties: {
          roomId: { type: 'string' }
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
      },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const user = request.user;
    const { roomId } = request.params;

    try {
      // Update consultation status
      const updated = await fastify.db('consultations')
        .where('room_id', roomId)
        .where(function() {
          this.where('doctor_id', user.userId)
            .orWhere('patient_id', user.userId);
        })
        .update({
          status: 'completed',
          ended_at: new Date(),
          updated_at: new Date(),
        });

      if (updated === 0) {
        return reply.code(404).send({
          error: 'ROOM_NOT_FOUND',
          message: 'Video room not found or access denied',
        });
      }

      return {
        success: true,
        message: 'Video call ended successfully',
      };

    } catch (error) {
      fastify.log.error('Video room end error:', error);
      return reply.code(500).send({
        error: 'END_ERROR',
        message: 'Failed to end video call',
      });
    }
  });
};

export default videoRoutes;
