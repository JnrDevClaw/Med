const aiRoutes = async (fastify, opts) => {
  
  // Start AI consultation
  fastify.post('/consultation', {
    schema: {
      tags: ['ai'],
      description: 'Start AI consultation session',
      headers: {
        type: 'object',
        properties: {
          authorization: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        required: ['symptoms'],
        properties: {
          symptoms: { type: 'array', items: { type: 'string' } },
          description: { type: 'string' },
          urgency: { type: 'string', enum: ['low', 'medium', 'high', 'emergency'] }
        }
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            sessionId: { type: 'string' },
            initialResponse: { type: 'string' }
          }
        }
      },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const user = request.user;
    const { symptoms, description, urgency = 'low' } = request.body;

    try {
      // Create AI consultation session
      const [session] = await fastify.db('ai_consultations')
        .insert({
          patient_id: user.userId,
          symptoms: JSON.stringify(symptoms),
          description,
          urgency,
          status: 'active',
          created_at: new Date(),
        })
        .returning('*');

      // Generate initial AI response
      const prompt = `Patient presents with symptoms: ${symptoms.join(', ')}. Description: ${description || 'None provided'}. Urgency: ${urgency}. Provide initial medical guidance.`;
      
      let initialResponse = 'I understand you\'re experiencing these symptoms. Let me help you with some initial guidance.';
      
      // Try to get AI response (fallback if AI service unavailable)
      try {
        // This would integrate with your AI service
        // const aiResponse = await fastify.ai.generateResponse(prompt);
        // initialResponse = aiResponse;
      } catch (aiError) {
        fastify.log.warn('AI service unavailable, using fallback response');
      }

      return reply.code(201).send({
        success: true,
        sessionId: session.id,
        initialResponse,
      });

    } catch (error) {
      fastify.log.error('AI consultation creation error:', error);
      return reply.code(500).send({
        error: 'CREATION_ERROR',
        message: 'Failed to start AI consultation',
      });
    }
  });

  // Send message to AI
  fastify.post('/consultation/:sessionId/message', {
    schema: {
      tags: ['ai'],
      description: 'Send message to AI consultation',
      headers: {
        type: 'object',
        properties: {
          authorization: { type: 'string' }
        }
      },
      params: {
        type: 'object',
        properties: {
          sessionId: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        required: ['message'],
        properties: {
          message: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            response: { type: 'string' }
          }
        }
      },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const user = request.user;
    const { sessionId } = request.params;
    const { message } = request.body;

    try {
      // Verify session belongs to user
      const session = await fastify.db('ai_consultations')
        .where('id', sessionId)
        .where('patient_id', user.userId)
        .first();

      if (!session) {
        return reply.code(404).send({
          error: 'SESSION_NOT_FOUND',
          message: 'AI consultation session not found',
        });
      }

      // Store user message
      await fastify.db('ai_messages')
        .insert({
          session_id: sessionId,
          sender: 'user',
          message,
          created_at: new Date(),
        });

      // Generate AI response
      let aiResponse = 'Thank you for the additional information. How else can I help you?';
      
      try {
        // This would integrate with your AI service
        // const response = await fastify.ai.generateResponse(message, session);
        // aiResponse = response;
      } catch (aiError) {
        fastify.log.warn('AI service unavailable, using fallback response');
      }

      // Store AI response
      await fastify.db('ai_messages')
        .insert({
          session_id: sessionId,
          sender: 'ai',
          message: aiResponse,
          created_at: new Date(),
        });

      return {
        success: true,
        response: aiResponse,
      };

    } catch (error) {
      fastify.log.error('AI message error:', error);
      return reply.code(500).send({
        error: 'MESSAGE_ERROR',
        message: 'Failed to process AI message',
      });
    }
  });

  // Get AI consultation history
  fastify.get('/consultation/:sessionId', {
    schema: {
      tags: ['ai'],
      description: 'Get AI consultation history',
      headers: {
        type: 'object',
        properties: {
          authorization: { type: 'string' }
        }
      },
      params: {
        type: 'object',
        properties: {
          sessionId: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            session: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                symptoms: { type: 'array', items: { type: 'string' } },
                description: { type: 'string' },
                urgency: { type: 'string' },
                status: { type: 'string' },
                createdAt: { type: 'string' }
              }
            },
            messages: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  sender: { type: 'string' },
                  message: { type: 'string' },
                  timestamp: { type: 'string' }
                }
              }
            }
          }
        }
      },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const user = request.user;
    const { sessionId } = request.params;

    try {
      // Get session
      const session = await fastify.db('ai_consultations')
        .where('id', sessionId)
        .where('patient_id', user.userId)
        .first();

      if (!session) {
        return reply.code(404).send({
          error: 'SESSION_NOT_FOUND',
          message: 'AI consultation session not found',
        });
      }

      // Get messages
      const messages = await fastify.db('ai_messages')
        .where('session_id', sessionId)
        .orderBy('created_at', 'asc');

      return {
        session: {
          id: session.id,
          symptoms: JSON.parse(session.symptoms),
          description: session.description,
          urgency: session.urgency,
          status: session.status,
          createdAt: session.created_at,
        },
        messages: messages.map(m => ({
          sender: m.sender,
          message: m.message,
          timestamp: m.created_at,
        })),
      };

    } catch (error) {
      fastify.log.error('AI consultation retrieval error:', error);
      return reply.code(500).send({
        error: 'RETRIEVAL_ERROR',
        message: 'Failed to retrieve AI consultation',
      });
    }
  });
};

export default aiRoutes;
