import fp from 'fastify-plugin';
import knex, { Knex } from 'knex';

declare module 'fastify' {
  interface FastifyInstance {
    db: Knex;
  }
}

export default fp(async function (fastify, opts) {
  const dbClient = process.env.DB_CLIENT || 'pg';

  if (dbClient === 'mongo') {
    // Dynamically register Mongo plugin
    const mongoPlugin = await import('./mongodb');
    // mongoPlugin default export is a function wrapped by fastify-plugin; call it
    await (mongoPlugin as any).default(fastify, opts);

    // Provide thin adapter so existing code can call fastify.db(collectionName)
    fastify.decorate('db', function (collectionName: string) {
      return (fastify as any).mongo.getCollection(collectionName);
    });

    fastify.addHook('onClose', async (instance) => {
      // mongo plugin handles client close
    });

    fastify.log.info('Using MongoDB client via fastify.mongo');
    return;
  }

  // default Postgres via Knex
  const db = knex({
    client: 'postgresql',
    connection: process.env.DATABASE_URL || {
      host: 'localhost',
      port: 5432,
      user: 'postgres',
      password: 'password',
      database: 'medplatform',
    },
    pool: {
      min: 2,
      max: 10,
    },
    migrations: {
      tableName: 'knex_migrations',
      directory: '../migrations',
    },
    seeds: {
      directory: '../seeds',
    },
  });

  // Test database connection
  try {
    await db.raw('SELECT 1+1 as result');
    fastify.log.info('Database connected successfully');
  } catch (error) {
    fastify.log.error('Database connection failed:', error);
    throw error;
  }

  fastify.decorate('db', db);

  fastify.addHook('onClose', async (instance) => {
    await instance.db.destroy();
  });
});
