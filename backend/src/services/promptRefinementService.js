import { collection, addDoc, doc, getDoc, updateDoc, query, where, orderBy, limit, getDocs } from 'firebase/firestore';

class PromptRefinementService {
  constructor(firestore, huggingFaceService) {
    this.db = firestore;
    this.hf = huggingFaceService;
    this.collectionName = 'prompt_refinements';
  }

  /**
   * Create a new prompt refinement session
   * @param {string} username - User's username
   * @param {string} originalPrompt - Original user prompt
   * @returns {Promise<Object>} - Refinement session data
   */
  async createRefinementSession(username, originalPrompt) {
    try {
      // Validate input
      if (!originalPrompt || originalPrompt.trim().length === 0) {
        throw new Error('Original prompt cannot be empty');
      }

      if (originalPrompt.length > 2000) {
        throw new Error('Prompt is too long. Please keep it under 2000 characters.');
      }

      // Preprocess the prompt
      const preprocessedPrompt = this.preprocessPrompt(originalPrompt);

      // Create refinement session document
      const sessionData = {
        username,
        originalPrompt: originalPrompt.trim(),
        preprocessedPrompt,
        refinedPrompt: null,
        status: 'pending', // pending, refined, sent, error
        createdAt: new Date(),
        updatedAt: new Date(),
        refinementAttempts: 0,
        metadata: {
          originalLength: originalPrompt.length,
          preprocessedLength: preprocessedPrompt.length
        }
      };

      const docRef = await addDoc(collection(this.db, this.collectionName), sessionData);

      return {
        sessionId: docRef.id,
        ...sessionData,
        id: docRef.id
      };

    } catch (error) {
      console.error('Error creating refinement session:', error);
      throw error;
    }
  }

  /**
   * Refine a prompt using Hugging Face
   * @param {string} sessionId - Refinement session ID
   * @returns {Promise<Object>} - Refined prompt data
   */
  async refinePrompt(sessionId) {
    try {
      // Get session document
      const sessionRef = doc(this.db, this.collectionName, sessionId);
      const sessionSnap = await getDoc(sessionRef);

      if (!sessionSnap.exists()) {
        throw new Error('Refinement session not found');
      }

      const sessionData = sessionSnap.data();

      // Check if already refined
      if (sessionData.status === 'refined' && sessionData.refinedPrompt) {
        return {
          sessionId,
          ...sessionData,
          id: sessionId
        };
      }

      // Check refinement attempts limit
      if (sessionData.refinementAttempts >= 3) {
        throw new Error('Maximum refinement attempts reached');
      }

      // Use preprocessed prompt for refinement
      const promptToRefine = sessionData.preprocessedPrompt || sessionData.originalPrompt;

      // Call Hugging Face service
      const refinementResult = await this.hf.refinePrompt(promptToRefine);

      if (!refinementResult.success) {
        throw new Error('Failed to refine prompt');
      }

      // Update session with refined prompt
      const updatedData = {
        refinedPrompt: refinementResult.refinedPrompt,
        status: 'refined',
        updatedAt: new Date(),
        refinementAttempts: sessionData.refinementAttempts + 1,
        refinementMetadata: {
          model: refinementResult.model,
          refinedAt: refinementResult.timestamp,
          originalLength: promptToRefine.length,
          refinedLength: refinementResult.refinedPrompt.length
        }
      };

      await updateDoc(sessionRef, updatedData);

      return {
        sessionId,
        ...sessionData,
        ...updatedData,
        id: sessionId
      };

    } catch (error) {
      // Update session with error status
      try {
        const sessionRef = doc(this.db, this.collectionName, sessionId);
        await updateDoc(sessionRef, {
          status: 'error',
          error: error.message,
          updatedAt: new Date()
        });
      } catch (updateError) {
        console.error('Error updating session with error status:', updateError);
      }

      console.error('Error refining prompt:', error);
      throw error;
    }
  }

  /**
   * Update original prompt and re-refine
   * @param {string} sessionId - Refinement session ID
   * @param {string} newOriginalPrompt - Updated original prompt
   * @returns {Promise<Object>} - Updated session data
   */
  async updateAndRefinePrompt(sessionId, newOriginalPrompt) {
    try {
      // Validate input
      if (!newOriginalPrompt || newOriginalPrompt.trim().length === 0) {
        throw new Error('Updated prompt cannot be empty');
      }

      if (newOriginalPrompt.length > 2000) {
        throw new Error('Prompt is too long. Please keep it under 2000 characters.');
      }

      // Get session document
      const sessionRef = doc(this.db, this.collectionName, sessionId);
      const sessionSnap = await getDoc(sessionRef);

      if (!sessionSnap.exists()) {
        throw new Error('Refinement session not found');
      }

      const sessionData = sessionSnap.data();

      // Check refinement attempts limit
      if (sessionData.refinementAttempts >= 3) {
        throw new Error('Maximum refinement attempts reached');
      }

      // Preprocess the new prompt
      const preprocessedPrompt = this.preprocessPrompt(newOriginalPrompt);

      // Update session with new original prompt
      await updateDoc(sessionRef, {
        originalPrompt: newOriginalPrompt.trim(),
        preprocessedPrompt,
        refinedPrompt: null,
        status: 'pending',
        updatedAt: new Date(),
        metadata: {
          ...sessionData.metadata,
          originalLength: newOriginalPrompt.length,
          preprocessedLength: preprocessedPrompt.length
        }
      });

      // Refine the updated prompt
      return await this.refinePrompt(sessionId);

    } catch (error) {
      console.error('Error updating and refining prompt:', error);
      throw error;
    }
  }

