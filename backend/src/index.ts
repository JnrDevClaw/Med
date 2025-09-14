import fastify from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import staticFiles from '@fastify/static';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import jwt from '@fastify/jwt';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Import routes
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import consultationRoutes from './routes/consultations';
import videoRoutes from './routes/video';
import credentialRoutes from './routes/credentials';
import aiRoutes from './routes/ai';

// Import plugins
import dbPlugin from './plugins/database';
import ceramicPlugin from './plugins/ceramic';
import ipfsPlugin from './plugins/ipfs';

// Import middleware
import { authMiddleware } from './middleware/auth';

// Load environment variables
dotenv.config();

const server = fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  },
}).withTypeProvider<TypeBoxTypeProvider>();

const start = async () => {
  try {
    // Ensure uploads directory exists
    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
      console.log(`📁 Created uploads directory: ${uploadDir}`);
    }

    // Register plugins
    await server.register(helmet, {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
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
        fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 10MB
      },
    });

    await server.register(staticFiles, {
      root: path.join(__dirname, '../uploads'),
      prefix: '/uploads/',
    });

    await server.register(jwt, {
      secret: process.env.JWT_SECRET || 'your-secret-key',
    });

    // Swagger documentation
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

    // Register custom plugins
  await server.register(dbPlugin);
  server.log.info(`Database driver mode: ${process.env.DB_CLIENT || 'pg'}`);
    await server.register(ceramicPlugin);
    await server.register(ipfsPlugin);

    // Register auth middleware
    await server.register(authMiddleware);

    // Register routes
    await server.register(authRoutes, { prefix: '/api/auth' });
    await server.register(userRoutes, { prefix: '/api/users' });
    await server.register(consultationRoutes, { prefix: '/api/consultations' });
    await server.register(videoRoutes, { prefix: '/api/video' });
    await server.register(credentialRoutes, { prefix: '/api/credentials' });
    await server.register(aiRoutes, { prefix: '/api/ai' });

    // Health check endpoint
    server.get('/health', async (request, reply) => {
      return { 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: '1.0.0'
      };
    });

    // Start server
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

// Handle graceful shutdown
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
