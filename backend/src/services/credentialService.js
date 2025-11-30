import crypto from 'crypto';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  orderBy
} from 'firebase/firestore';
import CredentialVerificationService from './credentialVerificationService.js';
import DoctorVerificationStatusService from './doctorVerificationStatusService.js';

/**
 * Credential Service
 * Handles doctor credential upload, storage, and verification using IPFS + Firestore
 */
export class CredentialService {
  constructor(firestore, ipfs, logger, huggingFaceApiKey, firestoreUserService) {
    this.firestore = firestore;
    this.ipfs = ipfs;
    this.logger = logger;
    this.credentialsCollection = 'doctor_credentials';
    this.algorithm = 'aes-256-gcm';
    this.keyLength = 32;
    
    // Initialize verification services
    this.verificationService = new CredentialVerificationService(logger, huggingFaceApiKey);
    this.statusService = new DoctorVerificationStatusService(firestore, firestoreUserService, logger);
  }

  /**
   * Generate encryption key for credential documents
   * @param {string} doctorUsername - Doctor's username
   * @param {string} credentialId - Credential ID for additional entropy
   * @returns {Buffer} - Encryption key
   */
  generateEncryptionKey(doctorUsername, credentialId) {
    const salt = Buffer.from(`medconnect-cred-${credentialId}`, 'utf8');
    return crypto.pbkdf2Sync(doctorUsername, salt, 100000, this.keyLength, 'sha256');
  }

  /**
   * Encrypt credential document before IPFS storage
   * @param {Buffer} documentBuffer - Document file buffer
   * @param {string} doctorUsername - Doctor's username
   * @param {string} credentialId - Credential ID
   * @returns {Object} - Encrypted document data
   */
  encryptDocument(documentBuffer, doctorUsername, credentialId) {
    try {
      const key = this.generateEncryptionKey(doctorUsername, credentialId);
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipherGCM(this.algorithm, key, iv);
      cipher.setAAD(Buffer.from(`${doctorUsername}-${credentialId}`, 'utf8'));
      
      let encrypted = cipher.update(documentBuffer);
      const final = cipher.final();
      encrypted = Buffer.concat([encrypted, final]);
      
      const authTag = cipher.getAuthTag();
      
      return {
        encrypted: encrypted.toString('base64'),
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
        algorithm: this.algorithm,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('Document encryption failed:', error);
      throw new Error('Failed to encrypt document');
    }
  }

  /**
   * Decrypt credential document retrieved from IPFS
   * @param {Object} encryptedData - Encrypted document data
   * @param {string} doctorUsername - Doctor's username
   * @param {string} credentialId - Credential ID
   * @returns {Buffer} - Decrypted document buffer
   */
  decryptDocument(encryptedData, doctorUsername, credentialId) {
    try {
      const key = this.generateEncryptionKey(doctorUsername, credentialId);
      const iv = Buffer.from(encryptedData.iv, 'hex');
      const decipher = crypto.createDecipherGCM(encryptedData.algorithm, key, iv);
      
      decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
      decipher.setAAD(Buffer.from(`${doctorUsername}-${credentialId}`, 'utf8'));
      
      const encrypted = Buffer.from(encryptedData.encrypted, 'base64');
      let decrypted = decipher.update(encrypted);
      const final = decipher.final();
      decrypted = Buffer.concat([decrypted, final]);
      
      return decrypted;
    } catch (error) {
      this.logger.error('Document decryption failed:', error);
      throw new Error('Failed to decrypt document');
    }
  }

  /**
   * Validate document type and size
   * @param {Object} file - Uploaded file object
   * @returns {Object} - Validation result
   */
  validateDocument(file) {
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp'
    ];
    
    const maxSize = 10 * 1024 * 1024; // 10MB
    
    if (!allowedTypes.includes(file.mimetype)) {
      return {
        valid: false,
        error: 'Invalid file type. Only PDF and image files are allowed.'
      };
    }
    
    if (file.file && file.file.bytesRead > maxSize) {
      return {
        valid: false,
        error: 'File too large. Maximum size is 10MB.'
      };
    }
    
    return { valid: true };
  }

