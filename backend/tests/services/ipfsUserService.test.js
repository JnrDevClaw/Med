import { jest } from '@jest/globals';
import { IPFSUserService } from '../../src/services/ipfsUserService.js';

// Mock IPFS client
const mockIpfs = {
  isReady: jest.fn(),
  uploadFile: jest.fn(),
  getFile: jest.fn()
};

// Mock logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
};

describe('IPFSUserService', () => {
  let ipfsUserService;

  beforeEach(() => {
    jest.clearAllMocks();
    ipfsUserService = new IPFSUserService(mockIpfs, mockLogger);
  });

  describe('Encryption and Decryption', () => {
    const testUsername = 'testuser';
    const testUserData = {
      username: testUsername,
      role: 'patient',
      email: 'test@example.com',
      personalInfo: {
        fullName: 'Test User',
        dateOfBirth: '1990-01-01'
      }
    };

    test('should encrypt user data successfully', () => {
      const encrypted = ipfsUserService.encryptUserData(testUserData, testUsername);
      
      expect(encrypted).toHaveProperty('encrypted');
      expect(encrypted).toHaveProperty('iv');
      expect(encrypted).toHaveProperty('authTag');
      expect(encrypted).toHaveProperty('algorithm');
      expect(encrypted).toHaveProperty('timestamp');
      expect(encrypted.algorithm).toBe('aes-256-gcm');
    });

    test('should decrypt user data successfully', () => {
      const encrypted = ipfsUserService.encryptUserData(testUserData, testUsername);
      const decrypted = ipfsUserService.decryptUserData(encrypted, testUsername);
      
      expect(decrypted).toEqual(testUserData);
    });

    test('should fail decryption with wrong username', () => {
      const encrypted = ipfsUserService.encryptUserData(testUserData, testUsername);
      
      expect(() => {
        ipfsUserService.decryptUserData(encrypted, 'wronguser');
      }).toThrow('Failed to decrypt user data');
    });

    test('should handle encryption errors gracefully', () => {
      expect(() => {
        ipfsUserService.encryptUserData(null, testUsername);
      }).toThrow('Failed to encrypt user data');
    });
  });

  describe('IPFS Storage Operations', () => {
    const testUsername = 'testuser';
    const testProfile = {
      username: testUsername,
      role: 'patient',
      email: 'test@example.com'
    };
    const testCid = 'QmTestCid123';

    beforeEach(() => {
      mockIpfs.isReady.mockReturnValue(true);
    });

    test('should store user profile on IPFS successfully', async () => {
      mockIpfs.uploadFile.mockResolvedValue(testCid);

      const result = await ipfsUserService.storeUserProfile(testProfile, testUsername);

      expect(result).toBe(testCid);
      expect(mockIpfs.uploadFile).toHaveBeenCalledWith(
        expect.any(Buffer),
        `${testUsername}_profile_encrypted.json`
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'User profile stored on IPFS',
        { username: testUsername, cid: testCid }
      );
    });

    test('should retrieve user profile from IPFS successfully', async () => {
      // First encrypt the data to simulate what would be stored
      const encryptedData = ipfsUserService.encryptUserData(testProfile, testUsername);
      const encryptedBuffer = Buffer.from(JSON.stringify(encryptedData), 'utf8');
      
      mockIpfs.getFile.mockResolvedValue(encryptedBuffer);

      const result = await ipfsUserService.retrieveUserProfile(testCid, testUsername);

      expect(result.username).toBe(testUsername);
      expect(result.role).toBe(testProfile.role);
      expect(mockIpfs.getFile).toHaveBeenCalledWith(testCid);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'User profile retrieved from IPFS',
        { username: testUsername, cid: testCid }
      );
    });

    test('should update user profile on IPFS successfully', async () => {
      const oldCid = 'QmOldCid123';
      const newCid = 'QmNewCid456';
      const updates = { email: 'newemail@example.com' };
      
      // Mock retrieval of existing profile
      const existingEncrypted = ipfsUserService.encryptUserData(testProfile, testUsername);
      const existingBuffer = Buffer.from(JSON.stringify(existingEncrypted), 'utf8');
      mockIpfs.getFile.mockResolvedValue(existingBuffer);
      
      // Mock upload of updated profile
      mockIpfs.uploadFile.mockResolvedValue(newCid);

      const result = await ipfsUserService.updateUserProfile(oldCid, updates, testUsername);

      expect(result).toBe(newCid);
      expect(mockIpfs.getFile).toHaveBeenCalledWith(oldCid);
      expect(mockIpfs.uploadFile).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'User profile updated on IPFS',
        { username: testUsername, oldCid, newCid }
      );
    });

    test('should throw error when IPFS is not ready', async () => {
      mockIpfs.isReady.mockReturnValue(false);

      await expect(
        ipfsUserService.storeUserProfile(testProfile, testUsername)
      ).rejects.toThrow('IPFS service not ready');

      await expect(
        ipfsUserService.retrieveUserProfile(testCid, testUsername)
      ).rejects.toThrow('IPFS service not ready');
    });

    test('should throw error with missing required parameters', async () => {
      await expect(
        ipfsUserService.storeUserProfile(null, testUsername)
      ).rejects.toThrow('User profile and username are required');

      await expect(
        ipfsUserService.storeUserProfile(testProfile, null)
      ).rejects.toThrow('User profile and username are required');

      await expect(
        ipfsUserService.retrieveUserProfile(null, testUsername)
      ).rejects.toThrow('CID and username are required');

      await expect(
        ipfsUserService.retrieveUserProfile(testCid, null)
      ).rejects.toThrow('CID and username are required');
    });
  });

  describe('Error Handling for Network Failures', () => {
    const testUsername = 'testuser';
    const testProfile = { username: testUsername, role: 'patient' };
    const testCid = 'QmTestCid123';

    beforeEach(() => {
      mockIpfs.isReady.mockReturnValue(true);
    });

    test('should handle IPFS upload network errors', async () => {
      const networkError = new Error('Network timeout');
      mockIpfs.uploadFile.mockRejectedValue(networkError);

      await expect(
        ipfsUserService.storeUserProfile(testProfile, testUsername)
      ).rejects.toThrow(networkError);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to store user profile on IPFS:',
        networkError
      );
    });

    test('should handle IPFS retrieval network errors', async () => {
      const networkError = new Error('IPFS node unreachable');
      mockIpfs.getFile.mockRejectedValue(networkError);

      await expect(
        ipfsUserService.retrieveUserProfile(testCid, testUsername)
      ).rejects.toThrow(networkError);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to retrieve user profile from IPFS:',
        networkError
      );
    });

    test('should handle corrupted data from IPFS', async () => {
      // Mock corrupted/invalid JSON data
      const corruptedBuffer = Buffer.from('invalid json data', 'utf8');
      mockIpfs.getFile.mockResolvedValue(corruptedBuffer);

      await expect(
        ipfsUserService.retrieveUserProfile(testCid, testUsername)
      ).rejects.toThrow();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to retrieve user profile from IPFS:',
        expect.any(Error)
      );
    });

    test('should handle update operation network failures', async () => {
      const networkError = new Error('Connection lost');
      mockIpfs.getFile.mockRejectedValue(networkError);

      await expect(
        ipfsUserService.updateUserProfile(testCid, { email: 'new@test.com' }, testUsername)
      ).rejects.toThrow(networkError);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to update user profile on IPFS:',
        networkError
      );
    });
  });

  describe('Profile Validation', () => {
    test('should validate valid profile', () => {
      const validProfile = {
        username: 'testuser',
        role: 'doctor'
      };

      expect(ipfsUserService.validateProfile(validProfile)).toBe(true);
    });

    test('should reject invalid profiles', () => {
      expect(ipfsUserService.validateProfile(null)).toBe(false);
      expect(ipfsUserService.validateProfile({})).toBe(false);
      expect(ipfsUserService.validateProfile({ username: 'test' })).toBe(false);
      expect(ipfsUserService.validateProfile({ role: 'patient' })).toBe(false);
      expect(ipfsUserService.validateProfile({ 
        username: 'test', 
        role: 'invalid' 
      })).toBe(false);
    });
  });

  describe('Key Generation', () => {
    test('should generate consistent encryption keys for same username', () => {
      const username = 'testuser';
      const key1 = ipfsUserService.generateEncryptionKey(username);
      const key2 = ipfsUserService.generateEncryptionKey(username);

      expect(key1).toEqual(key2);
      expect(key1).toHaveLength(32); // 256 bits
    });

    test('should generate different keys for different usernames', () => {
      const key1 = ipfsUserService.generateEncryptionKey('user1');
      const key2 = ipfsUserService.generateEncryptionKey('user2');

      expect(key1).not.toEqual(key2);
    });
  });
});