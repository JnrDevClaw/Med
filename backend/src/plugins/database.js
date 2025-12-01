import fp from 'fastify-plugin';
import { MongoClient } from 'mongodb';
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

/**
 * Database plugin that automatically selects between Firestore and MongoDB
 * - Uses Firestore if credentials are configured
 * - Falls back to local MongoDB if Firestore is not available
 */
export default fp(async (fastify, opts) => {
  const hasFirestoreConfig = !!(
    process.env.VITE_FIREBASE_API_KEY &&
    process.env.VITE_FIREBASE_PROJECT_ID
  );

  if (hasFirestoreConfig) {
    // Use Firestore
    try {
      const firebaseConfig = {
        apiKey: process.env.VITE_FIREBASE_API_KEY,
        authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.VITE_FIREBASE_PROJECT_ID,
        storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.VITE_FIREBASE_APP_ID,
      };

      const firebaseApp = initializeApp(firebaseConfig);
      const firestore = getFirestore(firebaseApp);

      fastify.decorate('firestore', firestore);
      fastify.decorate('dbType', 'firestore');
      
      fastify.log.info('✅ Using Firestore as database');
    } catch (error) {
      fastify.log.warn('⚠️  Firestore configuration found but initialization failed, falling back to MongoDB');
      fastify.log.warn('Error:', error.message);
      await initializeMongoDB(fastify);
    }
  } else {
    // Fallback to MongoDB
    fastify.log.info('ℹ️  No Firestore configuration found, using MongoDB');
    await initializeMongoDB(fastify);
  }
}, {
  name: 'firebase' // Keep name as 'firebase' for backward compatibility with existing plugins
});

async function initializeMongoDB(fastify) {
  const mongoUrl = process.env.MONGO_URL || 'mongodb://localhost:27017';
  const dbName = process.env.MONGO_DB || 'medplatform';

  const client = new MongoClient(mongoUrl);

  try {
    await client.connect();
    fastify.log.info(`✅ Connected to MongoDB at ${mongoUrl}`);
  } catch (err) {
    fastify.log.error('❌ MongoDB connection failed:', err);
    throw err;
  }

  const db = client.db(dbName);
  const getCollection = (name) => db.collection(name);

  fastify.decorate('mongo', { client, db, getCollection });
  fastify.decorate('dbType', 'mongodb');

  fastify.addHook('onClose', async (instance) => {
    await client.close();
    fastify.log.info('MongoDB connection closed');
  });
}
