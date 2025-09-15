import fp from 'fastify-plugin';
import { MongoClient } from 'mongodb';

export default fp(async (fastify, opts) => {
  const mongoUrl = process.env.MONGO_URL || 'mongodb://localhost:27017';
  const dbName = process.env.MONGO_DB || 'medplatform';

  const client = new MongoClient(mongoUrl);

  try {
    await client.connect();
    fastify.log.info('Connected to MongoDB');
  } catch (err) {
    fastify.log.error('MongoDB connection failed:', err);
    throw err;
  }

  const db = client.db(dbName);

  const getCollection = (name) => db.collection(name);

  fastify.decorate('mongo', { client, db, getCollection });

  fastify.addHook('onClose', async (instance) => {
    await client.close();
  });
});
