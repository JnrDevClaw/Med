import { io, Socket } from 'socket.io-client';
import { get } from 'svelte/store';
import { authStore } from '../stores/auth';

export interface WebRTCConfig {
  iceServers: RTCIceServer[];
  iceCandidatePoolSize: number;
}

export interface Participant {
  username: string;
  role: 'doctor' | 'patient';
  socketId: string;
}

export interface ConnectionQuality {
  audio: {
    quality: 'good' | 'fair' | 'poor';
    bitrate: number;
    packetsLost: number;
  };
  video: {
    quality: 'good' | 'fair' | 'poor';
    bitrate: number;
    packetsLost: number;
    resolution: { width: number; height: number } | null;
  };
  connection: {
    rtt: number;
    jitter: number;
    bandwidth: number;
  };
}

export class VideoCallService {
  private socket: Socket | null = null;
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private webrtcConfig: WebRTCConfig | null = null;
  private roomId: string | null = null;
  private isInitiator = false;
  private connectionQuality: ConnectionQuality | null = null;

  // Event callbacks
  public onRemoteStream: ((stream: MediaStream) => void) | null = null;
  public onParticipantJoined: ((participant: Participant) => void) | null = null;
  public onParticipantLeft: ((participant: Participant) => void) | null = null;
  public onConnectionQualityUpdate: ((quality: ConnectionQuality) => void) | null = null;
  public onCallEnded: (() => void) | null = null;
  public onError: ((error: string) => void) | null = null;

  constructor() {
    this.setupSocket();
  }