  /**
   * Create new credential record
   * @param {string} doctorUsername - Doctor's username
   * @param {Object} credentialData - Credential metadata
   * @returns {Promise<string>} - Credential ID
   */
  async createCredential(doctorUsername, credentialData) {
    try {
      const credentialDoc = {
        doctorUsername,
        credentialType: credentialData.credentialType,
        issuingAuthority: credentialData.issuingAuthority,
        credentialNumber: credentialData.credentialNumber || null,
        issuedDate: credentialData.issuedDate || null,
        expiryDate: credentialData.expiryDate || null,
        description: credentialData.description || null,
        status: 'pending',
        verificationStatus: 'not_started',
        documentCid: null,
        verificationResults: null,
        verificationConfidence: null,
        verifiedAt: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(this.firestore, this.credentialsCollection), credentialDoc);
      
      this.logger.info('Credential record created', { 
        doctorUsername, 
        credentialId: docRef.id,
        type: credentialData.credentialType
      });
      
      return docRef.id;
    } catch (error) {
      this.logger.error('Failed to create credential record:', error);
      throw error;
    }
  }

  /**
   * Upload credential document to IPFS
   * @param {string} credentialId - Credential ID
   * @param {string} doctorUsername - Doctor's username
   * @param {Object} file - Uploaded file
   * @returns {Promise<string>} - IPFS CID
   */
  async uploadDocument(credentialId, doctorUsername, file) {
    try {
      if (!this.ipfs.isReady()) {
        throw new Error('IPFS service not ready');
      }

      // Validate document
      const validation = this.validateDocument(file);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // Get file buffer
      const buffer = await file.toBuffer();
      
      // Encrypt document
      const encryptedData = this.encryptDocument(buffer, doctorUsername, credentialId);
      
      // Prepare metadata
      const documentMetadata = {
        originalFilename: file.filename,
        mimetype: file.mimetype,
        size: buffer.length,
        doctorUsername,
        credentialId,
        uploadedAt: new Date().toISOString(),
        ...encryptedData
      };
      
      // Convert to buffer for IPFS storage
      const metadataBuffer = Buffer.from(JSON.stringify(documentMetadata), 'utf8');
      
      // Upload to IPFS
      const cid = await this.ipfs.uploadFile(metadataBuffer, `credential_${credentialId}_${file.filename}`);
      
      // Update credential record with CID
      await this.updateCredentialDocument(credentialId, cid);
      
      // Queue document for AI verification
      await this.queueForVerification(credentialId, buffer, file.mimetype, doctorUsername);
      
      this.logger.info('Credential document uploaded to IPFS and queued for verification', { 
        doctorUsername, 
        credentialId, 
        cid,
        filename: file.filename
      });
      
      return cid;
    } catch (error) {
      this.logger.error('Failed to upload credential document:', error);
      throw error;
    }
  }

  /**
   * Update credential record with document CID
   * @param {string} credentialId - Credential ID
   * @param {string} documentCid - IPFS CID of document
   * @returns {Promise<void>}
   */
  async updateCredentialDocument(credentialId, documentCid) {
    try {
      const credentialRef = doc(this.firestore, this.credentialsCollection, credentialId);
      await updateDoc(credentialRef, {
        documentCid,
        status: 'document_uploaded',
        updatedAt: serverTimestamp()
      });
      
      this.logger.info('Credential document CID updated', { credentialId, documentCid });
    } catch (error) {
      this.logger.error('Failed to update credential document CID:', error);
      throw error;
    }
  }

  /**
   * Get credential by ID
   * @param {string} credentialId - Credential ID
   * @returns {Promise<Object|null>} - Credential document
   */
  async getCredentialById(credentialId) {
    try {
      const credentialDoc = await getDoc(doc(this.firestore, this.credentialsCollection, credentialId));
      
      if (!credentialDoc.exists()) {
        return null;
      }
      
      return {
        id: credentialDoc.id,
        ...credentialDoc.data()
      };
    } catch (error) {
      this.logger.error('Failed to get credential by ID:', error);
      throw error;
    }
  }

