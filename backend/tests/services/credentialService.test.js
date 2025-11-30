import { jest } from '@jest/globals';
import { CredentialService } from '../../src/services/credentialService.js';

// Mock dependencies
const mockFirestore = {};
const mockIpfs = {
  isReady: jest.fn(),
  uploadFile: jest.fn(),
  getFile: jest.fn()
};
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
};
const mockHuggingFaceApiKey = 'test-api-key';
const mockFirestoreUserService = {
  getUserByUsername: jest.fn(),
  updateUserMetadata: jest.fn()
};

// Mock Firestore functions
const mockCollection = jest.fn();
const mockQuery = jest.fn();
const mockWhere = jest.fn();
const mockOrderBy = jest.fn();
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
  orderBy: mockOrderBy,
  getDocs: mockGetDocs,
  addDoc: mockAddDoc,
  doc: mockDoc,
  getDoc: mockGetDoc,
  updateDoc: mockUpdateDoc,
  deleteDoc: mockDeleteDoc,
  serverTimestamp: mockServerTimestamp
}));

// Mock crypto module
const mockCrypto = {
  pbkdf2Sync: jest.fn(),
  randomBytes: jest.fn(),
  createCipherGCM: jest.fn(),
  createDecipherGCM: jest.fn()
};

jest.unstable_mockModule('crypto', () => ({
  default: mockCrypto,
  ...mockCrypto
}));

