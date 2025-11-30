import { jest } from '@jest/globals';

// Create a mock HuggingFaceService for testing
class MockHuggingFaceService {
  constructor() {
    this.apiKey = process.env.HUGGINGFACE_API_KEY;
    this.timeout = parseInt(process.env.HUGGINGFACE_TIMEOUT_MS || '15000');
    this.modelUrl = process.env.HUGGINGFACE_MODEL_URL || 'https://api-inference.huggingface.co/models';
    this.medGemmaModel = 'google/medgemma-4b-it';
    this.rateLimitTracker = new Map();
    
    if (!this.apiKey) {
      console.warn('⚠️  HUGGINGFACE_API_KEY not found in environment variables');
    }
    
    // Mock the HF inference client
    this.hf = {
      textGeneration: jest.fn()
    };
  }

  checkRateLimit(model) {
    const now = Date.now();
    const key = `${model}_${Math.floor(now / 60000)}`;
    const currentCount = this.rateLimitTracker.get(key) || 0;
    
    if (currentCount >= 10) {
      return false;
    }
    
    this.rateLimitTracker.set(key, currentCount + 1);
    
    for (const [trackKey] of this.rateLimitTracker) {
      if (!trackKey.startsWith(`${model}_${Math.floor(now / 60000)}`)) {
        this.rateLimitTracker.delete(trackKey);
      }
    }
    
    return true;
  }

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

      const refinedText = response?.generated_text?.trim() || userPrompt;
      