  /**
   * Get all credentials for a doctor
   * @param {string} doctorUsername - Doctor's username
   * @returns {Promise<Array>} - Array of credential documents
   */
  async getDoctorCredentials(doctorUsername) {
    try {
      const credentialsRef = collection(this.firestore, this.credentialsCollection);
      const q = query(
        credentialsRef, 
        where('doctorUsername', '==', doctorUsername),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const credentials = [];
      
      querySnapshot.forEach(doc => {
        credentials.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      return credentials;
    } catch (error) {
      this.logger.error('Failed to get doctor credentials:', error);
      throw error;
    }
  }

  /**
   * Retrieve credential document from IPFS
   * @param {string} credentialId - Credential ID
   * @param {string} doctorUsername - Doctor's username
   * @returns {Promise<Buffer>} - Decrypted document buffer
   */
  async retrieveDocument(credentialId, doctorUsername) {
    try {
      if (!this.ipfs.isReady()) {
        throw new Error('IPFS service not ready');
      }

      // Get credential record
      const credential = await this.getCredentialById(credentialId);
      if (!credential || !credential.documentCid) {
        throw new Error('Credential document not found');
      }

      // Verify ownership
      if (credential.doctorUsername !== doctorUsername) {
        throw new Error('Access denied');
      }

      // Retrieve from IPFS
      const metadataBuffer = await this.ipfs.getFile(credential.documentCid);
      const documentMetadata = JSON.parse(metadataBuffer.toString('utf8'));
      
      // Decrypt document
      const decryptedBuffer = this.decryptDocument(documentMetadata, doctorUsername, credentialId);
      
      return {
        buffer: decryptedBuffer,
        filename: documentMetadata.originalFilename,
        mimetype: documentMetadata.mimetype
      };
    } catch (error) {
      this.logger.error('Failed to retrieve credential document:', error);
      throw error;
    }
  }

  /**
   * Update credential verification status
   * @param {string} credentialId - Credential ID
   * @param {Object} verificationData - Verification results
   * @returns {Promise<void>}
   */
  async updateVerificationStatus(credentialId, verificationData) {
    try {
      const updates = {
        verificationStatus: verificationData.status,
        verificationResults: verificationData.results || null,
        verificationConfidence: verificationData.confidence || null,
        updatedAt: serverTimestamp()
      };

      if (verificationData.status === 'verified') {
        updates.status = 'verified';
        updates.verifiedAt = serverTimestamp();
      } else if (verificationData.status === 'rejected') {
        updates.status = 'rejected';
      }

      const credentialRef = doc(this.firestore, this.credentialsCollection, credentialId);
      await updateDoc(credentialRef, updates);
      
      this.logger.info('Credential verification status updated', { 
        credentialId, 
        status: verificationData.status 
      });
    } catch (error) {
      this.logger.error('Failed to update verification status:', error);
      throw error;
    }
  }

  /**
   * Get credentials pending verification
   * @param {number} limit - Maximum number of credentials to return
   * @returns {Promise<Array>} - Array of pending credentials
   */
  async getPendingCredentials(limit = 50) {
    try {
      const credentialsRef = collection(this.firestore, this.credentialsCollection);
      const q = query(
        credentialsRef,
        where('verificationStatus', '==', 'not_started'),
        where('documentCid', '!=', null),
        orderBy('documentCid'),
        orderBy('createdAt', 'asc')
      );
      
      const querySnapshot = await getDocs(q);
      const credentials = [];
      
      querySnapshot.forEach(doc => {
        if (credentials.length < limit) {
          credentials.push({
            id: doc.id,
            ...doc.data()
          });
        }
      });
      
      return credentials;
    } catch (error) {
      this.logger.error('Failed to get pending credentials:', error);
      throw error;
    }
  }

  /**
   * Queue credential for AI verification
   * @param {string} credentialId - Credential ID
   * @param {Buffer} documentBuffer - Document buffer
   * @param {string} mimetype - Document MIME type
   * @param {string} doctorUsername - Doctor's username
   * @returns {Promise<void>}
   */
  async queueForVerification(credentialId, documentBuffer, mimetype, doctorUsername) {
    try {
      // Get credential metadata
      const credential = await this.getCredentialById(credentialId);
      if (!credential) {
        throw new Error('Credential not found');
      }

      // Update status to indicate verification started
      await this.updateVerificationStatus(credentialId, {
        status: 'in_progress',
        results: null,
        confidence: null
      });

      // Queue for verification
      await this.verificationService.queueVerification({
        credentialId,
        documentBuffer,
        mimetype,
        credentialMetadata: {
          credentialType: credential.credentialType,
          issuingAuthority: credential.issuingAuthority,
          credentialNumber: credential.credentialNumber,
          issuedDate: credential.issuedDate,
          expiryDate: credential.expiryDate
        },
        callback: async (verificationResults) => {
          await this.handleVerificationResults(verificationResults);
        }
      });

      this.logger.info('Credential queued for verification', { credentialId, doctorUsername });
    } catch (error) {
      this.logger.error('Failed to queue credential for verification:', error);
      throw error;
    }
  }

  /**
   * Handle verification results from AI service
   * @param {Object} verificationResults - Results from verification service
   * @returns {Promise<void>}
   */
  async handleVerificationResults(verificationResults) {
    try {
      const { credentialId, verificationStatus, confidence, results } = verificationResults;

      // Update credential with verification results
      await this.updateVerificationStatus(credentialId, {
        status: verificationStatus,
        results,
        confidence
      });

      // If verification passed, evaluate doctor's overall verification status
      if (verificationStatus === 'verified') {
        await this.evaluateAndUpdateDoctorStatus(credentialId);
      }

      this.logger.info('Verification results processed', { 
        credentialId, 
        status: verificationStatus,
        confidence 
      });
    } catch (error) {
      this.logger.error('Failed to handle verification results:', error);
    }
  }

  /**
   * Evaluate and update doctor's overall verification status
   * @param {string} credentialId - Credential ID that was verified
   * @returns {Promise<void>}
   */
  async evaluateAndUpdateDoctorStatus(credentialId) {
    try {
      const credential = await this.getCredentialById(credentialId);
      if (!credential) {
        return;
      }

      const doctorUsername = credential.doctorUsername;
      
      // Evaluate doctor's verification eligibility
      const evaluation = await this.statusService.evaluateDoctorVerification(doctorUsername);
      
      // If eligible for verification, update status
      if (evaluation.isEligibleForVerification) {
        await this.statusService.updateDoctorVerificationStatus(
          doctorUsername,
          true,
          `Automatic verification based on credential validation (Score: ${evaluation.verificationScore})`
        );
        
        this.logger.info('Doctor automatically verified', { 
          doctorUsername, 
          score: evaluation.verificationScore 
        });
      } else {
        this.logger.info('Doctor not yet eligible for verification', { 
          doctorUsername, 
          score: evaluation.verificationScore,
          missingRequirements: evaluation.missingRequirements
        });
      }

    } catch (error) {
      this.logger.error('Failed to evaluate doctor verification status:', error);
    }
  }

  /**
   * Manually verify a credential (admin function)
   * @param {string} credentialId - Credential ID
   * @param {boolean} isApproved - Whether to approve or reject
   * @param {string} reviewerNotes - Notes from manual reviewer
   * @returns {Promise<void>}
   */
  async manuallyVerifyCredential(credentialId, isApproved, reviewerNotes = '') {
    try {
      const verificationResults = {
        status: isApproved ? 'verified' : 'rejected',
        results: {
          manualReview: true,
          reviewerNotes,
          reviewedAt: new Date().toISOString(),
          verificationMethod: 'manual_review'
        },
        confidence: isApproved ? 1.0 : 0.0
      };

      await this.updateVerificationStatus(credentialId, verificationResults);
      
      if (isApproved) {
        await this.evaluateAndUpdateDoctorStatus(credentialId);
      }

      this.logger.info('Credential manually verified', { 
        credentialId, 
        isApproved, 
        reviewerNotes 
      });
    } catch (error) {
      this.logger.error('Failed to manually verify credential:', error);
      throw error;
    }
  }

  /**
   * Get verification queue status
   * @returns {Object} - Queue status information
   */
  getVerificationQueueStatus() {
    return this.verificationService.getQueueStatus();
  }

  /**
   * Get doctor's verification status and history
   * @param {string} doctorUsername - Doctor's username
   * @returns {Promise<Object>} - Verification status information
   */
  async getDoctorVerificationStatus(doctorUsername) {
    try {
      const [evaluation, history, notifications] = await Promise.all([
        this.statusService.evaluateDoctorVerification(doctorUsername),
        this.statusService.getDoctorVerificationHistory(doctorUsername, 10),
        this.statusService.getDoctorNotifications(doctorUsername, true, 10)
      ]);

      return {
        evaluation,
        recentHistory: history,
        unreadNotifications: notifications
      };
    } catch (error) {
      this.logger.error('Failed to get doctor verification status:', error);
      throw error;
    }
  }

  /**
   * Get verification statistics
   * @returns {Promise<Object>} - System-wide verification statistics
   */
  async getVerificationStatistics() {
    return await this.statusService.getVerificationStatistics();
  }

  /**
   * Process automatic verifications
   * @returns {Promise<Array>} - List of processed doctors
   */
  async processAutomaticVerifications() {
    return await this.statusService.processAutomaticVerifications();
  }

  /**
   * Delete credential and associated document
   * @param {string} credentialId - Credential ID
   * @param {string} doctorUsername - Doctor's username (for verification)
   * @returns {Promise<void>}
   */
  async deleteCredential(credentialId, doctorUsername) {
    try {
      // Get credential to verify ownership
      const credential = await this.getCredentialById(credentialId);
      if (!credential) {
        throw new Error('Credential not found');
      }

      if (credential.doctorUsername !== doctorUsername) {
        throw new Error('Access denied');
      }

      // Delete from Firestore
      await deleteDoc(doc(this.firestore, this.credentialsCollection, credentialId));
      
      // Note: IPFS documents are immutable and will remain on the network
      // This is acceptable for audit trail purposes
      
      this.logger.info('Credential deleted', { credentialId, doctorUsername });
    } catch (error) {
      this.logger.error('Failed to delete credential:', error);
      throw error;
    }
  }
}

export default CredentialService;