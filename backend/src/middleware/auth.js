const fp = require('fastify-plugin');

const authMiddleware = fp(async function (fastify) {
  fastify.decorate('authenticate', async (request, reply) => {
    try {
      const token = request.headers.authorization && request.headers.authorization.replace('Bearer ', '');
      if (!token) {
        return reply.code(401).send({ error: 'UNAUTHORIZED', message: 'Access token required' });
      }

      const payload = fastify.jwt.verify(token);
      if (typeof payload === 'string') throw new Error('Invalid token format');

      const user = await fastify.db('users').where('id', payload.userId).first();
      if (!user) {
        return reply.code(401).send({ error: 'USER_NOT_FOUND', message: 'User not found' });
      }

      request.user = { userId: user.id, did: user.did, role: user.role };
    } catch (error) {
      return reply.code(401).send({ error: 'INVALID_TOKEN', message: 'Invalid or expired token' });
    }
  });

  fastify.decorate('requireRole', (requiredRole) => {
    return async (request, reply) => {
      if (!request.user) {
        return reply.code(401).send({ error: 'UNAUTHORIZED', message: 'Authentication required' });
      }

      if (request.user.role !== requiredRole && requiredRole !== 'admin') {
        return reply.code(403).send({ error: 'FORBIDDEN', message: `${requiredRole} role required` });
      }
    };
  });
});

module.exports = { authMiddleware };
