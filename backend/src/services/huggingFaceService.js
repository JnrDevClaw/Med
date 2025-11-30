import { HfInference } from '@huggingface/inference';
import dotenv from 'dotenv';

dotenv.config();

class HuggingFaceService {
  constructor() {
    this.apiKey = process.env.HUGGINGFACE_API_KEY;
    this.timeout = parseInt(process.env.HUGGINGFACE_TIMEOUT_MS || '15000');
    this.modelUrl = process.env.HUGGINGFACE_MODEL_URL || 'https://api-inference.huggingface.co/models';
    this.medGemmaModel = 'google/medgemma-4b-it';
    
    if (!this.apiKey) {
      console.warn('⚠️  HUGGINGFACE_API_KEY not found in environment variables');
    }
    
    this.hf = new HfInference(this.apiKey);
    this.rateLimitTracker = new Map();
  }

  /**
   * Check rate limiting for API calls
   * @param {string} model - Model identifier
   * @returns {boolean} - Whether request is allowed
   */
  checkRateLimit(model) {
    const now = Date.now();
    const key = `${model}_${Math.floor(now / 60000)}`; // Per minute tracking
    const currentCount = this.rateLimitTracker.get(key) || 0;
    
    // Allow 10 requests per minute per model
    if (currentCount >= 10) {
      return false;
    }
    
    this.rateLimitTracker.set(key, currentCount + 1);
    
    // Clean up old entries
    for (const [trackKey] of this.rateLimitTracker) {
      if (!trackKey.startsWith(`${model}_${Math.floor(now / 60000)}`)) {
        this.rateLimitTracker.delete(trackKey);
      }
    }
    
    return true;
  }

