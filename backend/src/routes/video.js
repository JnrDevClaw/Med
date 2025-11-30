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
            accessToken: { type: 'string' },
            webrtcConfig: { type: 'object' }
          }
        }
      },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const user = request.user;
    const { consultationId } = request.body;

    try {
      // Verify user has access to this consultation using Firestore
      const consultationRef = fastify.firestore.collection('consultations').doc(consultationId);
      const consultationDoc = await consultationRef.get();

      if (!consultationDoc.exists) {
        return reply.code(404).send({
          error: 'CONSULTATION_NOT_FOUND',
          message: 'Consultation not found',
        });
      }

      const consultation = consultationDoc.data();
      
      // Check if user is either the doctor or patient
      if (consultation.doctorUsername !== user.username && consultation.patientUsername !== user.username) {
        return reply.code(403).send({
          error: 'ACCESS_DENIED',
          message: 'Access denied to this consultation',
        });
      }

      // Generate room ID and access token
      const roomId = `consultation_${consultationId}`;
      const accessToken = fastify.jwt.sign(
        { 
          username: user.username,
          consultationId,
          roomId,
          type: 'video_access',
        },
        { expiresIn: '2h' }
      );

      // Update consultation with room info
      await consultationRef.update({
        roomId,
        status: 'active',
        updatedAt: new Date(),
      });

      return reply.code(201).send({
        success: true,
        roomId,
        accessToken,
        webrtcConfig: fastify.webrtcConfig
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
                username: { type: 'string' },
                role: { type: 'string' }
              }
            },
            webrtcConfig: { type: 'object' }
          }
        }
      },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const user = request.user;
    const { roomId } = request.params;

    try {
      // Extract consultation ID from room ID
      const consultationId = roomId.replace('consultation_', '');
      
      // Verify room exists and user has access using Firestore
      const consultationRef = fastify.firestore.collection('consultations').doc(consultationId);
      const consultationDoc = await consultationRef.get();

      if (!consultationDoc.exists) {
        return reply.code(404).send({
          error: 'ROOM_NOT_FOUND',
          message: 'Video room not found',
        });
      }

      const consultation = consultationDoc.data();
      
      // Check if user has access
      if (consultation.doctorUsername !== user.username && consultation.patientUsername !== user.username) {
        return reply.code(403).send({
          error: 'ACCESS_DENIED',
          message: 'Access denied to this video room',
        });
      }

      // Get user profile from Firestore
      const userRef = fastify.firestore.collection('users').doc(user.username);
      const userDoc = await userRef.get();
      const userData = userDoc.exists ? userDoc.data() : { role: 'patient' };

      return {
        success: true,
        participant: {
          username: user.username,
          role: userData.role,
        },
        webrtcConfig: fastify.webrtcConfig
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
      // Extract consultation ID from room ID
      const consultationId = roomId.replace('consultation_', '');
      
      // Verify user has access and update consultation status
      const consultationRef = fastify.firestore.collection('consultations').doc(consultationId);
      const consultationDoc = await consultationRef.get();

      if (!consultationDoc.exists) {
        return reply.code(404).send({
          error: 'ROOM_NOT_FOUND',
          message: 'Video room not found',
        });
      }

      const consultation = consultationDoc.data();
      
      // Check if user has access
      if (consultation.doctorUsername !== user.username && consultation.patientUsername !== user.username) {
        return reply.code(403).send({
          error: 'ACCESS_DENIED',
          message: 'Access denied to this video room',
        });
      }

      // Update consultation status
      await consultationRef.update({
        status: 'completed',
        endedAt: new Date(),
        updatedAt: new Date(),
        endedBy: user.username
      });

      // Clean up the WebRTC room
      if (fastify.webrtcSignaling) {
        fastify.webrtcSignaling.cleanupRoom(roomId);
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

  // Get connection quality metrics
  fastify.get('/room/:roomId/quality', {
    schema: {
      tags: ['video'],
      description: 'Get connection quality metrics',
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
            quality: { type: 'object' },
            recommendations: { type: 'array' }
          }
        }
      },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { roomId } = request.params;

    try {
      // Get room statistics
      const roomStats = fastify.webrtcSignaling.getRoomStats(roomId);
      
      if (!roomStats) {
        return reply.code(404).send({
          error: 'ROOM_NOT_FOUND',
          message: 'Video room not found or inactive',
        });
      }

      // Return basic room quality info
      return {
        success: true,
        quality: {
          participantCount: roomStats.participantCount,
          roomAge: Date.now() - roomStats.createdAt,
          status: 'active'
        },
        recommendations: []
      };

    } catch (error) {
      fastify.log.error('Quality check error:', error);
      return reply.code(500).send({
        error: 'QUALITY_CHECK_ERROR',
        message: 'Failed to get quality metrics',
      });
    }
  });
};

export default videoRoutes;
