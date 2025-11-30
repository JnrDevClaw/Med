import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  doc,
  deleteDoc,
  updateDoc,
} from 'firebase/firestore';

const authRoutes = async (fastify, opts) => {
  
  // Generate authentication challenge
  fastify.get('/challenge', {
    schema: {
      tags: ['auth'],
      description: 'Generate authentication challenge for DID',
      response: {
        200: {
          type: 'object',
          properties: {
            challenge: { type: 'string' },
            expires: { type: 'string' }
          }
        }
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
  fastify.post('/signup', {
    schema: {
      tags: ['auth'],
      description: 'Register new user with username',
      body: {
        type: 'object',
        required: ['username', 'profile'],
        properties: {
          username: { type: 'string', minLength: 3, maxLength: 30 },
          profile: {
            type: 'object',
            required: ['role'],
            properties: {
              role: { type: 'string', enum: ['patient', 'doctor'] },
              email: { type: 'string', format: 'email' }
            }
          }
        }
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                username: { type: 'string' },
                profile: {
                  type: 'object',
                  properties: {
                    username: { type: 'string' },
                    role: { type: 'string' }
                  }
                }
              }
            }
          }
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' }
          }
        }
      },
    },
  }, async (request, reply) => {
    const { username, profile } = request.body;

    // log incoming payload for debugging signup failures
    fastify.log.debug({ body: request.body }, 'Signup payload');

    try {
      // Use the new UserProfileService to create user
      const newUser = await fastify.userProfile.createUserProfile(username, {
        role: profile.role,
        email: profile.email || null,
        verified: false
      });

      reply.code(201).send({
        success: true,
        message: 'User registered successfully',
        user: {
          id: newUser.id,
          username: newUser.username,
          profile: {
            username: newUser.username,
            role: newUser.role,
          },
        },
      });

    } catch (error) {
      // log full stack to reveal underlying DB/constraint errors
      fastify.log.error('Signup error:', error && error.stack ? error.stack : error);
      fastify.log.debug({ error, body: request.body }, 'Signup error details');
      
      // Handle specific error types
      if (error.message.includes('already taken') || error.message.includes('already exists')) {
        return reply.code(400).send({
          error: 'USER_EXISTS',
          message: error.message,
        });
      }
      
      return reply.code(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to register user',
      });
    }
  });

  // User login
  fastify.post('/login', {
    schema: {
      tags: ['auth'],
      description: 'Authenticate user with username',
      body: {
        type: 'object',
        required: ['username'],
        properties: {
          username: { type: 'string' },
          // Note: For now, we're doing simple username-only login
          // In production, you'd want proper password authentication
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            accessToken: { type: 'string' },
            refreshToken: { type: 'string' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                username: { type: 'string' },
                role: { type: 'string' },
                verified: { type: 'boolean' }
              }
            }
          }
        },
        401: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' }
          }
        }
      },
    },
  }, async (request, reply) => {
    const { username } = request.body;

    try {
      // Find user by username
      const user = await fastify.userProfile.firestoreService.getUserByUsername(username);
      
      if (!user) {
        return reply.code(401).send({
          error: 'USER_NOT_FOUND',
          message: 'User not found',
        });
      }

      // Generate tokens
      const accessToken = fastify.jwt.sign(
        { 
          userId: user.id,
          username: user.username,
          role: user.role,
          verified: user.verified,
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

      // Store refresh token in Firestore
      await addDoc(collection(fastify.firestore, 'refresh_tokens'), {
        userId: user.id,
        token: refreshToken,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        created_at: new Date().toISOString(),
      });

      return {
        success: true,
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          username: user.username,
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
  fastify.post('/refresh', {
    schema: {
      tags: ['auth'],
      description: 'Refresh access token',
      body: {
        type: 'object',
        required: ['refreshToken'],
        properties: {
          refreshToken: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            accessToken: { type: 'string' },
            refreshToken: { type: 'string' }
          }
        },
        401: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' }
          }
        }
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

      // Check if token exists and is valid in Firestore
      const tokensRef = collection(fastify.firestore, 'refresh_tokens');
      const q = query(
        tokensRef,
        where('token', '==', refreshToken),
        where('userId', '==', payload.userId),
        where('expires_at', '>', new Date().toISOString())
      );
      const querySnapshot = await getDocs(q);
      const tokenRecord = querySnapshot.empty ? null : { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() };
      
      if (!tokenRecord) {
        return reply.code(401).send({
          error: 'INVALID_TOKEN',
          message: 'Invalid or expired refresh token',
        });
      }

      // Get user
      const user = await fastify.userProfile.firestoreService.getUserById(payload.userId);
      
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
          username: user.username,
          role: user.role,
          verified: user.verified,
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

      // Update refresh token in Firestore
      const tokenDocRef = doc(fastify.firestore, 'refresh_tokens', tokenRecord.id);
      await updateDoc(tokenDocRef, {
        token: newRefreshToken,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
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
      headers: {
        type: 'object',
        properties: {
          authorization: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        required: ['refreshToken'],
        properties: {
          refreshToken: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        }
      },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { refreshToken } = request.body;
    const user = request.user;

    try {
      // Invalidate refresh token
      const tokensRef = collection(fastify.firestore, 'refresh_tokens');
      const q = query(tokensRef, where('token', '==', refreshToken), where('userId', '==', user.userId));
      const querySnapshot = await getDocs(q);

      const deletePromises = [];
      querySnapshot.forEach(doc => deletePromises.push(deleteDoc(doc.ref)));
      await Promise.all(deletePromises);

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
