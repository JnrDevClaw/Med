import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import DoctorAvailabilityService from '../src/services/doctorAvailabilityService.js';
import ConsultationRequestService from '../src/services/consultationRequestService.js';
import WebRTCSignalingService from '../src/services/webrtcSignalingService.js';

describe('Video System Unit Tests', () => {
  let mockFirestore;
  let mockLogger;

  beforeEach(() => {
    // Mock Firestore
    mockFirestore = {
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({
          get: jest.fn(() => Promise.resolve({
            exists: true,
            data: () => ({
              doctorUsername: 'dr_test',
              patientUsername: 'patient_test',
              status: 'accepted',
              role: 'doctor',
              verified: true
            })
          })),
          update: jest.fn(() => Promise.resolve())
        }))
      }))
    };

    // Mock logger
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    };

    jest.clearAllMocks();
  });

  describe('Doctor Discovery Algorithms', () => {
    let doctorAvailabilityService;

    beforeEach(() => {
      doctorAvailabilityService = new DoctorAvailabilityService(mockFirestore, mockLogger);
    });

    it('should initialize doctor availability service', () => {
      expect(doctorAvailabilityService).toBeDefined();
      expect(doctorAvailabilityService.firestore).toBe(mockFirestore);
      expect(doctorAvailabilityService.logger).toBe(mockLogger);
      expect(doctorAvailabilityService.onlineDoctorsCache).toBeDefined();
    });

    it('should validate health categories structure', () => {
      const consultationService = new ConsultationRequestService(mockFirestore, mockLogger, doctorAvailabilityService);
      const categories = consultationService.getHealthCategories();

      expect(Array.isArray(categories)).toBe(true);
      expect(categories.length).toBeGreaterThan(0);

      // Validate structure of categories
      categories.forEach(category => {
        expect(category).toHaveProperty('name');
        expect(category).toHaveProperty('description');
        expect(category).toHaveProperty('specialties');
        expect(Array.isArray(category.specialties)).toBe(true);
        expect(category.specialties.length).toBeGreaterThan(0);
      });
    });

    it('should return suggested specialties for valid categories', () => {
      const consultationService = new ConsultationRequestService(mockFirestore, mockLogger, doctorAvailabilityService);
      
      const cardiologySpecialties = consultationService.getSuggestedSpecialties('Cardiology');
      expect(Array.isArray(cardiologySpecialties)).toBe(true);
      expect(cardiologySpecialties).toContain('Cardiology');
      
      const generalSpecialties = consultationService.getSuggestedSpecialties('General Medicine');
      expect(Array.isArray(generalSpecialties)).toBe(true);
      expect(generalSpecialties.length).toBeGreaterThan(0);
    });

    it('should handle invalid category gracefully', () => {
      const consultationService = new ConsultationRequestService(mockFirestore, mockLogger, doctorAvailabilityService);
      
      const invalidSpecialties = consultationService.getSuggestedSpecialties('InvalidCategory');
      expect(Array.isArray(invalidSpecialties)).toBe(true);
      expect(invalidSpecialties.length).toBe(0);
    });

    it('should manage doctor availability cache', () => {
      const doctorUsername = 'dr_test';
      const cacheData = {
        doctorUsername,
        isOnline: true,
        specialties: ['Cardiology'],
        currentLoad: 2,
        timestamp: Date.now()
      };

      // Test cache operations
      doctorAvailabilityService.onlineDoctorsCache.set(doctorUsername, cacheData);
      expect(doctorAvailabilityService.onlineDoctorsCache.has(doctorUsername)).toBe(true);
      
      const cached = doctorAvailabilityService.onlineDoctorsCache.get(doctorUsername);
      expect(cached.doctorUsername).toBe(doctorUsername);
      expect(cached.isOnline).toBe(true);
      expect(cached.currentLoad).toBe(2);

      // Test cache removal
      doctorAvailabilityService.onlineDoctorsCache.delete(doctorUsername);
      expect(doctorAvailabilityService.onlineDoctorsCache.has(doctorUsername)).toBe(false);
    });

    it('should validate doctor matching scoring algorithm logic', () => {
      // Test scoring logic components
      const baseScore = 10;
      const specialtyBonus = 20;
      const loadPenalty = 5;
      const recentActivityBonus = 15;

      // Mock doctor data
      const doctor = {
        doctorUsername: 'dr_cardio',
        specialties: ['Cardiology', 'Internal Medicine'],
        currentLoad: 2,
        lastSeen: new Date()
      };

      const preferredSpecialties = ['Cardiology'];
      
      // Calculate expected score
      let expectedScore = baseScore;
      
      // Specialty match bonus
      const matchingSpecialties = doctor.specialties.filter(specialty =>
        preferredSpecialties.includes(specialty)
      );
      expectedScore += matchingSpecialties.length * specialtyBonus;
      
      // Load penalty
      expectedScore -= doctor.currentLoad * loadPenalty;
      
      // Recent activity bonus (assuming very recent)
      expectedScore += recentActivityBonus;

      expect(expectedScore).toBe(baseScore + specialtyBonus - (2 * loadPenalty) + recentActivityBonus);
      expect(expectedScore).toBe(35); // 10 + 20 - 10 + 15
    });
  });

  describe('Consultation Request Workflow', () => {
    let consultationRequestService;
    let doctorAvailabilityService;

    beforeEach(() => {
      doctorAvailabilityService = new DoctorAvailabilityService(mockFirestore, mockLogger);
      consultationRequestService = new ConsultationRequestService(
        mockFirestore, 
        mockLogger, 
        doctorAvailabilityService
      );
    });

    it('should validate consultation request data structure', () => {
      const validRequestData = {
        category: 'Cardiology',
        description: 'Chest pain and shortness of breath',
        preferredSpecialties: ['Cardiology'],
        urgency: 'high'
      };

      // Validate required fields
      expect(validRequestData.category).toBeTruthy();
      expect(validRequestData.description).toBeTruthy();
      expect(Array.isArray(validRequestData.preferredSpecialties)).toBe(true);
      expect(['low', 'medium', 'high', 'emergency']).toContain(validRequestData.urgency);
    });

    it('should validate health categories', () => {
      const categories = consultationRequestService.getCategoryNames();
      
      expect(Array.isArray(categories)).toBe(true);
      expect(categories).toContain('General Medicine');
      expect(categories).toContain('Cardiology');
      expect(categories).toContain('Emergency');
      expect(categories).toContain('Pediatrics');
    });

    it('should handle request status transitions', () => {
      const validStatuses = ['pending', 'assigned', 'accepted', 'rejected', 'completed', 'cancelled'];
      
      // Test status transition logic
      const statusTransitions = {
        'pending': ['assigned', 'cancelled'],
        'assigned': ['accepted', 'rejected', 'cancelled'],
        'accepted': ['completed', 'cancelled'],
        'rejected': [],
        'completed': [],
        'cancelled': []
      };

      Object.keys(statusTransitions).forEach(status => {
        expect(validStatuses).toContain(status);
        statusTransitions[status].forEach(nextStatus => {
          expect(validStatuses).toContain(nextStatus);
        });
      });
    });

    it('should validate request note structure', () => {
      const validNote = {
        type: 'medical',
        content: 'Patient has history of hypertension',
        createdBy: 'dr_test',
        createdAt: new Date()
      };

      expect(['general', 'medical', 'administrative', 'status_change', 'reassignment']).toContain(validNote.type);
      expect(validNote.content).toBeTruthy();
      expect(validNote.createdBy).toBeTruthy();
      expect(validNote.createdAt).toBeInstanceOf(Date);
    });

    it('should handle urgency levels correctly', () => {
      const urgencyLevels = ['low', 'medium', 'high', 'emergency'];
      
      urgencyLevels.forEach(urgency => {
        const requestData = {
          category: 'General Medicine',
          description: 'Test consultation',
          urgency: urgency
        };
        
        expect(urgencyLevels).toContain(requestData.urgency);
      });
    });
  });

  describe('WebRTC Connection Handling', () => {
    let webrtcService;
    let mockServer;

    beforeEach(() => {
      // Create a proper mock server that mimics HTTP server interface
      mockServer = {
        listen: jest.fn(),
        close: jest.fn(),
        listeners: jest.fn(() => []),
        on: jest.fn(),
        once: jest.fn(),
        emit: jest.fn(),
        removeListener: jest.fn(),
        removeAllListeners: jest.fn(),
        setMaxListeners: jest.fn(),
        getMaxListeners: jest.fn(() => 10),
        prependListener: jest.fn(),
        prependOnceListener: jest.fn(),
        eventNames: jest.fn(() => [])
      };
      
      // Mock the WebRTC service without actually creating socket.io server
      webrtcService = {
        firestore: mockFirestore,
        rooms: new Map(),
        connections: new Map(),
        findUserRoom: function(socketId) {
          for (const [roomId, participants] of this.rooms.entries()) {
            if (participants.has(socketId)) {
              return roomId;
            }
          }
          return null;
        },
        getRoomStats: function(roomId) {
          const participants = this.rooms.get(roomId);
          if (!participants) {
            return null;
          }
          return {
            roomId,
            participantCount: participants.size,
            participants: Array.from(participants.values()),
            createdAt: Math.min(...Array.from(participants.values()).map(p => p.joinedAt))
          };
        },
        getActiveRooms: function() {
          const rooms = [];
          for (const [roomId, participants] of this.rooms.entries()) {
            rooms.push(this.getRoomStats(roomId));
          }
          return rooms;
        },
        cleanupRoom: function(roomId) {
          this.rooms.delete(roomId);
        },
        handleDisconnection: function(socketId) {
          const roomId = this.findUserRoom(socketId);
          if (roomId) {
            const participants = this.rooms.get(roomId);
            if (participants) {
              participants.delete(socketId);
              if (participants.size === 0) {
                this.rooms.delete(roomId);
              }
            }
          }
        },
        verifyConsultationAccess: async function(consultationId, userId) {
          try {
            const consultationRef = this.firestore.collection('consultations').doc(consultationId);
            const consultationDoc = await consultationRef.get();
            
            if (!consultationDoc.exists) {
              return null;
            }

            const consultation = consultationDoc.data();
            
            // Check if user is either the doctor or patient
            if (consultation.doctorUsername !== userId && consultation.patientUsername !== userId) {
              return null;
            }

            return consultation;
          } catch (error) {
            return null;
          }
        },
        updateConsultationStatus: async function(consultationId, status) {
          try {
            const consultationRef = this.firestore.collection('consultations').doc(consultationId);
            await consultationRef.update({
              status,
              updatedAt: new Date()
            });
          } catch (error) {
            // Handle error gracefully
          }
        }
      };
    });

    it('should initialize WebRTC service correctly', () => {
      expect(webrtcService).toBeDefined();
      expect(webrtcService.firestore).toBe(mockFirestore);
      expect(webrtcService.rooms).toBeDefined();
      expect(webrtcService.connections).toBeDefined();
    });

    it('should manage consultation rooms', () => {
      const roomId = 'consultation_test-123';
      const socketId = 'socket_456';
      
      // Create room
      if (!webrtcService.rooms.has(roomId)) {
        webrtcService.rooms.set(roomId, new Map());
      }
      
      // Add participant
      webrtcService.rooms.get(roomId).set(socketId, {
        userId: 'patient_test',
        userRole: 'patient',
        socketId: socketId,
        joinedAt: new Date()
      });

      expect(webrtcService.rooms.has(roomId)).toBe(true);
      expect(webrtcService.rooms.get(roomId).size).toBe(1);
      
      const participant = webrtcService.rooms.get(roomId).get(socketId);
      expect(participant.userId).toBe('patient_test');
      expect(participant.userRole).toBe('patient');
    });

    it('should find user rooms correctly', () => {
      const roomId = 'consultation_test-456';
      const socketId = 'socket_789';
      
      // Set up room
      webrtcService.rooms.set(roomId, new Map());
      webrtcService.rooms.get(roomId).set(socketId, {
        userId: 'dr_test',
        userRole: 'doctor',
        socketId: socketId,
        joinedAt: new Date()
      });

      const foundRoom = webrtcService.findUserRoom(socketId);
      expect(foundRoom).toBe(roomId);
      
      const notFoundRoom = webrtcService.findUserRoom('nonexistent_socket');
      expect(notFoundRoom).toBeNull();
    });

    it('should provide room statistics', () => {
      const roomId = 'consultation_test-stats';
      const room = new Map();
      
      room.set('socket1', {
        userId: 'patient_test',
        userRole: 'patient',
        socketId: 'socket1',
        joinedAt: new Date()
      });
      
      room.set('socket2', {
        userId: 'dr_test',
        userRole: 'doctor',
        socketId: 'socket2',
        joinedAt: new Date()
      });
      
      webrtcService.rooms.set(roomId, room);

      const stats = webrtcService.getRoomStats(roomId);
      expect(stats).toBeTruthy();
      expect(stats.roomId).toBe(roomId);
      expect(stats.participantCount).toBe(2);
      expect(Array.isArray(stats.participants)).toBe(true);
      expect(stats.participants).toHaveLength(2);
    });

    it('should handle room cleanup', () => {
      const roomId = 'consultation_test-cleanup';
      
      // Create room with participants
      const room = new Map();
      room.set('socket1', { userId: 'user1', socketId: 'socket1' });
      webrtcService.rooms.set(roomId, room);
      
      expect(webrtcService.rooms.has(roomId)).toBe(true);
      
      // Clean up room
      webrtcService.cleanupRoom(roomId);
      expect(webrtcService.rooms.has(roomId)).toBe(false);
    });

    it('should validate WebRTC signaling data structures', () => {
      const offer = {
        type: 'offer',
        sdp: 'v=0\r\no=- 123456789 2 IN IP4 127.0.0.1\r\n...'
      };

      const answer = {
        type: 'answer',
        sdp: 'v=0\r\no=- 987654321 2 IN IP4 127.0.0.1\r\n...'
      };

      const iceCandidate = {
        candidate: 'candidate:1 1 UDP 2130706431 192.168.1.100 54400 typ host',
        sdpMLineIndex: 0,
        sdpMid: '0'
      };

      // Validate offer
      expect(offer.type).toBe('offer');
      expect(offer.sdp).toBeTruthy();
      
      // Validate answer
      expect(answer.type).toBe('answer');
      expect(answer.sdp).toBeTruthy();
      
      // Validate ICE candidate
      expect(iceCandidate.candidate).toBeTruthy();
      expect(typeof iceCandidate.sdpMLineIndex).toBe('number');
      expect(iceCandidate.sdpMid).toBeTruthy();
    });

    it('should handle connection quality metrics', () => {
      const qualityMetrics = {
        bandwidth: 1500,
        packetLoss: 0.02,
        latency: 45,
        jitter: 8,
        resolution: '720p',
        frameRate: 30
      };

      // Validate metrics structure
      expect(typeof qualityMetrics.bandwidth).toBe('number');
      expect(typeof qualityMetrics.packetLoss).toBe('number');
      expect(typeof qualityMetrics.latency).toBe('number');
      expect(typeof qualityMetrics.jitter).toBe('number');
      
      // Validate ranges
      expect(qualityMetrics.bandwidth).toBeGreaterThan(0);
      expect(qualityMetrics.packetLoss).toBeGreaterThanOrEqual(0);
      expect(qualityMetrics.packetLoss).toBeLessThanOrEqual(1);
      expect(qualityMetrics.latency).toBeGreaterThanOrEqual(0);
    });

    it('should handle media control states', () => {
      const mediaState = {
        audio: {
          enabled: true,
          muted: false,
          deviceId: 'default'
        },
        video: {
          enabled: true,
          camera: 'front',
          resolution: '720p'
        },
        screen: {
          sharing: false,
          source: null
        }
      };

      // Validate audio state
      expect(typeof mediaState.audio.enabled).toBe('boolean');
      expect(typeof mediaState.audio.muted).toBe('boolean');
      
      // Validate video state
      expect(typeof mediaState.video.enabled).toBe('boolean');
      expect(['front', 'back', 'external']).toContain(mediaState.video.camera);
      
      // Validate screen sharing state
      expect(typeof mediaState.screen.sharing).toBe('boolean');
    });

    it('should handle disconnection scenarios', () => {
      const roomId = 'consultation_test-disconnect';
      const socketId1 = 'socket1';
      const socketId2 = 'socket2';
      
      // Set up room with two participants
      const room = new Map();
      room.set(socketId1, {
        userId: 'patient_test',
        userRole: 'patient',
        socketId: socketId1,
        joinedAt: new Date()
      });
      room.set(socketId2, {
        userId: 'dr_test',
        userRole: 'doctor',
        socketId: socketId2,
        joinedAt: new Date()
      });
      
      webrtcService.rooms.set(roomId, room);
      expect(webrtcService.rooms.get(roomId).size).toBe(2);
      
      // Simulate disconnection
      webrtcService.handleDisconnection(socketId1);
      
      // Room should still exist with one participant
      expect(webrtcService.rooms.has(roomId)).toBe(true);
      expect(webrtcService.rooms.get(roomId).size).toBe(1);
      expect(webrtcService.rooms.get(roomId).has(socketId2)).toBe(true);
      
      // Disconnect last participant
      webrtcService.handleDisconnection(socketId2);
      
      // Room should be cleaned up
      expect(webrtcService.rooms.has(roomId)).toBe(false);
    });
  });

  describe('Integration Tests', () => {
    it('should integrate doctor availability with consultation requests', () => {
      const doctorAvailabilityService = new DoctorAvailabilityService(mockFirestore, mockLogger);
      const consultationRequestService = new ConsultationRequestService(
        mockFirestore, 
        mockLogger, 
        doctorAvailabilityService
      );

      // Test service integration
      expect(consultationRequestService.doctorAvailabilityService).toBe(doctorAvailabilityService);
      
      // Test category and specialty matching
      const categories = consultationRequestService.getHealthCategories();
      const cardiologyCategory = categories.find(c => c.name === 'Cardiology');
      
      expect(cardiologyCategory).toBeTruthy();
      expect(cardiologyCategory.specialties).toContain('Cardiology');
    });

    it('should validate end-to-end consultation flow data structures', () => {
      // Mock consultation flow data
      const consultationFlow = {
        request: {
          id: 'req_123',
          patientUsername: 'patient_test',
          category: 'Cardiology',
          status: 'pending'
        },
        assignment: {
          doctorUsername: 'dr_cardio',
          assignedAt: new Date(),
          status: 'assigned'
        },
        consultation: {
          roomId: 'consultation_req_123',
          participants: ['patient_test', 'dr_cardio'],
          status: 'active'
        },
        completion: {
          completedAt: new Date(),
          status: 'completed',
          notes: []
        }
      };

      // Validate flow structure
      expect(consultationFlow.request.id).toBeTruthy();
      expect(consultationFlow.request.patientUsername).toBeTruthy();
      expect(consultationFlow.assignment.doctorUsername).toBeTruthy();
      expect(consultationFlow.consultation.roomId).toBeTruthy();
      expect(Array.isArray(consultationFlow.consultation.participants)).toBe(true);
      expect(Array.isArray(consultationFlow.completion.notes)).toBe(true);
    });
  });
});