  private setupSocket() {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001';
    this.socket = io(backendUrl, {
      autoConnect: false,
      withCredentials: true
    });

    this.socket.on('connect', () => {
      console.log('Connected to signaling server');
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from signaling server');
    });

    this.socket.on('room-joined', (data) => {
      console.log('Joined room:', data);
      this.roomId = data.roomId;
      this.webrtcConfig = data.consultation.webrtcConfig;
      
      // If there are existing participants, we need to initiate calls
      if (data.participants.length > 0) {
        this.isInitiator = true;
        this.createPeerConnection();
        this.makeOffer();
      }
    });

    this.socket.on('user-joined', (data) => {
      console.log('User joined:', data);
      if (this.onParticipantJoined) {
        this.onParticipantJoined(data);
      }
      
      // If we're already in the room, create peer connection for new user
      if (!this.isInitiator) {
        this.createPeerConnection();
      }
    });

    this.socket.on('user-left', (data) => {
      console.log('User left:', data);
      if (this.onParticipantLeft) {
        this.onParticipantLeft(data);
      }
    });

    this.socket.on('offer', async (data) => {
      console.log('Received offer from:', data.sender);
      if (!this.peerConnection) {
        this.createPeerConnection();
      }
      
      await this.peerConnection!.setRemoteDescription(data.offer);
      const answer = await this.peerConnection!.createAnswer();
      await this.peerConnection!.setLocalDescription(answer);
      
      this.socket!.emit('answer', {
        answer,
        target: data.sender
      });
    });

    this.socket.on('answer', async (data) => {
      console.log('Received answer from:', data.sender);
      await this.peerConnection!.setRemoteDescription(data.answer);
    });

    this.socket.on('ice-candidate', async (data) => {
      console.log('Received ICE candidate from:', data.sender);
      if (this.peerConnection) {
        await this.peerConnection.addIceCandidate(data.candidate);
      }
    });

    this.socket.on('peer-audio-toggle', (data) => {
      console.log('Peer audio toggle:', data);
      // Handle remote peer audio toggle
    });

    this.socket.on('peer-video-toggle', (data) => {
      console.log('Peer video toggle:', data);
      // Handle remote peer video toggle
    });

    this.socket.on('consultation-ended', () => {
      console.log('Consultation ended by peer');
      this.endCall();
      if (this.onCallEnded) {
        this.onCallEnded();
      }
    });

    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
      if (this.onError) {
        this.onError(error.message);
      }
    });
  }

  async joinConsultation(consultationId: string): Promise<void> {
    const auth = get(authStore);
    if (!auth.user) {
      throw new Error('User not authenticated');
    }

    // Get WebRTC configuration from backend
    const response = await fetch('/api/webrtc/config');
    this.webrtcConfig = await response.json();

    // Connect socket and join consultation room
    this.socket!.connect();
    
    this.socket!.emit('join-consultation', {
      consultationId,
      userId: auth.user.username,
      userRole: auth.user.role
    });
  }

  private createPeerConnection() {
    if (!this.webrtcConfig) {
      throw new Error('WebRTC configuration not available');
    }

    this.peerConnection = new RTCPeerConnection(this.webrtcConfig);

    // Add local stream tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        this.peerConnection!.addTrack(track, this.localStream!);
      });
    }

    // Handle remote stream
    this.peerConnection.ontrack = (event) => {
      console.log('Received remote track');
      this.remoteStream = event.streams[0];
      if (this.onRemoteStream) {
        this.onRemoteStream(this.remoteStream);
      }
    };

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.socket) {
        this.socket.emit('ice-candidate', {
          candidate: event.candidate,
          target: 'broadcast' // Send to all peers in room
        });
      }
    };

    // Monitor connection state
    this.peerConnection.onconnectionstatechange = () => {
      console.log('Connection state:', this.peerConnection!.connectionState);
      if (this.peerConnection!.connectionState === 'connected') {
        this.startQualityMonitoring();
      }
    };
  }

  private async makeOffer() {
    if (!this.peerConnection) return;

    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    
    this.socket!.emit('offer', {
      offer,
      target: 'broadcast' // Send to all peers in room
    });
  }

  async startLocalVideo(videoEnabled = true, audioEnabled = true): Promise<MediaStream> {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: videoEnabled ? {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        } : false,
        audio: audioEnabled ? {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } : false
      });

      return this.localStream;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      throw new Error('Failed to access camera/microphone');
    }
  }

  toggleAudio(enabled: boolean) {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = enabled;
        
        // Notify peers
        this.socket?.emit('toggle-audio', { enabled });
      }
    }
  }

  toggleVideo(enabled: boolean) {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = enabled;
        
        // Notify peers
        this.socket?.emit('toggle-video', { enabled });
      }
    }
  }

  private startQualityMonitoring() {
    if (!this.peerConnection) return;

    const monitorQuality = async () => {
      try {
        const stats = await this.peerConnection!.getStats();
        const quality = this.parseConnectionStats(stats);
        
        this.connectionQuality = quality;
        if (this.onConnectionQualityUpdate) {
          this.onConnectionQualityUpdate(quality);
        }

        // Send quality info to signaling server
        this.socket?.emit('connection-quality', quality);
        
      } catch (error) {
        console.error('Quality monitoring error:', error);
      }
    };

    // Monitor quality every 5 seconds
    setInterval(monitorQuality, 5000);
  }

  private parseConnectionStats(stats: RTCStatsReport): ConnectionQuality {
    const quality: ConnectionQuality = {
      audio: { quality: 'good', bitrate: 0, packetsLost: 0 },
      video: { quality: 'good', bitrate: 0, packetsLost: 0, resolution: null },
      connection: { rtt: 0, jitter: 0, bandwidth: 0 }
    };

    for (const report of stats.values()) {
      if (report.type === 'inbound-rtp') {
        if (report.mediaType === 'audio') {
          quality.audio.bitrate = report.bytesReceived || 0;
          quality.audio.packetsLost = report.packetsLost || 0;
        } else if (report.mediaType === 'video') {
          quality.video.bitrate = report.bytesReceived || 0;
          quality.video.packetsLost = report.packetsLost || 0;
          quality.video.resolution = {
            width: report.frameWidth || 0,
            height: report.frameHeight || 0
          };
        }
      } else if (report.type === 'candidate-pair' && report.state === 'succeeded') {
        quality.connection.rtt = report.currentRoundTripTime || 0;
        quality.connection.bandwidth = report.availableOutgoingBitrate || 0;
      }
    }

    // Calculate quality scores
    quality.audio.quality = quality.audio.packetsLost > 50 ? 'poor' : 
                           quality.audio.packetsLost > 10 ? 'fair' : 'good';
    
    quality.video.quality = quality.video.packetsLost > 50 ? 'poor' : 
                           quality.video.packetsLost > 10 ? 'fair' : 'good';

    return quality;
  }

  async endCall(): Promise<void> {
    // Stop local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    // Notify server and disconnect socket
    if (this.socket && this.roomId) {
      this.socket.emit('end-consultation', { 
        consultationId: this.roomId.replace('consultation_', '') 
      });
      this.socket.disconnect();
    }

    // Reset state
    this.roomId = null;
    this.isInitiator = false;
    this.connectionQuality = null;
  }

  getConnectionQuality(): ConnectionQuality | null {
    return this.connectionQuality;
  }

  isConnected(): boolean {
    return this.peerConnection?.connectionState === 'connected';
  }
}

export const videoCallService = new VideoCallService();