import { jest } from '@jest/globals';
import { FirestoreUserService } from '../../src/services/firestoreUserService.js';

// Mock Firestore functions
const mockFirestore = {};
const mockCollection = jest.fn();
const mockQuery = jest.fn();
const mockWhere = jest.fn();
const mockGetDocs = jest.fn();
const mockAddDoc = jest.fn();
const mockDoc = jest.fn();
const mockGetDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockDeleteDoc = jest.fn();
const mockServerTimestamp = jest.fn();

// Mock Firebase Firestore functions
jest.unstable_mockModule('firebase/firestore', () => ({
  collection: mockCollection,
  query: mockQuery,
  where: mockWhere,
  getDocs: mockGetDocs,
  addDoc: mockAddDoc,
  doc: mockDoc,
  getDoc: mockGetDoc,
  updateDoc: mockUpdateDoc,
  deleteDoc: mockDeleteDoc,
  serverTimestamp: mockServerTimestamp
}));

// Mock logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
};

describe('FirestoreUserService', () => {
  let firestoreUserService;

  beforeEach(() => {
    jest.clearAllMocks();
    firestoreUserService = new FirestoreUserService(mockFirestore, mockLogger);
    mockServerTimestamp.mockReturnValue({ _methodName: 'serverTimestamp' });
  });

  describe('CID Mapping Operations', () => {
    const testUsername = 'testuser';
    const testCid = 'QmTestCid123';
    const testMetadata = {
      role: 'patient',
      verified: false,
      email: 'test@example.com'
    };

    test('should create user mapping successfully', async () => {
      const mockDocRef = { id: 'doc123' };
      
      // Mock username availability check (user doesn't exist)
      mockCollection.mockReturnValue('users-collection');
      mockWhere.mockReturnValue('where-clause');
      mockQuery.mockReturnValue('query-object');
      mockGetDocs.mockResolvedValue({ empty: true });
      
      // Mock document creation
      mockAddDoc.mockResolvedValue(mockDocRef);

      const result = await firestoreUserService.createUserMapping(
        testUsername, 
        testCid, 
        testMetadata
      );

      expect(result).toBe(mockDocRef.id);
      expect(mockAddDoc).toHaveBeenCalledWith(
        'users-collection',
        expect.objectContaining({
          username: testUsername,
          ipfsCid: testCid,
          role: testMetadata.role,
          verified: testMetadata.verified,
          email: testMetadata.email
        })
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'User mapping created in Firestore',
        { username: testUsername, ipfsCid: testCid, firestoreId: mockDocRef.id }
      );
    });

    test('should throw error when username already exists', async () => {
      // Mock existing user
      const existingUser = { id: 'existing123', username: testUsername };
      mockGetDocs.mockResolvedValue({
        empty: false,
        docs: [{ id: existingUser.id, data: () => ({ username: testUsername }) }]
      });

      await expect(
        firestoreUserService.createUserMapping(testUsername, testCid, testMetadata)
      ).rejects.toThrow(`User with username '${testUsername}' already exists`);
    });

    test('should get user by username successfully', async () => {
      const userData = { username: testUsername, ipfsCid: testCid };
      const mockDoc = {
        id: 'doc123',
        data: () => userData
      };

      mockGetDocs.mockResolvedValue({
        empty: false,
        docs: [mockDoc]
      });

      const result = await firestoreUserService.getUserByUsername(testUsername);

      expect(result).toEqual({
        id: mockDoc.id,
        ...userData
      });
    });

    test('should return null when user not found by username', async () => {
      mockGetDocs.mockResolvedValue({ empty: true });

      const result = await firestoreUserService.getUserByUsername('nonexistent');

      expect(result).toBeNull();
    });

    test('should get user CID successfully', async () => {
      const userData = { username: testUsername, ipfsCid: testCid };
      mockGetDocs.mockResolvedValue({
        empty: false,
        docs: [{ id: 'doc123', data: () => userData }]
      });

      const result = await firestoreUserService.getUserCid(testUsername);

      expect(result).toBe(testCid);
    });

    test('should return null when getting CID for non-existent user', async () => {
      mockGetDocs.mockResolvedValue({ empty: true });

      const result = await firestoreUserService.getUserCid('nonexistent');

      expect(result).toBeNull();
    });

    test('should update user CID successfully', async () => {
      const newCid = 'QmNewCid456';
      const existingUser = { id: 'doc123', ipfsCid: testCid };
      
      // Mock getting existing user
      mockGetDocs.mockResolvedValue({
        empty: false,
        docs: [{ id: existingUser.id, data: () => ({ username: testUsername, ipfsCid: testCid }) }]
      });
      
      // Mock document reference
      mockDoc.mockReturnValue('doc-ref');

      await firestoreUserService.updateUserCid(testUsername, newCid);

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        'doc-ref',
        expect.objectContaining({
          ipfsCid: newCid,
          updatedAt: expect.any(Object)
        })
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'User CID updated in Firestore',
        { username: testUsername, oldCid: testCid, newCid }
      );
    });

    test('should throw error when updating CID for non-existent user', async () => {
      mockGetDocs.mockResolvedValue({ empty: true });

      await expect(
        firestoreUserService.updateUserCid('nonexistent', 'QmNewCid')
      ).rejects.toThrow(`User with username 'nonexistent' not found`);
    });
  });

  describe('User Metadata Operations', () => {
    const testUsername = 'testuser';

    test('should update user metadata successfully', async () => {
      const updates = { role: 'doctor', verified: true };
      const existingUser = { id: 'doc123' };
      
      mockGetDocs.mockResolvedValue({
        empty: false,
        docs: [{ id: existingUser.id, data: () => ({ username: testUsername }) }]
      });
      mockDoc.mockReturnValue('doc-ref');

      await firestoreUserService.updateUserMetadata(testUsername, updates);

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        'doc-ref',
        expect.objectContaining({
          role: updates.role,
          verified: updates.verified,
          updatedAt: expect.any(Object)
        })
      );
    });

    test('should filter out invalid metadata fields', async () => {
      const updates = { 
        role: 'doctor', 
        verified: true,
        invalidField: 'should be filtered',
        personalInfo: 'should not be in firestore'
      };
      const existingUser = { id: 'doc123' };
      
      mockGetDocs.mockResolvedValue({
        empty: false,
        docs: [{ id: existingUser.id, data: () => ({ username: testUsername }) }]
      });
      mockDoc.mockReturnValue('doc-ref');

      await firestoreUserService.updateUserMetadata(testUsername, updates);

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        'doc-ref',
        expect.objectContaining({
          role: updates.role,
          verified: updates.verified,
          updatedAt: expect.any(Object)
        })
      );
      
      // Verify invalid fields are not included
      const updateCall = mockUpdateDoc.mock.calls[0][1];
      expect(updateCall).not.toHaveProperty('invalidField');
      expect(updateCall).not.toHaveProperty('personalInfo');
    });

    test('should get users by role successfully', async () => {
      const doctorUsers = [
        { id: 'doc1', data: () => ({ username: 'doctor1', role: 'doctor' }) },
        { id: 'doc2', data: () => ({ username: 'doctor2', role: 'doctor' }) }
      ];

      mockGetDocs.mockResolvedValue({
        empty: false,
        docs: doctorUsers,
        forEach: (callback) => doctorUsers.forEach(callback)
      });

      const result = await firestoreUserService.getUsersByRole('doctor');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'doc1',
        username: 'doctor1',
        role: 'doctor'
      });
    });

    test('should check username availability correctly', async () => {
      // Test available username
      mockGetDocs.mockResolvedValueOnce({ empty: true });
      let isAvailable = await firestoreUserService.isUsernameAvailable('newuser');
      expect(isAvailable).toBe(true);

      // Test taken username
      mockGetDocs.mockResolvedValueOnce({ empty: false });
      isAvailable = await firestoreUserService.isUsernameAvailable('existinguser');
      expect(isAvailable).toBe(false);
    });
  });

  describe('Error Handling for Network Failures', () => {
    const testUsername = 'testuser';
    const testCid = 'QmTestCid123';

    test('should handle Firestore connection errors during user creation', async () => {
      const networkError = new Error('Firestore connection failed');
      mockGetDocs.mockRejectedValue(networkError);

      await expect(
        firestoreUserService.createUserMapping(testUsername, testCid, {})
      ).rejects.toThrow(networkError);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to create user mapping:',
        networkError
      );
    });

    test('should handle network errors during user retrieval', async () => {
      const networkError = new Error('Network timeout');
      mockGetDocs.mockRejectedValue(networkError);

      await expect(
        firestoreUserService.getUserByUsername(testUsername)
      ).rejects.toThrow(networkError);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to get user by username:',
        networkError
      );
    });

    test('should handle network errors during CID updates', async () => {
      const networkError = new Error('Firestore write failed');
      mockGetDocs.mockResolvedValue({
        empty: false,
        docs: [{ id: 'doc123', data: () => ({ username: testUsername }) }]
      });
      mockUpdateDoc.mockRejectedValue(networkError);

      await expect(
        firestoreUserService.updateUserCid(testUsername, 'QmNewCid')
      ).rejects.toThrow(networkError);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to update user CID:',
        networkError
      );
    });

    test('should handle network errors during metadata updates', async () => {
      const networkError = new Error('Connection lost');
      mockGetDocs.mockResolvedValue({
        empty: false,
        docs: [{ id: 'doc123', data: () => ({ username: testUsername }) }]
      });
      mockUpdateDoc.mockRejectedValue(networkError);

      await expect(
        firestoreUserService.updateUserMetadata(testUsername, { role: 'doctor' })
      ).rejects.toThrow(networkError);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to update user metadata:',
        networkError
      );
    });

    test('should handle network errors during user deletion', async () => {
      const networkError = new Error('Delete operation failed');
      mockGetDocs.mockResolvedValue({
        empty: false,
        docs: [{ id: 'doc123', data: () => ({ username: testUsername }) }]
      });
      mockDeleteDoc.mockRejectedValue(networkError);

      await expect(
        firestoreUserService.deleteUser(testUsername)
      ).rejects.toThrow(networkError);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to delete user:',
        networkError
      );
    });
  });

  describe('User Statistics', () => {
    test('should get user statistics successfully', async () => {
      const doctors = [
        { id: 'doc1', data: () => ({ role: 'doctor', verified: true }) },
        { id: 'doc2', data: () => ({ role: 'doctor', verified: false }) }
      ];
      const patients = [
        { id: 'pat1', data: () => ({ role: 'patient' }) }
      ];
      const verifiedDoctors = [
        { id: 'doc1', data: () => ({ role: 'doctor', verified: true }) }
      ];

      mockGetDocs
        .mockResolvedValueOnce({ docs: doctors, forEach: (cb) => doctors.forEach(cb) })
        .mockResolvedValueOnce({ docs: patients, forEach: (cb) => patients.forEach(cb) })
        .mockResolvedValueOnce({ docs: verifiedDoctors, forEach: (cb) => verifiedDoctors.forEach(cb) });

      const stats = await firestoreUserService.getUserStats();

      expect(stats).toEqual({
        totalUsers: 3,
        totalDoctors: 2,
        totalPatients: 1,
        verifiedDoctors: 1,
        unverifiedDoctors: 1
      });
    });

    test('should handle errors when getting user statistics', async () => {
      const error = new Error('Statistics query failed');
      mockGetDocs.mockRejectedValue(error);

      await expect(
        firestoreUserService.getUserStats()
      ).rejects.toThrow(error);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to get user statistics:',
        error
      );
    });
  });
});