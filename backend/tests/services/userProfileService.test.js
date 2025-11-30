import { jest } from '@jest/globals';
import { UserProfileService } from '../../src/services/userProfileService.js';

// Mock IPFS service
const mockIpfsService = {
  storeUserProfile: jest.fn(),
  retrieveUserProfile: jest.fn(),
  updateUserProfile: jest.fn(),
  validateProfile: jest.fn()
};

// Mock Firestore service
const mockFirestoreService = {
  createUserMapping: jest.fn(),
  getUserByUsername: jest.fn(),
  getUserCid: jest.fn(),
  updateUserCid: jest.fn(),
  updateUserMetadata: jest.fn(),
  isUsernameAvailable: jest.fn(),
  getUsersByRole: jest.fn()
};

// Mock logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
};

describe('UserProfileService', () => {
  let userProfileService;

  beforeEach(() => {
    jest.clearAllMocks();
    userProfileService = new UserProfileService(null, null, mockLogger);
    userProfileService.ipfsService = mockIpfsService;
    userProfileService.firestoreService = mockFirestoreService;
  });

  describe('User Profile Retrieval System', () => {
    const testUsername = 'testuser';
    const testCid = 'QmTestCid123';
    const testProfile = {
      username: testUsername,
      role: 'patient',
      email: 'test@example.com',
      personalInfo: {
        fullName: 'Test User',
        dateOfBirth: '1990-01-01'
      }
    };

    describe('getUserProfile - Core Retrieval Functionality', () => {
      test('should retrieve user profile successfully from IPFS', async () => {
        mockFirestoreService.getUserCid.mockResolvedValue(testCid);
        mockIpfsService.retrieveUserProfile.mockResolvedValue(testProfile);

        const result = await userProfileService.getUserProfile(testUsername);

        expect(result).toEqual(testProfile);
        expect(mockFirestoreService.getUserCid).toHaveBeenCalledWith(testUsername);
        expect(mockIpfsService.retrieveUserProfile).toHaveBeenCalledWith(testCid, testUsername);
        expect(mockLogger.info).toHaveBeenCalledWith(
          'Profile retrieved successfully',
          { username: testUsername, cid: testCid }
        );
      });

      test('should throw error when user not found in Firestore', async () => {
        mockFirestoreService.getUserCid.mockResolvedValue(null);

        await expect(
          userProfileService.getUserProfile(testUsername)
        ).rejects.toThrow(`User '${testUsername}' not found`);

        expect(mockLogger.error).toHaveBeenCalledWith(
          'Failed to retrieve user profile:',
          expect.any(Error)
        );
      });

      test('should handle IPFS network issues with retry logic', async () => {
        mockFirestoreService.getUserCid.mockResolvedValue(testCid);
        
        // Mock IPFS failures followed by success
        mockIpfsService.retrieveUserProfile
          .mockRejectedValueOnce(new Error('IPFS timeout'))
          .mockRejectedValueOnce(new Error('Network error'))
          .mockResolvedValueOnce(testProfile);

        const result = await userProfileService.getUserProfile(testUsername);

        expect(result).toEqual(testProfile);
        expect(mockIpfsService.retrieveUserProfile).toHaveBeenCalledTimes(3);
        expect(mockLogger.warn).toHaveBeenCalledTimes(2);
      });

      test('should fail after maximum retry attempts', async () => {
        mockFirestoreService.getUserCid.mockResolvedValue(testCid);
        
        // Mock consistent IPFS failures
        const ipfsError = new Error('IPFS node unreachable');
        mockIpfsService.retrieveUserProfile.mockRejectedValue(ipfsError);

        await expect(
          userProfileService.getUserProfile(testUsername)
        ).rejects.toThrow('Profile temporarily unavailable due to network issues');

        expect(mockIpfsService.retrieveUserProfile).toHaveBeenCalledTimes(3);
        expect(mockLogger.error).toHaveBeenCalledWith(
          `IPFS retrieval failed after 3 attempts`,
          expect.objectContaining({
            username: testUsername,
            cid: testCid
          })
        );
      });
    });

    describe('Caching Mechanism', () => {
      test('should return cached profile when available and not expired', async () => {
        // First call - cache miss
        mockFirestoreService.getUserCid.mockResolvedValue(testCid);
        mockIpfsService.retrieveUserProfile.mockResolvedValue(testProfile);

        const result1 = await userProfileService.getUserProfile(testUsername);
        expect(result1).toEqual(testProfile);

        // Second call - should use cache
        const result2 = await userProfileService.getUserProfile(testUsername);
        expect(result2).toEqual(testProfile);

        // Verify IPFS was only called once
        expect(mockIpfsService.retrieveUserProfile).toHaveBeenCalledTimes(1);
        expect(mockLogger.debug).toHaveBeenCalledWith(
          'Profile retrieved from cache',
          { username: testUsername }
        );
      });

      test('should bypass cache when useCache is false', async () => {
        // First call to populate cache
        mockFirestoreService.getUserCid.mockResolvedValue(testCid);
        mockIpfsService.retrieveUserProfile.mockResolvedValue(testProfile);
        await userProfileService.getUserProfile(testUsername);

        // Second call with useCache=false
        await userProfileService.getUserProfile(testUsername, false);

        // Verify IPFS was called twice
        expect(mockIpfsService.retrieveUserProfile).toHaveBeenCalledTimes(2);
      });

      test('should remove expired cache entries', async () => {
        // Mock expired cache entry
        userProfileService.profileCache.set(testUsername, {
          profile: testProfile,
          timestamp: Date.now() - (6 * 60 * 1000) // 6 minutes ago (expired)
        });

        mockFirestoreService.getUserCid.mockResolvedValue(testCid);
        mockIpfsService.retrieveUserProfile.mockResolvedValue(testProfile);

        await userProfileService.getUserProfile(testUsername);

        // Verify expired entry was removed and IPFS was called
        expect(mockIpfsService.retrieveUserProfile).toHaveBeenCalledTimes(1);
        expect(userProfileService.profileCache.has(testUsername)).toBe(true);
      });

      test('should implement LRU cache behavior when max size reached', async () => {
        // Fill cache to max capacity
        userProfileService.maxCacheSize = 2;
        
        // Add first entry
        userProfileService.cacheProfile('user1', { username: 'user1' });
        userProfileService.cacheProfile('user2', { username: 'user2' });
        
        // Add third entry (should evict first)
        userProfileService.cacheProfile('user3', { username: 'user3' });

        expect(userProfileService.profileCache.has('user1')).toBe(false);
        expect(userProfileService.profileCache.has('user2')).toBe(true);
        expect(userProfileService.profileCache.has('user3')).toBe(true);
        expect(userProfileService.profileCache.size).toBe(2);
      });
    });

    describe('Cache Management', () => {
      test('should clear specific user cache', () => {
        userProfileService.cacheProfile('user1', testProfile);
        userProfileService.cacheProfile('user2', testProfile);

        userProfileService.clearCache('user1');

        expect(userProfileService.profileCache.has('user1')).toBe(false);
        expect(userProfileService.profileCache.has('user2')).toBe(true);
      });

      test('should clear all cache when no username specified', () => {
        userProfileService.cacheProfile('user1', testProfile);
        userProfileService.cacheProfile('user2', testProfile);

        userProfileService.clearCache();

        expect(userProfileService.profileCache.size).toBe(0);
      });

      test('should provide accurate cache statistics', () => {
        const now = Date.now();
        
        // Add valid entry
        userProfileService.profileCache.set('user1', {
          profile: testProfile,
          timestamp: now - (2 * 60 * 1000) // 2 minutes ago
        });
        
        // Add expired entry
        userProfileService.profileCache.set('user2', {
          profile: testProfile,
          timestamp: now - (6 * 60 * 1000) // 6 minutes ago
        });

        const stats = userProfileService.getCacheStats();

        expect(stats.totalEntries).toBe(2);
        expect(stats.validEntries).toBe(1);
        expect(stats.expiredEntries).toBe(1);
        expect(stats.maxSize).toBe(100);
        expect(stats.cacheTimeout).toBe(5 * 60 * 1000);
      });
    });

    describe('Batch Profile Retrieval', () => {
      test('should retrieve multiple profiles successfully', async () => {
        const usernames = ['user1', 'user2', 'user3'];
        const profiles = {
          user1: { username: 'user1', role: 'patient' },
          user2: { username: 'user2', role: 'doctor' },
          user3: { username: 'user3', role: 'patient' }
        };

        // Mock successful retrievals
        mockFirestoreService.getUserCid
          .mockResolvedValueOnce('cid1')
          .mockResolvedValueOnce('cid2')
          .mockResolvedValueOnce('cid3');
        
        mockIpfsService.retrieveUserProfile
          .mockResolvedValueOnce(profiles.user1)
          .mockResolvedValueOnce(profiles.user2)
          .mockResolvedValueOnce(profiles.user3);

        const results = await userProfileService.batchGetUserProfiles(usernames);

        expect(results).toEqual(profiles);
        expect(mockIpfsService.retrieveUserProfile).toHaveBeenCalledTimes(3);
      });

      test('should handle partial failures in batch retrieval', async () => {
        const usernames = ['user1', 'user2'];
        
        mockFirestoreService.getUserCid
          .mockResolvedValueOnce('cid1')
          .mockResolvedValueOnce(null); // user2 not found
        
        mockIpfsService.retrieveUserProfile
          .mockResolvedValueOnce({ username: 'user1', role: 'patient' });

        const results = await userProfileService.batchGetUserProfiles(usernames);

        expect(results.user1).toEqual({ username: 'user1', role: 'patient' });
        expect(results.user2).toHaveProperty('error');
        expect(mockLogger.warn).toHaveBeenCalledWith(
          'Failed to retrieve profile for user2:',
          expect.any(Error)
        );
      });
    });

    describe('Health Check System', () => {
      test('should return healthy status when IPFS is ready', async () => {
        const mockIpfs = {
          isReady: jest.fn().mockReturnValue(true),
          uploadFile: jest.fn().mockResolvedValue('QmHealthCheck'),
          getFile: jest.fn().mockResolvedValue(Buffer.from('test'))
        };
        userProfileService.ipfsService.ipfs = mockIpfs;

        const health = await userProfileService.healthCheck();

        expect(health.status).toBe('healthy');
        expect(health.ipfs.ready).toBe(true);
        expect(health.ipfs.latency).toBeGreaterThan(0);
        expect(health.cache).toBeDefined();
      });

      test('should return degraded status when IPFS is not ready', async () => {
        const mockIpfs = {
          isReady: jest.fn().mockReturnValue(false)
        };
        userProfileService.ipfsService.ipfs = mockIpfs;

        const health = await userProfileService.healthCheck();

        expect(health.status).toBe('degraded');
        expect(health.ipfs.ready).toBe(false);
        expect(health.ipfs.latency).toBeNull();
      });

      test('should return unhealthy status on errors', async () => {
        const mockIpfs = {
          isReady: jest.fn().mockImplementation(() => {
            throw new Error('IPFS connection failed');
          })
        };
        userProfileService.ipfsService.ipfs = mockIpfs;

        const health = await userProfileService.healthCheck();

        expect(health.status).toBe('unhealthy');
        expect(health.error).toBe('IPFS connection failed');
      });
    });
  });

  describe('Profile Creation and Updates', () => {
    const testUsername = 'newuser';
    const testProfile = {
      username: testUsername,
      role: 'patient',
      email: 'new@example.com'
    };

    test('should create user profile successfully', async () => {
      const testCid = 'QmNewCid123';
      const firestoreId = 'firestore123';

      mockIpfsService.validateProfile.mockReturnValue(true);
      mockFirestoreService.isUsernameAvailable.mockResolvedValue(true);
      mockIpfsService.storeUserProfile.mockResolvedValue(testCid);
      mockFirestoreService.createUserMapping.mockResolvedValue(firestoreId);

      const result = await userProfileService.createUserProfile(testUsername, testProfile);

      expect(result).toEqual({
        id: firestoreId,
        username: testUsername,
        ipfsCid: testCid,
        role: testProfile.role,
        verified: false
      });
      expect(mockLogger.info).toHaveBeenCalledWith(
        'User profile created successfully',
        { username: testUsername, ipfsCid: testCid, firestoreId }
      );
    });

    test('should update user profile successfully', async () => {
      const oldCid = 'QmOldCid123';
      const newCid = 'QmNewCid456';
      const updates = { email: 'updated@example.com' };

      mockFirestoreService.getUserCid.mockResolvedValue(oldCid);
      mockIpfsService.updateUserProfile.mockResolvedValue(newCid);

      const result = await userProfileService.updateUserProfile(testUsername, updates);

      expect(result).toBe(newCid);
      expect(mockFirestoreService.updateUserCid).toHaveBeenCalledWith(testUsername, newCid);
      expect(userProfileService.profileCache.has(testUsername)).toBe(false); // Cache invalidated
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle network timeouts gracefully', async () => {
      const testUsername = 'testuser';
      const testCid = 'QmTestCid123';
      
      mockFirestoreService.getUserCid.mockResolvedValue(testCid);
      mockIpfsService.retrieveUserProfile.mockRejectedValue(new Error('Request timeout'));

      await expect(
        userProfileService.getUserProfile(testUsername)
      ).rejects.toThrow('Profile temporarily unavailable due to network issues');
    });

    test('should handle concurrent profile requests efficiently', async () => {
      const testUsername = 'testuser';
      const testCid = 'QmTestCid123';
      const testProfile = { username: testUsername, role: 'patient' };

      mockFirestoreService.getUserCid.mockResolvedValue(testCid);
      mockIpfsService.retrieveUserProfile.mockResolvedValue(testProfile);

      // Make multiple concurrent requests
      const promises = Array(5).fill().map(() => 
        userProfileService.getUserProfile(testUsername)
      );

      const results = await Promise.all(promises);

      // All should return the same profile
      results.forEach(result => {
        expect(result).toEqual(testProfile);
      });

      // IPFS should only be called once due to caching
      expect(mockIpfsService.retrieveUserProfile).toHaveBeenCalledTimes(1);
    });
  });
});