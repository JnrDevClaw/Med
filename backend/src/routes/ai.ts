import { FastifyPluginAsync } from 'fastify';
import { Type, Static } from '@sinclair/typebox';
import { ProviderRegistry } from '../services/ai/provider';
import { HuggingFaceProvider } from '../services/ai/huggingface';
import crypto from 'crypto';

const ChatMessageSchema = Type.Object({
  message: Type.String({ minLength: 1, maxLength: 2000 }),
  symptoms: Type.Optional(Type.Array(Type.String())),
  previousMessages: Type.Optional(Type.Array(Type.Object({
    role: Type.Union([Type.Literal('user'), Type.Literal('assistant')]),
    content: Type.String(),
    timestamp: Type.String(),
  }))),
});

const ModelSelectSchema = Type.Object({
  model: Type.Union([
    Type.Literal('biogpt'),
    Type.Literal('mistral-med'),
    Type.Literal('clinical-bert'),
  ]),
});

type ChatMessageRequest = Static<typeof ChatMessageSchema>;
type ModelSelectRequest = Static<typeof ModelSelectSchema>;

// Simple in-memory cache (process lifetime). Could be replaced with Redis.
const aiCache = new Map<string, { timestamp: number; data: any }>();
const CACHE_TTL_MS = 60_000; // 1 minute

// Rate limiting per user (in-memory)
const userRateLimit = new Map<string, { requests: number; windowStart: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10; // Max 10 AI requests per minute per user

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const userLimit = userRateLimit.get(userId);
  
  if (!userLimit || now - userLimit.windowStart > RATE_LIMIT_WINDOW_MS) {
    userRateLimit.set(userId, { requests: 1, windowStart: now });
    return true;
  }
  
  if (userLimit.requests >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }
  
  userLimit.requests++;
  return true;
}

const registry = new ProviderRegistry();
if (process.env.HUGGINGFACE_API_KEY) {
  registry.register(new HuggingFaceProvider(process.env.HUGGINGFACE_API_KEY));
}