  /**
   * Mark prompt as sent (final step)
   * @param {string} sessionId - Refinement session ID
   * @returns {Promise<Object>} - Updated session data
   */
  async markPromptAsSent(sessionId) {
    try {
      const sessionRef = doc(this.db, this.collectionName, sessionId);
      const sessionSnap = await getDoc(sessionRef);

      if (!sessionSnap.exists()) {
        throw new Error('Refinement session not found');
      }

      const sessionData = sessionSnap.data();

      if (sessionData.status !== 'refined') {
        throw new Error('Prompt must be refined before sending');
      }

      // Update status to sent
      const updatedData = {
        status: 'sent',
        sentAt: new Date(),
        updatedAt: new Date()
      };

      await updateDoc(sessionRef, updatedData);

      return {
        sessionId,
        ...sessionData,
        ...updatedData,
        id: sessionId
      };

    } catch (error) {
      console.error('Error marking prompt as sent:', error);
      throw error;
    }
  }

  /**
   * Get refinement session by ID
   * @param {string} sessionId - Refinement session ID
   * @param {string} username - User's username (for authorization)
   * @returns {Promise<Object>} - Session data
   */
  async getRefinementSession(sessionId, username) {
    try {
      const sessionRef = doc(this.db, this.collectionName, sessionId);
      const sessionSnap = await getDoc(sessionRef);

      if (!sessionSnap.exists()) {
        throw new Error('Refinement session not found');
      }

      const sessionData = sessionSnap.data();

      // Check if user owns this session
      if (sessionData.username !== username) {
        throw new Error('Unauthorized access to refinement session');
      }

      return {
        sessionId,
        ...sessionData,
        id: sessionId
      };

    } catch (error) {
      console.error('Error getting refinement session:', error);
      throw error;
    }
  }

  /**
   * Get user's recent refinement sessions
   * @param {string} username - User's username
   * @param {number} limitCount - Number of sessions to retrieve
   * @returns {Promise<Array>} - Array of session data
   */
  async getUserRefinementHistory(username, limitCount = 10) {
    try {
      const q = query(
        collection(this.db, this.collectionName),
        where('username', '==', username),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );

      const querySnapshot = await getDocs(q);
      const sessions = [];

      querySnapshot.forEach((doc) => {
        sessions.push({
          sessionId: doc.id,
          ...doc.data(),
          id: doc.id
        });
      });

      return sessions;

    } catch (error) {
      console.error('Error getting user refinement history:', error);
      throw error;
    }
  }

  /**
   * Preprocess user prompt before refinement
   * @param {string} prompt - Original prompt
   * @returns {string} - Preprocessed prompt
   */
  preprocessPrompt(prompt) {
    let processed = prompt.trim();

    // Remove excessive whitespace
    processed = processed.replace(/\s+/g, ' ');

    // Remove potentially harmful content patterns
    const harmfulPatterns = [
      /jailbreak/gi,
      /ignore.{0,20}instructions/gi,
      /pretend.{0,20}you.{0,20}are/gi
    ];

    for (const pattern of harmfulPatterns) {
      processed = processed.replace(pattern, '[filtered]');
    }

    // Add medical context if not present
    const medicalKeywords = ['symptom', 'pain', 'doctor', 'medical', 'health', 'treatment', 'diagnosis'];
    const hasMedicalContext = medicalKeywords.some(keyword => 
      processed.toLowerCase().includes(keyword)
    );

    if (!hasMedicalContext && processed.length > 20) {
      processed = `Medical question: ${processed}`;
    }

    return processed;
  }

  /**
   * Compare original and refined prompts
   * @param {string} sessionId - Refinement session ID
   * @returns {Promise<Object>} - Comparison data
   */
  async comparePrompts(sessionId) {
    try {
      const session = await this.getRefinementSession(sessionId);

      if (!session.refinedPrompt) {
        throw new Error('Prompt has not been refined yet');
      }

      const comparison = {
        original: {
          text: session.originalPrompt,
          length: session.originalPrompt.length,
          wordCount: session.originalPrompt.split(/\s+/).length
        },
        refined: {
          text: session.refinedPrompt,
          length: session.refinedPrompt.length,
          wordCount: session.refinedPrompt.split(/\s+/).length
        },
        improvements: this.analyzeImprovements(session.originalPrompt, session.refinedPrompt)
      };

      return comparison;

    } catch (error) {
      console.error('Error comparing prompts:', error);
      throw error;
    }
  }

  /**
   * Analyze improvements between original and refined prompts
   * @param {string} original - Original prompt
   * @param {string} refined - Refined prompt
   * @returns {Array} - Array of improvement descriptions
   */
  analyzeImprovements(original, refined) {
    const improvements = [];

    // Check for medical terminology
    const medicalTerms = ['symptom', 'diagnosis', 'treatment', 'condition', 'medical history'];
    const originalMedTerms = medicalTerms.filter(term => original.toLowerCase().includes(term)).length;
    const refinedMedTerms = medicalTerms.filter(term => refined.toLowerCase().includes(term)).length;

    if (refinedMedTerms > originalMedTerms) {
      improvements.push('Added medical terminology for clarity');
    }

    // Check for structure improvements
    if (refined.includes('?') && !original.includes('?')) {
      improvements.push('Structured as clear questions');
    }

    // Check for specificity
    const specificityWords = ['specific', 'exactly', 'precisely', 'particular'];
    const originalSpecificity = specificityWords.filter(word => original.toLowerCase().includes(word)).length;
    const refinedSpecificity = specificityWords.filter(word => refined.toLowerCase().includes(word)).length;

    if (refinedSpecificity > originalSpecificity) {
      improvements.push('Made more specific and precise');
    }

    // Check for context addition
    if (refined.length > original.length * 1.2) {
      improvements.push('Added helpful context');
    }

    return improvements;
  }
}

export default PromptRefinementService;