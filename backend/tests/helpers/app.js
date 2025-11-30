import Fastify from 'fastify';

export async function build(opts = {}) {
  const app = Fastify({
    logger: false // Disable logging during tests
  });

  // Register mock plugins and dependencies
  app.decorate('firestore', opts.firestore || {});
  app.decorate('authenticate', opts.authenticate || ((request, reply, done) => {
    reply.code(401).send({ error: 'UNAUTHORIZED', message: 'Authentication required' });
  }));

  // Mock Firestore functions to return proper chainable objects
  const mockFirestore = opts.firestore || {};
  if (!mockFirestore.collection) {
    mockFirestore.collection = () => mockFirestore;
    mockFirestore.doc = () => mockFirestore;
    mockFirestore.query = () => mockFirestore;
    mockFirestore.where = () => mockFirestore;
    mockFirestore.orderBy = () => mockFirestore;
    mockFirestore.limit = () => mockFirestore;
  }

  app.decorate('firestore', mockFirestore);

  try {
    // Register routes with error handling
    const questionsModule = await import('../../src/routes/questions.js');
    await app.register(questionsModule.default, { prefix: '/questions' });
    
    const answersModule = await import('../../src/routes/answers.js');
    await app.register(answersModule.default, { prefix: '/answers' });
    
    const commentsModule = await import('../../src/routes/comments.js');
    await app.register(commentsModule.default, { prefix: '/comments' });
  } catch (error) {
    console.error('Failed to register routes:', error);
    throw error;
  }

  return app;
}