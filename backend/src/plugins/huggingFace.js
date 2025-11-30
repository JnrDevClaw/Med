import fastifyPlugin from 'fastify-plugin';
import HuggingFaceService from '../services/huggingFaceService.js';

async function huggingFacePlugin(fastify, options) {
  const huggingFaceService = new HuggingFaceService();
  
  // Register the service
  fastify.decorate('huggingFace', huggingFaceService);
  
  // Add health check for Hugging Face service
  fastify.addHook('onReady', async () => {
    try {
      const status = await huggingFaceService.getModelStatus();
      if (status.status === 'available') {
        fastify.log.info('✅ Hugging Face MedGemma model is available');
      } else {
        fastify.log.warn('⚠️  Hugging Face MedGemma model is unavailable:', status.error);
      }
    } catch (error) {
      fastify.log.error('❌ Failed to check Hugging Face model status:', error.message);
    }
  });
  
  fastify.log.info('🤖 Hugging Face plugin registered');
}

export default fastifyPlugin(huggingFacePlugin, {
  name: 'huggingFace',
  dependencies: []
});