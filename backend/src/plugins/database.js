const fp = require('fastify-plugin');
const knex = require('knex');

module.exports = fp(async function (fastify, opts) {
  const dbClient = process.env.DB_CLIENT || 'pg';

  if (dbClient === 'mongo') {
    // register mongodb plugin (it will decorate fastify.mongo)
    // lazy-require to avoid loading when not needed
    const mongoPlugin = require('./mongodb');
    await mongoPlugin(fastify, opts);

    // provide a thin adapter so existing code can call fastify.db(collectionName)
    fastify.decorate('db', function (collectionName) {
      return fastify.mongo.getCollection(collectionName);
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
    pool: { min: 2, max: 10 },
    migrations: { tableName: 'knex_migrations', directory: '../migrations' },
    seeds: { directory: '../seeds' },
  });

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
