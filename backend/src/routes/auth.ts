import { FastifyPluginAsync } from 'fastify';
import { Type, Static } from '@sinclair/typebox';

const SignupSchema = Type.Object({
  did: Type.String(),
  profile: Type.Object({
    name: Type.String(),
    role: Type.Union([Type.Literal('patient'), Type.Literal('doctor')]),
    email: Type.Optional(Type.String({ format: 'email' })),
  }),
});

const LoginSchema = Type.Object({
  did: Type.String(),
  signature: Type.String(),
  challenge: Type.String(),
});

const RefreshTokenSchema = Type.Object({
  refreshToken: Type.String(),
});

type SignupRequest = Static<typeof SignupSchema>;
type LoginRequest = Static<typeof LoginSchema>;
type RefreshTokenRequest = Static<typeof RefreshTokenSchema>;

const authRoutes: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  
  // Generate authentication challenge
  fastify.get('/challenge', {
    schema: {
      tags: ['auth'],
      description: 'Generate authentication challenge for DID',
      response: {
        200: Type.Object({
          challenge: Type.String(),
          expires: Type.String(),
        }),
      },
    },
  }, async (request, reply) => {
    const challenge = fastify.jwt.sign(
      { type: 'auth_challenge', timestamp: Date.now() },
      { expiresIn: '5m' }
    );
    
    return {
      challenge,
      expires: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    };
  });

  // User signup
  fastify.post<{ Body: SignupRequest }>('/signup', {
    schema: {
      tags: ['auth'],
      description: 'Register new user with DID',
      body: SignupSchema,
      response: {
        201: Type.Object({
          success: Type.Boolean(),
          message: Type.String(),
          user: Type.Object({
            id: Type.String(),
            did: Type.String(),
            profile: Type.Object({
              name: Type.String(),
              role: Type.String(),
            }),
          }),
        }),
        400: Type.Object({
          error: Type.String(),
          message: Type.String(),
        }),
      },
    },
  }, async (request, reply) => {
    const { did, profile } = request.body;

    try {
      // Check if user already exists
      const existingUser = await fastify.db('users')
        .where('did', did)
        .first();

      if (existingUser) {
        return reply.code(400).send({
          error: 'USER_EXISTS',
          message: 'User with this DID already exists',
        });
      }

      // Create user in database
      const [newUser] = await fastify.db('users')
        .insert({
          did,
          name: profile.name,
          role: profile.role,
          email: profile.email || null,
          verified: false,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returning(['id', 'did', 'name', 'role']);

      // Store profile on Ceramic (IDX)
      try {
        // This would integrate with Ceramic to store the profile
        // For now, we'll store a reference
        await fastify.db('ceramic_profiles')
          .insert({
            user_id: newUser.id,
            did,
            profile_stream_id: null, // Would be set after Ceramic integration
            created_at: new Date(),
          });
      } catch (ceramicError) {
        fastify.log.warn('Failed to store profile on Ceramic:', ceramicError);
      }

      reply.code(201).send({
        success: true,
        message: 'User registered successfully',
        user: {
          id: newUser.id,
          did: newUser.did,
          profile: {
            name: newUser.name,
            role: newUser.role,
          },
        },
      });

    } catch (error) {
      fastify.log.error('Signup error:', error);
      return reply.code(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to register user',
      });
    }
  });

  // User login
  fastify.post<{ Body: LoginRequest }>('/login', {
    schema: {
      tags: ['auth'],
      description: 'Authenticate user with DID signature',
      body: LoginSchema,
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          accessToken: Type.String(),
          refreshToken: Type.String(),
          user: Type.Object({
            id: Type.String(),
            did: Type.String(),
            name: Type.String(),
            role: Type.String(),
            verified: Type.Boolean(),
          }),
        }),
        401: Type.Object({
          error: Type.String(),
          message: Type.String(),
        }),
      },
    },
  }, async (request, reply) => {
    const { did, signature, challenge } = request.body;

    try {
      // Verify challenge
      try {
        fastify.jwt.verify(challenge);
      } catch (error) {
        return reply.code(401).send({
          error: 'INVALID_CHALLENGE',
          message: 'Invalid or expired challenge',
        });
      }

      // Find user
      const user = await fastify.db('users')
        .where('did', did)
        .first();

      if (!user) {
        return reply.code(401).send({
          error: 'USER_NOT_FOUND',
          message: 'User not found',
        });
      }

      // TODO: Verify DID signature
      // This would involve verifying the signature against the DID document
      // For now, we'll assume the signature is valid

      // Generate tokens
      const accessToken = fastify.jwt.sign(
        { 
          userId: user.id,
          did: user.did,
          role: user.role,
        },
        { expiresIn: '1h' }
      );

      const refreshToken = fastify.jwt.sign(
        { 
          userId: user.id,
          type: 'refresh',
        },
        { expiresIn: '7d' }
      );

      // Store refresh token
      await fastify.db('refresh_tokens')
        .insert({
          user_id: user.id,
          token: refreshToken,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          created_at: new Date(),
        });

      return {
        success: true,
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          did: user.did,
          name: user.name,
          role: user.role,
          verified: user.verified,
        },
      };

    } catch (error) {
      fastify.log.error('Login error:', error);
      return reply.code(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Login failed',
      });
    }
  });

  // Refresh token
  fastify.post<{ Body: RefreshTokenRequest }>('/refresh', {
    schema: {
      tags: ['auth'],
      description: 'Refresh access token',
      body: RefreshTokenSchema,
      response: {
        200: Type.Object({
          accessToken: Type.String(),
          refreshToken: Type.String(),
        }),
        401: Type.Object({
          error: Type.String(),
          message: Type.String(),
        }),
      },
    },
  }, async (request, reply) => {
    const { refreshToken } = request.body;

    try {
      // Verify refresh token
      const payload = fastify.jwt.verify(refreshToken);
      
      if (typeof payload === 'string' || payload.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      // Check if token exists and is valid
      const tokenRecord = await fastify.db('refresh_tokens')
        .where('token', refreshToken)
        .where('user_id', payload.userId)
        .where('expires_at', '>', new Date())
        .first();

      if (!tokenRecord) {
        return reply.code(401).send({
          error: 'INVALID_TOKEN',
          message: 'Invalid or expired refresh token',
        });
      }

      // Get user
      const user = await fastify.db('users')
        .where('id', payload.userId)
        .first();

      if (!user) {
        return reply.code(401).send({
          error: 'USER_NOT_FOUND',
          message: 'User not found',
        });
      }

      // Generate new tokens
      const newAccessToken = fastify.jwt.sign(
        { 
          userId: user.id,
          did: user.did,
          role: user.role,
        },
        { expiresIn: '1h' }
      );

      const newRefreshToken = fastify.jwt.sign(
        { 
          userId: user.id,
          type: 'refresh',
        },
        { expiresIn: '7d' }
      );

      // Update refresh token
      await fastify.db('refresh_tokens')
        .where('id', tokenRecord.id)
        .update({
          token: newRefreshToken,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          updated_at: new Date(),
        });

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };

    } catch (error) {
      fastify.log.error('Token refresh error:', error);
      return reply.code(401).send({
        error: 'INVALID_TOKEN',
        message: 'Invalid refresh token',
      });
    }
  });

  // Logout
  fastify.post('/logout', {
    schema: {
      tags: ['auth'],
      description: 'Logout user and invalidate refresh token',
      headers: Type.Object({
        authorization: Type.String(),
      }),
      body: RefreshTokenSchema,
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          message: Type.String(),
        }),
      },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { refreshToken } = request.body as RefreshTokenRequest;
    const user = request.user;

    try {
      // Invalidate refresh token
      await fastify.db('refresh_tokens')
        .where('token', refreshToken)
        .where('user_id', user.userId)
        .delete();

      return {
        success: true,
        message: 'Logged out successfully',
      };

    } catch (error) {
      fastify.log.error('Logout error:', error);
      return {
        success: true,
        message: 'Logged out successfully',
      };
    }
  });
};

export default authRoutes;