  /**
   * Refine user prompt using MedGemma model
   * @param {string} userPrompt - Original user prompt
   * @returns {Promise<Object>} - Refined prompt response
   */
  async refinePrompt(userPrompt) {
    if (!this.apiKey) {
      throw new Error('Hugging Face API key not configured');
    }

    if (!this.checkRateLimit(this.medGemmaModel)) {
      throw new Error('Rate limit exceeded. Please try again in a minute.');
    }

    try {
      const refinementPrompt = `You are a medical AI assistant. Refine the following user prompt to be more specific, medically accurate, and helpful for getting better medical advice. Keep the user's intent but make it clearer and more structured.

Original prompt: "${userPrompt}"

Refined prompt:`;

      const response = await this.hf.textGeneration({
        model: this.medGemmaModel,
        inputs: refinementPrompt,
        parameters: {
          max_new_tokens: 200,
          temperature: 0.3,
          do_sample: true,
          top_p: 0.9,
          repetition_penalty: 1.1,
          return_full_text: false
        },
        options: {
          wait_for_model: true,
          use_cache: false
        }
      });

      const refinedText = response.generated_text?.trim() || userPrompt;
      
      return {
        success: true,
        originalPrompt: userPrompt,
        refinedPrompt: refinedText,
        model: this.medGemmaModel,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Hugging Face prompt refinement error:', error);
      
      // Handle specific error types
      if (error.message?.includes('rate limit')) {
        throw new Error('API rate limit exceeded. Please try again later.');
      } else if (error.message?.includes('model')) {
        throw new Error('Medical AI model is currently unavailable. Please try again later.');
      } else if (error.message?.includes('timeout')) {
        throw new Error('Request timeout. Please try again with a shorter prompt.');
      }
      
      throw new Error('Failed to refine prompt. Please try again.');
    }
  }

  /**
   * Generate medical response using MedGemma model
   * @param {string} prompt - Medical prompt
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} - AI response
   */
  async generateMedicalResponse(prompt, options = {}) {
    if (!this.apiKey) {
      throw new Error('Hugging Face API key not configured');
    }

    if (!this.checkRateLimit(this.medGemmaModel)) {
      throw new Error('Rate limit exceeded. Please try again in a minute.');
    }

    try {
      const medicalPrompt = `You are a helpful medical AI assistant. Provide accurate, helpful medical information while always recommending consulting with healthcare professionals for serious concerns.

User question: ${prompt}

Response:`;

      const response = await this.hf.textGeneration({
        model: this.medGemmaModel,
        inputs: medicalPrompt,
        parameters: {
          max_new_tokens: options.maxTokens || 500,
          temperature: options.temperature || 0.4,
          do_sample: true,
          top_p: options.topP || 0.9,
          repetition_penalty: 1.1,
          return_full_text: false
        },
        options: {
          wait_for_model: true,
          use_cache: false
        }
      });

      const responseText = response.generated_text?.trim() || 'I apologize, but I cannot provide a response at this time. Please consult with a healthcare professional.';
      
      return {
        success: true,
        response: responseText,
        model: this.medGemmaModel,
        prompt: prompt,
        timestamp: new Date().toISOString(),
        metadata: {
          maxTokens: options.maxTokens || 500,
          temperature: options.temperature || 0.4
        }
      };

    } catch (error) {
      console.error('Hugging Face medical response error:', error);
      
      // Handle specific error types
      if (error.message?.includes('rate limit')) {
        throw new Error('API rate limit exceeded. Please try again later.');
      } else if (error.message?.includes('model')) {
        throw new Error('Medical AI model is currently unavailable. Please try again later.');
      } else if (error.message?.includes('timeout')) {
        throw new Error('Request timeout. Please try again.');
      }
      
      throw new Error('Failed to generate medical response. Please try again.');
    }
  }

  /**
   * Validate response content for medical appropriateness
   * @param {string} response - AI generated response
   * @returns {Object} - Validation result
   */
  validateMedicalResponse(response) {
    const warnings = [];
    const errors = [];
    
    // Check for inappropriate medical advice
    const dangerousPatterns = [
      /ignore.{0,20}doctor/i,
      /don't.{0,20}see.{0,20}doctor/i,
      /avoid.{0,20}medical.{0,20}care/i,
      /self.{0,20}medicate/i,
      /definitely.{0,20}have/i,
      /certainly.{0,20}is/i
    ];
    
    const warningPatterns = [
      /probably.{0,20}have/i,
      /likely.{0,20}is/i,
      /might.{0,20}be/i
    ];
    
    for (const pattern of dangerousPatterns) {
      if (pattern.test(response)) {
        errors.push('Response contains potentially dangerous medical advice');
        break;
      }
    }
    
    for (const pattern of warningPatterns) {
      if (pattern.test(response)) {
        warnings.push('Response contains diagnostic language that should be reviewed');
        break;
      }
    }
    
    // Check for medical disclaimer
    const hasDisclaimer = /consult.{0,50}healthcare|see.{0,50}doctor|medical.{0,50}professional/i.test(response);
    
    if (!hasDisclaimer && response.length > 100) {
      warnings.push('Response lacks medical disclaimer');
    }
    
    return {
      isValid: errors.length === 0,
      warnings,
      errors,
      hasDisclaimer
    };
  }

  /**
   * Get model status and information
   * @returns {Promise<Object>} - Model status
   */
  async getModelStatus() {
    try {
      // Test with a simple prompt
      const testResponse = await this.hf.textGeneration({
        model: this.medGemmaModel,
        inputs: "Hello",
        parameters: {
          max_new_tokens: 10,
          temperature: 0.1
        },
        options: {
          wait_for_model: false
        }
      });

      return {
        model: this.medGemmaModel,
        status: 'available',
        lastChecked: new Date().toISOString(),
        apiKeyConfigured: !!this.apiKey
      };

    } catch (error) {
      return {
        model: this.medGemmaModel,
        status: 'unavailable',
        error: error.message,
        lastChecked: new Date().toISOString(),
        apiKeyConfigured: !!this.apiKey
      };
    }
  }
}

export default HuggingFaceService;