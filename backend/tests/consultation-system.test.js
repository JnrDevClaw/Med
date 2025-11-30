import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import ConsultationRequestService from '../src/services/consultationRequestService.js';
import DoctorAvailabilityService from '../src/services/doctorAvailabilityService.js';

// Test configuration
const testConfig = {
  projectId: 'test-project',
  apiKey: 'test-key',
  authDomain: 'test.firebaseapp.com',
  storageBucket: 'test.appspot.com',
  messagingSenderId: '123456789',
  appId: 'test-app-id'
};

describe('Consultation Request System', () => {
  let firestore;
  let consultationRequestService;
  let doctorAvailabilityService;
  let mockLogger;

  beforeAll(async () => {
    // Initialize Firebase app for testing
    const app = initializeApp(testConfig);
    firestore = getFirestore(app);
    
    // Connect to Firestore emulator
    try {
      connectFirestoreEmulator(firestore, 'localhost', 8080);
    } catch (error) {
      // Emulator might already be connected
      console.log('Firestore emulator connection:', error.message);
    }

    // Mock logger
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    };

    // Initialize services
    doctorAvailabilityService = new DoctorAvailabilityService(firestore, mockLogger);
    consultationRequestService = new ConsultationRequestService(
      firestore, 
      mockLogger, 
      doctorAvailabilityService
    );
  });

  beforeEach(() => {
    // Clear mock calls
    jest.clearAllMocks();
  });

  describe('Health Categories', () => {
    it('should return available health categories', () => {
      const categories = consultationRequestService.getHealthCategories();
      
      expect(Array.isArray(categories)).toBe(true);
      expect(categories.length).toBeGreaterThan(0);
      
      // Check structure of first category
      const firstCategory = categories[0];
      expect(firstCategory).toHaveProperty('name');
      expect(firstCategory).toHaveProperty('description');
      expect(firstCategory).toHaveProperty('specialties');
      expect(Array.isArray(firstCategory.specialties)).toBe(true);
    });

    it('should return category names only', () => {
      const categoryNames = consultationRequestService.getCategoryNames();
      
      expect(Array.isArray(categoryNames)).toBe(true);
      expect(categoryNames.length).toBeGreaterThan(0);
      expect(categoryNames).toContain('General Medicine');
      expect(categoryNames).toContain('Cardiology');
      expect(categoryNames).toContain('Emergency');
    });

    it('should return suggested specialties for valid category', () => {
      const specialties = consultationRequestService.getSuggestedSpecialties('Cardiology');
      
      expect(Array.isArray(specialties)).toBe(true);
      expect(specialties.length).toBeGreaterThan(0);
      expect(specialties).toContain('Cardiology');
    });

    it('should return empty array for invalid category', () => {
      const specialties = consultationRequestService.getSuggestedSpecialties('InvalidCategory');
      
      expect(Array.isArray(specialties)).toBe(true);
      expect(specialties.length).toBe(0);
    });
  });

  describe('Request Validation', () => {
    it('should validate required fields for consultation request', async () => {
      const invalidRequestData = {
        // Missing category and description
        urgency: 'medium'
      };

      await expect(
        consultationRequestService.createConsultationRequest('testpatient', invalidRequestData)
      ).rejects.toThrow();
    });

    it('should validate health category', async () => {
      const invalidRequestData = {
        category: 'InvalidCategory',
        description: 'Test description'
      };

      await expect(
        consultationRequestService.createConsultationRequest('testpatient', invalidRequestData)
      ).rejects.toThrow('Invalid health category: InvalidCategory');
    });
  });

  describe('Request Statistics', () => {
    it('should return request statistics', async () => {
      const stats = await consultationRequestService.getRequestStats();
      
      expect(stats).toHaveProperty('pendingRequests');
      expect(stats).toHaveProperty('assignedRequests');
      expect(stats).toHaveProperty('completedRequests');
      expect(stats).toHaveProperty('totalRequests');
      
      expect(typeof stats.pendingRequests).toBe('number');
      expect(typeof stats.assignedRequests).toBe('number');
      expect(typeof stats.completedRequests).toBe('number');
      expect(typeof stats.totalRequests).toBe('number');
    });
  });

  describe('Doctor Availability', () => {
    it('should return availability statistics', async () => {
      const stats = await doctorAvailabilityService.getAvailabilityStats();
      
      expect(stats).toHaveProperty('totalDoctors');
      expect(stats).toHaveProperty('onlineDoctors');
      expect(stats).toHaveProperty('offlineDoctors');
      expect(stats).toHaveProperty('totalActiveConsultations');
      expect(stats).toHaveProperty('averageLoad');
      
      expect(typeof stats.totalDoctors).toBe('number');
      expect(typeof stats.onlineDoctors).toBe('number');
      expect(typeof stats.offlineDoctors).toBe('number');
      expect(typeof stats.totalActiveConsultations).toBe('number');
    });

    it('should get available doctors with filters', async () => {
      const doctors = await doctorAvailabilityService.getAvailableDoctors({
        maxLoad: 3,
        limit: 5
      });
      
      expect(Array.isArray(doctors)).toBe(true);
      // Note: In test environment, there might be no doctors available
      doctors.forEach(doctor => {
        expect(doctor).toHaveProperty('doctorUsername');
        expect(doctor).toHaveProperty('isOnline');
        expect(doctor).toHaveProperty('specialties');
        expect(doctor).toHaveProperty('currentLoad');
        expect(doctor.currentLoad).toBeLessThanOrEqual(3);
      });
    });
  });

  afterAll(async () => {
    // Cleanup if needed
  });
});