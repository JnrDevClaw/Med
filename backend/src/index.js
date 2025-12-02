import fastify from 'fastify';
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
import { fileURLToPath } from 'url';

// Import routes
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import consultationRoutes from './routes/consultations.js';
import videoRoutes from './routes/video.js';
import credentialRoutes from './routes/credentials.js';
import aiRoutes from './routes/ai.js';
import questionsRoutes from './routes/questions.js';
import answersRoutes from './routes/answers.js';
import commentsRoutes from './routes/comments.js';
import doctorDiscussionsRoutes from './routes/doctorDiscussions.js';
import doctorCommentsRoutes from './routes/doctorComments.js';
import notificationRoutes from './routes/notifications.js';

// Import plugins
import ceramicPlugin from './plugins/ceramic.js';
import ipfsPlugin from './plugins/ipfs.js';
import databasePlugin from './plugins/database.js';
import userProfilePlugin from './plugins/userProfile.js';
import huggingFacePlugin from './plugins/huggingFace.js';
import consultationPlugin from './plugins/consultation.js';
import webrtcPlugin from './plugins/webrtc.js';
import credentialPlugin from './plugins/credential.js';
import verificationCachePlugin from './plugins/verificationCache.js';
import integrationPlugin from './plugins/integration.js';
import performancePlugin from './plugins/performance.js';

// Import middleware
import { authMiddleware } from './middleware/auth.js';

// ES6 module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

const server = fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  },
  pluginTimeout: 30000, // 30 seconds for plugin initialization
  requestTimeout: 60000, // 60 seconds for request timeout
});

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

    // Configure CORS for production and development
    const allowedOrigins = [
      'http://localhost:5173',
      'https://medconnect124.netlify.app',
      'https://medconnect1.vercel.app',
      'https://med-qkh3.onrender.com',
      // Split CORS_ORIGIN by comma if it contains multiple origins
      ...(process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim()) : [])
    ].filter(Boolean);

    await server.register(cors, {
      origin: (origin, cb) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return cb(null, true);
        
        // Check if origin matches any allowed origins
        const isAllowed = allowedOrigins.some(allowed => {
          if (allowed && origin) {
            return origin === allowed || origin.startsWith(allowed);
          }
          return false;
        });
        
        if (isAllowed) {
          cb(null, true);
        } else {
          console.warn(`CORS blocked origin: ${origin}`);
          cb(new Error(`Origin ${origin} not allowed by CORS policy`));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
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
          { name: 'questions', description: 'Q&A forum endpoints' },
          { name: 'answers', description: 'Q&A answer endpoints' },
          { name: 'comments', description: 'Q&A comment endpoints' },
          { name: 'doctor-discussions', description: 'Doctor discussion forum endpoints' },
          { name: 'doctor-comments', description: 'Doctor discussion comment endpoints' },
          { name: 'notifications', description: 'Unified notification system endpoints' },
          { name: 'performance', description: 'Performance monitoring and optimization endpoints' },
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
    await server.register(ceramicPlugin);
    await server.register(ipfsPlugin);
    await server.register(databasePlugin); // Auto-selects Firestore or MongoDB
    await server.register(userProfilePlugin);
    await server.register(huggingFacePlugin);
    await server.register(consultationPlugin);
    await server.register(webrtcPlugin);
    await server.register(credentialPlugin);
    await server.register(verificationCachePlugin);
    await server.register(performancePlugin);
    await server.register(integrationPlugin);

    // Register auth middleware
    await server.register(authMiddleware);

    // Register routes
    await server.register(authRoutes, { prefix: '/api/auth' });
    await server.register(userRoutes, { prefix: '/api/users' });
    await server.register(consultationRoutes, { prefix: '/api/consultations' });
    await server.register(videoRoutes, { prefix: '/api/video' });
    await server.register(credentialRoutes, { prefix: '/api/credentials' });
    await server.register(aiRoutes, { prefix: '/api/ai' });
    await server.register(questionsRoutes, { prefix: '/api/questions' });
    await server.register(answersRoutes, { prefix: '/api/answers' });
    await server.register(commentsRoutes, { prefix: '/api/comments' });
    await server.register(doctorDiscussionsRoutes, { prefix: '/api/doctor-discussions' });
    await server.register(doctorCommentsRoutes, { prefix: '/api/doctor-comments' });
    await server.register(notificationRoutes, { prefix: '/api/notifications' });

    // Health check endpoint
    server.get('/health', async (request, reply) => {
      const healthData = { 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        memory: process.memoryUsage()
      };
      
      // Log health checks in development for debugging
      if (process.env.NODE_ENV !== 'production') {
        console.log(`🏥 Health check from ${request.ip} at ${healthData.timestamp}`);
      }
      
      return healthData;
    });

    // CORS test endpoint
    server.get('/cors-test', async (request, reply) => {
      return {
        message: 'CORS is working!',
        origin: request.headers.origin || 'No origin header',
        timestamp: new Date().toISOString(),
        allowedOrigins: allowedOrigins
      };
    });



    // Start server - use PORT from environment (Render sets this to 3001)
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
