import { Server } from 'socket.io';

class WebRTCSignalingService {
  constructor(server, firestore) {
    this.io = new Server(server, {
      cors: {
        origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
        methods: ['GET', 'POST'],
        credentials: true
      }
    });
    
    this.firestore = firestore;
    this.rooms = new Map(); // In-memory room management
    this.connections = new Map(); // Track peer connections
    
    this.setupSocketHandlers();
  }

  setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`User connected: ${socket.id}`);

      // Join consultation room
      socket.on('join-consultation', async (data) => {
        try {
          const { consultationId, userId, userRole } = data;
          
          // Verify consultation exists and user has access
          const consultation = await this.verifyConsultationAccess(consultationId, userId);
          if (!consultation) {
            socket.emit('error', { message: 'Consultation not found or access denied' });
            return;
          }

          const roomId = `consultation_${consultationId}`;
          socket.join(roomId);
          
          // Track room participants
          if (!this.rooms.has(roomId)) {
            this.rooms.set(roomId, new Map());
          }
          
          this.rooms.get(roomId).set(socket.id, {
            userId,
            userRole,
            socketId: socket.id,
            joinedAt: new Date()
          });

          // Notify other participants
          socket.to(roomId).emit('user-joined', {
            userId,
            userRole,
            socketId: socket.id
          });

          // Send current participants to new user
          const participants = Array.from(this.rooms.get(roomId).values())
            .filter(p => p.socketId !== socket.id);
          
          socket.emit('room-joined', {
            roomId,
            participants,
            consultation
          });

          // Update consultation status to active
          await this.updateConsultationStatus(consultationId, 'active');

        } catch (error) {
          console.error('Join consultation error:', error);
          socket.emit('error', { message: 'Failed to join consultation' });
        }
      });

      // WebRTC signaling events
      socket.on('offer', (data) => {
        socket.to(data.target).emit('offer', {
          offer: data.offer,
          sender: socket.id
        });
      });

      socket.on('answer', (data) => {
        socket.to(data.target).emit('answer', {
          answer: data.answer,
          sender: socket.id
        });
      });

      socket.on('ice-candidate', (data) => {
        socket.to(data.target).emit('ice-candidate', {
          candidate: data.candidate,
          sender: socket.id
        });
      });

      // Connection quality monitoring
      socket.on('connection-quality', (data) => {
        const roomId = this.findUserRoom(socket.id);
        if (roomId) {
          socket.to(roomId).emit('peer-quality-update', {
            userId: socket.id,
            quality: data
          });
        }
      });

      // Media control events
      socket.on('toggle-audio', (data) => {
        const roomId = this.findUserRoom(socket.id);
        if (roomId) {
          socket.to(roomId).emit('peer-audio-toggle', {
            userId: socket.id,
            enabled: data.enabled
          });
        }
      });

      socket.on('toggle-video', (data) => {
        const roomId = this.findUserRoom(socket.id);
        if (roomId) {
          socket.to(roomId).emit('peer-video-toggle', {
            userId: socket.id,
            enabled: data.enabled
          });
        }
      });

      // Screen sharing events
      socket.on('start-screen-share', (data) => {
        const roomId = this.findUserRoom(socket.id);
        if (roomId) {
          // Update participant info to track screen sharing
          const participants = this.rooms.get(roomId);
          const user = participants.get(socket.id);
          if (user) {
            user.isScreenSharing = true;
          }

          // Notify other participants
          socket.to(roomId).emit('peer-screen-share-started', {
            userId: socket.id,
            userRole: user?.userRole
          });
        }
      });

      socket.on('stop-screen-share', (data) => {
        const roomId = this.findUserRoom(socket.id);
        if (roomId) {
          // Update participant info
          const participants = this.rooms.get(roomId);
          const user = participants.get(socket.id);
          if (user) {
            user.isScreenSharing = false;
          }

          // Notify other participants
          socket.to(roomId).emit('peer-screen-share-stopped', {
            userId: socket.id
          });
        }
      });

      // Screen share specific signaling (separate peer connection)
      socket.on('screen-share-offer', (data) => {
        socket.to(data.target).emit('screen-share-offer', {
          offer: data.offer,
          sender: socket.id
        });
      });

      socket.on('screen-share-answer', (data) => {
        socket.to(data.target).emit('screen-share-answer', {
          answer: data.answer,
          sender: socket.id
        });
      });

      socket.on('screen-share-ice-candidate', (data) => {
        socket.to(data.target).emit('screen-share-ice-candidate', {
          candidate: data.candidate,
          sender: socket.id
        });
      });

      // Screen sharing events
      socket.on('screen-share-started', (data) => {
        const roomId = this.findUserRoom(socket.id);
        if (roomId) {
          console.log(`User ${socket.id} started screen sharing in room ${roomId}`);
          socket.to(roomId).emit('screen-share-started', {
            userId: socket.id,
            timestamp: new Date()
          });
        }
      });

      socket.on('screen-share-stopped', (data) => {
        const roomId = this.findUserRoom(socket.id);
        if (roomId) {
          console.log(`User ${socket.id} stopped screen sharing in room ${roomId}`);
          socket.to(roomId).emit('screen-share-stopped', {
            userId: socket.id,
            timestamp: new Date()
          });
        }
      });

      // End consultation
      socket.on('end-consultation', async (data) => {
        try {
          const { consultationId } = data;
          const roomId = `consultation_${consultationId}`;
          
          // Notify all participants
          this.io.to(roomId).emit('consultation-ended', {
            endedBy: socket.id,
            timestamp: new Date()
          });

          // Update consultation status
          await this.updateConsultationStatus(consultationId, 'completed');

          // Clean up room
          this.cleanupRoom(roomId);

        } catch (error) {
          console.error('End consultation error:', error);
          socket.emit('error', { message: 'Failed to end consultation' });
        }
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        this.handleDisconnection(socket.id);
      });
    });
  }

  async verifyConsultationAccess(consultationId, userId) {
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
      console.error('Consultation verification error:', error);
      return null;
    }
  }

  async updateConsultationStatus(consultationId, status) {
    try {
      const consultationRef = this.firestore.collection('consultations').doc(consultationId);
      await consultationRef.update({
        status,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Update consultation status error:', error);
    }
  }

  findUserRoom(socketId) {
    for (const [roomId, participants] of this.rooms.entries()) {
      if (participants.has(socketId)) {
        return roomId;
      }
    }
    return null;
  }

  handleDisconnection(socketId) {
    const roomId = this.findUserRoom(socketId);
    if (roomId) {
      const participants = this.rooms.get(roomId);
      const user = participants.get(socketId);
      
      if (user) {
        // Notify other participants
        this.io.to(roomId).emit('user-left', {
          userId: user.userId,
          socketId
        });
        
        // Remove from room
        participants.delete(socketId);
        
        // Clean up empty rooms
        if (participants.size === 0) {
          this.rooms.delete(roomId);
        }
      }
    }
  }

  cleanupRoom(roomId) {
    // Disconnect all sockets in the room
    const sockets = this.io.sockets.adapter.rooms.get(roomId);
    if (sockets) {
      sockets.forEach(socketId => {
        const socket = this.io.sockets.sockets.get(socketId);
        if (socket) {
          socket.leave(roomId);
        }
      });
    }
    
    // Remove from memory
    this.rooms.delete(roomId);
  }

  // Get room statistics
  getRoomStats(roomId) {
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
  }

  // Get all active rooms
  getActiveRooms() {
    const rooms = [];
    for (const [roomId, participants] of this.rooms.entries()) {
      rooms.push(this.getRoomStats(roomId));
    }
    return rooms;
  }
}

export default WebRTCSignalingService;