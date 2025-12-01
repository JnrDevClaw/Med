import fastifyPlugin from 'fastify-plugin';
import WebRTCSignalingService from '../services/webrtcSignalingService.js';

const webrtcPlugin = async (fastify, opts) => {
  // WebRTC configuration with STUN/TURN servers
  const webrtcConfig = {
    iceServers: [
      // Public STUN servers
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
      
      // Add TURN servers if available (for production)
      ...(process.env.TURN_SERVER_URL ? [{
        urls: process.env.TURN_SERVER_URL,
        username: process.env.TURN_USERNAME,
        credential: process.env.TURN_CREDENTIAL
      }] : [])
    ],
    iceCandidatePoolSize: 10
  };

  // Initialize WebRTC signaling service after server is ready
  fastify.addHook('onReady', async () => {
    try {
      // Get the HTTP server instance
      const server = fastify.server;
      
      // Initialize signaling service with Firestore
      const signalingService = new WebRTCSignalingService(server, fastify.firestore);
      
      // Make signaling service available to routes
      fastify.decorate('webrtcSignaling', signalingService);
      fastify.decorate('webrtcConfig', webrtcConfig);
      
      fastify.log.info('WebRTC signaling service initialized');
    } catch (error) {
      fastify.log.error('Failed to initialize WebRTC signaling service:', error);
      throw error;
    }
  });

  // Connection quality monitoring utilities
  fastify.decorate('webrtcUtils', {
    // Parse WebRTC stats for quality metrics
    parseConnectionStats: (stats) => {
      const quality = {
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
              width: report.frameWidth,
              height: report.frameHeight
            };
          }
        } else if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          quality.connection.rtt = report.currentRoundTripTime || 0;
          quality.connection.bandwidth = report.availableOutgoingBitrate || 0;
        }
      }

      // Calculate overall quality scores
      quality.audio.quality = quality.audio.packetsLost > 50 ? 'poor' : 
                             quality.audio.packetsLost > 10 ? 'fair' : 'good';
      
      quality.video.quality = quality.video.packetsLost > 50 ? 'poor' : 
                             quality.video.packetsLost > 10 ? 'fair' : 'good';

      return quality;
    },

    // Generate quality recommendations
    getQualityRecommendations: (quality) => {
      const recommendations = [];

      if (quality.connection.rtt > 300) {
        recommendations.push('High latency detected. Consider switching to audio-only mode.');
      }

      if (quality.video.packetsLost > 20) {
        recommendations.push('Video quality issues detected. Try reducing video resolution.');
      }

      if (quality.audio.packetsLost > 10) {
        recommendations.push('Audio quality issues detected. Check your internet connection.');
      }

      if (quality.connection.bandwidth < 500000) { // Less than 500kbps
        recommendations.push('Low bandwidth detected. Consider audio-only consultation.');
      }

      return recommendations;
    }
  });

  // Add WebRTC configuration endpoint
  fastify.get('/api/webrtc/config', {
    schema: {
      tags: ['webrtc'],
      description: 'Get WebRTC configuration',
      response: {
        200: {
          type: 'object',
          properties: {
            iceServers: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  urls: { type: 'string' },
                  username: { type: 'string' },
                  credential: { type: 'string' }
                }
              }
            },
            iceCandidatePoolSize: { type: 'number' }
          }
        }
      }
    }
  }, async (request, reply) => {
    return webrtcConfig;
  });

  // Get active rooms (for monitoring/debugging)
  fastify.get('/api/webrtc/rooms', {
    schema: {
      tags: ['webrtc'],
      description: 'Get active WebRTC rooms',
      headers: {
        type: 'object',
        properties: {
          authorization: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            rooms: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  roomId: { type: 'string' },
                  participantCount: { type: 'number' },
                  participants: { type: 'array' },
                  createdAt: { type: 'number' }
                }
              }
            }
          }
        }
      }
    },
    onRequest: async (request, reply) => {
      // Use onRequest hook instead of preHandler to ensure authenticate is available
      if (fastify.authenticate) {
        await fastify.authenticate(request, reply);
      }
    }
  }, async (request, reply) => {
    const rooms = fastify.webrtcSignaling.getActiveRooms();
    return { rooms };
  });
};

export default fastifyPlugin(webrtcPlugin, {
  name: 'webrtc',
  dependencies: ['firebase'] // Depends on Firestore
});