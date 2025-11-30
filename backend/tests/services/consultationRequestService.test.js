import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, collection, addDoc, deleteDoc, getDocs, query, where, doc } from 'firebase/firestore';
import ConsultationRequestService from '../../src/services/consultationRequestService.js';
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

describe('Consultation Request Service - Workflow Tests', () => {
  let firestore;
  let consultationRequestService;
  let doctorAvailabilityService;
  let mockLogger;
  let testUserIds = [];
  let testRequestIds = [];

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

    // Initialize services
    doctorAvailabilityService = new DoctorAvailabilityService(firestore, mockLogger);
    consultationRequestService = new ConsultationRequestService(
      firestore, 
      mockLogger, 
      doctorAvailabilityService
    );
  });

  beforeEach(async () => {
    // Clear mock calls
    jest.clearAllMocks();
    
    // Clean up test data
    await cleanupTestData();
    
    // Create test users
    await createTestUsers();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  async function createTestUsers() {
    // Create test patients and doctors
    const users = [
      { username: 'patient1', role: 'patient' },
      { username: 'patient2', role: 'patient' },
      { username: 'dr_cardio', role: 'doctor', verified: true },
      { username: 'dr_general', role: 'doctor', verified: true },
      { username: 'dr_busy', role: 'doctor', verified: true }
    ];

    for (const user of users) {
      const docRef = await addDoc(collection(firestore, 'users'), user);
      testUserIds.push(docRef.id);
    }

    // Set up doctor availability
    await doctorAvailabilityService.setDoctorAvailability('dr_cardio', true, ['Cardiology', 'Internal Medicine']);
    await doctorAvailabilityService.setDoctorAvailability('dr_general', true, ['General Practice', 'Family Medicine']);
    await doctorAvailabilityService.setDoctorAvailability('dr_busy', true, ['General Practice']);
    
    // Set dr_busy to high load
    await doctorAvailabilityService.updateDoctorLoad('dr_busy', 5);
  }

  async function cleanupTestData() {
    // Clean up users
    for (const id of testUserIds) {
      try {
        await deleteDoc(doc(firestore, 'users', id));
      } catch (error) {
        // Ignore if already deleted
      }
    }
    testUserIds = [];

    // Clean up consultation requests
    for (const id of testRequestIds) {
      try {
        await deleteDoc(doc(firestore, 'consultation_requests', id));
      } catch (error) {
        // Ignore if already deleted
      }
    }
    testRequestIds = [];

    // Clean up availability records
    const availabilityQuery = query(collection(firestore, 'doctor_availability'));
    const snapshot = await getDocs(availabilityQuery);
    for (const docSnapshot of snapshot.docs) {
      await deleteDoc(docSnapshot.ref);
    }

    // Clean up all consultation requests
    const requestsQuery = query(collection(firestore, 'consultation_requests'));
    const requestsSnapshot = await getDocs(requestsQuery);
    for (const docSnapshot of requestsSnapshot.docs) {
      await deleteDoc(docSnapshot.ref);
    }
  }

  describe('Consultation Request Creation Workflow', () => {
    it('should create consultation request with automatic doctor assignment', async () => {
      const requestData = {
        category: 'Cardiology',
        description: 'Chest pain and shortness of breath',
        preferredSpecialties: ['Cardiology'],
        urgency: 'high'
      };

      const request = await consultationRequestService.createConsultationRequest('patient1', requestData);
      testRequestIds.push(request.id);

      expect(request).toBeTruthy();
      expect(request.id).toBeTruthy();
      expect(request.patientUsername).toBe('patient1');
      expect(request.category).toBe('Cardiology');
      expect(request.description).toBe(requestData.description);
      expect(request.urgency).toBe('high');
      expect(request.status).toBe('assigned'); // Should be auto-assigned
      expect(request.assignedDoctorUsername).toBe('dr_cardio');
    });

    it('should create pending request when no doctors available', async () => {
      // Set all doctors offline
      await doctorAvailabilityService.setDoctorOffline('dr_cardio');
      await doctorAvailabilityService.setDoctorOffline('dr_general');
      await doctorAvailabilityService.setDoctorOffline('dr_busy');

      const requestData = {
        category: 'Neurology',
        description: 'Headache and dizziness',
        urgency: 'medium'
      };

      const request = await consultationRequestService.createConsultationRequest('patient1', requestData);
      testRequestIds.push(request.id);

      expect(request.status).toBe('pending');
      expect(request.assignedDoctorUsername).toBeNull();
    });

    it('should assign preferred doctor if available', async () => {
      const requestData = {
        category: 'General Medicine',
        description: 'General health checkup',
        preferredDoctorUsername: 'dr_general',
        urgency: 'low'
      };

      const request = await consultationRequestService.createConsultationRequest('patient1', requestData);
      testRequestIds.push(request.id);

      expect(request.status).toBe('assigned');
      expect(request.assignedDoctorUsername).toBe('dr_general');
    });

    it('should reject invalid health category', async () => {
      const requestData = {
        category: 'InvalidCategory',
        description: 'Test description'
      };

      await expect(
        consultationRequestService.createConsultationRequest('patient1', requestData)
      ).rejects.toThrow('Invalid health category: InvalidCategory');
    });

    it('should reject request for non-existent patient', async () => {
      const requestData = {
        category: 'General Medicine',
        description: 'Test description'
      };

      await expect(
        consultationRequestService.createConsultationRequest('nonexistent_patient', requestData)
      ).rejects.toThrow("Patient 'nonexistent_patient' not found");
    });
  });

  describe('Request Status Management Workflow', () => {
    let testRequestId;

    beforeEach(async () => {
      const requestData = {
        category: 'General Medicine',
        description: 'Test consultation',
        urgency: 'medium'
      };

      const request = await consultationRequestService.createConsultationRequest('patient1', requestData);
      testRequestId = request.id;
      testRequestIds.push(testRequestId);
    });

    it('should accept consultation request', async () => {
      const updatedRequest = await consultationRequestService.updateRequestStatus(
        testRequestId,
        'accepted',
        'dr_general',
        { scheduledAt: new Date().toISOString() }
      );

      expect(updatedRequest.status).toBe('accepted');
      expect(updatedRequest.acceptedAt).toBeTruthy();
      expect(updatedRequest.scheduledAt).toBeTruthy();
      expect(updatedRequest.notes).toHaveLength(1);
      expect(updatedRequest.notes[0].type).toBe('status_change');
    });

    it('should reject consultation request with reason', async () => {
      const rejectionReason = 'Doctor unavailable at requested time';
      
      const updatedRequest = await consultationRequestService.updateRequestStatus(
        testRequestId,
        'rejected',
        'dr_general',
        { rejectionReason }
      );

      expect(updatedRequest.status).toBe('rejected');
      expect(updatedRequest.rejectionReason).toBe(rejectionReason);
      expect(updatedRequest.notes).toHaveLength(1);
    });

    it('should complete consultation request and update doctor load', async () => {
      // First accept the request
      await consultationRequestService.updateRequestStatus(testRequestId, 'accepted', 'dr_general');
      
      // Then complete it
      const updatedRequest = await consultationRequestService.updateRequestStatus(
        testRequestId,
        'completed',
        'dr_general'
      );

      expect(updatedRequest.status).toBe('completed');
      expect(updatedRequest.completedAt).toBeTruthy();
      
      // Verify doctor load was decreased
      const availability = await doctorAvailabilityService.getDoctorAvailability('dr_general');
      expect(availability.currentLoad).toBe(0);
    });

    it('should cancel consultation request', async () => {
      const updatedRequest = await consultationRequestService.updateRequestStatus(
        testRequestId,
        'cancelled',
        'patient1'
      );

      expect(updatedRequest.status).toBe('cancelled');
      expect(updatedRequest.notes).toHaveLength(1);
    });

    it('should throw error for non-existent request', async () => {
      await expect(
        consultationRequestService.updateRequestStatus('nonexistent_id', 'accepted', 'dr_general')
      ).rejects.toThrow("Consultation request 'nonexistent_id' not found");
    });
  });

  describe('Request Retrieval and Filtering', () => {
    beforeEach(async () => {
      // Create multiple test requests
      const requests = [
        {
          patient: 'patient1',
          data: { category: 'Cardiology', description: 'Heart issue', urgency: 'high' }
        },
        {
          patient: 'patient1',
          data: { category: 'General Medicine', description: 'Checkup', urgency: 'low' }
        },
        {
          patient: 'patient2',
          data: { category: 'Cardiology', description: 'Chest pain', urgency: 'medium' }
        }
      ];

      for (const req of requests) {
        const request = await consultationRequestService.createConsultationRequest(req.patient, req.data);
        testRequestIds.push(request.id);
      }
    });

    it('should get consultation requests for patient', async () => {
      const requests = await consultationRequestService.getConsultationRequests('patient1', 'patient');

      expect(Array.isArray(requests)).toBe(true);
      expect(requests.length).toBe(2);
      expect(requests.every(r => r.patientUsername === 'patient1')).toBe(true);
    });

    it('should get consultation requests for doctor', async () => {
      const requests = await consultationRequestService.getConsultationRequests('dr_cardio', 'doctor');

      expect(Array.isArray(requests)).toBe(true);
      // Should get requests assigned to dr_cardio
      expect(requests.every(r => r.assignedDoctorUsername === 'dr_cardio')).toBe(true);
    });

    it('should filter requests by status', async () => {
      const requests = await consultationRequestService.getConsultationRequests(
        'patient1', 
        'patient',
        { status: 'assigned' }
      );

      expect(requests.every(r => r.status === 'assigned')).toBe(true);
    });

    it('should filter requests by category', async () => {
      const requests = await consultationRequestService.getConsultationRequests(
        'patient1',
        'patient',
        { category: 'Cardiology' }
      );

      expect(requests.every(r => r.category === 'Cardiology')).toBe(true);
      expect(requests.length).toBe(1);
    });

    it('should throw error for invalid role', async () => {
      await expect(
        consultationRequestService.getConsultationRequests('patient1', 'invalid_role')
      ).rejects.toThrow('Invalid role: invalid_role');
    });
  });

  describe('Request Notes and Communication', () => {
    let testRequestId;

    beforeEach(async () => {
      const requestData = {
        category: 'General Medicine',
        description: 'Test consultation'
      };

      const request = await consultationRequestService.createConsultationRequest('patient1', requestData);
      testRequestId = request.id;
      testRequestIds.push(testRequestId);
    });

    it('should add note to consultation request', async () => {
      const noteContent = 'Patient has history of hypertension';
      
      await consultationRequestService.addRequestNote(
        testRequestId,
        noteContent,
        'dr_general',
        'medical'
      );

      // Retrieve request to verify note was added
      const requests = await consultationRequestService.getConsultationRequests('patient1', 'patient');
      const request = requests.find(r => r.id === testRequestId);

      expect(request.notes).toHaveLength(1);
      expect(request.notes[0].content).toBe(noteContent);
      expect(request.notes[0].type).toBe('medical');
      expect(request.notes[0].createdBy).toBe('dr_general');
    });

    it('should throw error when adding note to non-existent request', async () => {
      await expect(
        consultationRequestService.addRequestNote('nonexistent_id', 'Test note', 'dr_general')
      ).rejects.toThrow("Consultation request 'nonexistent_id' not found");
    });
  });

  describe('Request Reassignment Workflow', () => {
    let testRequestId;

    beforeEach(async () => {
      const requestData = {
        category: 'General Medicine',
        description: 'Test consultation',
        preferredDoctorUsername: 'dr_general'
      };

      const request = await consultationRequestService.createConsultationRequest('patient1', requestData);
      testRequestId = request.id;
      testRequestIds.push(testRequestId);
    });

    it('should reassign request to different doctor', async () => {
      const updatedRequest = await consultationRequestService.reassignRequest(
        testRequestId,
        'dr_cardio',
        'admin'
      );

      expect(updatedRequest.assignedDoctorUsername).toBe('dr_cardio');
      expect(updatedRequest.status).toBe('assigned');
      expect(updatedRequest.notes.some(note => note.type === 'reassignment')).toBe(true);
      
      // Verify load balancing
      const cardioDr = await doctorAvailabilityService.getDoctorAvailability('dr_cardio');
      const generalDr = await doctorAvailabilityService.getDoctorAvailability('dr_general');
      
      expect(cardioDr.currentLoad).toBe(1);
      expect(generalDr.currentLoad).toBe(0);
    });

    it('should reject reassignment to unavailable doctor', async () => {
      await doctorAvailabilityService.setDoctorOffline('dr_cardio');

      await expect(
        consultationRequestService.reassignRequest(testRequestId, 'dr_cardio', 'admin')
      ).rejects.toThrow("Doctor 'dr_cardio' is not available");
    });

    it('should reject reassignment to overloaded doctor', async () => {
      await expect(
        consultationRequestService.reassignRequest(testRequestId, 'dr_busy', 'admin')
      ).rejects.toThrow("Doctor 'dr_busy' has reached maximum consultation load");
    });
  });

  describe('Auto-Assignment and Pending Request Management', () => {
    it('should auto-assign pending requests', async () => {
      // Create pending request by setting all doctors offline first
      await doctorAvailabilityService.setDoctorOffline('dr_cardio');
      await doctorAvailabilityService.setDoctorOffline('dr_general');

      const requestData = {
        category: 'General Medicine',
        description: 'Test consultation'
      };

      const request = await consultationRequestService.createConsultationRequest('patient1', requestData);
      testRequestIds.push(request.id);
      
      expect(request.status).toBe('pending');

      // Bring doctor back online
      await doctorAvailabilityService.setDoctorAvailability('dr_general', true, ['General Practice']);

      // Run auto-assignment
      const assignedCount = await consultationRequestService.autoAssignPendingRequests();

      expect(assignedCount).toBe(1);
    });

    it('should get pending requests', async () => {
      // Set all doctors offline to create pending requests
      await doctorAvailabilityService.setDoctorOffline('dr_cardio');
      await doctorAvailabilityService.setDoctorOffline('dr_general');

      const requestData = {
        category: 'General Medicine',
        description: 'Test consultation'
      };

      const request = await consultationRequestService.createConsultationRequest('patient1', requestData);
      testRequestIds.push(request.id);

      const pendingRequests = await consultationRequestService.getPendingRequests();

      expect(Array.isArray(pendingRequests)).toBe(true);
      expect(pendingRequests.length).toBeGreaterThan(0);
      expect(pendingRequests.every(r => r.status === 'pending')).toBe(true);
    });
  });

  describe('Health Categories and Specialties', () => {
    it('should return valid health categories', () => {
      const categories = consultationRequestService.getHealthCategories();

      expect(Array.isArray(categories)).toBe(true);
      expect(categories.length).toBeGreaterThan(0);

      const cardiology = categories.find(c => c.name === 'Cardiology');
      expect(cardiology).toBeTruthy();
      expect(cardiology.description).toBeTruthy();
      expect(Array.isArray(cardiology.specialties)).toBe(true);
      expect(cardiology.specialties).toContain('Cardiology');
    });

    it('should return category names', () => {
      const categoryNames = consultationRequestService.getCategoryNames();

      expect(Array.isArray(categoryNames)).toBe(true);
      expect(categoryNames).toContain('General Medicine');
      expect(categoryNames).toContain('Cardiology');
      expect(categoryNames).toContain('Emergency');
    });

    it('should return suggested specialties for category', () => {
      const specialties = consultationRequestService.getSuggestedSpecialties('Cardiology');

      expect(Array.isArray(specialties)).toBe(true);
      expect(specialties).toContain('Cardiology');
      expect(specialties).toContain('Cardiovascular Surgery');
    });
  });

  describe('Statistics and Reporting', () => {
    beforeEach(async () => {
      // Create requests with different statuses
      const requests = [
        { status: 'pending', category: 'General Medicine' },
        { status: 'assigned', category: 'Cardiology' },
        { status: 'completed', category: 'General Medicine' }
      ];

      for (const reqData of requests) {
        const request = await consultationRequestService.createConsultationRequest('patient1', {
          category: reqData.category,
          description: 'Test consultation'
        });
        testRequestIds.push(request.id);

        if (reqData.status !== 'assigned') {
          await consultationRequestService.updateRequestStatus(request.id, reqData.status, 'system');
        }
      }
    });

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

      expect(stats.totalRequests).toBeGreaterThan(0);
    });
  });
});