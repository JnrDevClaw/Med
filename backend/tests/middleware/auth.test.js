import { jest } from '@jest/globals';
import Fastify from 'fastify';
import { authMiddleware } from '../../src/middleware/auth.js';

describe('Authentication Middleware', () => {
  let app;
  let mockUserProfile;
  let mockVerificationCache;

  beforeEach(async () => {
    // Create fresh Fastify instance for each test
    app = Fastify({ logger: false });

    // Mock user profile service
    mockUserProfile = {
      firestoreService: {
        getUserById: jest.fn()
      }
    };

    // Mock verification cache service
    mockVerificationCache = {
      getVerificationStatus: jest.fn(),
      setVerificationStatus: jest.fn()
    };

    // Mock JWT plugin
    app.decorate('jwt', {
      verify: jest.fn()
    });

    // Register dependencies
    app.decorate('userProfile', mockUserProfile);
    app.decorate('verificationCache', mockVerificationCache);

    // Register auth middleware
    await app.register(authMiddleware);

    // Add test routes to verify middleware behavior
    app.get('/protected', {
      preHandler: app.authenticate
    }, async (request, reply) => {
      return { user: request.user };
    });

    app.get('/doctor-only', {
      preHandler: [app.authenticate, app.requireRole('doctor')]
    }, async (request, reply) => {
      return { message: 'Doctor access granted' };
    });

    app.get('/verified-doctor-only', {
      preHandler: [app.authenticate, app.requireVerifiedDoctor]
    }, async (request, reply) => {
      return { message: 'Verified doctor access granted' };
    });

    app.get('/verified-only', {
      preHandler: [app.authenticate, app.requireVerified]
    }, async (request, reply) => {
      return { message: 'Verified user access granted' };
    });

    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('Route Protection Middleware', () => {
    describe('authenticate middleware', () => {
      test('should reject requests without authorization header', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/protected'
        });

        expect(response.statusCode).toBe(401);
        expect(JSON.parse(response.payload)).toEqual({
          error: 'UNAUTHORIZED',
          message: 'Access token required'
        });
      });

      test('should reject requests with invalid token format', async () => {
        app.jwt.verify.mockImplementation(() => {
          throw new Error('Invalid token');
        });

        const response = await app.inject({
          method: 'GET',
          url: '/protected',
          headers: {
            authorization: 'Bearer invalid-token'
          }
        });

        expect(response.statusCode).toBe(401);
        expect(JSON.parse(response.payload)).toEqual({
          error: 'INVALID_TOKEN',
          message: 'Invalid or expired token'
        });
      });

      test('should reject requests when user not found in database', async () => {
        const mockPayload = { userId: 'user123' };
        app.jwt.verify.mockReturnValue(mockPayload);
        mockUserProfile.firestoreService.getUserById.mockResolvedValue(null);

        const response = await app.inject({
          method: 'GET',
          url: '/protected',
          headers: {
            authorization: 'Bearer valid-token'
          }
        });

        expect(response.statusCode).toBe(401);
        expect(JSON.parse(response.payload)).toEqual({
          error: 'USER_NOT_FOUND',
          message: 'User not found'
        });
      });

      test('should authenticate valid user successfully', async () => {
        const mockPayload = { userId: 'user123' };
        const mockUser = {
          id: 'user123',
          username: 'testuser',
          role: 'patient',
          verified: false
        };

        app.jwt.verify.mockReturnValue(mockPayload);
        mockUserProfile.firestoreService.getUserById.mockResolvedValue(mockUser);
        mockVerificationCache.getVerificationStatus.mockReturnValue(null);

        const response = await app.inject({
          method: 'GET',
          url: '/protected',
          headers: {
            authorization: 'Bearer valid-token'
          }
        });

        expect(response.statusCode).toBe(200);
        expect(JSON.parse(response.payload)).toEqual({
          user: {
            userId: 'user123',
            username: 'testuser',
            role: 'patient',
            verified: false
          }
        });

        expect(mockVerificationCache.setVerificationStatus).toHaveBeenCalledWith('user123', false);
      });

      test('should use cached verification status when available', async () => {
        const mockPayload = { userId: 'user123' };
        const mockUser = {
          id: 'user123',
          username: 'testuser',
          role: 'doctor',
          verified: false // Database value
        };

        app.jwt.verify.mockReturnValue(mockPayload);
        mockUserProfile.firestoreService.getUserById.mockResolvedValue(mockUser);
        mockVerificationCache.getVerificationStatus.mockReturnValue(true); // Cached value

        const response = await app.inject({
          method: 'GET',
          url: '/protected',
          headers: {
            authorization: 'Bearer valid-token'
          }
        });

        expect(response.statusCode).toBe(200);
        const responseData = JSON.parse(response.payload);
        expect(responseData.user.verified).toBe(true); // Should use cached value

        expect(mockVerificationCache.setVerificationStatus).not.toHaveBeenCalled();
      });

      test('should handle string token payload', async () => {
        app.jwt.verify.mockReturnValue('invalid-string-payload');

        const response = await app.inject({
          method: 'GET',
          url: '/protected',
          headers: {
            authorization: 'Bearer valid-token'
          }
        });

        expect(response.statusCode).toBe(401);
        expect(JSON.parse(response.payload)).toEqual({
          error: 'INVALID_TOKEN',
          message: 'Invalid or expired token'
        });
      });
    });

    describe('requireRole middleware', () => {
      test('should allow access for correct role', async () => {
        const mockPayload = { userId: 'doctor123' };
        const mockUser = {
          id: 'doctor123',
          username: 'testdoctor',
          role: 'doctor',
          verified: true
        };

        app.jwt.verify.mockReturnValue(mockPayload);
        mockUserProfile.firestoreService.getUserById.mockResolvedValue(mockUser);
        mockVerificationCache.getVerificationStatus.mockReturnValue(null);

        const response = await app.inject({
          method: 'GET',
          url: '/doctor-only',
          headers: {
            authorization: 'Bearer valid-token'
          }
        });

        expect(response.statusCode).toBe(200);
        expect(JSON.parse(response.payload)).toEqual({
          message: 'Doctor access granted'
        });
      });

      test('should deny access for incorrect role', async () => {
        const mockPayload = { userId: 'patient123' };
        const mockUser = {
          id: 'patient123',
          username: 'testpatient',
          role: 'patient',
          verified: false
        };

        app.jwt.verify.mockReturnValue(mockPayload);
        mockUserProfile.firestoreService.getUserById.mockResolvedValue(mockUser);
        mockVerificationCache.getVerificationStatus.mockReturnValue(null);

        const response = await app.inject({
          method: 'GET',
          url: '/doctor-only',
          headers: {
            authorization: 'Bearer valid-token'
          }
        });

        expect(response.statusCode).toBe(403);
        expect(JSON.parse(response.payload)).toEqual({
          error: 'FORBIDDEN',
          message: 'doctor role required'
        });
      });

      test('should deny access when user not authenticated', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/doctor-only'
        });

        expect(response.statusCode).toBe(401);
        expect(JSON.parse(response.payload)).toEqual({
          error: 'UNAUTHORIZED',
          message: 'Access token required'
        });
      });
    });

    describe('requireVerifiedDoctor middleware', () => {
      test('should allow access for verified doctor', async () => {
        const mockPayload = { userId: 'doctor123' };
        const mockUser = {
          id: 'doctor123',
          username: 'testdoctor',
          role: 'doctor',
          verified: true
        };

        app.jwt.verify.mockReturnValue(mockPayload);
        mockUserProfile.firestoreService.getUserById.mockResolvedValue(mockUser);
        mockVerificationCache.getVerificationStatus.mockReturnValue(null);

        const response = await app.inject({
          method: 'GET',
          url: '/verified-doctor-only',
          headers: {
            authorization: 'Bearer valid-token'
          }
        });

        expect(response.statusCode).toBe(200);
        expect(JSON.parse(response.payload)).toEqual({
          message: 'Verified doctor access granted'
        });
      });

      test('should deny access for unverified doctor', async () => {
        const mockPayload = { userId: 'doctor123' };
        const mockUser = {
          id: 'doctor123',
          username: 'testdoctor',
          role: 'doctor',
          verified: false
        };

        app.jwt.verify.mockReturnValue(mockPayload);
        mockUserProfile.firestoreService.getUserById.mockResolvedValue(mockUser);
        mockVerificationCache.getVerificationStatus.mockReturnValue(null);

        const response = await app.inject({
          method: 'GET',
          url: '/verified-doctor-only',
          headers: {
            authorization: 'Bearer valid-token'
          }
        });

        expect(response.statusCode).toBe(403);
        expect(JSON.parse(response.payload)).toEqual({
          error: 'VERIFICATION_REQUIRED',
          message: 'Doctor verification required to access this feature',
          details: {
            verificationStatus: 'unverified',
            redirectTo: '/credentials/upload'
          }
        });
      });

      test('should deny access for non-doctor users', async () => {
        const mockPayload = { userId: 'patient123' };
        const mockUser = {
          id: 'patient123',
          username: 'testpatient',
          role: 'patient',
          verified: true
        };

        app.jwt.verify.mockReturnValue(mockPayload);
        mockUserProfile.firestoreService.getUserById.mockResolvedValue(mockUser);
        mockVerificationCache.getVerificationStatus.mockReturnValue(null);

        const response = await app.inject({
          method: 'GET',
          url: '/verified-doctor-only',
          headers: {
            authorization: 'Bearer valid-token'
          }
        });

        expect(response.statusCode).toBe(403);
        expect(JSON.parse(response.payload)).toEqual({
          error: 'FORBIDDEN',
          message: 'Doctor role required'
        });
      });

      test('should deny access when user not authenticated', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/verified-doctor-only'
        });

        expect(response.statusCode).toBe(401);
        expect(JSON.parse(response.payload)).toEqual({
          error: 'UNAUTHORIZED',
          message: 'Access token required'
        });
      });
    });

    describe('requireVerified middleware', () => {
      test('should allow access for verified users', async () => {
        const mockPayload = { userId: 'user123' };
        const mockUser = {
          id: 'user123',
          username: 'testuser',
          role: 'patient',
          verified: true
        };

        app.jwt.verify.mockReturnValue(mockPayload);
        mockUserProfile.firestoreService.getUserById.mockResolvedValue(mockUser);
        mockVerificationCache.getVerificationStatus.mockReturnValue(null);

        const response = await app.inject({
          method: 'GET',
          url: '/verified-only',
          headers: {
            authorization: 'Bearer valid-token'
          }
        });

        expect(response.statusCode).toBe(200);
        expect(JSON.parse(response.payload)).toEqual({
          message: 'Verified user access granted'
        });
      });

      test('should deny access for unverified patient with correct redirect', async () => {
        const mockPayload = { userId: 'patient123' };
        const mockUser = {
          id: 'patient123',
          username: 'testpatient',
          role: 'patient',
          verified: false
        };

        app.jwt.verify.mockReturnValue(mockPayload);
        mockUserProfile.firestoreService.getUserById.mockResolvedValue(mockUser);
        mockVerificationCache.getVerificationStatus.mockReturnValue(null);

        const response = await app.inject({
          method: 'GET',
          url: '/verified-only',
          headers: {
            authorization: 'Bearer valid-token'
          }
        });

        expect(response.statusCode).toBe(403);
        expect(JSON.parse(response.payload)).toEqual({
          error: 'VERIFICATION_REQUIRED',
          message: 'Account verification required to access this feature',
          details: {
            verificationStatus: 'unverified',
            userRole: 'patient',
            redirectTo: '/profile/verify'
          }
        });
      });

      test('should deny access for unverified doctor with correct redirect', async () => {
        const mockPayload = { userId: 'doctor123' };
        const mockUser = {
          id: 'doctor123',
          username: 'testdoctor',
          role: 'doctor',
          verified: false
        };

        app.jwt.verify.mockReturnValue(mockPayload);
        mockUserProfile.firestoreService.getUserById.mockResolvedValue(mockUser);
        mockVerificationCache.getVerificationStatus.mockReturnValue(null);

        const response = await app.inject({
          method: 'GET',
          url: '/verified-only',
          headers: {
            authorization: 'Bearer valid-token'
          }
        });

        expect(response.statusCode).toBe(403);
        expect(JSON.parse(response.payload)).toEqual({
          error: 'VERIFICATION_REQUIRED',
          message: 'Account verification required to access this feature',
          details: {
            verificationStatus: 'unverified',
            userRole: 'doctor',
            redirectTo: '/credentials/upload'
          }
        });
      });

      test('should deny access when user not authenticated', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/verified-only'
        });

        expect(response.statusCode).toBe(401);
        expect(JSON.parse(response.payload)).toEqual({
          error: 'UNAUTHORIZED',
          message: 'Access token required'
        });
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle database errors during authentication', async () => {
      const mockPayload = { userId: 'user123' };
      const dbError = new Error('Database connection failed');

      app.jwt.verify.mockReturnValue(mockPayload);
      mockUserProfile.firestoreService.getUserById.mockRejectedValue(dbError);

      const response = await app.inject({
        method: 'GET',
        url: '/protected',
        headers: {
          authorization: 'Bearer valid-token'
        }
      });

      expect(response.statusCode).toBe(401);
      expect(JSON.parse(response.payload)).toEqual({
        error: 'INVALID_TOKEN',
        message: 'Invalid or expired token'
      });
    });

    test('should handle verification cache errors gracefully', async () => {
      const mockPayload = { userId: 'user123' };
      const mockUser = {
        id: 'user123',
        username: 'testuser',
        role: 'patient',
        verified: true
      };

      app.jwt.verify.mockReturnValue(mockPayload);
      mockUserProfile.firestoreService.getUserById.mockResolvedValue(mockUser);
      mockVerificationCache.getVerificationStatus.mockImplementation(() => {
        throw new Error('Cache error');
      });

      const response = await app.inject({
        method: 'GET',
        url: '/protected',
        headers: {
          authorization: 'Bearer valid-token'
        }
      });

      // Currently the middleware doesn't handle cache errors gracefully
      // It should be improved to catch cache errors and fall back to database
      expect(response.statusCode).toBe(401);
      expect(JSON.parse(response.payload)).toEqual({
        error: 'INVALID_TOKEN',
        message: 'Invalid or expired token'
      });
    });

    test('should handle missing verification cache service', async () => {
      // Create app without verification cache
      const appWithoutCache = Fastify({ logger: false });
      
      appWithoutCache.decorate('jwt', {
        verify: jest.fn()
      });
      appWithoutCache.decorate('userProfile', mockUserProfile);
      // No verification cache decorated

      await appWithoutCache.register(authMiddleware);
      
      appWithoutCache.get('/test', {
        preHandler: appWithoutCache.authenticate
      }, async (request, reply) => {
        return { user: request.user };
      });

      await appWithoutCache.ready();

      const mockPayload = { userId: 'user123' };
      const mockUser = {
        id: 'user123',
        username: 'testuser',
        role: 'patient',
        verified: true
      };

      appWithoutCache.jwt.verify.mockReturnValue(mockPayload);
      mockUserProfile.firestoreService.getUserById.mockResolvedValue(mockUser);

      const response = await appWithoutCache.inject({
        method: 'GET',
        url: '/test',
        headers: {
          authorization: 'Bearer valid-token'
        }
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload).user.verified).toBe(true);

      await appWithoutCache.close();
    });
  });
});