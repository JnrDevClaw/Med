const { Type } = require('@sinclair/typebox');
// Lazy require for agora token builder to avoid startup failure when package not installed
let RtcTokenBuilder, RtcRole;

module.exports = async function (fastify, opts) {
  fastify.post('/create', {
    schema: { tags: ['video'], description: 'Create a new video consultation', headers: Type.Object({ authorization: Type.String() }) },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { doctorId, scheduledTime, duration = 30 } = request.body;
    const user = request.user;
    try {
      const doctor = await fastify.db('users').where('id', doctorId).where('role', 'doctor').where('verified', true).first();
      if (!doctor) return reply.code(400).send({ error: 'DOCTOR_NOT_FOUND', message: 'Verified doctor not found' });

      const channelName = `consultation_${Date.now()}_${Math.random().toString(36).substr(2,9)}`;
      const scheduleTime = scheduledTime ? new Date(scheduledTime) : new Date();
      const [consultation] = await fastify.db('consultations').insert({ patient_id: user.userId, doctor_id: doctorId, type: 'video', status: 'scheduled', scheduled_at: scheduleTime, metadata: { duration_minutes: duration, channel_name: channelName } }).returning('*');
      await fastify.db('video_calls').insert({ consultation_id: consultation.id, agora_channel_name: channelName, call_status: 'waiting' });
      return reply.code(201).send({ consultationId: consultation.id, channelName, scheduledTime: consultation.scheduled_at, status: consultation.status });
    } catch (error) {
      fastify.log.error('Create call error:', error);
      return reply.code(500).send({ error: 'CREATION_ERROR', message: 'Failed to create video consultation' });
    }
  });

  // join/end/history endpoints omitted for brevity
};
