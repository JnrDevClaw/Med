// @ts-nocheck
import { FastifyPluginAsync } from 'fastify';
import type { FastifyInstance } from 'fastify';
import { TileDocument } from '@ceramicnetwork/stream-tile';
import { Type, Static } from '@sinclair/typebox';
import { pipeline } from 'stream';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';
import crypto from 'crypto';

const pump = promisify(pipeline);

const UploadCredentialSchema = Type.Object({
  credentialType: Type.Union([
    Type.Literal('license'),
    Type.Literal('certificate'),
    Type.Literal('degree'),
    Type.Literal('specialization'),
  ]),
  issuingAuthority: Type.String({ minLength: 1 }),
  credentialNumber: Type.Optional(Type.String()),
  issuedDate: Type.Optional(Type.String({ format: 'date' })),
  expiryDate: Type.Optional(Type.String({ format: 'date' })),
});

type UploadCredentialRequest = Static<typeof UploadCredentialSchema>;

const credentialRoutes: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  
  // Upload doctor credential
  fastify.post('/upload', {
    schema: {
      tags: ['credentials'],
      description: 'Upload doctor credential document',
      headers: Type.Object({
        authorization: Type.String(),
      }),
      consumes: ['multipart/form-data'],
      response: {
        201: Type.Object({
          credentialId: Type.String(),
          ipfsHash: Type.String(),
          status: Type.String(),
          message: Type.String(),
        }),
        400: Type.Object({
          error: Type.String(),
          message: Type.String(),
        }),
      },
    },
    preHandler: [fastify.authenticate, fastify.requireRole('doctor')],
  }, async (request, reply) => {
  const user = (request as any).user;

    try {
      const data = await request.file();
      
      if (!data) {
        return reply.code(400).send({
          error: 'NO_FILE',
          message: 'No file uploaded',
        });
      }

      // Validate file type
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
      if (!allowedTypes.includes(data.mimetype)) {
        return reply.code(400).send({
          error: 'INVALID_FILE_TYPE',
          message: 'Only PDF and image files are allowed',
        });
      }

      // Validate file size (10MB max)
      const maxSize = 10 * 1024 * 1024;
      if (data.file.readableLength > maxSize) {
        return reply.code(400).send({
          error: 'FILE_TOO_LARGE',
          message: 'File size must be less than 10MB',
        });
      }

      // Get form fields
      const fields = data.fields;
      const credentialType = (fields.credentialType as any)?.value;
      const issuingAuthority = (fields.issuingAuthority as any)?.value;
      const credentialNumber = (fields.credentialNumber as any)?.value;
      const issuedDate = (fields.issuedDate as any)?.value;
      const expiryDate = (fields.expiryDate as any)?.value;

      if (!credentialType || !issuingAuthority) {
        return reply.code(400).send({
          error: 'MISSING_FIELDS',
          message: 'Credential type and issuing authority are required',
        });
      }

      // Create temporary file
      const uploadDir = process.env.UPLOAD_DIR || './uploads';
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const filename = `${Date.now()}_${data.filename}`;
      const filepath = path.join(uploadDir, filename);
      
      // Save file temporarily
      await pump(data.file, fs.createWriteStream(filepath));

  // Read file & compute hash
  const fileBuffer = fs.readFileSync(filepath);
  const sha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');
  const fileSizeBytes = fileBuffer.length;

  // Upload to IPFS
  const ipfsHash = await fastify.ipfs.uploadFile(fileBuffer, data.filename);

      // Clean up temporary file
      fs.unlinkSync(filepath);

      // Save credential to database
    const verificationNotes = JSON.stringify({ fileHash: sha256, fileSize: fileSizeBytes });

    // MongoDB compatible credential creation
    const credentialDoc = {
      doctor_id: user.userId,
      credential_type: credentialType,
      issuing_authority: issuingAuthority,
      credential_number: credentialNumber || null,
      issued_date: issuedDate ? new Date(issuedDate) : null,
      expiry_date: expiryDate ? new Date(expiryDate) : null,
      ipfs_hash: ipfsHash,
      verification_notes: verificationNotes,
      status: 'pending',
      created_at: new Date(),
      updated_at: new Date()
    };

    let credential;
    if (process.env.DB_CLIENT === 'mongo') {
      const result = await fastify.db('doctor_credentials').insertOne(credentialDoc);
      credential = { id: result.insertedId.toString(), ...credentialDoc };
    } else {
      const [result] = await fastify.db('doctor_credentials').insert(credentialDoc).returning('*');
      credential = result;
    }

      reply.code(201).send({
        credentialId: credential.id,
        ipfsHash,
        status: credential.status,
  message: 'Credential uploaded successfully and is pending verification',
  // hash metadata (not part of original schema response; kept backward compatible)
  // @ts-ignore
  hash: sha256,
      });

    } catch (error) {
  fastify.log.error('Credential upload error:', error as any);
  return (reply as any).code(500).send({
        error: 'UPLOAD_ERROR',
        message: 'Failed to upload credential',
      });
    }
  });

  // Get doctor credentials
  fastify.get('/my-credentials', {
    schema: {
      tags: ['credentials'],
      description: 'Get doctor\'s credentials',
      headers: Type.Object({
        authorization: Type.String(),
      }),
      response: {
        200: Type.Object({
          credentials: Type.Array(Type.Object({
            id: Type.String(),
            credentialType: Type.String(),
            issuingAuthority: Type.String(),
            credentialNumber: Type.Optional(Type.String()),
            issuedDate: Type.Optional(Type.String()),
            expiryDate: Type.Optional(Type.String()),
            status: Type.String(),
            ipfsHash: Type.String(),
            ceramicVcId: Type.Optional(Type.String()),
            verifiedAt: Type.Optional(Type.String()),
            verificationNotes: Type.Optional(Type.String()),
          })),
        }),
      },
    },
    preHandler: [fastify.authenticate, fastify.requireRole('doctor')],
  }, async (request, reply) => {
  const user = (request as any).user;

    try {
      let credentials;
      if (process.env.DB_CLIENT === 'mongo') {
        credentials = await fastify.db('doctor_credentials')
          .find({ doctor_id: user.userId })
          .sort({ created_at: -1 })
          .toArray();
      } else {
        credentials = await fastify.db('doctor_credentials')
          .where('doctor_id', user.userId)
          .orderBy('created_at', 'desc');
      }

      return {
        credentials: credentials.map(c => ({
          id: c._id?.toString() || c.id,
          credentialType: c.credential_type,
          issuingAuthority: c.issuing_authority,
          credentialNumber: c.credential_number,
          issuedDate: c.issued_date,
          expiryDate: c.expiry_date,
          status: c.status,
          ipfsHash: c.ipfs_hash,
          ceramicVcId: c.ceramic_vc_id,
          verifiedAt: c.verified_at,
          verificationNotes: c.verification_notes,
        })),
      };

    } catch (error) {
  fastify.log.error('Get credentials error:', error as any);
  return (reply as any).code(500).send({
        error: 'DATABASE_ERROR',
        message: 'Failed to retrieve credentials',
      });
    }
  });

  // Admin: Get pending credentials for verification
  fastify.get('/pending', {
    schema: {
      tags: ['credentials'],
      description: 'Get pending credentials for verification (Admin only)',
      headers: Type.Object({
        authorization: Type.String(),
      }),
      querystring: Type.Object({
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
        offset: Type.Optional(Type.Number({ minimum: 0 })),
      }),
      response: {
        200: Type.Object({
          credentials: Type.Array(Type.Object({
            id: Type.String(),
            doctorName: Type.String(),
            doctorDid: Type.String(),
            credentialType: Type.String(),
            issuingAuthority: Type.String(),
            credentialNumber: Type.Optional(Type.String()),
            issuedDate: Type.Optional(Type.String()),
            expiryDate: Type.Optional(Type.String()),
            ipfsHash: Type.String(),
            uploadedAt: Type.String(),
          })),
          total: Type.Number(),
        }),
      },
    },
    preHandler: [fastify.authenticate], // TODO: Add admin role check
  }, async (request, reply) => {
    const { limit = 20, offset = 0 } = request.query as any;

    try {
      const credentials = await fastify.db('doctor_credentials')
        .join('users', 'doctor_credentials.doctor_id', 'users.id')
        .where('doctor_credentials.status', 'pending')
        .select([
          'doctor_credentials.*',
          'users.name as doctor_name',
          'users.did as doctor_did',
        ])
        .orderBy('doctor_credentials.created_at', 'asc')
        .limit(limit)
        .offset(offset);

      const [{ count }] = await fastify.db('doctor_credentials')
        .where('status', 'pending')
        .count('* as count');

      return {
        credentials: credentials.map(c => ({
          id: c.id,
          doctorName: c.doctor_name,
          doctorDid: c.doctor_did,
          credentialType: c.credential_type,
          issuingAuthority: c.issuing_authority,
          credentialNumber: c.credential_number,
          issuedDate: c.issued_date,
          expiryDate: c.expiry_date,
          ipfsHash: c.ipfs_hash,
          uploadedAt: c.created_at,
        })),
        total: parseInt(count as string),
      };

    } catch (error) {
  fastify.log.error('Get pending credentials error:', error as any);
  return (reply as any).code(500).send({
        error: 'DATABASE_ERROR',
        message: 'Failed to retrieve pending credentials',
      });
    }
  });

  // Admin: Verify or reject credential
  fastify.post('/verify/:credentialId', {
    schema: {
      tags: ['credentials'],
      description: 'Verify or reject a doctor credential (Admin only)',
      headers: Type.Object({
        authorization: Type.String(),
      }),
      params: Type.Object({
        credentialId: Type.String(),
      }),
      body: Type.Object({
        action: Type.Union([Type.Literal('approve'), Type.Literal('reject')]),
        notes: Type.Optional(Type.String()),
        createVC: Type.Optional(Type.Boolean()),
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          message: Type.String(),
          ceramicVcId: Type.Optional(Type.String()),
        }),
      },
    },
    preHandler: [fastify.authenticate], // TODO: Add admin role check
  }, async (request, reply) => {
    const { credentialId } = request.params as { credentialId: string };
    const { action, notes, createVC = true } = request.body as any;
  const user = (request as any).user;

    try {
      // Get credential
      const credential = await fastify.db('doctor_credentials')
        .join('users', 'doctor_credentials.doctor_id', 'users.id')
        .where('doctor_credentials.id', credentialId)
        .select(['doctor_credentials.*', 'users.name', 'users.did'])
        .first();

      if (!credential) {
  return (reply as any).code(404).send({
          error: 'CREDENTIAL_NOT_FOUND',
          message: 'Credential not found',
        });
      }

      if (credential.status !== 'pending') {
  return (reply as any).code(400).send({
          error: 'INVALID_STATUS',
          message: 'Credential is not pending verification',
        });
      }

      let ceramicVcId: string | null = null;

      if (action === 'approve') {
        if (createVC && fastify.ceramic?.client?.did) {
          try {
            ceramicVcId = await createVerifiableCredential(fastify, credential);
          } catch (e) {
            fastify.log.warn({ err: e }, 'Failed to record credential VC on Ceramic; continuing');
          }
        } else if (createVC) {
          fastify.log.warn('Ceramic DID not authenticated; skipping VC creation');
        }

        // Update credential status
        await fastify.db('doctor_credentials')
          .where('id', credentialId)
          .update({
            status: 'verified',
            ceramic_vc_id: ceramicVcId,
            verified_by: user.userId,
            verified_at: new Date(),
            verification_notes: notes,
            updated_at: new Date(),
          });

        // Update doctor's verified status
        await fastify.db('users')
          .where('id', credential.doctor_id)
          .update({
            verified: true,
            updated_at: new Date(),
          });

        return {
          success: true,
          message: 'Credential verified successfully',
          ceramicVcId,
        };

      } else {
        // Reject credential
        await fastify.db('doctor_credentials')
          .where('id', credentialId)
          .update({
            status: 'rejected',
            verified_by: user.userId,
            verified_at: new Date(),
            verification_notes: notes,
            updated_at: new Date(),
          });

        return {
          success: true,
          message: 'Credential rejected',
        };
      }

    } catch (error) {
  fastify.log.error('Credential verification error:', error as any);
  return (reply as any).code(500).send({
        error: 'VERIFICATION_ERROR',
        message: 'Failed to verify credential',
      });
    }
  });

  // Get credential document from IPFS
  fastify.get('/document/:ipfsHash', {
    schema: {
      tags: ['credentials'],
      description: 'Get credential document from IPFS',
      headers: Type.Object({
        authorization: Type.String(),
      }),
      params: Type.Object({
        ipfsHash: Type.String(),
      }),
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { ipfsHash } = request.params as { ipfsHash: string };

    try {
      const fileBuffer = await fastify.ipfs.getFile(ipfsHash);
      
      // Set appropriate headers
      reply.header('Content-Type', 'application/octet-stream');
      reply.header('Content-Disposition', `attachment; filename="${ipfsHash}"`);
      
      return reply.send(fileBuffer);

    } catch (error) {
  fastify.log.error('IPFS retrieval error:', error as any);
      return reply.code(404).send({
        error: 'FILE_NOT_FOUND',
        message: 'Document not found on IPFS',
      });
    }
  });
};

// Helper: create a VC-like TileDocument referencing an off-chain credential
async function createVerifiableCredential(fastify: FastifyInstance, credential: any): Promise<string> {
  const ceramic = fastify.ceramic.client;
  const content = {
    type: 'DoctorCredential',
    doctorDid: credential.did,
    doctorName: credential.name,
    credentialType: credential.credential_type,
    issuingAuthority: credential.issuing_authority,
    credentialNumber: credential.credential_number || null,
    issuedDate: credential.issued_date ? new Date(credential.issued_date).toISOString() : null,
    expiryDate: credential.expiry_date ? new Date(credential.expiry_date).toISOString() : null,
    ipfsHash: credential.ipfs_hash,
    status: 'verified',
    platformVerificationAt: new Date().toISOString(),
    platformCredentialId: credential.id,
    schema: 'med-platform/doctor-credential-v1',
  };

  const metadata = {
    controllers: [ceramic.did!.id],
    family: 'med-platform-credential',
    tags: ['doctor-credential', credential.credential_type],
    anchor: false,
    sync: true,
  } as any;

  const doc = await TileDocument.create(ceramic, content, metadata);
  return doc.id.toString();
}

export default credentialRoutes;
