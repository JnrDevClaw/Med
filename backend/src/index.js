const fastify = require('fastify');
// Type provider removed to avoid a TypeScript-only dependency
const cors = require('@fastify/cors');
const helmet = require('@fastify/helmet');
const rateLimit = require('@fastify/rate-limit');
const multipart = require('@fastify/multipart');
const staticFiles = require('@fastify/static');
const swagger = require('@fastify/swagger');
const swaggerUi = require('@fastify/swagger-ui');
const jwt = require('@fastify/jwt');
const dotenv = require('dotenv');
const path = require('path');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const consultationRoutes = require('./routes/consultations');
const videoRoutes = require('./routes/video');
const credentialRoutes = require('./routes/credentials');
const aiRoutes = require('./routes/ai');

const dbPlugin = require('./plugins/database');
const ceramicPlugin = require('./plugins/ceramic');
const ipfsPlugin = require('./plugins/ipfs');

const { authMiddleware } = require('./middleware/auth');

dotenv.config();

const server = fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  },
});

const start = async () => {
  try {
    await server.register(helmet, {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
    });

    await server.register(cors, {
      origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
      credentials: true,
    });

    await server.register(rateLimit, {
      max: parseInt(process.env.RATE_LIMIT_MAX || '100'),
      timeWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '60000'),
    });

    await server.register(multipart, {
      limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'),
      },
    });

    await server.register(staticFiles, {
      root: path.join(__dirname, '../uploads'),
      prefix: '/uploads/',
    });

    await server.register(jwt, {
      secret: process.env.JWT_SECRET || 'your-secret-key',
    });

    await server.register(swagger, {
      swagger: {
        info: {
          title: 'Medical Platform API',
          description: 'Decentralized Medical Platform API Documentation',
          version: '1.0.0',
        },
        host: 'localhost:3001',
        schemes: ['http', 'https'],
        consumes: ['application/json'],
        produces: ['application/json'],
        tags: [
          { name: 'auth', description: 'Authentication endpoints' },
          { name: 'users', description: 'User management endpoints' },
          { name: 'consultations', description: 'Medical consultation endpoints' },
          { name: 'video', description: 'Video call endpoints' },
          { name: 'credentials', description: 'Doctor credential endpoints' },
          { name: 'ai', description: 'AI consultation endpoints' },
        ],
      },
    });

    await server.register(swaggerUi, {
      routePrefix: '/docs',
      uiConfig: {
        docExpansion: 'full',
        deepLinking: false,
      },
    });

    await server.register(dbPlugin);
    await server.register(ceramicPlugin);
    await server.register(ipfsPlugin);

    await server.register(authMiddleware);

    await server.register(authRoutes, { prefix: '/api/auth' });
    await server.register(userRoutes, { prefix: '/api/users' });
    await server.register(consultationRoutes, { prefix: '/api/consultations' });
    await server.register(videoRoutes, { prefix: '/api/video' });
    await server.register(credentialRoutes, { prefix: '/api/credentials' });
    await server.register(aiRoutes, { prefix: '/api/ai' });

    server.get('/health', async (request, reply) => ({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0',
    }));

    const port = parseInt(process.env.PORT || '3001');
    const host = process.env.HOST || '0.0.0.0';

    await server.listen({ port, host });
    console.log(`🚀 Server running at http://${host}:${port}`);
    console.log(`📚 API Documentation available at http://${host}:${port}/docs`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

const gracefulShutdown = async () => {
  try {
    console.log('Received shutdown signal, shutting down gracefully...');
    await server.close();
    console.log('Server closed successfully');
    process.exit(0);
  } catch (err) {
    console.error('Error during shutdown:', err);
    process.exit(1);
  }
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

start();