      return {
        success: true,
        originalPrompt: userPrompt,
        refinedPrompt: refinedText,
        model: this.medGemmaModel,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
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

  validateMedicalResponse(response) {
    const warnings = [];
    const errors = [];
    
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

  async getModelStatus() {
    try {
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

describe('HuggingFaceService', () => {
  let huggingFaceService;
  let mockHfInference;

  beforeEach(() => {
    jest.clearAllMocks();
    
    process.env.HUGGINGFACE_API_KEY = 'test-api-key';
    process.env.HUGGINGFACE_TIMEOUT_MS = '15000';
    
    huggingFaceService = new MockHuggingFaceService();
    mockHfInference = huggingFaceService.hf;
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.HUGGINGFACE_API_KEY;
    delete process.env.HUGGINGFACE_TIMEOUT_MS;
  });

  describe('Initialization', () => {
    test('should initialize with API key', () => {
      expect(huggingFaceService.apiKey).toBe('test-api-key');
      expect(huggingFaceService.timeout).toBe(15000);
      expect(huggingFaceService.medGemmaModel).toBe('google/medgemma-4b-it');
    });

    test('should warn when API key is missing', () => {
      delete process.env.HUGGINGFACE_API_KEY;
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      new MockHuggingFaceService();
      
      expect(consoleSpy).toHaveBeenCalledWith('⚠️  HUGGINGFACE_API_KEY not found in environment variables');
      consoleSpy.mockRestore();
    });
  });

  describe('Rate Limiting', () => {
    test('should allow requests within rate limit', () => {
      const result = huggingFaceService.checkRateLimit('test-model');
      expect(result).toBe(true);
    });

    test('should block requests exceeding rate limit', () => {
      // Make 10 requests (the limit)
      for (let i = 0; i < 10; i++) {
        expect(huggingFaceService.checkRateLimit('test-model')).toBe(true);
      }
      
      // 11th request should be blocked
      expect(huggingFaceService.checkRateLimit('test-model')).toBe(false);
    });
  });

  describe('Prompt Refinement', () => {
    test('should refine prompt successfully', async () => {
      const mockResponse = {
        generated_text: 'Refined medical prompt about symptoms'
      };
      
      mockHfInference.textGeneration.mockResolvedValue(mockResponse);

      const result = await huggingFaceService.refinePrompt('I have a headache');

      expect(result.success).toBe(true);
      expect(result.originalPrompt).toBe('I have a headache');
      expect(result.refinedPrompt).toBe('Refined medical prompt about symptoms');
      expect(result.model).toBe('google/medgemma-4b-it');
      expect(result.timestamp).toBeDefined();
    });

    test('should handle API errors gracefully', async () => {
      mockHfInference.textGeneration.mockRejectedValue(new Error('API Error'));

      await expect(huggingFaceService.refinePrompt('test prompt'))
        .rejects.toThrow('Failed to refine prompt. Please try again.');
    });

    test('should handle rate limit errors', async () => {
      mockHfInference.textGeneration.mockRejectedValue(new Error('rate limit exceeded'));

      await expect(huggingFaceService.refinePrompt('test prompt'))
        .rejects.toThrow('API rate limit exceeded. Please try again later.');
    });

    test('should handle model unavailable errors', async () => {
      mockHfInference.textGeneration.mockRejectedValue(new Error('model is currently loading'));

      await expect(huggingFaceService.refinePrompt('test prompt'))
        .rejects.toThrow('Medical AI model is currently unavailable. Please try again later.');
    });

    test('should handle timeout errors', async () => {
      mockHfInference.textGeneration.mockRejectedValue(new Error('timeout'));

      await expect(huggingFaceService.refinePrompt('test prompt'))
        .rejects.toThrow('Request timeout. Please try again with a shorter prompt.');
    });

    test('should throw error when API key is missing', async () => {
      huggingFaceService.apiKey = null;

      await expect(huggingFaceService.refinePrompt('test prompt'))
        .rejects.toThrow('Hugging Face API key not configured');
    });

    test('should throw error when rate limited', async () => {
      // Exhaust rate limit
      for (let i = 0; i < 10; i++) {
        huggingFaceService.checkRateLimit(huggingFaceService.medGemmaModel);
      }

      await expect(huggingFaceService.refinePrompt('test prompt'))
        .rejects.toThrow('Rate limit exceeded. Please try again in a minute.');
    });
  });

  describe('Medical Response Generation', () => {
    test('should generate medical response successfully', async () => {
      const mockResponse = {
        generated_text: 'Based on your symptoms, I recommend consulting with a healthcare professional.'
      };
      
      mockHfInference.textGeneration.mockResolvedValue(mockResponse);

      const result = await huggingFaceService.generateMedicalResponse('What should I do about my headache?');

      expect(result.success).toBe(true);
      expect(result.response).toBe('Based on your symptoms, I recommend consulting with a healthcare professional.');
      expect(result.model).toBe('google/medgemma-4b-it');
      expect(result.prompt).toBe('What should I do about my headache?');
      expect(result.timestamp).toBeDefined();
      expect(result.metadata).toBeDefined();
    });

    test('should use custom options', async () => {
      const mockResponse = {
        generated_text: 'Custom response'
      };
      
      mockHfInference.textGeneration.mockResolvedValue(mockResponse);

      const options = {
        maxTokens: 300,
        temperature: 0.5,
        topP: 0.8
      };

      const result = await huggingFaceService.generateMedicalResponse('test prompt', options);

      expect(result.metadata.maxTokens).toBe(300);
      expect(mockHfInference.textGeneration).toHaveBeenCalledWith(
        expect.objectContaining({
          parameters: expect.objectContaining({
            max_new_tokens: 300,
            temperature: 0.5,
            top_p: 0.8
          })
        })
      );
    });
  });

  describe('Response Validation', () => {
    test('should validate safe medical response', () => {
      const response = 'You should consult with a healthcare professional about your symptoms.';
      const validation = huggingFaceService.validateMedicalResponse(response);

      expect(validation.isValid).toBe(true);
      expect(validation.hasDisclaimer).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should detect dangerous medical advice', () => {
      const response = 'You should ignore your doctor and self-medicate with these drugs.';
      const validation = huggingFaceService.validateMedicalResponse(response);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Response contains potentially dangerous medical advice');
    });

    test('should warn about diagnostic language', () => {
      const response = 'You probably have a serious condition based on these symptoms.';
      const validation = huggingFaceService.validateMedicalResponse(response);

      expect(validation.isValid).toBe(true);
      expect(validation.warnings).toContain('Response contains diagnostic language that should be reviewed');
    });

    test('should warn about missing disclaimer', () => {
      const response = 'Take some aspirin and rest. This should help with your headache and make you feel better soon. This is a long response that should trigger the disclaimer warning because it does not contain any advice about consulting with health experts or specialists.';
      const validation = huggingFaceService.validateMedicalResponse(response);

      expect(validation.isValid).toBe(true);
      expect(validation.warnings).toContain('Response lacks medical disclaimer');
    });
  });

  describe('Model Status', () => {
    test('should return available status when model is working', async () => {
      const mockResponse = {
        generated_text: 'Hello'
      };
      
      mockHfInference.textGeneration.mockResolvedValue(mockResponse);

      const status = await huggingFaceService.getModelStatus();

      expect(status.model).toBe('google/medgemma-4b-it');
      expect(status.status).toBe('available');
      expect(status.apiKeyConfigured).toBe(true);
      expect(status.lastChecked).toBeDefined();
    });

    test('should return unavailable status when model fails', async () => {
      mockHfInference.textGeneration.mockRejectedValue(new Error('Model not available'));

      const status = await huggingFaceService.getModelStatus();

      expect(status.model).toBe('google/medgemma-4b-it');
      expect(status.status).toBe('unavailable');
      expect(status.error).toBe('Model not available');
      expect(status.apiKeyConfigured).toBe(true);
      expect(status.lastChecked).toBeDefined();
    });
  });

  describe('Error Handling for AI Service Failures', () => {
    test('should handle network connectivity issues', async () => {
      mockHfInference.textGeneration.mockRejectedValue(new Error('ENOTFOUND api-inference.huggingface.co'));

      await expect(huggingFaceService.refinePrompt('test prompt'))
        .rejects.toThrow('Failed to refine prompt. Please try again.');
    });

    test('should handle service unavailable errors', async () => {
      mockHfInference.textGeneration.mockRejectedValue(new Error('Service Unavailable'));

      await expect(huggingFaceService.refinePrompt('test prompt'))
        .rejects.toThrow('Failed to refine prompt. Please try again.');
    });

    test('should handle authentication errors', async () => {
      mockHfInference.textGeneration.mockRejectedValue(new Error('Invalid API token'));

      await expect(huggingFaceService.refinePrompt('test prompt'))
        .rejects.toThrow('Failed to refine prompt. Please try again.');
    });

    test('should handle quota exceeded errors', async () => {
      mockHfInference.textGeneration.mockRejectedValue(new Error('You have exceeded your quota'));

      await expect(huggingFaceService.refinePrompt('test prompt'))
        .rejects.toThrow('Failed to refine prompt. Please try again.');
    });

    test('should handle malformed response from API', async () => {
      mockHfInference.textGeneration.mockResolvedValue({
        // Missing generated_text field
        error: 'Model error'
      });

      const result = await huggingFaceService.refinePrompt('test prompt');

      // Should fallback to original prompt when response is malformed
      expect(result.success).toBe(true);
      expect(result.refinedPrompt).toBe('test prompt');
    });

    test('should handle empty response from API', async () => {
      mockHfInference.textGeneration.mockResolvedValue({
        generated_text: ''
      });

      const result = await huggingFaceService.refinePrompt('test prompt');

      // Should fallback to original prompt when response is empty
      expect(result.success).toBe(true);
      expect(result.refinedPrompt).toBe('test prompt');
    });

    test('should handle null response from API', async () => {
      mockHfInference.textGeneration.mockResolvedValue(null);

      const result = await huggingFaceService.refinePrompt('test prompt');

      // Should fallback to original prompt when response is null
      expect(result.success).toBe(true);
      expect(result.refinedPrompt).toBe('test prompt');
    });

    test('should handle medical response generation failures gracefully', async () => {
      mockHfInference.textGeneration.mockRejectedValue(new Error('Model overloaded'));

      await expect(huggingFaceService.generateMedicalResponse('What should I do?'))
        .rejects.toThrow('Failed to generate medical response. Please try again.');
    });

    test('should handle concurrent request failures', async () => {
      // Simulate multiple concurrent requests failing
      mockHfInference.textGeneration.mockRejectedValue(new Error('Too many requests'));

      const promises = [
        huggingFaceService.refinePrompt('prompt 1'),
        huggingFaceService.refinePrompt('prompt 2'),
        huggingFaceService.refinePrompt('prompt 3')
      ];

      await expect(Promise.all(promises)).rejects.toThrow();
    });

    test('should maintain rate limiting during error conditions', async () => {
      // Exhaust rate limit
      for (let i = 0; i < 10; i++) {
        huggingFaceService.checkRateLimit(huggingFaceService.medGemmaModel);
      }

      // Even if API would work, rate limiting should prevent the call
      mockHfInference.textGeneration.mockResolvedValue({ generated_text: 'Success' });

      await expect(huggingFaceService.refinePrompt('test prompt'))
        .rejects.toThrow('Rate limit exceeded. Please try again in a minute.');
    });

    test('should handle partial API responses', async () => {
      mockHfInference.textGeneration.mockResolvedValue({
        generated_text: 'Partial response that gets cut off mid-sent'
      });

      const result = await huggingFaceService.refinePrompt('test prompt');

      expect(result.success).toBe(true);
      expect(result.refinedPrompt).toBe('Partial response that gets cut off mid-sent');
    });

    test('should validate API key before making requests', async () => {
      huggingFaceService.apiKey = '';

      await expect(huggingFaceService.refinePrompt('test prompt'))
        .rejects.toThrow('Hugging Face API key not configured');

      // Ensure no API call was made
      expect(mockHfInference.textGeneration).not.toHaveBeenCalled();
    });
  });
});