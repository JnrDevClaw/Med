import { jest } from '@jest/globals';

// Mock Hugging Face Inference
const mockHfInference = {
  imageToText: jest.fn(),
  textGeneration: jest.fn()
};

// Mock Hugging Face module
jest.unstable_mockModule('@huggingface/inference', () => ({
  HfInference: jest.fn().mockImplementation(() => mockHfInference)
}));

// Import after mocking
const { CredentialVerificationService } = await import('../../src/services/credentialVerificationService.js');

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
};

describe('CredentialVerificationService', () => {
  let verificationService;
  const testApiKey = 'test-hf-api-key';

  beforeEach(() => {
    jest.clearAllMocks();
    verificationService = new CredentialVerificationService(mockLogger, testApiKey);
  });

  describe('AI Verification Logic', () => {
    const testCredentialId = 'cred123';
    const testDocumentBuffer = Buffer.from('test document content');
    const testCredentialMetadata = {
      credentialType: 'medical_license',
      issuingAuthority: 'Medical Board',
      credentialNumber: 'ML123456',
      issuedDate: '2023-01-01',
      expiryDate: '2025-01-01'
    };

    test('should extract text from PDF documents', async () => {
      const result = await verificationService.extractTextFromDocument(
        testDocumentBuffer,
        'application/pdf'
      );

      expect(result).toContain('PDF Document');
      expect(result).toContain('medical credential information');
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    test('should perform OCR on image documents successfully', async () => {
      const mockOcrResult = {
        generated_text: 'Medical License\nDr. John Doe\nLicense Number: ML123456'
      };

      mockHfInference.imageToText.mockResolvedValue(mockOcrResult);

      const result = await verificationService.performOCR(testDocumentBuffer);

      expect(mockHfInference.imageToText).toHaveBeenCalledWith({
        data: expect.any(Blob),
        model: 'microsoft/trocr-base-printed'
      });
      expect(result).toBe(mockOcrResult.generated_text);
    });

    test('should handle OCR failures gracefully', async () => {
      const ocrError = new Error('OCR service unavailable');
      mockHfInference.imageToText.mockRejectedValue(ocrError);

      const result = await verificationService.performOCR(testDocumentBuffer);

      expect(result).toContain('OCR Failed');
      expect(result).toContain('Manual review required');
      expect(mockLogger.error).toHaveBeenCalledWith('OCR failed:', ocrError);
    });

    test('should extract text from image documents', async () => {
      const mockOcrResult = {
        generated_text: 'Medical License Text'
      };
      mockHfInference.imageToText.mockResolvedValue(mockOcrResult);

      const result = await verificationService.extractTextFromDocument(
        testDocumentBuffer,
        'image/jpeg'
      );

      expect(result).toBe('Medical License Text');
    });

    test('should handle unsupported document types', async () => {
      await expect(
        verificationService.extractTextFromDocument(testDocumentBuffer, 'text/plain')
      ).rejects.toThrow('Unsupported document type for text extraction');
    });

    test('should create proper analysis prompt', () => {
      const extractedText = 'Medical License\nDr. John Doe\nLicense: ML123456';
      
      const prompt = verificationService.createAnalysisPrompt(extractedText, testCredentialMetadata);

      expect(prompt).toContain('Analyze this medical credential document');
      expect(prompt).toContain(extractedText);
      expect(prompt).toContain(testCredentialMetadata.credentialType);
      expect(prompt).toContain(testCredentialMetadata.issuingAuthority);
      expect(prompt).toContain('Format your response as JSON');
    });

    test('should perform AI text analysis successfully', async () => {
      const mockAnalysisResponse = {
        generated_text: JSON.stringify({
          validity: 'valid',
          confidence: 0.95,
          extractedInfo: {
            licenseNumber: 'ML123456',
            holderName: 'Dr. John Doe'
          },
          concerns: [],
          recommendation: 'approve'
        })
      };

      mockHfInference.textGeneration.mockResolvedValue(mockAnalysisResponse);

      const prompt = 'Test analysis prompt';
      const result = await verificationService.performTextAnalysis(prompt);

      expect(mockHfInference.textGeneration).toHaveBeenCalledWith({
        model: 'microsoft/DialoGPT-medium',
        inputs: prompt,
        parameters: {
          max_new_tokens: 500,
          temperature: 0.3,
          do_sample: true
        }
      });
      expect(result).toBe(mockAnalysisResponse.generated_text);
    });

    test('should handle AI analysis failures', async () => {
      const aiError = new Error('AI service unavailable');
      mockHfInference.textGeneration.mockRejectedValue(aiError);

      const result = await verificationService.performTextAnalysis('test prompt');

      expect(result).toContain('manual_review');
      expect(mockLogger.error).toHaveBeenCalledWith('AI text analysis failed:', aiError);
    });

    test('should parse JSON analysis results correctly', () => {
      const analysisText = `Some text before {
        "validity": "valid",
        "confidence": 0.85,
        "extractedInfo": {"licenseNumber": "ML123456"},
        "concerns": ["Minor formatting issue"],
        "recommendation": "approve"
      } some text after`;

      const result = verificationService.parseAnalysisResults(analysisText);

      expect(result).toEqual({
        isValid: true,
        confidence: 0.85,
        issues: ['Minor formatting issue'],
        extractedInfo: { licenseNumber: 'ML123456' },
        recommendation: 'approve'
      });
    });

    test('should handle malformed JSON with fallback parsing', () => {
      const analysisText = 'This document appears valid and authentic based on the analysis.';

      const result = verificationService.parseAnalysisResults(analysisText);

      expect(result.isValid).toBe(true);
      expect(result.confidence).toBe(0.5);
      expect(result.recommendation).toBe('approve');
    });

    test('should detect suspicious content with fallback parsing', () => {
      const analysisText = 'This document appears suspicious and potentially fraudulent.';

      const result = verificationService.parseAnalysisResults(analysisText);

      expect(result.isValid).toBe(false);
      expect(result.confidence).toBe(0.5);
      expect(result.issues).toContain('Potential issues detected in document');
    });

    test('should analyze credential text successfully', async () => {
      const extractedText = 'Medical License\nDr. John Doe\nML123456';
      const mockAnalysisResponse = JSON.stringify({
        validity: 'valid',
        confidence: 0.9,
        extractedInfo: { licenseNumber: 'ML123456' },
        concerns: [],
        recommendation: 'approve'
      });

      verificationService.performTextAnalysis = jest.fn().mockResolvedValue(mockAnalysisResponse);

      const result = await verificationService.analyzeCredentialText(extractedText, testCredentialMetadata);

      expect(result.isValid).toBe(true);
      expect(result.confidence).toBe(0.9);
      expect(result.recommendation).toBe('approve');
    });

    test('should handle credential analysis failures', async () => {
      const extractedText = 'Test text';
      const analysisError = new Error('Analysis failed');

      verificationService.performTextAnalysis = jest.fn().mockRejectedValue(analysisError);

      const result = await verificationService.analyzeCredentialText(extractedText, testCredentialMetadata);

      expect(result.isValid).toBe(false);
      expect(result.confidence).toBe(0.0);
      expect(result.issues).toContain('Analysis failed - manual review required');
      expect(result.recommendation).toBe('manual_review');
      expect(mockLogger.error).toHaveBeenCalledWith('Credential analysis failed:', analysisError);
    });
  });

  describe('Business Rules and Verification Logic', () => {
    const testCredentialMetadata = {
      credentialType: 'medical_license',
      issuingAuthority: 'Medical Board',
      expiryDate: '2025-12-31'
    };

    test('should apply minimum confidence threshold rule', () => {
      const analysisResults = {
        isValid: true,
        confidence: 0.6, // Below threshold
        issues: [],
        recommendation: 'approve'
      };

      const result = verificationService.applyVerificationRules(analysisResults, testCredentialMetadata);

      expect(result.recommendation).toBe('manual_review');
      expect(result.issues).toContain('Confidence below threshold - manual review required');
    });

    test('should require manual review for high-stakes credentials', () => {
      const analysisResults = {
        isValid: true,
        confidence: 0.8, // Above general threshold but below high-stakes threshold
        issues: [],
        recommendation: 'approve'
      };

      const highStakesMetadata = {
        ...testCredentialMetadata,
        credentialType: 'board_certification'
      };

      const result = verificationService.applyVerificationRules(analysisResults, highStakesMetadata);

      expect(result.recommendation).toBe('manual_review');
      expect(result.issues).toContain('High-stakes credential requires manual verification');
    });

    test('should reject expired credentials', () => {
      const analysisResults = {
        isValid: true,
        confidence: 0.9,
        issues: [],
        recommendation: 'approve'
      };

      const expiredMetadata = {
        ...testCredentialMetadata,
        expiryDate: '2020-01-01' // Expired
      };

      const result = verificationService.applyVerificationRules(analysisResults, expiredMetadata);

      expect(result.isValid).toBe(false);
      expect(result.recommendation).toBe('reject');
      expect(result.issues).toContain('Credential has expired');
    });

    test('should pass valid credentials with high confidence', () => {
      const analysisResults = {
        isValid: true,
        confidence: 0.95,
        issues: [],
        recommendation: 'approve'
      };

      const result = verificationService.applyVerificationRules(analysisResults, testCredentialMetadata);

      expect(result.isValid).toBe(true);
      expect(result.confidence).toBe(0.95);
      expect(result.recommendation).toBe('approve');
    });
  });

  describe('Verification Workflow', () => {
    const testCredentialId = 'cred123';
    const testDocumentBuffer = Buffer.from('test document');
    const testMimetype = 'application/pdf';
    const testCredentialMetadata = {
      credentialType: 'medical_license',
      issuingAuthority: 'Medical Board'
    };

    test('should complete full verification workflow successfully', async () => {
      const mockExtractedText = 'Medical License\nDr. John Doe\nML123456';
      const mockAnalysisResults = {
        isValid: true,
        confidence: 0.9,
        issues: [],
        recommendation: 'approve'
      };

      verificationService.extractTextFromDocument = jest.fn().mockResolvedValue(mockExtractedText);
      verificationService.analyzeCredentialText = jest.fn().mockResolvedValue(mockAnalysisResults);
      verificationService.applyVerificationRules = jest.fn().mockReturnValue(mockAnalysisResults);

      const result = await verificationService.verifyCredential(
        testCredentialId,
        testDocumentBuffer,
        testMimetype,
        testCredentialMetadata
      );

      expect(verificationService.extractTextFromDocument).toHaveBeenCalledWith(
        testDocumentBuffer,
        testMimetype
      );
      expect(verificationService.analyzeCredentialText).toHaveBeenCalledWith(
        mockExtractedText,
        testCredentialMetadata
      );
      expect(verificationService.applyVerificationRules).toHaveBeenCalledWith(
        mockAnalysisResults,
        testCredentialMetadata
      );

      expect(result).toEqual({
        credentialId: testCredentialId,
        verificationStatus: 'verified',
        confidence: 0.9,
        results: expect.objectContaining({
          extractedText: expect.any(String),
          analysisResults: mockAnalysisResults,
          verifiedAt: expect.any(String),
          verificationMethod: 'ai_analysis'
        })
      });
    });

    test('should handle verification failures gracefully', async () => {
      const verificationError = new Error('Verification process failed');
      verificationService.extractTextFromDocument = jest.fn().mockRejectedValue(verificationError);

      const result = await verificationService.verifyCredential(
        testCredentialId,
        testDocumentBuffer,
        testMimetype,
        testCredentialMetadata
      );

      expect(result).toEqual({
        credentialId: testCredentialId,
        verificationStatus: 'failed',
        confidence: 0.0,
        results: expect.objectContaining({
          error: verificationError.message,
          verifiedAt: expect.any(String),
          verificationMethod: 'ai_analysis'
        })
      });

      expect(mockLogger.error).toHaveBeenCalledWith('Credential verification failed:', verificationError);
    });

    test('should return rejected status for invalid credentials', async () => {
      const mockExtractedText = 'Invalid document content';
      const mockAnalysisResults = {
        isValid: false,
        confidence: 0.3,
        issues: ['Document appears fraudulent'],
        recommendation: 'reject'
      };

      verificationService.extractTextFromDocument = jest.fn().mockResolvedValue(mockExtractedText);
      verificationService.analyzeCredentialText = jest.fn().mockResolvedValue(mockAnalysisResults);
      verificationService.applyVerificationRules = jest.fn().mockReturnValue(mockAnalysisResults);

      const result = await verificationService.verifyCredential(
        testCredentialId,
        testDocumentBuffer,
        testMimetype,
        testCredentialMetadata
      );

      expect(result.verificationStatus).toBe('rejected');
      expect(result.confidence).toBe(0.3);
    });
  });

  describe('Verification Queue Management', () => {
    test('should add verification request to queue', async () => {
      const verificationRequest = {
        credentialId: 'cred123',
        documentBuffer: Buffer.from('test'),
        mimetype: 'application/pdf',
        credentialMetadata: {},
        callback: jest.fn()
      };

      // Mock the processVerificationQueue to prevent actual processing
      verificationService.processVerificationQueue = jest.fn();

      await verificationService.queueVerification(verificationRequest);

      expect(verificationService.verificationQueue).toHaveLength(1);
      expect(verificationService.verificationQueue[0]).toBe(verificationRequest);
      expect(verificationService.processVerificationQueue).toHaveBeenCalled();
    });

    test('should process verification queue sequentially', async () => {
      const mockCallback1 = jest.fn();
      const mockCallback2 = jest.fn();
      
      const request1 = {
        credentialId: 'cred1',
        documentBuffer: Buffer.from('test1'),
        mimetype: 'application/pdf',
        credentialMetadata: {},
        callback: mockCallback1
      };
      
      const request2 = {
        credentialId: 'cred2',
        documentBuffer: Buffer.from('test2'),
        mimetype: 'image/jpeg',
        credentialMetadata: {},
        callback: mockCallback2
      };

      // Mock verification results
      verificationService.verifyCredential = jest.fn()
        .mockResolvedValueOnce({ credentialId: 'cred1', verificationStatus: 'verified' })
        .mockResolvedValueOnce({ credentialId: 'cred2', verificationStatus: 'rejected' });

      // Add requests to queue
      verificationService.verificationQueue.push(request1, request2);

      await verificationService.processVerificationQueue();

      expect(verificationService.verifyCredential).toHaveBeenCalledTimes(2);
      expect(mockCallback1).toHaveBeenCalledWith({ credentialId: 'cred1', verificationStatus: 'verified' });
      expect(mockCallback2).toHaveBeenCalledWith({ credentialId: 'cred2', verificationStatus: 'rejected' });
      expect(verificationService.verificationQueue).toHaveLength(0);
    });

    test('should handle queue processing errors gracefully', async () => {
      const mockCallback = jest.fn();
      const request = {
        credentialId: 'cred1',
        documentBuffer: Buffer.from('test'),
        mimetype: 'application/pdf',
        credentialMetadata: {},
        callback: mockCallback
      };

      const processingError = new Error('Processing failed');
      verificationService.verifyCredential = jest.fn().mockRejectedValue(processingError);

      verificationService.verificationQueue.push(request);

      await verificationService.processVerificationQueue();

      expect(mockLogger.error).toHaveBeenCalledWith('Queue processing error:', processingError);
      expect(verificationService.verificationQueue).toHaveLength(0);
    });

    test('should return correct queue status', () => {
      verificationService.verificationQueue = ['item1', 'item2'];
      verificationService.isProcessing = true;

      const status = verificationService.getQueueStatus();

      expect(status).toEqual({
        queueLength: 2,
        isProcessing: true
      });
    });

    test('should not start processing if already processing', async () => {
      verificationService.isProcessing = true;
      verificationService.verificationQueue = ['item1'];
      
      const originalProcessing = verificationService.isProcessing;
      await verificationService.processVerificationQueue();
      
      expect(verificationService.isProcessing).toBe(originalProcessing);
    });
  });
});