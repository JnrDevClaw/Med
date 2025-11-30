import { HfInference } from '@huggingface/inference';

/**
 * Credential Verification Service
 * Handles AI-powered verification of doctor credentials using document analysis
 */
export class CredentialVerificationService {
  constructor(logger, huggingFaceApiKey) {
    this.logger = logger;
    this.hf = new HfInference(huggingFaceApiKey);
    this.verificationQueue = [];
    this.isProcessing = false;
  }

  /**
   * Extract text from document buffer using OCR
   * @param {Buffer} documentBuffer - Document file buffer
   * @param {string} mimetype - Document MIME type
   * @returns {Promise<string>} - Extracted text
   */
  async extractTextFromDocument(documentBuffer, mimetype) {
    try {
      if (mimetype === 'application/pdf') {
        // For PDF files, we would typically use a PDF parser
        // For now, we'll simulate text extraction
        return this.simulatePDFTextExtraction(documentBuffer);
      } else if (mimetype.startsWith('image/')) {
        // Use Hugging Face OCR model for images
        return await this.performOCR(documentBuffer);
      } else {
        throw new Error('Unsupported document type for text extraction');
      }
    } catch (error) {
      this.logger.error('Text extraction failed:', error);
      throw new Error('Failed to extract text from document');
    }
  }

  /**
   * Simulate PDF text extraction (in production, use a proper PDF parser)
   * @param {Buffer} documentBuffer - PDF buffer
   * @returns {string} - Simulated extracted text
   */
  simulatePDFTextExtraction(documentBuffer) {
    // In a real implementation, you would use libraries like pdf-parse or pdf2pic + OCR
    // For now, we'll return a placeholder that indicates PDF processing
    return `[PDF Document - ${documentBuffer.length} bytes]
    This is a simulated text extraction from a PDF document.
    In production, this would contain the actual extracted text from the PDF.
    Document appears to contain medical credential information.`;
  }

  /**
   * Perform OCR on image documents
   * @param {Buffer} imageBuffer - Image buffer
   * @returns {Promise<string>} - Extracted text
   */
  async performOCR(imageBuffer) {
    try {
      // Convert buffer to blob for Hugging Face API
      const blob = new Blob([imageBuffer]);
      
      // Use TrOCR model for document OCR
      const result = await this.hf.imageToText({
        data: blob,
        model: 'microsoft/trocr-base-printed'
      });

      return result.generated_text || '';
    } catch (error) {
      this.logger.error('OCR failed:', error);
      // Fallback to simulated text extraction
      return `[Image Document - OCR Failed]
      Unable to extract text from image document.
      Manual review required.`;
    }
  }

  /**
   * Analyze extracted text for credential validity
   * @param {string} extractedText - Text extracted from document
   * @param {Object} credentialMetadata - Credential metadata
   * @returns {Promise<Object>} - Verification results
   */
  async analyzeCredentialText(extractedText, credentialMetadata) {
    try {
      // Create a prompt for medical credential analysis
      const analysisPrompt = this.createAnalysisPrompt(extractedText, credentialMetadata);
      
      // Use a text classification or generation model
      const analysis = await this.performTextAnalysis(analysisPrompt);
      
      return this.parseAnalysisResults(analysis);
    } catch (error) {
      this.logger.error('Credential analysis failed:', error);
      return {
        isValid: false,
        confidence: 0.0,
        issues: ['Analysis failed - manual review required'],
        extractedInfo: {},
        recommendation: 'manual_review'
      };
    }
  }

