const { Type } = require('@sinclair/typebox');

module.exports = async function (fastify, opts) {
  fastify.get('/challenge', {
    schema: {
      tags: ['auth'],
      description: 'Generate authentication challenge for DID',
      response: {
        200: Type.Object({ challenge: Type.String(), expires: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const challenge = fastify.jwt.sign({ type: 'auth_challenge', timestamp: Date.now() }, { expiresIn: '5m' });
    return { challenge, expires: new Date(Date.now() + 5 * 60 * 1000).toISOString() };
  });

  fastify.post('/signup', {
    schema: {
      tags: ['auth'],
      description: 'Register new user with DID',
      body: Type.Object({ did: Type.String(), profile: Type.Object({ name: Type.String(), role: Type.Union([Type.Literal('patient'), Type.Literal('doctor')]), email: Type.Optional(Type.String({ format: 'email' })) }) }),
    },
  }, async (request, reply) => {
    const { did, profile } = request.body;
    try {
      const existingUser = await fastify.db('users').where('did', did).first();
      if (existingUser) return reply.code(400).send({ error: 'USER_EXISTS', message: 'User with this DID already exists' });

      const [newUser] = await fastify.db('users').insert({ did, name: profile.name, role: profile.role, email: profile.email || null, verified: false, created_at: new Date(), updated_at: new Date() }).returning(['id', 'did', 'name', 'role']);

      try {
        await fastify.db('ceramic_profiles').insert({ user_id: newUser.id, did, profile_stream_id: null, created_at: new Date() });
      } catch (ceramicError) {
        fastify.log.warn('Failed to store profile on Ceramic:', ceramicError);
      }

      reply.code(201).send({ success: true, message: 'User registered successfully', user: { id: newUser.id, did: newUser.did, profile: { name: newUser.name, role: newUser.role } } });
    } catch (error) {
      fastify.log.error('Signup error:', error);
      return reply.code(500).send({ error: 'INTERNAL_ERROR', message: 'Failed to register user' });
    }
  });

  fastify.post('/login', {
    schema: {
      tags: ['auth'],
      description: 'Authenticate user with DID signature',
      body: Type.Object({ did: Type.String(), signature: Type.String(), challenge: Type.String() }),
    },
  }, async (request, reply) => {
    const { did, signature, challenge } = request.body;
    try {
      try { fastify.jwt.verify(challenge); } catch (error) { return reply.code(401).send({ error: 'INVALID_CHALLENGE', message: 'Invalid or expired challenge' }); }

      const user = await fastify.db('users').where('did', did).first();
      if (!user) return reply.code(401).send({ error: 'USER_NOT_FOUND', message: 'User not found' });

      const accessToken = fastify.jwt.sign({ userId: user.id, did: user.did, role: user.role }, { expiresIn: '1h' });
      const refreshToken = fastify.jwt.sign({ userId: user.id, type: 'refresh' }, { expiresIn: '7d' });

      await fastify.db('refresh_tokens').insert({ user_id: user.id, token: refreshToken, expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), created_at: new Date() });

      return { success: true, accessToken, refreshToken, user: { id: user.id, did: user.did, name: user.name, role: user.role, verified: user.verified } };
    } catch (error) {
      fastify.log.error('Login error:', error);
      return reply.code(500).send({ error: 'INTERNAL_ERROR', message: 'Login failed' });
    }
  });

  fastify.post('/refresh', {
    schema: {
      tags: ['auth'],
      description: 'Refresh access token',
      body: Type.Object({ refreshToken: Type.String() }),
    },
  }, async (request, reply) => {
    const { refreshToken } = request.body;
    try {
      const payload = fastify.jwt.verify(refreshToken);
      if (typeof payload === 'string' || payload.type !== 'refresh') throw new Error('Invalid token type');

      const tokenRecord = await fastify.db('refresh_tokens').where('token', refreshToken).where('user_id', payload.userId).where('expires_at', '>', new Date()).first();
      if (!tokenRecord) return reply.code(401).send({ error: 'INVALID_TOKEN', message: 'Invalid or expired refresh token' });

      const user = await fastify.db('users').where('id', payload.userId).first();
      if (!user) return reply.code(401).send({ error: 'USER_NOT_FOUND', message: 'User not found' });

      const newAccessToken = fastify.jwt.sign({ userId: user.id, did: user.did, role: user.role }, { expiresIn: '1h' });
      const newRefreshToken = fastify.jwt.sign({ userId: user.id, type: 'refresh' }, { expiresIn: '7d' });

      await fastify.db('refresh_tokens').where('id', tokenRecord.id).update({ token: newRefreshToken, expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), updated_at: new Date() });

      return { accessToken: newAccessToken, refreshToken: newRefreshToken };
    } catch (error) {
      fastify.log.error('Token refresh error:', error);
      return reply.code(401).send({ error: 'INVALID_TOKEN', message: 'Invalid refresh token' });
    }
  });

  fastify.post('/logout', {
    schema: {
      tags: ['auth'],
      description: 'Logout user and invalidate refresh token',
      headers: Type.Object({ authorization: Type.String() }),
      body: Type.Object({ refreshToken: Type.String() }),
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { refreshToken } = request.body;
    const user = request.user;
    try {
      await fastify.db('refresh_tokens').where('token', refreshToken).where('user_id', user.userId).delete();
      return { success: true, message: 'Logged out successfully' };
    } catch (error) {
      fastify.log.error('Logout error:', error);
      return { success: true, message: 'Logged out successfully' };
    }
  });
};
