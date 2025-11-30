import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  orderBy,
  limit as firestoreLimit
} from 'firebase/firestore';

/**
 * Cross-System Integration Service
 * Connects Q&A system with user profiles, AI suggestions with Q&A, 
 * video consultations with user history, and manages unified notifications
 */
export class CrossSystemIntegrationService {
  constructor(firestore, userProfileService, notificationService, logger) {
    this.firestore = firestore;
    this.userProfileService = userProfileService;
    this.notificationService = notificationService;
    this.logger = logger;
    this.userActivityCollection = 'user_activity';
    this.systemIntegrationsCollection = 'system_integrations';
  }

  /**
   * Connect Q&A system with user profiles
   * Enriches Q&A data with user profile information
   */
  async enrichQuestionWithUserProfile(question) {
    try {
      // Get author profile from IPFS
      const authorProfile = await this.userProfileService.getUserProfile(question.authorUsername);
      
      return {
        ...question,
        author: {
          username: authorProfile.username,
          role: authorProfile.role,
          verified: authorProfile.verified,
          displayName: this.getDisplayName(authorProfile),
          specialties: authorProfile.profileData?.professionalInfo?.specialties || [],
          experience: authorProfile.profileData?.professionalInfo?.experience || 0,
          bio: authorProfile.profileData?.personalInfo?.bio || ''
        }
      };
    } catch (error) {
      this.logger.error('Failed to enrich question with user profile:', error);
      // Return question without enrichment if profile fetch fails
      return {
        ...question,
        author: {
          username: question.authorUsername,
          role: question.authorRole,
          verified: false,
          displayName: question.authorUsername
        }
      };
    }
  }

  async enrichAnswerWithUserProfile(answer) {
    try {
      const authorProfile = await this.userProfileService.getUserProfile(answer.authorUsername);
      
      return {
        ...answer,
        author: {
          username: authorProfile.username,
          role: authorProfile.role,
          verified: authorProfile.verified,
          displayName: this.getDisplayName(authorProfile),
          specialties: authorProfile.profileData?.professionalInfo?.specialties || [],
          experience: authorProfile.profileData?.professionalInfo?.experience || 0,
          credentials: authorProfile.verified ? 'Verified Doctor' : 'Community Member'
        }
      };
    } catch (error) {
      this.logger.error('Failed to enrich answer with user profile:', error);
      return {
        ...answer,
        author: {
          username: answer.authorUsername,
          role: answer.authorRole,
          verified: false,
          displayName: answer.authorUsername
        }
      };
    }
  }

  /**
   * Integrate AI suggestions with Q&A
   * Suggests relevant questions and provides AI insights for Q&A content
   */
  async getAISuggestionsForQuestion(questionContent, category) {
    try {
      // Find similar questions based on content and category
      const similarQuestions = await this.findSimilarQuestions(questionContent, category);
      
      // Generate AI-powered content suggestions
      const aiSuggestions = await this.generateAIContentSuggestions(questionContent, category);
      
      return {
        similarQuestions: similarQuestions.slice(0, 5), // Top 5 similar questions
        aiSuggestions,
        recommendedActions: this.getRecommendedActions(category, similarQuestions.length)
      };
    } catch (error) {
      this.logger.error('Failed to get AI suggestions for question:', error);
      return {
        similarQuestions: [],
        aiSuggestions: null,
        recommendedActions: []
      };
    }
  }

