import CredentialService from '../services/credentialService.js';

const credentialRoutes = async (fastify, opts) => {
  // Initialize credential service
  const credentialService = new CredentialService(
    fastify.firebase.firestore,
    fastify.ipfs,
    fastify.log
  );
  
  // Submit doctor credentials for verification
  fastify.post('/', {
    schema: {
      tags: ['credentials'],
      description: 'Submit doctor credentials for verification',
      headers: {
        type: 'object',
        properties: {
          authorization: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        required: ['credentialType', 'issuingAuthority'],
        properties: {
          credentialType: { 
            type: 'string', 
            enum: ['medical_license', 'board_certification', 'education', 'residency', 'fellowship', 'other'] 
          },
          issuingAuthority: { type: 'string' },
          credentialNumber: { type: 'string' },
          issuedDate: { type: 'string', format: 'date' },
          expiryDate: { type: 'string', format: 'date' },
          description: { type: 'string' }
        }
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            credential: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                credentialType: { type: 'string' },
                status: { type: 'string' },
                createdAt: { type: 'string' }
              }
            }
          }
        }
      },
    },
    preHandler: [fastify.authenticate, fastify.requireRole('doctor')],
  }, async (request, reply) => {
    const user = request.user;
    const credentialData = request.body;

    try {
      const credentialId = await credentialService.createCredential(user.username, credentialData);
      const credential = await credentialService.getCredentialById(credentialId);

      return reply.code(201).send({
        success: true,
        credential: {
          id: credentialId,
          credentialType: credential.credentialType,
          status: credential.status,
          createdAt: credential.createdAt,
        },
      });

    } catch (error) {
      fastify.log.error('Credential submission error:', error);
      return reply.code(500).send({
        error: 'SUBMISSION_ERROR',
        message: 'Failed to submit credential',
      });
    }
  });

  // Get doctor's credentials
  fastify.get('/', {
    schema: {
      tags: ['credentials'],
      description: 'Get doctor credentials',
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
            credentials: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  credentialType: { type: 'string' },
                  issuingAuthority: { type: 'string' },
                  status: { type: 'string' },
                  verificationStatus: { type: 'string' },
                  hasDocument: { type: 'boolean' },
                  createdAt: { type: 'string' },
                  verifiedAt: { type: 'string' }
                }
              }
            }
          }
        }
      },
    },
    preHandler: [fastify.authenticate, fastify.requireRole('doctor')],
  }, async (request, reply) => {
    const user = request.user;

    try {
      const credentials = await credentialService.getDoctorCredentials(user.username);

      return {
        credentials: credentials.map(c => ({
          id: c.id,
          credentialType: c.credentialType,
          issuingAuthority: c.issuingAuthority,
          credentialNumber: c.credentialNumber,
          status: c.status,
          verificationStatus: c.verificationStatus,
          hasDocument: !!c.documentCid,
          description: c.description,
          issuedDate: c.issuedDate,
          expiryDate: c.expiryDate,
          createdAt: c.createdAt,
          verifiedAt: c.verifiedAt,
          verificationConfidence: c.verificationConfidence
        })),
      };

    } catch (error) {
      fastify.log.error('Credentials retrieval error:', error);
      return reply.code(500).send({
        error: 'RETRIEVAL_ERROR',
        message: 'Failed to retrieve credentials',
      });
    }
  });

  // Upload credential document
  fastify.post('/:credentialId/upload', {
    schema: {
      tags: ['credentials'],
      description: 'Upload credential document to IPFS',
      headers: {
        type: 'object',
        properties: {
          authorization: { type: 'string' }
        }
      },
      params: {
        type: 'object',
        properties: {
          credentialId: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            documentCid: { type: 'string' },
            uploadProgress: { type: 'object' }
          }
        }
      },
    },
    preHandler: [fastify.authenticate, fastify.requireRole('doctor')],
  }, async (request, reply) => {
    const user = request.user;
    const { credentialId } = request.params;

    try {
      // Verify credential belongs to user
      const credential = await credentialService.getCredentialById(credentialId);
      if (!credential || credential.doctorUsername !== user.username) {
        return reply.code(404).send({
          error: 'CREDENTIAL_NOT_FOUND',
          message: 'Credential not found or access denied',
        });
      }

      // Handle file upload
      const file = await request.file();
      if (!file) {
        return reply.code(400).send({
          error: 'NO_FILE',
          message: 'No file uploaded',
        });
      }

      // Upload document to IPFS with encryption
      const documentCid = await credentialService.uploadDocument(credentialId, user.username, file);

      return {
        success: true,
        documentCid,
        uploadProgress: {
          status: 'completed',
          filename: file.filename,
          size: file.file?.bytesRead || 0,
          uploadedAt: new Date().toISOString()
        }
      };

    } catch (error) {
      fastify.log.error('Document upload error:', error);
      
      // Handle specific error types
      if (error.message.includes('Invalid file type') || error.message.includes('File too large')) {
        return reply.code(400).send({
          error: 'VALIDATION_ERROR',
          message: error.message,
        });
      }
      
      if (error.message.includes('IPFS service not ready')) {
        return reply.code(503).send({
          error: 'SERVICE_UNAVAILABLE',
          message: 'File storage service temporarily unavailable',
        });
      }

      return reply.code(500).send({
        error: 'UPLOAD_ERROR',
        message: 'Failed to upload document',
      });
    }
  });
  // Get credential document
  fastify.get('/:credentialId/document', {
    schema: {
      tags: ['credentials'],
      description: 'Download credential document',
      headers: {
        type: 'object',
        properties: {
          authorization: { type: 'string' }
        }
      },
      params: {
        type: 'object',
        properties: {
          credentialId: { type: 'string' }
        }
      }
    },
    preHandler: [fastify.authenticate, fastify.requireRole('doctor')],
  }, async (request, reply) => {
    const user = request.user;
    const { credentialId } = request.params;

    try {
      const documentData = await credentialService.retrieveDocument(credentialId, user.username);
      
      reply.header('Content-Type', documentData.mimetype);
      reply.header('Content-Disposition', `attachment; filename="${documentData.filename}"`);
      
      return reply.send(documentData.buffer);

    } catch (error) {
      fastify.log.error('Document retrieval error:', error);
      
      if (error.message.includes('not found') || error.message.includes('Access denied')) {
        return reply.code(404).send({
          error: 'DOCUMENT_NOT_FOUND',
          message: 'Document not found or access denied',
        });
      }

      return reply.code(500).send({
        error: 'RETRIEVAL_ERROR',
        message: 'Failed to retrieve document',
      });
    }
  });

  // Get credential details
  fastify.get('/:credentialId', {
    schema: {
      tags: ['credentials'],
      description: 'Get credential details',
      headers: {
        type: 'object',
        properties: {
          authorization: { type: 'string' }
        }
      },
      params: {
        type: 'object',
        properties: {
          credentialId: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            credential: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                credentialType: { type: 'string' },
                issuingAuthority: { type: 'string' },
                status: { type: 'string' },
                verificationStatus: { type: 'string' },
                hasDocument: { type: 'boolean' }
              }
            }
          }
        }
      },
    },
    preHandler: [fastify.authenticate, fastify.requireRole('doctor')],
  }, async (request, reply) => {
    const user = request.user;
    const { credentialId } = request.params;

    try {
      const credential = await credentialService.getCredentialById(credentialId);
      
      if (!credential || credential.doctorUsername !== user.username) {
        return reply.code(404).send({
          error: 'CREDENTIAL_NOT_FOUND',
          message: 'Credential not found or access denied',
        });
      }

      return {
        credential: {
          id: credential.id,
          credentialType: credential.credentialType,
          issuingAuthority: credential.issuingAuthority,
          credentialNumber: credential.credentialNumber,
          status: credential.status,
          verificationStatus: credential.verificationStatus,
          hasDocument: !!credential.documentCid,
          description: credential.description,
          issuedDate: credential.issuedDate,
          expiryDate: credential.expiryDate,
          createdAt: credential.createdAt,
          verifiedAt: credential.verifiedAt,
          verificationResults: credential.verificationResults,
          verificationConfidence: credential.verificationConfidence
        }
      };

    } catch (error) {
      fastify.log.error('Credential retrieval error:', error);
      return reply.code(500).send({
        error: 'RETRIEVAL_ERROR',
        message: 'Failed to retrieve credential',
      });
    }
  });

  // Delete credential
  fastify.delete('/:credentialId', {
    schema: {
      tags: ['credentials'],
      description: 'Delete credential',
      headers: {
        type: 'object',
        properties: {
          authorization: { type: 'string' }
        }
      },
      params: {
        type: 'object',
        properties: {
          credentialId: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        }
      },
    },
    preHandler: [fastify.authenticate, fastify.requireRole('doctor')],
  }, async (request, reply) => {
    const user = request.user;
    const { credentialId } = request.params;

    try {
      await credentialService.deleteCredential(credentialId, user.username);

      return {
        success: true,
        message: 'Credential deleted successfully'
      };

    } catch (error) {
      fastify.log.error('Credential deletion error:', error);
      
      if (error.message.includes('not found') || error.message.includes('Access denied')) {
        return reply.code(404).send({
          error: 'CREDENTIAL_NOT_FOUND',
          message: 'Credential not found or access denied',
        });
      }

      return reply.code(500).send({
        error: 'DELETION_ERROR',
        message: 'Failed to delete credential',
      });
    }
  });

  // Get upload progress (for tracking large file uploads)
  fastify.get('/:credentialId/upload-progress', {
    schema: {
      tags: ['credentials'],
      description: 'Get upload progress for credential document',
      headers: {
        type: 'object',
        properties: {
          authorization: { type: 'string' }
        }
      },
      params: {
        type: 'object',
        properties: {
          credentialId: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            progress: {
              type: 'object',
              properties: {
                status: { type: 'string' },
                hasDocument: { type: 'boolean' },
                uploadedAt: { type: 'string' }
              }
            }
          }
        }
      },
    },
    preHandler: [fastify.authenticate, fastify.requireRole('doctor')],
  }, async (request, reply) => {
    const user = request.user;
    const { credentialId } = request.params;

    try {
      const credential = await credentialService.getCredentialById(credentialId);
      
      if (!credential || credential.doctorUsername !== user.username) {
        return reply.code(404).send({
          error: 'CREDENTIAL_NOT_FOUND',
          message: 'Credential not found or access denied',
        });
      }

      return {
        progress: {
          status: credential.documentCid ? 'completed' : 'pending',
          hasDocument: !!credential.documentCid,
          uploadedAt: credential.documentCid ? credential.updatedAt : null
        }
      };

    } catch (error) {
      fastify.log.error('Upload progress error:', error);
      return reply.code(500).send({
        error: 'PROGRESS_ERROR',
        message: 'Failed to get upload progress',
      });
    }
  });

  // Manual verification endpoint (admin only)
  fastify.post('/:credentialId/verify', {
    schema: {
      tags: ['credentials'],
      description: 'Manually verify credential (admin only)',
      headers: {
        type: 'object',
        properties: {
          authorization: { type: 'string' }
        }
      },
      params: {
        type: 'object',
        properties: {
          credentialId: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        required: ['approved'],
        properties: {
          approved: { type: 'boolean' },
          reviewerNotes: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        }
      },
    },
    preHandler: [fastify.authenticate], // Note: In production, add admin role check
  }, async (request, reply) => {
    const { credentialId } = request.params;
    const { approved, reviewerNotes } = request.body;

    try {
      await credentialService.manuallyVerifyCredential(credentialId, approved, reviewerNotes);

      return {
        success: true,
        message: `Credential ${approved ? 'approved' : 'rejected'} successfully`
      };

    } catch (error) {
      fastify.log.error('Manual verification error:', error);
      return reply.code(500).send({
        error: 'VERIFICATION_ERROR',
        message: 'Failed to verify credential',
      });
    }
  });

  // Get verification queue status
  fastify.get('/verification/queue-status', {
    schema: {
      tags: ['credentials'],
      description: 'Get verification queue status',
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
            queueStatus: {
              type: 'object',
              properties: {
                queueLength: { type: 'number' },
                isProcessing: { type: 'boolean' }
              }
            }
          }
        }
      },
    },
    preHandler: [fastify.authenticate, fastify.requireRole('doctor')],
  }, async (request, reply) => {
    try {
      const queueStatus = credentialService.getVerificationQueueStatus();

      return {
        queueStatus
      };

    } catch (error) {
      fastify.log.error('Queue status error:', error);
      return reply.code(500).send({
        error: 'STATUS_ERROR',
        message: 'Failed to get queue status',
      });
    }
  });

  // Get pending credentials for manual review (admin endpoint)
  fastify.get('/pending-review', {
    schema: {
      tags: ['credentials'],
      description: 'Get credentials pending manual review',
      headers: {
        type: 'object',
        properties: {
          authorization: { type: 'string' }
        }
      },
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'number', default: 20 }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            credentials: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  doctorUsername: { type: 'string' },
                  credentialType: { type: 'string' },
                  status: { type: 'string' },
                  verificationStatus: { type: 'string' }
                }
              }
            }
          }
        }
      },
    },
    preHandler: [fastify.authenticate], // Note: In production, add admin role check
  }, async (request, reply) => {
    const { limit } = request.query;

    try {
      const credentials = await credentialService.getPendingCredentials(limit);

      return {
        credentials: credentials.map(c => ({
          id: c.id,
          doctorUsername: c.doctorUsername,
          credentialType: c.credentialType,
          issuingAuthority: c.issuingAuthority,
          status: c.status,
          verificationStatus: c.verificationStatus,
          hasDocument: !!c.documentCid,
          createdAt: c.createdAt,
          verificationResults: c.verificationResults
        }))
      };

    } catch (error) {
      fastify.log.error('Pending credentials error:', error);
      return reply.code(500).send({
        error: 'RETRIEVAL_ERROR',
        message: 'Failed to get pending credentials',
      });
    }
  });

  // Get doctor's verification status
  fastify.get('/verification-status', {
    schema: {
      tags: ['credentials'],
      description: 'Get doctor verification status and history',
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
            verificationStatus: {
              type: 'object',
              properties: {
                evaluation: { type: 'object' },
                recentHistory: { type: 'array' },
                unreadNotifications: { type: 'array' }
              }
            }
          }
        }
      },
    },
    preHandler: [fastify.authenticate, fastify.requireRole('doctor')],
  }, async (request, reply) => {
    const user = request.user;

    try {
      const verificationStatus = await credentialService.getDoctorVerificationStatus(user.username);

      return {
        verificationStatus
      };

    } catch (error) {
      fastify.log.error('Verification status error:', error);
      return reply.code(500).send({
        error: 'STATUS_ERROR',
        message: 'Failed to get verification status',
      });
    }
  });

  // Get verification statistics (admin endpoint)
  fastify.get('/verification/statistics', {
    schema: {
      tags: ['credentials'],
      description: 'Get system verification statistics',
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
            statistics: {
              type: 'object',
              properties: {
                totalDoctors: { type: 'number' },
                verifiedDoctors: { type: 'number' },
                verificationRate: { type: 'string' }
              }
            }
          }
        }
      },
    },
    preHandler: [fastify.authenticate], // Note: In production, add admin role check
  }, async (request, reply) => {
    try {
      const statistics = await credentialService.getVerificationStatistics();

      return {
        statistics
      };

    } catch (error) {
      fastify.log.error('Statistics error:', error);
      return reply.code(500).send({
        error: 'STATISTICS_ERROR',
        message: 'Failed to get verification statistics',
      });
    }
  });

  // Process automatic verifications (admin endpoint)
  fastify.post('/verification/process-automatic', {
    schema: {
      tags: ['credentials'],
      description: 'Process automatic verifications for eligible doctors',
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
            success: { type: 'boolean' },
            processedDoctors: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  username: { type: 'string' },
                  action: { type: 'string' },
                  score: { type: 'number' }
                }
              }
            }
          }
        }
      },
    },
    preHandler: [fastify.authenticate], // Note: In production, add admin role check
  }, async (request, reply) => {
    try {
      const processedDoctors = await credentialService.processAutomaticVerifications();

      return {
        success: true,
        processedDoctors
      };

    } catch (error) {
      fastify.log.error('Automatic verification processing error:', error);
      return reply.code(500).send({
        error: 'PROCESSING_ERROR',
        message: 'Failed to process automatic verifications',
      });
    }
  });
};

export default credentialRoutes;