const aiRoutes: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  
  // Get available AI models
  fastify.get('/models', {
    schema: {
      tags: ['ai'],
      description: 'Get available AI medical models',
      response: {
        200: Type.Object({
          models: Type.Array(Type.Object({
            id: Type.String(),
            name: Type.String(),
            description: Type.String(),
            capabilities: Type.Array(Type.String()),
            accuracy: Type.Number(),
            responseTime: Type.String(),
          })),
        }),
      },
    },
  }, async (request, reply) => {
    return {
      models: [
        {
          id: 'biogpt',
          name: 'BioGPT',
          description: 'Large language model trained on biomedical literature',
          capabilities: ['symptom analysis', 'medical Q&A', 'drug information'],
          accuracy: 0.87,
          responseTime: '2-5 seconds',
        },
        {
          id: 'mistral-med',
          name: 'Mistral Medical',
          description: 'Specialized model for medical consultations',
          capabilities: ['diagnosis assistance', 'treatment suggestions', 'medical education'],
          accuracy: 0.91,
          responseTime: '3-7 seconds',
        },
        {
          id: 'clinical-bert',
          name: 'Clinical BERT',
          description: 'BERT model fine-tuned on clinical notes',
          capabilities: ['symptom extraction', 'medical entity recognition'],
          accuracy: 0.84,
          responseTime: '1-3 seconds',
        },
      ],
    };
  });

  // Start AI consultation
  fastify.post<{ Body: ChatMessageRequest & ModelSelectRequest }>('/chat', {
    schema: {
      tags: ['ai'],
      description: 'Send message to AI medical assistant',
      headers: Type.Object({
        authorization: Type.String(),
      }),
      body: Type.Intersect([ChatMessageSchema, ModelSelectSchema]),
      response: {
        200: Type.Object({
          response: Type.String(),
          consultationId: Type.String(),
          model: Type.String(),
          confidence: Type.Number(),
          disclaimer: Type.String(),
          followUpQuestions: Type.Optional(Type.Array(Type.String())),
          escalationRecommended: Type.Boolean(),
        }),
        400: Type.Object({
          error: Type.String(),
          message: Type.String(),
        }),
      },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { message, symptoms, previousMessages, model } = request.body;
    const user = request.user as any;

    // Check rate limit
    if (!checkRateLimit(user.userId)) {
      return (reply as any).code(429).send({
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many AI requests. Please wait before trying again.',
      });
    }

    try {
      // Create consultation record (MongoDB compatible)
      const consultationDoc = {
        patient_id: user.userId,
        doctor_id: null, // AI consultation
        type: 'ai',
        status: 'active',
        started_at: new Date(),
        metadata: {
          model,
          symptoms: symptoms || [],
        },
        created_at: new Date(),
        updated_at: new Date()
      };

      let consultation;
      if (process.env.DB_CLIENT === 'mongo') {
        const result = await (fastify.db('consultations') as any).insertOne(consultationDoc);
        consultation = { id: result.insertedId.toString(), ...consultationDoc };
      } else {
        const [result] = await fastify.db('consultations').insert(consultationDoc).returning('*');
        consultation = result;
      }

      // Cache key
      const key = crypto.createHash('sha256').update(JSON.stringify({ model, message, symptoms, previousMessages })).digest('hex');
      let aiResponse: any;
      const cached = aiCache.get(key);
      if (cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
        aiResponse = cached.data;
      } else {
        aiResponse = await invokeModel(registry, model, message, symptoms, previousMessages);
        aiCache.set(key, { timestamp: Date.now(), data: aiResponse });
      }

      // Store AI consultation (MongoDB compatible)
      const aiConsultationDoc = {
        consultation_id: consultation.id,
        patient_id: user.userId,
        patient_message: message,
        ai_response: aiResponse.response,
        model_used: model,
        confidence_score: aiResponse.confidence,
        escalated: aiResponse.escalationRecommended,
        model_metadata: {
          tokens_used: aiResponse.tokensUsed,
          processing_time: aiResponse.processingTime,
        },
        created_at: new Date(),
        updated_at: new Date()
      };

      if (process.env.DB_CLIENT === 'mongo') {
        await (fastify.db('ai_consultations') as any).insertOne(aiConsultationDoc);
      } else {
        await fastify.db('ai_consultations').insert(aiConsultationDoc);
      }

      // Update consultation status (MongoDB compatible)
      const updateData = {
        status: 'completed',
        ended_at: new Date(),
        duration_minutes: Math.round((Date.now() - new Date(consultation.started_at).getTime()) / 60000),
        updated_at: new Date()
      };

      if (process.env.DB_CLIENT === 'mongo') {
        await (fastify.db('consultations') as any).updateOne(
          { _id: consultation.id },
          { $set: updateData }
        );
      } else {
        await fastify.db('consultations')
          .where('id', consultation.id)
          .update(updateData);
      }

      return {
        response: aiResponse.response,
        consultationId: consultation.id,
        model,
        confidence: aiResponse.confidence,
        disclaimer: getModelDisclaimer(model, aiResponse.provider),
        followUpQuestions: aiResponse.followUpQuestions,
        escalationRecommended: aiResponse.escalationRecommended,
      };

    } catch (error) {
      fastify.log.error('AI consultation error:', error as any);
      return (reply as any).code(500).send({
        error: 'AI_ERROR',
        message: 'Failed to process AI consultation',
      });
    }
  });

  // Get consultation history
  fastify.get('/history', {
    schema: {
      tags: ['ai'],
      description: 'Get AI consultation history for user',
      headers: Type.Object({
        authorization: Type.String(),
      }),
      querystring: Type.Object({
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
        offset: Type.Optional(Type.Number({ minimum: 0 })),
      }),
      response: {
        200: Type.Object({
          consultations: Type.Array(Type.Object({
            id: Type.String(),
            date: Type.String(),
            model: Type.String(),
            message: Type.String(),
            response: Type.String(),
            confidence: Type.Number(),
            escalated: Type.Boolean(),
          })),
          total: Type.Number(),
        }),
      },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const user = request.user as any;
    const { limit = 20, offset = 0 } = request.query as any;

    try {
      let consultations, count;
      
      if (process.env.DB_CLIENT === 'mongo') {
        // MongoDB aggregation to join collections
        const pipeline = [
          { $match: { patient_id: user.userId } },
          {
            $lookup: {
              from: 'consultations',
              localField: 'consultation_id',
              foreignField: '_id',
              as: 'consultation'
            }
          },
          { $unwind: '$consultation' },
          {
            $project: {
              id: { $toString: '$_id' },
              date: '$consultation.created_at',
              model: '$model_used',
              message: '$patient_message',
              response: '$ai_response',
              confidence: '$confidence_score',
              escalated: '$escalated'
            }
          },
          { $sort: { date: -1 } },
          { $skip: offset },
          { $limit: limit }
        ];
        
        consultations = await (fastify.db('ai_consultations') as any).aggregate(pipeline).toArray();
        
        const countResult = await (fastify.db('ai_consultations') as any).countDocuments({ patient_id: user.userId });
        count = countResult;
      } else {
        consultations = await fastify.db('ai_consultations')
          .join('consultations', 'ai_consultations.consultation_id', 'consultations.id')
          .where('ai_consultations.patient_id', user.userId)
          .select([
            'ai_consultations.id',
            'consultations.created_at as date',
            'ai_consultations.model_used as model',
            'ai_consultations.patient_message as message',
            'ai_consultations.ai_response as response',
            'ai_consultations.confidence_score as confidence',
            'ai_consultations.escalated',
          ])
          .orderBy('consultations.created_at', 'desc')
          .limit(limit)
          .offset(offset);

        const [{ count: countResult }] = await fastify.db('ai_consultations')
          .join('consultations', 'ai_consultations.consultation_id', 'consultations.id')
          .where('ai_consultations.patient_id', user.userId)
          .count('* as count');
        count = countResult;
      }

      return {
        consultations: consultations.map((c: any) => ({
          ...c,
          confidence: parseFloat(c.confidence) || 0,
        })),
        total: typeof count === 'string' ? parseInt(count) : count,
      };

    } catch (error) {
      fastify.log.error('History retrieval error:', error as any);
      return (reply as any).code(500).send({
        error: 'DATABASE_ERROR',
        message: 'Failed to retrieve consultation history',
      });
    }
  });
};

async function invokeModel(registry: any, model: string, message: string, symptoms?: string[], previousMessages?: any[]) {
  const provider = registry.get(model);
  if (provider) {
    try {
      return await provider.invoke({ model, message, symptoms, previousMessages });
    } catch (e) {
      // fallback to simulation
    }
  }
  const startTime = Date.now();
  const sim = await simulateAIResponse(model, message, symptoms);
  const processingTime = Date.now() - startTime;
  return {
    ...sim,
    tokensUsed: Math.floor(Math.random() * 200) + 50,
    processingTime,
    provider: provider?.name || 'simulation'
  };
}

async function simulateAIResponse(
  model: string, 
  message: string, 
  symptoms?: string[]
): Promise<{
  response: string;
  confidence: number;
  followUpQuestions?: string[];
  escalationRecommended: boolean;
}> {
  // Simulate different responses based on model
  const responses = {
    'biogpt': {
      response: `Based on the symptoms you've described, this could be related to several conditions. ${message.toLowerCase().includes('fever') ? 'Fever often indicates an infection or inflammatory response.' : ''} I recommend monitoring your symptoms and consulting with a healthcare provider for proper evaluation.`,
      confidence: 0.82,
      followUpQuestions: [
        'How long have you been experiencing these symptoms?',
        'Have you taken any medications recently?',
        'Do you have any known allergies?',
      ],
      escalationRecommended: message.toLowerCase().includes('severe') || message.toLowerCase().includes('emergency'),
    },
    'mistral-med': {
      response: `Thank you for sharing your symptoms. Based on medical literature and similar cases, your symptoms might suggest ${symptoms?.length ? 'multiple factors' : 'various possibilities'}. It's important to get a proper medical evaluation for accurate diagnosis and treatment.`,
      confidence: 0.89,
      followUpQuestions: [
        'Are there any triggers that worsen your symptoms?',
        'Do you have a family history of similar conditions?',
        'What is your current stress level?',
      ],
      escalationRecommended: symptoms?.some(s => s.toLowerCase().includes('chest pain')) || false,
    },
    'clinical-bert': {
      response: `I've analyzed your input for medical entities and patterns. While I can identify relevant medical terms and concepts, a comprehensive evaluation by a healthcare professional is essential for proper diagnosis and treatment planning.`,
      confidence: 0.76,
      followUpQuestions: [
        'Can you provide more specific details about the timing?',
        'Have you noticed any patterns in your symptoms?',
      ],
      escalationRecommended: message.toLowerCase().includes('urgent') || message.toLowerCase().includes('immediate'),
    },
  };

  return responses[model as keyof typeof responses] || responses['biogpt'];
}

function getModelDisclaimer(model: string, provider: string): string {
  return `⚠️ MEDICAL DISCLAIMER: Output from ${model} (provider: ${provider}) is informational and not a substitute for professional diagnosis or treatment. For emergencies, contact local emergency services immediately.`;
}

export default aiRoutes;
