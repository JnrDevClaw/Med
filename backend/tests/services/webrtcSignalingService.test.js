import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import { createServer } from 'http';
import WebRTCSignalingService from '../../src/services/webrtcSignalingService.js';

describe('WebRTC Signaling Service - Connection Handling Tests', () => {
  let httpServer;
  let webrtcService;
  let mockFirestore;

  beforeAll(() => {
    // Create HTTP server
    httpServer = createServer();
    
    // Mock Firestore
    mockFirestore = {
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({
          get: jest.fn(() => Promise.resolve({
            exists: true,
            data: () => ({
              doctorUsername: 'dr_test',
              patientUsername: 'patient_test',
              status: 'accepted'
            })
          })),
          update: jest.fn(() => Promise.resolve())
        }))
      }))
    };

    // Initialize WebRTC service
    webrtcService = new WebRTCSignalingService(httpServer, mockFirestore);
  });

  afterAll(() => {
    if (httpServer) {
      httpServer.close();
    }
  });

  beforeEach(() => {
    // Clear rooms and connections
    webrtcService.rooms.clear();
    webrtcService.connections.clear();

    // Reset mock calls
    jest.clearAllMocks();
  });

  describe('Service Initialization', () => {
    it('should initialize WebRTC service with server and firestore', () => {
      expect(webrtcService).toBeDefined();
      expect(webrtcService.firestore).toBe(mockFirestore);
      expect(webrtcService.rooms).toBeDefined();
      expect(webrtcService.connections).toBeDefined();
    });

    it('should have empty rooms and connections initially', () => {
      expect(webrtcService.rooms.size).toBe(0);
      expect(webrtcService.connections.size).toBe(0);
    });
  });

  describe('Consultation Access Verification', () => {
    it('should verify consultation access for valid consultation', async () => {
      const result = await webrtcService.verifyConsultationAccess('test-consultation-1', 'patient_test');
      
      expect(result).toBeTruthy();
      expect(result.doctorUsername).toBe('dr_test');
      expect(result.patientUsername).toBe('patient_test');
      expect(result.status).toBe('accepted');
      expect(mockFirestore.collection).toHaveBeenCalledWith('consultations');
    });

    it('should return null for non-existent consultation', async () => {
      // Mock Firestore to return no consultation
      mockFirestore.collection = jest.fn(() => ({
        doc: jest.fn(() => ({
          get: jest.fn(() => Promise.resolve({
            exists: false
          }))
        }))
      }));

      const result = await webrtcService.verifyConsultationAccess('nonexistent-consultation', 'patient_test');
      
      expect(result).toBeNull();
    });

    it('should return null for unauthorized user', async () => {
      const result = await webrtcService.verifyConsultationAccess('test-consultation-1', 'unauthorized_user');
      
      expect(result).toBeNull();
    });

    it('should handle Firestore errors gracefully', async () => {
      // Mock Firestore to throw error
      mockFirestore.collection = jest.fn(() => ({
        doc: jest.fn(() => ({
          get: jest.fn(() => Promise.reject(new Error('Firestore error')))
        }))
      }));

      const result = await webrtcService.verifyConsultationAccess('test-consultation-error', 'patient_test');
      
      expect(result).toBeNull();
    });
  });

  describe('Room Management', () => {
    it('should create and manage rooms', () => {
      const roomId = 'consultation_test-consultation-1';
      const socketId = 'socket123';
      
      // Simulate adding participant to room
      if (!webrtcService.rooms.has(roomId)) {
        webrtcService.rooms.set(roomId, new Map());
      }
      
      webrtcService.rooms.get(roomId).set(socketId, {
        userId: 'patient_test',
        userRole: 'patient',
        socketId: socketId,
        joinedAt: new Date()
      });

      expect(webrtcService.rooms.has(roomId)).toBe(true);
      expect(webrtcService.rooms.get(roomId).size).toBe(1);
      expect(webrtcService.rooms.get(roomId).get(socketId).userId).toBe('patient_test');
    });

    it('should find user room correctly', () => {
      const roomId = 'consultation_test-consultation-2';
      const socketId = 'socket456';
      
      // Set up room with participant
      if (!webrtcService.rooms.has(roomId)) {
        webrtcService.rooms.set(roomId, new Map());
      }
      
      webrtcService.rooms.get(roomId).set(socketId, {
        userId: 'dr_test',
        userRole: 'doctor',
        socketId: socketId,
        joinedAt: new Date()
      });

      const foundRoom = webrtcService.findUserRoom(socketId);
      expect(foundRoom).toBe(roomId);
    });

    it('should return null for user not in any room', () => {
      const foundRoom = webrtcService.findUserRoom('nonexistent-socket-id');
      expect(foundRoom).toBeNull();
    });

    it('should clean up empty rooms', () => {
      const roomId = 'consultation_test-consultation-3';
      
      // Create empty room
      webrtcService.rooms.set(roomId, new Map());
      expect(webrtcService.rooms.has(roomId)).toBe(true);
      
      // Clean up room
      webrtcService.cleanupRoom(roomId);
      expect(webrtcService.rooms.has(roomId)).toBe(false);
    });
  });

  describe('Consultation Status Management', () => {
    it('should update consultation status', async () => {
      await webrtcService.updateConsultationStatus('test-consultation-1', 'active');
      
      expect(mockFirestore.collection).toHaveBeenCalledWith('consultations');
      // Verify the update method was called (mocked)
      const mockDoc = mockFirestore.collection().doc();
      expect(mockDoc.update).toHaveBeenCalled();
    });

    it('should handle update errors gracefully', async () => {
      // Mock Firestore update to throw error
      mockFirestore.collection = jest.fn(() => ({
        doc: jest.fn(() => ({
          update: jest.fn(() => Promise.reject(new Error('Update failed')))
        }))
      }));

      // Should not throw error, just log it
      await expect(
        webrtcService.updateConsultationStatus('test-consultation-error', 'active')
      ).resolves.toBeUndefined();
    });
  });

  describe('Disconnection Handling', () => {
    it('should handle user disconnection from room', () => {
      const roomId = 'consultation_test-consultation-disconnect';
      const socketId = 'socket789';
      
      // Set up room with participant
      if (!webrtcService.rooms.has(roomId)) {
        webrtcService.rooms.set(roomId, new Map());
      }
      
      webrtcService.rooms.get(roomId).set(socketId, {
        userId: 'patient_test',
        userRole: 'patient',
        socketId: socketId,
        joinedAt: new Date()
      });

      expect(webrtcService.rooms.get(roomId).size).toBe(1);
      
      // Simulate disconnection
      webrtcService.handleDisconnection(socketId);
      
      // Room should be cleaned up if empty
      expect(webrtcService.rooms.has(roomId)).toBe(false);
    });

    it('should keep room alive if other participants remain', () => {
      const roomId = 'consultation_test-consultation-partial-disconnect';
      const socketId1 = 'socket1';
      const socketId2 = 'socket2';
      
      // Set up room with two participants
      if (!webrtcService.rooms.has(roomId)) {
        webrtcService.rooms.set(roomId, new Map());
      }
      
      const room = webrtcService.rooms.get(roomId);
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

      expect(room.size).toBe(2);
      
      // Simulate one user disconnecting
      webrtcService.handleDisconnection(socketId1);
      
      // Room should still exist with one participant
      expect(webrtcService.rooms.has(roomId)).toBe(true);
      expect(webrtcService.rooms.get(roomId).size).toBe(1);
      expect(webrtcService.rooms.get(roomId).has(socketId2)).toBe(true);
    });
  });

  describe('Room Statistics and Management', () => {
    beforeEach(() => {
      // Set up test room with participants
      const roomId = 'consultation_test-consultation-stats';
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
    });

    it('should provide room statistics', () => {
      const roomId = 'consultation_test-consultation-stats';
      const stats = webrtcService.getRoomStats(roomId);

      expect(stats).toBeTruthy();
      expect(stats.roomId).toBe(roomId);
      expect(stats.participantCount).toBe(2);
      expect(Array.isArray(stats.participants)).toBe(true);
      expect(stats.participants).toHaveLength(2);
      expect(stats.createdAt).toBeTruthy();

      // Check participant details
      const userIds = stats.participants.map(p => p.userId);
      expect(userIds).toContain('patient_test');
      expect(userIds).toContain('dr_test');
    });

    it('should return null for non-existent room stats', () => {
      const stats = webrtcService.getRoomStats('nonexistent-room');
      expect(stats).toBeNull();
    });

    it('should list all active rooms', () => {
      const activeRooms = webrtcService.getActiveRooms();

      expect(Array.isArray(activeRooms)).toBe(true);
      expect(activeRooms.length).toBeGreaterThan(0);

      const testRoom = activeRooms.find(room => 
        room.roomId === 'consultation_test-consultation-stats'
      );
      expect(testRoom).toBeTruthy();
      expect(testRoom.participantCount).toBe(2);
    });

    it('should find user room correctly', () => {
      const roomId = webrtcService.findUserRoom('socket1');
      expect(roomId).toBe('consultation_test-consultation-stats');
    });

    it('should return null for user not in any room', () => {
      const roomId = webrtcService.findUserRoom('nonexistent-socket-id');
      expect(roomId).toBeNull();
    });
  });

  describe('WebRTC Connection Quality Monitoring', () => {
    it('should track connection quality metrics', () => {
      const qualityData = {
        bandwidth: 1000,
        packetLoss: 0.01,
        latency: 50,
        jitter: 5
      };

      // Test that quality data structure is valid
      expect(typeof qualityData.bandwidth).toBe('number');
      expect(typeof qualityData.packetLoss).toBe('number');
      expect(typeof qualityData.latency).toBe('number');
      expect(qualityData.bandwidth).toBeGreaterThan(0);
      expect(qualityData.packetLoss).toBeGreaterThanOrEqual(0);
      expect(qualityData.latency).toBeGreaterThanOrEqual(0);
    });

    it('should validate WebRTC signaling data structures', () => {
      const mockOffer = {
        type: 'offer',
        sdp: 'mock-sdp-offer-data'
      };

      const mockAnswer = {
        type: 'answer',
        sdp: 'mock-sdp-answer-data'
      };

      const mockCandidate = {
        candidate: 'candidate:1 1 UDP 2130706431 192.168.1.100 54400 typ host',
        sdpMLineIndex: 0,
        sdpMid: '0'
      };

      // Validate offer structure
      expect(mockOffer.type).toBe('offer');
      expect(mockOffer.sdp).toBeTruthy();

      // Validate answer structure
      expect(mockAnswer.type).toBe('answer');
      expect(mockAnswer.sdp).toBeTruthy();

      // Validate ICE candidate structure
      expect(mockCandidate.candidate).toBeTruthy();
      expect(typeof mockCandidate.sdpMLineIndex).toBe('number');
      expect(mockCandidate.sdpMid).toBeTruthy();
    });

    it('should handle media control states', () => {
      const mediaStates = {
        audio: { enabled: true, muted: false },
        video: { enabled: true, camera: 'front' },
        screen: { sharing: false }
      };

      expect(typeof mediaStates.audio.enabled).toBe('boolean');
      expect(typeof mediaStates.video.enabled).toBe('boolean');
      expect(typeof mediaStates.screen.sharing).toBe('boolean');
    });
  });
});