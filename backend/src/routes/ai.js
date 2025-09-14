const { Type } = require('@sinclair/typebox');

module.exports = async function (fastify, opts) {
  fastify.get('/models', {
    schema: { tags: ['ai'], description: 'Get available AI medical models' },
  }, async (request, reply) => {
    return { models: [ { id: 'biogpt', name: 'BioGPT', description: 'Large language model trained on biomedical literature', capabilities: ['symptom analysis'], accuracy: 0.87, responseTime: '2-5 seconds' }, { id: 'mistral-med', name: 'Mistral Medical', description: 'Specialized model for medical consultations', capabilities: ['diagnosis assistance'], accuracy: 0.91, responseTime: '3-7 seconds' }, { id: 'clinical-bert', name: 'Clinical BERT', description: 'BERT model fine-tuned on clinical notes', capabilities: ['symptom extraction'], accuracy: 0.84, responseTime: '1-3 seconds' } ] };
  });

  fastify.post('/chat', {
    schema: { tags: ['ai'], description: 'Send message to AI medical assistant', headers: Type.Object({ authorization: Type.String() }), body: Type.Intersect([Type.Object({ message: Type.String() }), Type.Object({ model: Type.String() })]) },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { message, symptoms, previousMessages, model } = request.body;
    const user = request.user;
    try {
      const [consultation] = await fastify.db('consultations').insert({ patient_id: user.userId, doctor_id: null, type: 'ai', status: 'active', started_at: new Date(), metadata: { model, symptoms: symptoms || [] } }).returning('*');
      const aiResponse = await simulateAIResponse(model, message, symptoms);
      await fastify.db('ai_consultations').insert({ consultation_id: consultation.id, patient_id: user.userId, patient_message: message, ai_response: aiResponse.response, model_used: model, confidence_score: aiResponse.confidence, escalated: aiResponse.escalationRecommended, model_metadata: { tokens_used: aiResponse.tokensUsed, processing_time: aiResponse.processingTime } });
      await fastify.db('consultations').where('id', consultation.id).update({ status: 'completed', ended_at: new Date(), duration_minutes: Math.round((Date.now() - new Date(consultation.started_at).getTime()) / 60000) });
      return { response: aiResponse.response, consultationId: consultation.id, model, confidence: aiResponse.confidence, disclaimer: getModelDisclaimer(model), followUpQuestions: aiResponse.followUpQuestions, escalationRecommended: aiResponse.escalationRecommended };
    } catch (error) {
      fastify.log.error('AI consultation error:', error);
      return reply.code(500).send({ error: 'AI_ERROR', message: 'Failed to process AI consultation' });
    }
  });
};

async function simulateAIResponse(model, message, symptoms) {
  const startTime = Date.now();
  const responses = {
    biogpt: { response: `Simulated response: ${message}`, confidence: 0.82, followUpQuestions: [], escalationRecommended: false },
    'mistral-med': { response: `Simulated response: ${message}`, confidence: 0.89, followUpQuestions: [], escalationRecommended: false },
    'clinical-bert': { response: `Simulated response: ${message}`, confidence: 0.76, followUpQuestions: [], escalationRecommended: false },
  };
  const out = responses[model] || responses['biogpt'];
  return { ...out, tokensUsed: Math.floor(Math.random() * 200) + 50, processingTime: Date.now() - startTime };
}

function getModelDisclaimer(model) { return `⚠️ IMPORTANT MEDICAL DISCLAIMER: This AI assistant (${model}) is for informational purposes only.`; }
