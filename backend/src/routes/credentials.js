const credentialRoutes = async (fastify, opts) => {
  
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
          credentialType: { type: 'string', enum: ['medical_license', 'board_certification', 'education', 'other'] },
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
                submittedAt: { type: 'string' }
              }
            }
          }
        }
      },
    },
    preHandler: [fastify.authenticate, fastify.requireRole('doctor')],
  }, async (request, reply) => {
    const user = request.user;
    const { credentialType, issuingAuthority, credentialNumber, issuedDate, expiryDate, description } = request.body;

    try {
      const [credential] = await fastify.db('doctor_credentials')
        .insert({
          doctor_id: user.userId,
          credential_type: credentialType,
          issuing_authority: issuingAuthority,
          credential_number: credentialNumber,
          issued_date: issuedDate ? new Date(issuedDate) : null,
          expiry_date: expiryDate ? new Date(expiryDate) : null,
          description,
          status: 'pending',
          submitted_at: new Date(),
        })
        .returning('*');

      return reply.code(201).send({
        success: true,
        credential: {
          id: credential.id,
          credentialType: credential.credential_type,
          status: credential.status,
          submittedAt: credential.submitted_at,
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
                  submittedAt: { type: 'string' },
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
      const credentials = await fastify.db('doctor_credentials')
        .where('doctor_id', user.userId)
        .orderBy('submitted_at', 'desc');

      return {
        credentials: credentials.map(c => ({
          id: c.id,
          credentialType: c.credential_type,
          issuingAuthority: c.issuing_authority,
          status: c.status,
          submittedAt: c.submitted_at,
          verifiedAt: c.verified_at,
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
      description: 'Upload credential document',
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
            documentId: { type: 'string' }
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
      const credential = await fastify.db('doctor_credentials')
        .where('id', credentialId)
        .where('doctor_id', user.userId)
        .first();

      if (!credential) {
        return reply.code(404).send({
          error: 'CREDENTIAL_NOT_FOUND',
          message: 'Credential not found',
        });
      }

      // Handle file upload
      const data = await request.file();
      if (!data) {
        return reply.code(400).send({
          error: 'NO_FILE',
          message: 'No file uploaded',
        });
      }

      const buffer = await data.toBuffer();
      const filename = `credential_${credentialId}_${data.filename}`;

      // Store file (could be IPFS, S3, or local storage)
      let documentId;
      try {
        documentId = await fastify.ipfs.uploadFile(buffer, filename);
      } catch (ipfsError) {
        // Fallback to local storage
        const fs = require('fs');
        const path = require('path');
        const uploadDir = process.env.UPLOAD_DIR || './uploads';
        const filePath = path.join(uploadDir, filename);
        fs.writeFileSync(filePath, buffer);
        documentId = filename;
      }

      // Update credential with document reference
      await fastify.db('doctor_credentials')
        .where('id', credentialId)
        .update({
          document_id: documentId,
          updated_at: new Date(),
        });

      return {
        success: true,
        documentId,
      };

    } catch (error) {
      fastify.log.error('Document upload error:', error);
      return reply.code(500).send({
        error: 'UPLOAD_ERROR',
        message: 'Failed to upload document',
      });
    }
  });
};

export default credentialRoutes;
