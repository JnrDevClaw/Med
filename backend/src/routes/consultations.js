const { Type } = require('@sinclair/typebox');

module.exports = async function (fastify, opts) {
  fastify.get('/', {
    schema: { tags: ['consultations'], description: 'Get user consultations', headers: Type.Object({ authorization: Type.String() }) },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const user = request.user;
    const { limit = 20, offset = 0 } = request.query || {};
    try {
      const consultations = await fastify.db('consultations').where(function() { this.where('patient_id', user.userId).orWhere('doctor_id', user.userId); }).orderBy('created_at', 'desc').limit(limit).offset(offset);
      const [{ count }] = await fastify.db('consultations').where(function() { this.where('patient_id', user.userId).orWhere('doctor_id', user.userId); }).count('* as count');
      return { consultations, total: parseInt(count) };
    } catch (error) {
      fastify.log.error('Consultations retrieval error:', error);
      return reply.code(500).send({ error: 'DATABASE_ERROR', message: 'Failed to retrieve consultations' });
    }
  });

  // Other endpoints (details, notes, reminders) are present in TS source; implement as needed.
};
