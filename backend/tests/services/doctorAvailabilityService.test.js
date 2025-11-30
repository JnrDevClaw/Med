import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, collection, addDoc, deleteDoc, getDocs, query, where } from 'firebase/firestore';
import DoctorAvailabilityService from '../../src/services/doctorAvailabilityService.js';

// Test configuration
const testConfig = {
  projectId: 'test-project',
  apiKey: 'test-key',
  authDomain: 'test.firebaseapp.com',
  storageBucket: 'test.appspot.com',
  messagingSenderId: '123456789',
  appId: 'test-app-id'
};

describe('Doctor Availability Service - Doctor Discovery Tests', () => {
  let firestore;
  let doctorAvailabilityService;
  let mockLogger;
  let testDoctorIds = [];

  beforeAll(async () => {
    // Initialize Firebase app for testing
    const app = initializeApp(testConfig);
    firestore = getFirestore(app);
    
    // Connect to Firestore emulator
    try {
      connectFirestoreEmulator(firestore, 'localhost', 8080);
    } catch (error) {
      console.log('Firestore emulator connection:', error.message);
    }

    // Mock logger
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    };

    // Initialize service
    doctorAvailabilityService = new DoctorAvailabilityService(firestore, mockLogger);
  });

  beforeEach(async () => {
    // Clear mock calls
    jest.clearAllMocks();
    
    // Clean up test data
    await cleanupTestData();
    
    // Create test doctors
    await createTestDoctors();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  async function createTestDoctors() {
    // Create verified doctors in users collection
    const doctors = [
      { username: 'dr_cardio', role: 'doctor', verified: true },
      { username: 'dr_general', role: 'doctor', verified: true },
      { username: 'dr_pediatric', role: 'doctor', verified: true },
      { username: 'dr_unverified', role: 'doctor', verified: false }
    ];

    for (const doctor of doctors) {
      const docRef = await addDoc(collection(firestore, 'users'), doctor);
      testDoctorIds.push(docRef.id);
    }
  }

  async function cleanupTestData() {
    // Clean up users
    for (const id of testDoctorIds) {
      try {
        await deleteDoc(doc(firestore, 'users', id));
      } catch (error) {
        // Ignore if already deleted
      }
    }
    testDoctorIds = [];

    // Clean up availability records
    const availabilityQuery = query(collection(firestore, 'doctor_availability'));
    const snapshot = await getDocs(availabilityQuery);
    for (const doc of snapshot.docs) {
      await deleteDoc(doc.ref);
    }
  }

  describe('Doctor Availability Management', () => {
    it('should set doctor availability for verified doctor', async () => {
      const specialties = ['Cardiology', 'Internal Medicine'];
      
      await doctorAvailabilityService.setDoctorAvailability('dr_cardio', true, specialties);
      
      const availability = await doctorAvailabilityService.getDoctorAvailability('dr_cardio');
      
      expect(availability).toBeTruthy();
      expect(availability.doctorUsername).toBe('dr_cardio');
      expect(availability.isOnline).toBe(true);
      expect(availability.specialties).toEqual(specialties);
      expect(availability.currentLoad).toBe(0);
    });

    it('should reject setting availability for unverified doctor', async () => {
      await expect(
        doctorAvailabilityService.setDoctorAvailability('dr_unverified', true, [])
      ).rejects.toThrow("Verified doctor 'dr_unverified' not found");
    });

    it('should update existing availability record', async () => {
      // Set initial availability
      await doctorAvailabilityService.setDoctorAvailability('dr_general', true, ['General Practice']);
      
      // Update availability
      await doctorAvailabilityService.setDoctorAvailability('dr_general', false, ['General Practice', 'Family Medicine']);
      
      const availability = await doctorAvailabilityService.getDoctorAvailability('dr_general');
      
      expect(availability.isOnline).toBe(false);
      expect(availability.specialties).toContain('Family Medicine');
    });
  });

  describe('Doctor Discovery Algorithms', () => {
    beforeEach(async () => {
      // Set up test doctors with different availability states
      await doctorAvailabilityService.setDoctorAvailability('dr_cardio', true, ['Cardiology', 'Internal Medicine']);
      await doctorAvailabilityService.setDoctorAvailability('dr_general', true, ['General Practice', 'Family Medicine']);
      await doctorAvailabilityService.setDoctorAvailability('dr_pediatric', false, ['Pediatrics', 'Child Psychology']);
    });

    it('should find available doctors with basic filters', async () => {
      const doctors = await doctorAvailabilityService.getAvailableDoctors({
        maxLoad: 5,
        limit: 10
      });
      
      expect(Array.isArray(doctors)).toBe(true);
      expect(doctors.length).toBe(2); // Only online doctors
      
      const doctorUsernames = doctors.map(d => d.doctorUsername);
      expect(doctorUsernames).toContain('dr_cardio');
      expect(doctorUsernames).toContain('dr_general');
      expect(doctorUsernames).not.toContain('dr_pediatric'); // offline
    });

    it('should filter doctors by specialty', async () => {
      const doctors = await doctorAvailabilityService.getAvailableDoctors({
        specialties: ['Cardiology'],
        limit: 10
      });
      
      expect(doctors.length).toBe(1);
      expect(doctors[0].doctorUsername).toBe('dr_cardio');
      expect(doctors[0].specialties).toContain('Cardiology');
    });

    it('should respect load balancing in doctor discovery', async () => {
      // Set different loads for doctors
      await doctorAvailabilityService.updateDoctorLoad('dr_cardio', 2);
      await doctorAvailabilityService.updateDoctorLoad('dr_general', 4);
      
      const doctors = await doctorAvailabilityService.getAvailableDoctors({
        maxLoad: 3,
        limit: 10
      });
      
      // Only dr_cardio should be returned (load = 2, under maxLoad = 3)
      expect(doctors.length).toBe(1);
      expect(doctors[0].doctorUsername).toBe('dr_cardio');
      expect(doctors[0].currentLoad).toBe(2);
    });

    it('should find best matching doctor with scoring algorithm', async () => {
      // Set up doctors with different loads
      await doctorAvailabilityService.updateDoctorLoad('dr_cardio', 1);
      await doctorAvailabilityService.updateDoctorLoad('dr_general', 3);
      
      const bestMatch = await doctorAvailabilityService.findBestMatchingDoctor(
        'Cardiology',
        ['Cardiology', 'Internal Medicine']
      );
      
      expect(bestMatch).toBeTruthy();
      expect(bestMatch.doctorUsername).toBe('dr_cardio');
      expect(bestMatch.matchScore).toBeGreaterThan(0);
      expect(bestMatch.specialties).toContain('Cardiology');
    });

    it('should return null when no doctors match criteria', async () => {
      const bestMatch = await doctorAvailabilityService.findBestMatchingDoctor(
        'Neurology',
        ['Neurosurgery', 'Brain Surgery']
      );
      
      expect(bestMatch).toBeNull();
    });

    it('should prioritize doctors with lower load in matching', async () => {
      // Create two cardiology doctors with different loads
      await doctorAvailabilityService.setDoctorAvailability('dr_cardio', true, ['Cardiology']);
      await doctorAvailabilityService.updateDoctorLoad('dr_cardio', 3);
      
      // Add another cardiology doctor with lower load
      const docRef = await addDoc(collection(firestore, 'users'), {
        username: 'dr_cardio2',
        role: 'doctor',
        verified: true
      });
      testDoctorIds.push(docRef.id);
      
      await doctorAvailabilityService.setDoctorAvailability('dr_cardio2', true, ['Cardiology']);
      await doctorAvailabilityService.updateDoctorLoad('dr_cardio2', 1);
      
      const bestMatch = await doctorAvailabilityService.findBestMatchingDoctor(
        'Cardiology',
        ['Cardiology']
      );
      
      expect(bestMatch.doctorUsername).toBe('dr_cardio2');
      expect(bestMatch.currentLoad).toBe(1);
    });
  });

  describe('Load Management', () => {
    beforeEach(async () => {
      await doctorAvailabilityService.setDoctorAvailability('dr_general', true, ['General Practice']);
    });

    it('should update doctor consultation load', async () => {
      // Increase load
      await doctorAvailabilityService.updateDoctorLoad('dr_general', 2);
      
      let availability = await doctorAvailabilityService.getDoctorAvailability('dr_general');
      expect(availability.currentLoad).toBe(2);
      
      // Decrease load
      await doctorAvailabilityService.updateDoctorLoad('dr_general', -1);
      
      availability = await doctorAvailabilityService.getDoctorAvailability('dr_general');
      expect(availability.currentLoad).toBe(1);
    });

    it('should not allow negative load values', async () => {
      await doctorAvailabilityService.updateDoctorLoad('dr_general', -5);
      
      const availability = await doctorAvailabilityService.getDoctorAvailability('dr_general');
      expect(availability.currentLoad).toBe(0);
    });

    it('should throw error for non-existent doctor load update', async () => {
      await expect(
        doctorAvailabilityService.updateDoctorLoad('nonexistent_doctor', 1)
      ).rejects.toThrow("Doctor availability record not found for 'nonexistent_doctor'");
    });
  });

  describe('Cleanup and Maintenance', () => {
    it('should set doctor offline', async () => {
      await doctorAvailabilityService.setDoctorAvailability('dr_general', true, ['General Practice']);
      
      await doctorAvailabilityService.setDoctorOffline('dr_general');
      
      const availability = await doctorAvailabilityService.getDoctorAvailability('dr_general');
      expect(availability.isOnline).toBe(false);
    });

    it('should get availability statistics', async () => {
      await doctorAvailabilityService.setDoctorAvailability('dr_cardio', true, ['Cardiology']);
      await doctorAvailabilityService.setDoctorAvailability('dr_general', false, ['General Practice']);
      
      const stats = await doctorAvailabilityService.getAvailabilityStats();
      
      expect(stats).toHaveProperty('totalDoctors');
      expect(stats).toHaveProperty('onlineDoctors');
      expect(stats).toHaveProperty('offlineDoctors');
      expect(stats).toHaveProperty('totalActiveConsultations');
      expect(stats).toHaveProperty('averageLoad');
      expect(stats).toHaveProperty('cacheSize');
      
      expect(typeof stats.totalDoctors).toBe('number');
      expect(typeof stats.onlineDoctors).toBe('number');
      expect(stats.onlineDoctors).toBe(1);
    });
  });

  describe('Caching Behavior', () => {
    it('should cache online doctor data', async () => {
      await doctorAvailabilityService.setDoctorAvailability('dr_cardio', true, ['Cardiology']);
      
      // First call should populate cache
      const availability1 = await doctorAvailabilityService.getDoctorAvailability('dr_cardio');
      expect(availability1).toBeTruthy();
      
      // Second call should use cache (verify by checking cache size in stats)
      const availability2 = await doctorAvailabilityService.getDoctorAvailability('dr_cardio');
      expect(availability2).toBeTruthy();
      
      const stats = await doctorAvailabilityService.getAvailabilityStats();
      expect(stats.cacheSize).toBeGreaterThan(0);
    });

    it('should remove from cache when set offline', async () => {
      await doctorAvailabilityService.setDoctorAvailability('dr_cardio', true, ['Cardiology']);
      
      // Verify cached
      await doctorAvailabilityService.getDoctorAvailability('dr_cardio');
      let stats = await doctorAvailabilityService.getAvailabilityStats();
      expect(stats.cacheSize).toBeGreaterThan(0);
      
      // Set offline
      await doctorAvailabilityService.setDoctorOffline('dr_cardio');
      
      // Cache should be cleared
      stats = await doctorAvailabilityService.getAvailabilityStats();
      expect(stats.cacheSize).toBe(0);
    });
  });
});