  /**
   * Create analysis prompt for AI model
   * @param {string} extractedText - Extracted text
   * @param {Object} credentialMetadata - Credential metadata
   * @returns {string} - Analysis prompt
   */
  createAnalysisPrompt(extractedText, credentialMetadata) {
    return `Analyze this medical credential document for authenticity and validity:

DOCUMENT TEXT:
${extractedText}

CLAIMED CREDENTIAL INFO:
- Type: ${credentialMetadata.credentialType}
- Issuing Authority: ${credentialMetadata.issuingAuthority}
- Credential Number: ${credentialMetadata.credentialNumber || 'Not provided'}
- Issue Date: ${credentialMetadata.issuedDate || 'Not provided'}
- Expiry Date: ${credentialMetadata.expiryDate || 'Not provided'}

Please analyze and provide:
1. Validity assessment (valid/invalid/uncertain)
2. Confidence score (0.0-1.0)
3. Key information extracted from document
4. Any red flags or concerns
5. Recommendation (approve/reject/manual_review)

Format your response as JSON with these fields:
{
  "validity": "valid|invalid|uncertain",
  "confidence": 0.0-1.0,
  "extractedInfo": {
    "licenseNumber": "...",
    "issuingAuthority": "...",
    "holderName": "...",
    "issueDate": "...",
    "expiryDate": "..."
  },
  "concerns": ["list of concerns"],
  "recommendation": "approve|reject|manual_review"
}`;
  }

  /**
   * Perform text analysis using AI model
   * @param {string} prompt - Analysis prompt
   * @returns {Promise<string>} - AI response
   */
  async performTextAnalysis(prompt) {
    try {
      // Use a general-purpose text generation model
      const response = await this.hf.textGeneration({
        model: 'microsoft/DialoGPT-medium',
        inputs: prompt,
        parameters: {
          max_new_tokens: 500,
          temperature: 0.3,
          do_sample: true
        }
      });

      return response.generated_text || '';
    } catch (error) {
      this.logger.error('AI text analysis failed:', error);
      // Return a fallback response
      return JSON.stringify({
        validity: 'uncertain',
        confidence: 0.0,
        extractedInfo: {},
        concerns: ['AI analysis unavailable'],
        recommendation: 'manual_review'
      });
    }
  }

