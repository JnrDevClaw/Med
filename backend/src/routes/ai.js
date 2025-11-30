import PromptRefinementService from '../services/promptRefinementService.js';

const aiRoutes = async (fastify, opts) => {
  // Helper function to get prompt refinement service
  function getPromptRefinementService() {
    if (!promptRefinementService) {
      promptRefinementService = new PromptRefinementService(fastify.firebase.firestore, fastify.huggingFace);
    }
    return promptRefinementService;
  }
  
  let promptRefinementService;
  
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

  // Create prompt refinement session
  fastify.post('/refine/create', {
    schema: {
      tags: ['ai'],
      description: 'Create a new prompt refinement session',
      headers: {
        type: 'object',
        properties: {
          authorization: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        required: ['prompt'],
        properties: {
          prompt: { type: 'string', minLength: 1, maxLength: 2000 }
        }
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            sessionId: { type: 'string' },
            originalPrompt: { type: 'string' },
            preprocessedPrompt: { type: 'string' },
            status: { type: 'string' }
          }
        }
      }
    },
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const user = request.user;
    const { prompt } = request.body;

    try {
      const session = await getPromptRefinementService().createRefinementSession(user.username, prompt);

      return reply.code(201).send({
        success: true,
        sessionId: session.sessionId,
        originalPrompt: session.originalPrompt,
        preprocessedPrompt: session.preprocessedPrompt,
        status: session.status
      });

    } catch (error) {
      fastify.log.error('Prompt refinement creation error:', error);
      return reply.code(400).send({
        error: 'REFINEMENT_CREATION_ERROR',
        message: error.message
      });
    }
  });

  // Refine prompt using Hugging Face
  fastify.post('/refine/:sessionId', {
    schema: {
      tags: ['ai'],
      description: 'Refine a prompt using AI',
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
            success: { type: 'boolean' },
            sessionId: { type: 'string' },
            originalPrompt: { type: 'string' },
            refinedPrompt: { type: 'string' },
            status: { type: 'string' },
            improvements: { type: 'array', items: { type: 'string' } }
          }
        }
      }
    },
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const user = request.user;
    const { sessionId } = request.params;

    try {
      const session = await getPromptRefinementService().refinePrompt(sessionId);

      // Verify user owns this session
      if (session.username !== user.username) {
        return reply.code(403).send({
          error: 'UNAUTHORIZED',
          message: 'Access denied to this refinement session'
        });
      }

      // Get comparison data
      const comparison = await getPromptRefinementService().comparePrompts(sessionId);

      return {
        success: true,
        sessionId: session.sessionId,
        originalPrompt: session.originalPrompt,
        refinedPrompt: session.refinedPrompt,
        status: session.status,
        improvements: comparison.improvements
      };

    } catch (error) {
      fastify.log.error('Prompt refinement error:', error);
      return reply.code(400).send({
        error: 'REFINEMENT_ERROR',
        message: error.message
      });
    }
  });

  // Update original prompt and re-refine
  fastify.put('/refine/:sessionId', {
    schema: {
      tags: ['ai'],
      description: 'Update original prompt and re-refine',
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
        required: ['prompt'],
        properties: {
          prompt: { type: 'string', minLength: 1, maxLength: 2000 }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            sessionId: { type: 'string' },
            originalPrompt: { type: 'string' },
            refinedPrompt: { type: 'string' },
            status: { type: 'string' }
          }
        }
      }
    },
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const user = request.user;
    const { sessionId } = request.params;
    const { prompt } = request.body;

    try {
      // First verify user owns this session
      const existingSession = await getPromptRefinementService().getRefinementSession(sessionId, user.username);

      const session = await getPromptRefinementService().updateAndRefinePrompt(sessionId, prompt);

      return {
        success: true,
        sessionId: session.sessionId,
        originalPrompt: session.originalPrompt,
        refinedPrompt: session.refinedPrompt,
        status: session.status
      };

    } catch (error) {
      fastify.log.error('Prompt update and refinement error:', error);
      return reply.code(400).send({
        error: 'UPDATE_REFINEMENT_ERROR',
        message: error.message
      });
    }
  });

  // Get refinement session details
  fastify.get('/refine/:sessionId', {
    schema: {
      tags: ['ai'],
      description: 'Get refinement session details',
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
            success: { type: 'boolean' },
            session: {
              type: 'object',
              properties: {
                sessionId: { type: 'string' },
                originalPrompt: { type: 'string' },
                refinedPrompt: { type: 'string' },
                status: { type: 'string' },
                createdAt: { type: 'string' },
                updatedAt: { type: 'string' }
              }
            },
            comparison: {
              type: 'object',
              properties: {
                improvements: { type: 'array', items: { type: 'string' } }
              }
            }
          }
        }
      }
    },
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const user = request.user;
    const { sessionId } = request.params;

    try {
      const session = await getPromptRefinementService().getRefinementSession(sessionId, user.username);
      
      let comparison = null;
      if (session.refinedPrompt) {
        comparison = await getPromptRefinementService().comparePrompts(sessionId);
      }

      return {
        success: true,
        session: {
          sessionId: session.sessionId,
          originalPrompt: session.originalPrompt,
          refinedPrompt: session.refinedPrompt,
          status: session.status,
          createdAt: session.createdAt?.toISOString(),
          updatedAt: session.updatedAt?.toISOString()
        },
        comparison
      };

    } catch (error) {
      fastify.log.error('Get refinement session error:', error);
      return reply.code(404).send({
        error: 'SESSION_NOT_FOUND',
        message: error.message
      });
    }
  });

  // Send refined prompt to AI for final response
  fastify.post('/refine/:sessionId/send', {
    schema: {
      tags: ['ai'],
      description: 'Send refined prompt to AI for medical response',
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
            success: { type: 'boolean' },
            response: { type: 'string' },
            sessionId: { type: 'string' },
            validation: {
              type: 'object',
              properties: {
                isValid: { type: 'boolean' },
                warnings: { type: 'array', items: { type: 'string' } },
                hasDisclaimer: { type: 'boolean' }
              }
            }
          }
        }
      }
    },
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const user = request.user;
    const { sessionId } = request.params;

    try {
      // Get and verify session
      const session = await getPromptRefinementService().getRefinementSession(sessionId, user.username);

      if (session.status !== 'refined') {
        return reply.code(400).send({
          error: 'PROMPT_NOT_REFINED',
          message: 'Prompt must be refined before sending'
        });
      }

      // Generate AI response using refined prompt
      const aiResponse = await fastify.huggingFace.generateMedicalResponse(session.refinedPrompt);

      if (!aiResponse.success) {
        throw new Error('Failed to generate AI response');
      }

      // Validate the response
      const validation = fastify.huggingFace.validateMedicalResponse(aiResponse.response);

      // Mark session as sent
      await getPromptRefinementService().markPromptAsSent(sessionId);

      return {
        success: true,
        response: aiResponse.response,
        sessionId,
        validation: {
          isValid: validation.isValid,
          warnings: validation.warnings,
          hasDisclaimer: validation.hasDisclaimer
        }
      };

    } catch (error) {
      fastify.log.error('Send refined prompt error:', error);
      return reply.code(400).send({
        error: 'SEND_PROMPT_ERROR',
        message: error.message
      });
    }
  });

  // Get user's refinement history
  fastify.get('/refine/history', {
    schema: {
      tags: ['ai'],
      description: 'Get user refinement history',
      headers: {
        type: 'object',
        properties: {
          authorization: { type: 'string' }
        }
      },
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 50, default: 10 }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            sessions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  sessionId: { type: 'string' },
                  originalPrompt: { type: 'string' },
                  status: { type: 'string' },
                  createdAt: { type: 'string' }
                }
              }
            }
          }
        }
      }
    },
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const user = request.user;
    const { limit = 10 } = request.query;

    try {
      const sessions = await getPromptRefinementService().getUserRefinementHistory(user.username, limit);

      return {
        success: true,
        sessions: sessions.map(session => ({
          sessionId: session.sessionId,
          originalPrompt: session.originalPrompt.substring(0, 100) + (session.originalPrompt.length > 100 ? '...' : ''),
          status: session.status,
          createdAt: session.createdAt?.toISOString()
        }))
      };

    } catch (error) {
      fastify.log.error('Get refinement history error:', error);
      return reply.code(500).send({
        error: 'HISTORY_ERROR',
        message: 'Failed to retrieve refinement history'
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