  async findSimilarQuestions(content, category, limit = 10) {
    try {
      // Simple keyword-based similarity (can be enhanced with ML)
      const keywords = this.extractKeywords(content);
      
      const questionsRef = collection(this.firestore, 'questions');
      const q = query(
        questionsRef,
        where('category', '==', category),
        orderBy('upvotes', 'desc'),
        firestoreLimit(limit * 2) // Get more to filter by similarity
      );

      const snapshot = await getDocs(q);
      const questions = [];
      
      snapshot.forEach(doc => {
        const question = { id: doc.id, ...doc.data() };
        const similarity = this.calculateTextSimilarity(content, question.content, keywords);
        
        if (similarity > 0.3) { // Similarity threshold
          questions.push({
            ...question,
            similarity
          });
        }
      });

      // Sort by similarity and return top results
      return questions
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);
        
    } catch (error) {
      this.logger.error('Failed to find similar questions:', error);
      return [];
    }
  }

  async generateAIContentSuggestions(content, category) {
    try {
      // This would integrate with the AI service to generate suggestions
      // For now, return category-based suggestions
      const suggestions = {
        category,
        suggestedTags: this.generateSuggestedTags(content, category),
        relatedTopics: this.getRelatedTopics(category),
        improvementTips: this.getContentImprovementTips(content)
      };

      return suggestions;
    } catch (error) {
      this.logger.error('Failed to generate AI content suggestions:', error);
      return null;
    }
  }

  /**
   * Link video consultations with user history
   * Provides context from previous interactions for consultations
   */
  async getConsultationContext(patientUsername, doctorUsername = null) {
    try {
      const context = {
        patient: await this.getPatientConsultationHistory(patientUsername),
        interactions: await this.getPatientSystemInteractions(patientUsername),
        recommendations: []
      };

      if (doctorUsername) {
        context.doctor = await this.getDoctorConsultationHistory(doctorUsername);
        context.previousInteractions = await this.getPreviousPatientDoctorInteractions(
          patientUsername, 
          doctorUsername
        );
      }

      // Generate recommendations based on history
      context.recommendations = this.generateConsultationRecommendations(context);

      return context;
    } catch (error) {
      this.logger.error('Failed to get consultation context:', error);
      return {
        patient: null,
        interactions: [],
        recommendations: []
      };
    }
  }

  async getPatientConsultationHistory(username, limit = 10) {
    try {
      const consultationsRef = collection(this.firestore, 'consultation_requests');
      const q = query(
        consultationsRef,
        where('patientUsername', '==', username),
        orderBy('createdAt', 'desc'),
        firestoreLimit(limit)
      );

      const snapshot = await getDocs(q);
      const consultations = [];
      
      snapshot.forEach(doc => {
        consultations.push({ id: doc.id, ...doc.data() });
      });

      return {
        totalConsultations: consultations.length,
        recentConsultations: consultations,
        commonCategories: this.getCommonCategories(consultations),
        averageRating: this.calculateAverageRating(consultations)
      };
    } catch (error) {
      this.logger.error('Failed to get patient consultation history:', error);
      return null;
    }
  }

  async getPatientSystemInteractions(username, days = 30) {
    try {
      const interactions = {
        qaActivity: await this.getQAActivity(username, days),
        aiInteractions: await this.getAIInteractions(username, days),
        recentTopics: [],
        engagementLevel: 'medium'
      };

      // Calculate engagement level
      const totalActivity = interactions.qaActivity.questionsAsked + 
                          interactions.qaActivity.answersGiven + 
                          interactions.aiInteractions.totalSessions;
      
      if (totalActivity > 20) interactions.engagementLevel = 'high';
      else if (totalActivity < 5) interactions.engagementLevel = 'low';

      return interactions;
    } catch (error) {
      this.logger.error('Failed to get patient system interactions:', error);
      return {
        qaActivity: { questionsAsked: 0, answersGiven: 0 },
        aiInteractions: { totalSessions: 0 },
        recentTopics: [],
        engagementLevel: 'unknown'
      };
    }
  }

  async getQAActivity(username, days) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      // Get questions asked
      const questionsQuery = query(
        collection(this.firestore, 'questions'),
        where('authorUsername', '==', username),
        where('createdAt', '>=', cutoffDate.toISOString())
      );
      const questionsSnapshot = await getDocs(questionsQuery);

      // Get answers given
      const answersQuery = query(
        collection(this.firestore, 'answers'),
        where('authorUsername', '==', username),
        where('createdAt', '>=', cutoffDate.toISOString())
      );
      const answersSnapshot = await getDocs(answersQuery);

      return {
        questionsAsked: questionsSnapshot.size,
        answersGiven: answersSnapshot.size,
        recentQuestions: questionsSnapshot.docs.slice(0, 5).map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
      };
    } catch (error) {
      this.logger.error('Failed to get QA activity:', error);
      return { questionsAsked: 0, answersGiven: 0, recentQuestions: [] };
    }
  }

  async getAIInteractions(username, days) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      // This would query AI interaction history
      // For now, return mock data structure
      return {
        totalSessions: 0,
        averageSessionLength: 0,
        commonTopics: [],
        lastInteraction: null
      };
    } catch (error) {
      this.logger.error('Failed to get AI interactions:', error);
      return {
        totalSessions: 0,
        averageSessionLength: 0,
        commonTopics: [],
        lastInteraction: null
      };
    }
  }

  /**
   * Record user activity across systems
   */
  async recordUserActivity(username, activityType, data = {}) {
    try {
      const activity = {
        username,
        activityType, // 'question_asked', 'answer_given', 'ai_session', 'consultation_requested', etc.
        data,
        timestamp: serverTimestamp(),
        source: data.source || 'unknown'
      };

      await addDoc(collection(this.firestore, this.userActivityCollection), activity);
      
      this.logger.info('User activity recorded', { username, activityType });
    } catch (error) {
      this.logger.error('Failed to record user activity:', error);
      // Don't throw error - activity recording failure shouldn't block main operations
    }
  }

  /**
   * Get user activity summary
   */
  async getUserActivitySummary(username, days = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const activityRef = collection(this.firestore, this.userActivityCollection);
      const q = query(
        activityRef,
        where('username', '==', username),
        where('timestamp', '>=', cutoffDate),
        orderBy('timestamp', 'desc')
      );

      const snapshot = await getDocs(q);
      const activities = [];
      const activityCounts = {};

      snapshot.forEach(doc => {
        const activity = { id: doc.id, ...doc.data() };
        activities.push(activity);
        
        activityCounts[activity.activityType] = (activityCounts[activity.activityType] || 0) + 1;
      });

      return {
        totalActivities: activities.length,
        activityCounts,
        recentActivities: activities.slice(0, 10),
        mostActiveDay: this.getMostActiveDay(activities),
        engagementTrend: this.calculateEngagementTrend(activities)
      };
    } catch (error) {
      this.logger.error('Failed to get user activity summary:', error);
      return {
        totalActivities: 0,
        activityCounts: {},
        recentActivities: [],
        mostActiveDay: null,
        engagementTrend: 'stable'
      };
    }
  }

  /**
   * Helper methods
   */
  getDisplayName(profile) {
    if (profile.profileData?.personalInfo?.fullName) {
      return profile.profileData.personalInfo.fullName;
    }
    return profile.username;
  }

  extractKeywords(text) {
    // Simple keyword extraction (can be enhanced with NLP)
    return text.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3)
      .slice(0, 10);
  }

  calculateTextSimilarity(text1, text2, keywords) {
    const text2Lower = text2.toLowerCase();
    const matchingKeywords = keywords.filter(keyword => 
      text2Lower.includes(keyword)
    );
    
    return matchingKeywords.length / keywords.length;
  }

  generateSuggestedTags(content, category) {
    // Generate tags based on content and category
    const commonTags = {
      'general': ['health', 'medical', 'advice'],
      'cardiology': ['heart', 'cardiovascular', 'blood-pressure'],
      'dermatology': ['skin', 'rash', 'acne'],
      'pediatrics': ['children', 'kids', 'infant'],
      'mental-health': ['anxiety', 'depression', 'stress']
    };

    return commonTags[category] || ['health', 'medical'];
  }

  getRelatedTopics(category) {
    const relatedTopics = {
      'cardiology': ['Heart Health', 'Blood Pressure', 'Cholesterol'],
      'dermatology': ['Skin Care', 'Allergies', 'Sun Protection'],
      'mental-health': ['Stress Management', 'Sleep Health', 'Wellness']
    };

    return relatedTopics[category] || ['General Health', 'Wellness'];
  }

  getContentImprovementTips(content) {
    const tips = [];
    
    if (content.length < 50) {
      tips.push('Consider providing more details about your symptoms or concerns');
    }
    
    if (!content.includes('?')) {
      tips.push('Make sure to include specific questions you want answered');
    }
    
    return tips;
  }

  getRecommendedActions(category, similarQuestionsCount) {
    const actions = [];
    
    if (similarQuestionsCount > 0) {
      actions.push('Review similar questions before posting');
    }
    
    actions.push('Consider consulting with AI first for quick insights');
    
    if (category === 'emergency') {
      actions.push('For urgent medical issues, consider requesting a video consultation');
    }
    
    return actions;
  }

  getCommonCategories(consultations) {
    const categories = {};
    consultations.forEach(consultation => {
      categories[consultation.category] = (categories[consultation.category] || 0) + 1;
    });
    
    return Object.entries(categories)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([category, count]) => ({ category, count }));
  }

  calculateAverageRating(consultations) {
    const ratingsSum = consultations.reduce((sum, consultation) => {
      return sum + (consultation.rating || 0);
    }, 0);
    
    return consultations.length > 0 ? ratingsSum / consultations.length : 0;
  }

  generateConsultationRecommendations(context) {
    const recommendations = [];
    
    if (context.patient?.commonCategories?.length > 0) {
      recommendations.push({
        type: 'specialty_match',
        message: `Patient frequently consults about ${context.patient.commonCategories[0].category}`
      });
    }
    
    if (context.interactions?.engagementLevel === 'high') {
      recommendations.push({
        type: 'engagement',
        message: 'Highly engaged patient - likely to follow through with recommendations'
      });
    }
    
    return recommendations;
  }

  getMostActiveDay(activities) {
    const dayCounts = {};
    activities.forEach(activity => {
      const day = new Date(activity.timestamp?.toDate?.() || activity.timestamp).toDateString();
      dayCounts[day] = (dayCounts[day] || 0) + 1;
    });
    
    return Object.entries(dayCounts)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || null;
  }

  calculateEngagementTrend(activities) {
    if (activities.length < 7) return 'insufficient_data';
    
    const recentWeek = activities.slice(0, 7).length;
    const previousWeek = activities.slice(7, 14).length;
    
    if (recentWeek > previousWeek) return 'increasing';
    if (recentWeek < previousWeek) return 'decreasing';
    return 'stable';
  }

  async getDoctorConsultationHistory(doctorUsername, limit = 10) {
    try {
      const consultationsRef = collection(this.firestore, 'consultation_requests');
      const q = query(
        consultationsRef,
        where('assignedDoctorUsername', '==', doctorUsername),
        orderBy('createdAt', 'desc'),
        firestoreLimit(limit)
      );

      const snapshot = await getDocs(q);
      const consultations = [];
      
      snapshot.forEach(doc => {
        consultations.push({ id: doc.id, ...doc.data() });
      });

      return {
        totalConsultations: consultations.length,
        recentConsultations: consultations,
        specialtyFocus: this.getSpecialtyFocus(consultations),
        averageRating: this.calculateAverageRating(consultations)
      };
    } catch (error) {
      this.logger.error('Failed to get doctor consultation history:', error);
      return null;
    }
  }

  async getPreviousPatientDoctorInteractions(patientUsername, doctorUsername) {
    try {
      const consultationsRef = collection(this.firestore, 'consultation_requests');
      const q = query(
        consultationsRef,
        where('patientUsername', '==', patientUsername),
        where('assignedDoctorUsername', '==', doctorUsername),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(q);
      const interactions = [];
      
      snapshot.forEach(doc => {
        interactions.push({ id: doc.id, ...doc.data() });
      });

      return {
        totalInteractions: interactions.length,
        lastInteraction: interactions[0] || null,
        relationshipDuration: this.calculateRelationshipDuration(interactions),
        interactionPattern: this.analyzeInteractionPattern(interactions)
      };
    } catch (error) {
      this.logger.error('Failed to get previous patient-doctor interactions:', error);
      return {
        totalInteractions: 0,
        lastInteraction: null,
        relationshipDuration: 0,
        interactionPattern: 'new'
      };
    }
  }

  getSpecialtyFocus(consultations) {
    const categories = {};
    consultations.forEach(consultation => {
      categories[consultation.category] = (categories[consultation.category] || 0) + 1;
    });
    
    return Object.entries(categories)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([category, count]) => ({ category, count }));
  }

  calculateRelationshipDuration(interactions) {
    if (interactions.length === 0) return 0;
    
    const firstInteraction = new Date(interactions[interactions.length - 1].createdAt);
    const lastInteraction = new Date(interactions[0].createdAt);
    
    return Math.floor((lastInteraction - firstInteraction) / (1000 * 60 * 60 * 24)); // Days
  }

  analyzeInteractionPattern(interactions) {
    if (interactions.length === 0) return 'new';
    if (interactions.length === 1) return 'first_time';
    if (interactions.length < 5) return 'occasional';
    return 'regular';
  }
}

export default CrossSystemIntegrationService;