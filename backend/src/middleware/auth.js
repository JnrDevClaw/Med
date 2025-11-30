import fp from 'fastify-plugin';

const authMiddleware = fp(async function (fastify) {
  // Authentication middleware
  fastify.decorate('authenticate', async (request, reply) => {
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

      // Try to get verification status from cache first
      let verificationStatus = null;
      if (fastify.verificationCache) {
        verificationStatus = fastify.verificationCache.getVerificationStatus(payload.userId);
      }

      // Get user from Firestore to ensure they still exist
      const user = await fastify.userProfile.firestoreService.getUserById(payload.userId);

      if (!user) {
        return reply.code(401).send({
          error: 'USER_NOT_FOUND',
          message: 'User not found',
        });
      }

      // Use cached verification status if available, otherwise use fresh from database
      const verified = verificationStatus !== null ? verificationStatus : user.verified;

      // Cache the verification status if not already cached
      if (verificationStatus === null && fastify.verificationCache) {
        fastify.verificationCache.setVerificationStatus(user.id, user.verified);
      }

      request.user = { 
        userId: user.id, 
        username: user.username, 
        role: user.role, 
        verified: verified 
      };

    } catch (error) {
      return reply.code(401).send({
        error: 'INVALID_TOKEN',
        message: 'Invalid or expired token',
      });
    }
  });

  // Role-based access control middleware
  fastify.decorate('requireRole', (requiredRole) => {
    return async (request, reply) => {
      if (!request.user) {
        return reply.code(401).send({
          error: 'UNAUTHORIZED',
          message: 'Authentication required',
        });
      }

      if (request.user.role !== requiredRole && requiredRole !== 'admin') {
        return reply.code(403).send({
          error: 'FORBIDDEN',
          message: `${requiredRole} role required`,
        });
      }
    };
  });

  // Doctor verification middleware
  fastify.decorate('requireVerifiedDoctor', async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
    }

    if (request.user.role !== 'doctor') {
      return reply.code(403).send({
        error: 'FORBIDDEN',
        message: 'Doctor role required',
      });
    }

    if (!request.user.verified) {
      return reply.code(403).send({
        error: 'VERIFICATION_REQUIRED',
        message: 'Doctor verification required to access this feature',
        details: {
          verificationStatus: 'unverified',
          redirectTo: '/credentials/upload'
        }
      });
    }
  });

  // General verification middleware (for any role)
  fastify.decorate('requireVerified', async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
    }

    if (!request.user.verified) {
      return reply.code(403).send({
        error: 'VERIFICATION_REQUIRED',
        message: 'Account verification required to access this feature',
        details: {
          verificationStatus: 'unverified',
          userRole: request.user.role,
          redirectTo: request.user.role === 'doctor' ? '/credentials/upload' : '/profile/verify'
        }
      });
    }
  });
});

export { authMiddleware };
