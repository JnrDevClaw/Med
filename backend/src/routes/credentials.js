const { Type } = require('@sinclair/typebox');
const { pipeline } = require('stream');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs');

const pump = promisify(pipeline);

module.exports = async function (fastify, opts) {
  fastify.post('/upload', {
    schema: { tags: ['credentials'], description: 'Upload doctor credential document', headers: Type.Object({ authorization: Type.String() }), consumes: ['multipart/form-data'] },
    preHandler: [fastify.authenticate, fastify.requireRole('doctor')],
  }, async (request, reply) => {
    const user = request.user;
    try {
      const data = await request.file();
      if (!data) return reply.code(400).send({ error: 'NO_FILE', message: 'No file uploaded' });
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
      if (!allowedTypes.includes(data.mimetype)) return reply.code(400).send({ error: 'INVALID_FILE_TYPE', message: 'Only PDF and image files are allowed' });
      const uploadDir = process.env.UPLOAD_DIR || './uploads';
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
      const filename = `${Date.now()}_${data.filename}`;
      const filepath = path.join(uploadDir, filename);
      await pump(data.file, fs.createWriteStream(filepath));
      const fileBuffer = fs.readFileSync(filepath);
      const ipfsHash = await fastify.ipfs.uploadFile(fileBuffer, data.filename);
      fs.unlinkSync(filepath);
      const [credential] = await fastify.db('doctor_credentials').insert({ doctor_id: user.userId, credential_type: request.body.credentialType || null, issuing_authority: request.body.issuingAuthority || null, credential_number: request.body.credentialNumber || null, issued_date: request.body.issuedDate ? new Date(request.body.issuedDate) : null, expiry_date: request.body.expiryDate ? new Date(request.body.expiryDate) : null, ipfs_hash: ipfsHash, status: 'pending' }).returning('*');
      return reply.code(201).send({ credentialId: credential.id, ipfsHash, status: credential.status, message: 'Credential uploaded successfully and is pending verification' });
    } catch (error) {
      fastify.log.error('Credential upload error:', error);
      return reply.code(500).send({ error: 'UPLOAD_ERROR', message: 'Failed to upload credential' });
    }
  });

  fastify.get('/my-credentials', {
    schema: { tags: ['credentials'], description: "Get doctor's credentials", headers: Type.Object({ authorization: Type.String() }) },
    preHandler: [fastify.authenticate, fastify.requireRole('doctor')],
  }, async (request, reply) => {
    const user = request.user;
    try {
      const credentials = await fastify.db('doctor_credentials').where('doctor_id', user.userId).orderBy('created_at', 'desc');
      return { credentials: credentials.map(c => ({ id: c.id, credentialType: c.credential_type, issuingAuthority: c.issuing_authority, credentialNumber: c.credential_number, issuedDate: c.issued_date, expiryDate: c.expiry_date, status: c.status, ipfsHash: c.ipfs_hash, ceramicVcId: c.ceramic_vc_id, verifiedAt: c.verified_at, verificationNotes: c.verification_notes })) };
    } catch (error) {
      fastify.log.error('Get credentials error:', error);
      return reply.code(500).send({ error: 'DATABASE_ERROR', message: 'Failed to retrieve credentials' });
    }
  });
};