describe('CredentialService', () => {
  let credentialService;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup Firestore mocks to return chainable objects
    mockCollection.mockReturnValue('credentials-collection');
    mockQuery.mockReturnValue('query-object');
    mockWhere.mockReturnValue('where-clause');
    mockOrderBy.mockReturnValue('order-clause');
    mockDoc.mockReturnValue('doc-ref');
    
    credentialService = new CredentialService(
      mockFirestore,
      mockIpfs,
      mockLogger,
      mockHuggingFaceApiKey,
      mockFirestoreUserService
    );
    mockServerTimestamp.mockReturnValue({ _methodName: 'serverTimestamp' });
  });

  describe('Document Upload and Processing', () => {
    const testCredentialId = 'cred123';
    const testDoctorUsername = 'doctor1';
    const mockFile = {
      filename: 'license.pdf',
      mimetype: 'application/pdf',
      toBuffer: jest.fn().mockResolvedValue(Buffer.from('test pdf content')),
      file: { bytesRead: 1024 }
    };

    test('should validate document type and size correctly', () => {
      // Valid PDF file
      const validFile = {
        mimetype: 'application/pdf',
        file: { bytesRead: 1024 }
      };
      let result = credentialService.validateDocument(validFile);
      expect(result.valid).toBe(true);

      // Valid image file
      const validImage = {
        mimetype: 'image/jpeg',
        file: { bytesRead: 2048 }
      };
      result = credentialService.validateDocument(validImage);
      expect(result.valid).toBe(true);

      // Invalid file type
      const invalidFile = {
        mimetype: 'text/plain',
        file: { bytesRead: 1024 }
      };
      result = credentialService.validateDocument(invalidFile);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid file type');

      // File too large
      const largeFile = {
        mimetype: 'application/pdf',
        file: { bytesRead: 15 * 1024 * 1024 } // 15MB
      };
      result = credentialService.validateDocument(largeFile);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('File too large');
    });

    test('should encrypt document before IPFS storage', () => {
      const testBuffer = Buffer.from('test document content');
      const mockKey = Buffer.from('test-encryption-key');
      const mockIv = Buffer.from('test-iv-16-bytes');
      const mockAuthTag = Buffer.from('test-auth-tag');
      
      const mockCipher = {
        setAAD: jest.fn(),
        update: jest.fn().mockReturnValue(Buffer.from('encrypted-part')),
        final: jest.fn().mockReturnValue(Buffer.from('final-part')),
        getAuthTag: jest.fn().mockReturnValue(mockAuthTag)
      };

      mockCrypto.pbkdf2Sync.mockReturnValue(mockKey);
      mockCrypto.randomBytes.mockReturnValue(mockIv);
      mockCrypto.createCipherGCM.mockReturnValue(mockCipher);

      const result = credentialService.encryptDocument(testBuffer, testDoctorUsername, testCredentialId);

      expect(mockCrypto.pbkdf2Sync).toHaveBeenCalledWith(
        testDoctorUsername,
        expect.any(Buffer),
        100000,
        32,
        'sha256'
      );
      expect(mockCrypto.createCipherGCM).toHaveBeenCalledWith('aes-256-gcm', mockKey, mockIv);
      expect(mockCipher.setAAD).toHaveBeenCalled();
      expect(result).toHaveProperty('encrypted');
      expect(result).toHaveProperty('iv');
      expect(result).toHaveProperty('authTag');
      expect(result).toHaveProperty('algorithm', 'aes-256-gcm');
    });

    test('should upload document to IPFS successfully', async () => {
      const testCid = 'QmTestCid123';
      
      mockIpfs.isReady.mockReturnValue(true);
      mockIpfs.uploadFile.mockResolvedValue(testCid);
      
      // Mock encryption
      const mockEncryptedData = {
        encrypted: 'encrypted-content',
        iv: 'test-iv',
        authTag: 'test-auth-tag',
        algorithm: 'aes-256-gcm'
      };
      credentialService.encryptDocument = jest.fn().mockReturnValue(mockEncryptedData);
      credentialService.updateCredentialDocument = jest.fn().mockResolvedValue();
      credentialService.queueForVerification = jest.fn().mockResolvedValue();

      const result = await credentialService.uploadDocument(testCredentialId, testDoctorUsername, mockFile);

      expect(credentialService.validateDocument).toBeDefined();
      expect(mockFile.toBuffer).toHaveBeenCalled();
      expect(credentialService.encryptDocument).toHaveBeenCalledWith(
        expect.any(Buffer),
        testDoctorUsername,
        testCredentialId
      );
      expect(mockIpfs.uploadFile).toHaveBeenCalled();
      expect(credentialService.updateCredentialDocument).toHaveBeenCalledWith(testCredentialId, testCid);
      expect(credentialService.queueForVerification).toHaveBeenCalled();
      expect(result).toBe(testCid);
    });

    test('should handle IPFS service not ready error', async () => {
      mockIpfs.isReady.mockReturnValue(false);

      await expect(
        credentialService.uploadDocument(testCredentialId, testDoctorUsername, mockFile)
      ).rejects.toThrow('IPFS service not ready');
    });

    test('should handle invalid document validation', async () => {
      const invalidFile = {
        ...mockFile,
        mimetype: 'text/plain'
      };
      
      mockIpfs.isReady.mockReturnValue(true);

      await expect(
        credentialService.uploadDocument(testCredentialId, testDoctorUsername, invalidFile)
      ).rejects.toThrow('Invalid file type');
    });

    test('should create credential record successfully', async () => {
      const credentialData = {
        credentialType: 'medical_license',
        issuingAuthority: 'Medical Board',
        credentialNumber: 'ML123456',
        issuedDate: '2023-01-01',
        expiryDate: '2025-01-01',
        description: 'Medical License'
      };
      const mockDocRef = { id: 'cred123' };

      mockCollection.mockReturnValue('credentials-collection');
      mockAddDoc.mockResolvedValue(mockDocRef);

      const result = await credentialService.createCredential(testDoctorUsername, credentialData);

      expect(mockAddDoc).toHaveBeenCalledWith(
        'credentials-collection',
        expect.objectContaining({
          doctorUsername: testDoctorUsername,
          credentialType: credentialData.credentialType,
          issuingAuthority: credentialData.issuingAuthority,
          credentialNumber: credentialData.credentialNumber,
          status: 'pending',
          verificationStatus: 'not_started'
        })
      );
      expect(result).toBe(mockDocRef.id);
    });

    test('should retrieve document from IPFS successfully', async () => {
      const testCid = 'QmTestCid123';
      const mockCredential = {
        id: testCredentialId,
        doctorUsername: testDoctorUsername,
        documentCid: testCid
      };
      const mockMetadata = {
        originalFilename: 'license.pdf',
        mimetype: 'application/pdf',
        encrypted: 'encrypted-content',
        iv: 'test-iv',
        authTag: 'test-auth-tag',
        algorithm: 'aes-256-gcm'
      };
      const mockDecryptedBuffer = Buffer.from('decrypted content');

      mockIpfs.isReady.mockReturnValue(true);
      credentialService.getCredentialById = jest.fn().mockResolvedValue(mockCredential);
      mockIpfs.getFile.mockResolvedValue(Buffer.from(JSON.stringify(mockMetadata)));
      credentialService.decryptDocument = jest.fn().mockReturnValue(mockDecryptedBuffer);

      const result = await credentialService.retrieveDocument(testCredentialId, testDoctorUsername);

      expect(credentialService.getCredentialById).toHaveBeenCalledWith(testCredentialId);
      expect(mockIpfs.getFile).toHaveBeenCalledWith(testCid);
      expect(credentialService.decryptDocument).toHaveBeenCalledWith(
        mockMetadata,
        testDoctorUsername,
        testCredentialId
      );
      expect(result).toEqual({
        buffer: mockDecryptedBuffer,
        filename: mockMetadata.originalFilename,
        mimetype: mockMetadata.mimetype
      });
    });

    test('should handle access denied for document retrieval', async () => {
      const mockCredential = {
        id: testCredentialId,
        doctorUsername: 'different-doctor',
        documentCid: 'QmTestCid123'
      };

      mockIpfs.isReady.mockReturnValue(true);
      credentialService.getCredentialById = jest.fn().mockResolvedValue(mockCredential);

      await expect(
        credentialService.retrieveDocument(testCredentialId, testDoctorUsername)
      ).rejects.toThrow('Access denied');
    });
  });

  describe('Credential Management', () => {
    const testDoctorUsername = 'doctor1';
    const testCredentialId = 'cred123';

    test('should get credential by ID successfully', async () => {
      const mockCredentialData = {
        doctorUsername: testDoctorUsername,
        credentialType: 'medical_license',
        status: 'verified'
      };
      const mockDoc = {
        exists: () => true,
        id: testCredentialId,
        data: () => mockCredentialData
      };

      mockGetDoc.mockResolvedValue(mockDoc);

      const result = await credentialService.getCredentialById(testCredentialId);

      expect(result).toEqual({
        id: testCredentialId,
        ...mockCredentialData
      });
    });

    test('should return null for non-existent credential', async () => {
      const mockDoc = {
        exists: () => false
      };

      mockGetDoc.mockResolvedValue(mockDoc);

      const result = await credentialService.getCredentialById('nonexistent');

      expect(result).toBeNull();
    });

    test('should get doctor credentials successfully', async () => {
      const mockCredentials = [
        { id: 'cred1', data: () => ({ credentialType: 'license' }) },
        { id: 'cred2', data: () => ({ credentialType: 'certification' }) }
      ];

      mockGetDocs.mockResolvedValue({
        forEach: (callback) => mockCredentials.forEach(callback)
      });

      const result = await credentialService.getDoctorCredentials(testDoctorUsername);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'cred1',
        credentialType: 'license'
      });
    });

    test('should update verification status successfully', async () => {
      const verificationData = {
        status: 'verified',
        results: { confidence: 0.95 },
        confidence: 0.95
      };

      await credentialService.updateVerificationStatus(testCredentialId, verificationData);

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        'doc-ref',
        expect.objectContaining({
          verificationStatus: 'verified',
          verificationResults: verificationData.results,
          verificationConfidence: 0.95,
          status: 'verified',
          verifiedAt: expect.any(Object)
        })
      );
    });

    test('should get pending credentials successfully', async () => {
      const mockPendingCredentials = [
        { id: 'cred1', data: () => ({ verificationStatus: 'not_started' }) },
        { id: 'cred2', data: () => ({ verificationStatus: 'not_started' }) }
      ];

      mockGetDocs.mockResolvedValue({
        forEach: (callback) => mockPendingCredentials.forEach(callback)
      });

      const result = await credentialService.getPendingCredentials(10);

      expect(result).toHaveLength(2);
      expect(mockWhere).toHaveBeenCalledWith('verificationStatus', '==', 'not_started');
      expect(mockWhere).toHaveBeenCalledWith('documentCid', '!=', null);
    });

    test('should delete credential successfully', async () => {
      const mockCredential = {
        id: testCredentialId,
        doctorUsername: testDoctorUsername
      };

      credentialService.getCredentialById = jest.fn().mockResolvedValue(mockCredential);

      await credentialService.deleteCredential(testCredentialId, testDoctorUsername);

      expect(credentialService.getCredentialById).toHaveBeenCalledWith(testCredentialId);
      expect(mockDeleteDoc).toHaveBeenCalledWith('doc-ref');
    });

    test('should handle access denied for credential deletion', async () => {
      const mockCredential = {
        id: testCredentialId,
        doctorUsername: 'different-doctor'
      };

      credentialService.getCredentialById = jest.fn().mockResolvedValue(mockCredential);

      await expect(
        credentialService.deleteCredential(testCredentialId, testDoctorUsername)
      ).rejects.toThrow('Access denied');
    });
  });

  describe('Error Handling', () => {
    test('should handle Firestore errors during credential creation', async () => {
      const credentialData = { credentialType: 'license' };
      const firestoreError = new Error('Firestore connection failed');

      mockAddDoc.mockRejectedValue(firestoreError);

      await expect(
        credentialService.createCredential('doctor1', credentialData)
      ).rejects.toThrow(firestoreError);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to create credential record:',
        firestoreError
      );
    });

    test('should handle IPFS errors during document upload', async () => {
      const ipfsError = new Error('IPFS upload failed');
      
      mockIpfs.isReady.mockReturnValue(true);
      mockIpfs.uploadFile.mockRejectedValue(ipfsError);
      credentialService.encryptDocument = jest.fn().mockReturnValue({});

      await expect(
        credentialService.uploadDocument('cred123', 'doctor1', {
          filename: 'test.pdf',
          mimetype: 'application/pdf',
          toBuffer: jest.fn().mockResolvedValue(Buffer.from('test')),
          file: { bytesRead: 1024 }
        })
      ).rejects.toThrow(ipfsError);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to upload credential document:',
        ipfsError
      );
    });

    test('should handle encryption errors', () => {
      const encryptionError = new Error('Encryption failed');
      mockCrypto.createCipherGCM.mockImplementation(() => {
        throw encryptionError;
      });

      expect(() => {
        credentialService.encryptDocument(Buffer.from('test'), 'doctor1', 'cred123');
      }).toThrow('Failed to encrypt document');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Document encryption failed:',
        encryptionError
      );
    });
  });
});