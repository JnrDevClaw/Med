import { HfInference } from '@huggingface/inference';
import dotenv from 'dotenv';

dotenv.config();

class HuggingFaceService {
  constructor() {
    this.apiKey = process.env.HUGGINGFACE_API_KEY;
    this.timeout = parseInt(process.env.HUGGINGFACE_TIMEOUT_MS || '30000');
    this.modelUrl = process.env.HUGGINGFACE_MODEL_URL || 'https://api-inference.huggingface.co/models';
    
    // Model configuration from environment
    this.refinerModel = process.env.HUGGINGFACE_REFINER_MODEL || 'blaze999/Medical-NER';
    this.medicalModel = process.env.HUGGINGFACE_MEDICAL_MODEL || 'sethuiyer/Medichat-Llama3-8B';
    this.medicalModelAlt1 = process.env.HUGGINGFACE_MEDICAL_MODEL_ALT1 || 'ruslanmv/Medical-Llama3-8B';
    this.medicalModelAlt2 = process.env.HUGGINGFACE_MEDICAL_MODEL_ALT2 || 'alpha-ai/LLAMA3-3B-Medical-COT';
    
    if (!this.apiKey) {
      console.warn('⚠️  HUGGINGFACE_API_KEY not found in environment variables');
    }
    
    this.hf = new HfInference(this.apiKey);
    this.rateLimitTracker = new Map();
    
    console.log('🤖 HuggingFace Service initialized with models:');
    console.log(`   Refiner: ${this.refinerModel}`);
    console.log(`   Medical: ${this.medicalModel}`);
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
   * Refine user prompt using Medical NER model
   * @param {string} userPrompt - Original user prompt
   * @returns {Promise<Object>} - Refined prompt response
   */
  async refinePrompt(userPrompt) {
    if (!this.apiKey) {
      throw new Error('Hugging Face API key not configured');
    }

    if (!this.checkRateLimit(this.refinerModel)) {
      throw new Error('Rate limit exceeded. Please try again in a minute.');
    }

    try {
      // Medical-NER model is designed to extract and structure medical entities
      // We'll use it to identify medical terms and create a more structured prompt
      const refinementPrompt = `Extract and structure the medical information from this text. Identify symptoms, conditions, body parts, and medical concerns. Make it clear and specific for medical consultation:

${userPrompt}`;

      const response = await this.hf.textGeneration({
        model: this.refinerModel,
        inputs: refinementPrompt,
        parameters: {
          max_new_tokens: 250,
          temperature: 0.2,
          do_sample: true,
          top_p: 0.85,
          repetition_penalty: 1.15,
          return_full_text: false
        },
        options: {
          wait_for_model: true,
          use_cache: false
        }
      });

      let refinedText = response.generated_text?.trim() || userPrompt;
      
      // Clean up the refined text
      refinedText = this.cleanRefinedPrompt(refinedText, userPrompt);
      
      return {
        success: true,
        originalPrompt: userPrompt,
        refinedPrompt: refinedText,
        model: this.refinerModel,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Hugging Face prompt refinement error:', error);
      
      // Handle specific error types
      if (error.message?.includes('rate limit')) {
        throw new Error('API rate limit exceeded. Please try again later.');
      } else if (error.message?.includes('model')) {
        throw new Error('Prompt refiner is currently unavailable. Please try again later.');
      } else if (error.message?.includes('timeout')) {
        throw new Error('Request timeout. Please try again with a shorter prompt.');
      }
      
      throw new Error('Failed to refine prompt. Please try again.');
    }
  }

  /**
   * Clean and format refined prompt
   * @param {string} refinedText - Raw refined text from model
   * @param {string} originalPrompt - Original user prompt
   * @returns {string} - Cleaned refined prompt
   */
  cleanRefinedPrompt(refinedText, originalPrompt) {
    // Remove common artifacts
    let cleaned = refinedText
      .replace(/^(Refined prompt:|Output:|Result:)/i, '')
      .replace(/\[.*?\]/g, '') // Remove bracketed annotations
      .trim();
    
    // If the refined text is too short or seems invalid, return enhanced original
    if (cleaned.length < 10 || cleaned.length < originalPrompt.length * 0.5) {
      cleaned = `Medical inquiry: ${originalPrompt}`;
    }
    
    // Ensure it starts with a capital letter
    if (cleaned.length > 0) {
      cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }
    
    // Ensure it ends with proper punctuation
    if (!/[.!?]$/.test(cleaned)) {
      cleaned += '.';
    }
    
    return cleaned;
  }

  /**
   * Generate medical response using Medichat-Llama3 model
   * @param {string} prompt - Medical prompt (should be refined)
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} - AI response
   */
  async generateMedicalResponse(prompt, options = {}) {
    if (!this.apiKey) {
      throw new Error('Hugging Face API key not configured');
    }

    if (!this.checkRateLimit(this.medicalModel)) {
      throw new Error('Rate limit exceeded. Please try again in a minute.');
    }

    try {
      // Medichat-Llama3-8B is specifically trained for medical conversations
      const medicalPrompt = `<|system|>
You are a knowledgeable medical AI assistant. Provide accurate, helpful medical information based on current medical knowledge. Always remind users to consult healthcare professionals for diagnosis and treatment.
<|user|>
${prompt}
<|assistant|>`;

      const response = await this.hf.textGeneration({
        model: this.medicalModel,
        inputs: medicalPrompt,
        parameters: {
          max_new_tokens: options.maxTokens || 600,
          temperature: options.temperature || 0.5,
          do_sample: true,
          top_p: options.topP || 0.92,
          repetition_penalty: 1.1,
          return_full_text: false
        },
        options: {
          wait_for_model: true,
          use_cache: false
        }
      });

      let responseText = response.generated_text?.trim() || '';
      
      // Clean up response
      responseText = this.cleanMedicalResponse(responseText);
      
      // Fallback if response is empty or too short
      if (!responseText || responseText.length < 20) {
        responseText = 'I apologize, but I cannot provide a complete response at this time. Please consult with a healthcare professional for medical advice.';
      }
      
      return {
        success: true,
        response: responseText,
        model: this.medicalModel,
        prompt: prompt,
        timestamp: new Date().toISOString(),
        metadata: {
          maxTokens: options.maxTokens || 600,
          temperature: options.temperature || 0.5
        }
      };

    } catch (error) {
      console.error('Hugging Face medical response error:', error);
      
      // Try fallback model if primary fails
      if (options.allowFallback !== false) {
        console.log('Attempting fallback to alternative medical model...');
        return await this.generateMedicalResponseFallback(prompt, options);
      }
      
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
   * Generate medical response using fallback model
   * @param {string} prompt - Medical prompt
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} - AI response
   */
  async generateMedicalResponseFallback(prompt, options = {}) {
    try {
      const fallbackModel = this.medicalModelAlt1;
      
      const medicalPrompt = `### Medical Question:
${prompt}

### Medical Response:`;

      const response = await this.hf.textGeneration({
        model: fallbackModel,
        inputs: medicalPrompt,
        parameters: {
          max_new_tokens: options.maxTokens || 500,
          temperature: 0.6,
          do_sample: true,
          top_p: 0.9,
          repetition_penalty: 1.15,
          return_full_text: false
        },
        options: {
          wait_for_model: true,
          use_cache: false
        }
      });

      let responseText = response.generated_text?.trim() || 'Please consult with a healthcare professional.';
      responseText = this.cleanMedicalResponse(responseText);
      
      return {
        success: true,
        response: responseText,
        model: fallbackModel,
        prompt: prompt,
        timestamp: new Date().toISOString(),
        metadata: {
          isFallback: true,
          maxTokens: options.maxTokens || 500
        }
      };

    } catch (fallbackError) {
      console.error('Fallback model also failed:', fallbackError);
      throw new Error('All medical AI models are currently unavailable. Please try again later.');
    }
  }

  /**
   * Clean medical response text
   * @param {string} responseText - Raw response from model
   * @returns {string} - Cleaned response
   */
  cleanMedicalResponse(responseText) {
    // Remove common artifacts and formatting issues
    let cleaned = responseText
      .replace(/^(Response:|Answer:|Assistant:)/i, '')
      .replace(/<\|.*?\|>/g, '') // Remove special tokens
      .replace(/\[INST\].*?\[\/INST\]/g, '') // Remove instruction markers
      .trim();
    
    // Remove incomplete sentences at the end
    const sentences = cleaned.split(/[.!?]+/);
    if (sentences.length > 1 && sentences[sentences.length - 1].trim().length < 10) {
      sentences.pop();
      cleaned = sentences.join('. ') + '.';
    }
    
    return cleaned;
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
    const models = {
      refiner: this.refinerModel,
      medical: this.medicalModel,
      fallback1: this.medicalModelAlt1,
      fallback2: this.medicalModelAlt2
    };

    const statuses = {};

    for (const [key, modelName] of Object.entries(models)) {
      try {
        // Test with a simple prompt
        const testResponse = await this.hf.textGeneration({
          model: modelName,
          inputs: "Test",
          parameters: {
            max_new_tokens: 5,
            temperature: 0.1
          },
          options: {
            wait_for_model: false
          }
        });

        statuses[key] = {
          model: modelName,
          status: 'available',
          lastChecked: new Date().toISOString()
        };

      } catch (error) {
        statuses[key] = {
          model: modelName,
          status: 'unavailable',
          error: error.message,
          lastChecked: new Date().toISOString()
        };
      }
    }

    return {
      apiKeyConfigured: !!this.apiKey,
      models: statuses,
      timestamp: new Date().toISOString()
    };
  }
}

export default HuggingFaceService;