// @ts-nocheck
import { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

// (Light) augment only if not present; use any to avoid type conflicts from JWT typings
declare module 'fastify' {
  interface FastifyRequest { user: any }
  interface FastifyInstance { authenticate: any; requireRole: any }
}

export const authMiddleware = fp(async function (fastify: FastifyInstance) {
  // Authentication middleware
  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const token = request.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return reply.code(401).send({
          error: 'UNAUTHORIZED',
          message: 'Access token required',
        });
      }

      const payload = fastify.jwt.verify(token);
      
      if (typeof payload === 'string') {
        throw new Error('Invalid token format');
      }

      // Get user from database to ensure they still exist
      const user = await fastify.db('users')
        .where('id', payload.userId)
        .first();

      if (!user) {
        return reply.code(401).send({
          error: 'USER_NOT_FOUND',
          message: 'User not found',
        });
      }

  (request as any).user = { userId: user.id, did: user.did, role: user.role };

    } catch (error) {
      return reply.code(401).send({
        error: 'INVALID_TOKEN',
        message: 'Invalid or expired token',
      });
    }
  });

  // Role-based access control middleware
  fastify.decorate('requireRole', (requiredRole: 'patient' | 'doctor' | 'admin') => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
  if (!(request as any).user) {
        return reply.code(401).send({
          error: 'UNAUTHORIZED',
          message: 'Authentication required',
        });
      }

  if ((request as any).user.role !== requiredRole && requiredRole !== 'admin') {
        return reply.code(403).send({
          error: 'FORBIDDEN',
          message: `${requiredRole} role required`,
        });
      }
    };
  });
});