  /**
   * Parse AI analysis results
   * @param {string} analysisText - Raw AI response
   * @returns {Object} - Parsed verification results
   */
  parseAnalysisResults(analysisText) {
    try {
      // Try to extract JSON from the response
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          isValid: parsed.validity === 'valid',
          confidence: Math.max(0, Math.min(1, parsed.confidence || 0)),
          issues: parsed.concerns || [],
          extractedInfo: parsed.extractedInfo || {},
          recommendation: parsed.recommendation || 'manual_review'
        };
      }
    } catch (error) {
      this.logger.error('Failed to parse AI analysis results:', error);
    }

    // Fallback parsing for non-JSON responses
    return this.fallbackAnalysisParsing(analysisText);
  }

  /**
   * Fallback parsing when JSON parsing fails
   * @param {string} analysisText - Raw analysis text
   * @returns {Object} - Basic verification results
   */
  fallbackAnalysisParsing(analysisText) {
    const lowerText = analysisText.toLowerCase();
    
    // Simple keyword-based analysis
    const positiveKeywords = ['valid', 'authentic', 'legitimate', 'approved'];
    const negativeKeywords = ['invalid', 'fake', 'fraudulent', 'suspicious'];
    
    const positiveCount = positiveKeywords.filter(word => lowerText.includes(word)).length;
    const negativeCount = negativeKeywords.filter(word => lowerText.includes(word)).length;
    
    let isValid = false;
    let confidence = 0.3; // Low confidence for fallback parsing
    
    if (positiveCount > negativeCount) {
      isValid = true;
      confidence = 0.5;
    } else if (negativeCount > positiveCount) {
      isValid = false;
      confidence = 0.5;
    }

    return {
      isValid,
      confidence,
      issues: negativeCount > 0 ? ['Potential issues detected in document'] : [],
      extractedInfo: {},
      recommendation: confidence < 0.7 ? 'manual_review' : (isValid ? 'approve' : 'reject')
    };
  }

  /**
   * Verify a credential document
   * @param {string} credentialId - Credential ID
   * @param {Buffer} documentBuffer - Document buffer
   * @param {string} mimetype - Document MIME type
   * @param {Object} credentialMetadata - Credential metadata
   * @returns {Promise<Object>} - Verification results
   */
  async verifyCredential(credentialId, documentBuffer, mimetype, credentialMetadata) {
    try {
      this.logger.info('Starting credential verification', { credentialId });

      // Step 1: Extract text from document
      const extractedText = await this.extractTextFromDocument(documentBuffer, mimetype);
      
      // Step 2: Analyze the extracted text
      const analysisResults = await this.analyzeCredentialText(extractedText, credentialMetadata);
      
      // Step 3: Apply business rules and confidence thresholds
      const finalResults = this.applyVerificationRules(analysisResults, credentialMetadata);
      
      this.logger.info('Credential verification completed', { 
        credentialId, 
        isValid: finalResults.isValid,
        confidence: finalResults.confidence
      });

      return {
        credentialId,
        verificationStatus: finalResults.isValid ? 'verified' : 'rejected',
        confidence: finalResults.confidence,
        results: {
          extractedText: extractedText.substring(0, 500), // Truncate for storage
          analysisResults: finalResults,
          verifiedAt: new Date().toISOString(),
          verificationMethod: 'ai_analysis'
        }
      };

    } catch (error) {
      this.logger.error('Credential verification failed:', error);
      return {
        credentialId,
        verificationStatus: 'failed',
        confidence: 0.0,
        results: {
          error: error.message,
          verifiedAt: new Date().toISOString(),
          verificationMethod: 'ai_analysis'
        }
      };
    }
  }

  /**
   * Apply business rules to verification results
   * @param {Object} analysisResults - AI analysis results
   * @param {Object} credentialMetadata - Credential metadata
   * @returns {Object} - Final verification results
   */
  applyVerificationRules(analysisResults, credentialMetadata) {
    const rules = {
      minimumConfidence: 0.7,
      requiresManualReview: [
        'medical_license',
        'board_certification'
      ]
    };

    let finalResults = { ...analysisResults };

    // Apply confidence threshold
    if (finalResults.confidence < rules.minimumConfidence) {
      finalResults.recommendation = 'manual_review';
      finalResults.issues.push('Confidence below threshold - manual review required');
    }

    // Check if credential type requires manual review
    if (rules.requiresManualReview.includes(credentialMetadata.credentialType)) {
      if (finalResults.confidence < 0.9) {
        finalResults.recommendation = 'manual_review';
        finalResults.issues.push('High-stakes credential requires manual verification');
      }
    }

    // Check for expired credentials
    if (credentialMetadata.expiryDate) {
      const expiryDate = new Date(credentialMetadata.expiryDate);
      if (expiryDate < new Date()) {
        finalResults.isValid = false;
        finalResults.issues.push('Credential has expired');
        finalResults.recommendation = 'reject';
      }
    }

    return finalResults;
  }

  /**
   * Add credential to verification queue
   * @param {Object} verificationRequest - Verification request
   * @returns {Promise<void>}
   */
  async queueVerification(verificationRequest) {
    this.verificationQueue.push(verificationRequest);
    
    if (!this.isProcessing) {
      this.processVerificationQueue();
    }
  }

  /**
   * Process verification queue
   * @returns {Promise<void>}
   */
  async processVerificationQueue() {
    if (this.isProcessing || this.verificationQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    this.logger.info(`Processing verification queue: ${this.verificationQueue.length} items`);

    while (this.verificationQueue.length > 0) {
      const request = this.verificationQueue.shift();
      
      try {
        const results = await this.verifyCredential(
          request.credentialId,
          request.documentBuffer,
          request.mimetype,
          request.credentialMetadata
        );

        // Callback to update credential status
        if (request.callback) {
          await request.callback(results);
        }

      } catch (error) {
        this.logger.error('Queue processing error:', error);
      }

      // Add delay between verifications to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    this.isProcessing = false;
    this.logger.info('Verification queue processing completed');
  }

  /**
   * Get verification queue status
   * @returns {Object} - Queue status
   */
  getQueueStatus() {
    return {
      queueLength: this.verificationQueue.length,
      isProcessing: this.isProcessing
    };
  }
}

export default CredentialVerificationService;