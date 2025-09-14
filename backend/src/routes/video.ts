import { FastifyPluginAsync } from 'fastify';
import { Type, Static } from '@sinclair/typebox';
// Agora token builder is lazy-required at runtime so the server can start without the package installed.
// The actual types are declared below for TypeScript but implementation is required dynamically.
type RtcTokenBuilderType = any;
type RtcRoleType = any;
let RtcTokenBuilder: RtcTokenBuilderType;
let RtcRole: RtcRoleType;

const CreateCallSchema = Type.Object({
  doctorId: Type.String(),
  scheduledTime: Type.Optional(Type.String({ format: 'date-time' })),
  duration: Type.Optional(Type.Number({ minimum: 15, maximum: 120 })), // minutes
});

const JoinCallSchema = Type.Object({
  consultationId: Type.String(),
});

type CreateCallRequest = Static<typeof CreateCallSchema>;
type JoinCallRequest = Static<typeof JoinCallSchema>;

const videoRoutes: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  
  // Create video consultation
  fastify.post<{ Body: CreateCallRequest }>('/create', {
    schema: {
      tags: ['video'],
      description: 'Create a new video consultation',
      headers: Type.Object({
        authorization: Type.String(),
      }),
      body: CreateCallSchema,
      response: {
        201: Type.Object({
          consultationId: Type.String(),
          channelName: Type.String(),
          scheduledTime: Type.String(),
          status: Type.String(),
        }),
        400: Type.Object({
          error: Type.String(),
          message: Type.String(),
        }),
      },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { doctorId, scheduledTime, duration = 30 } = request.body;
    const user = request.user;

    try {
      // Verify doctor exists and is verified
      const doctor = await fastify.db('users')
        .where('id', doctorId)
        .where('role', 'doctor')
        .where('verified', true)
        .first();

      if (!doctor) {
        return reply.code(400).send({
          error: 'DOCTOR_NOT_FOUND',
          message: 'Verified doctor not found',
        });
      }

      // Create consultation
      const channelName = `consultation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const scheduleTime = scheduledTime ? new Date(scheduledTime) : new Date();

      const [consultation] = await fastify.db('consultations')
        .insert({
          patient_id: user.userId,
          doctor_id: doctorId,
          type: 'video',
          status: 'scheduled',
          scheduled_at: scheduleTime,
          metadata: {
            duration_minutes: duration,
            channel_name: channelName,
          },
        })
        .returning('*');

      // Create video call record
      await fastify.db('video_calls')
        .insert({
          consultation_id: consultation.id,
          agora_channel_name: channelName,
          call_status: 'waiting',
        });

      reply.code(201).send({
        consultationId: consultation.id,
        channelName,
        scheduledTime: consultation.scheduled_at,
        status: consultation.status,
      });

    } catch (error) {
      fastify.log.error('Create call error:', error);
      return reply.code(500).send({
        error: 'CREATION_ERROR',
        message: 'Failed to create video consultation',
      });
    }
  });

  // Join video call
  fastify.post<{ Body: JoinCallRequest }>('/join', {
    schema: {
      tags: ['video'],
      description: 'Join a video consultation',
      headers: Type.Object({
        authorization: Type.String(),
      }),
      body: JoinCallSchema,
      response: {
        200: Type.Object({
          token: Type.String(),
          channelName: Type.String(),
          uid: Type.Number(),
          appId: Type.String(),
          role: Type.String(),
          consultation: Type.Object({
            id: Type.String(),
            patientName: Type.String(),
            doctorName: Type.String(),
            scheduledTime: Type.String(),
            status: Type.String(),
          }),
        }),
        403: Type.Object({
          error: Type.String(),
          message: Type.String(),
        }),
      },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { consultationId } = request.body;
    const user = request.user;

    try {
      // Get consultation with participants
      const consultation = await fastify.db('consultations')
        .join('video_calls', 'consultations.id', 'video_calls.consultation_id')
        .leftJoin('users as patient', 'consultations.patient_id', 'patient.id')
        .leftJoin('users as doctor', 'consultations.doctor_id', 'doctor.id')
        .where('consultations.id', consultationId)
        .where(function() {
          this.where('consultations.patient_id', user.userId)
            .orWhere('consultations.doctor_id', user.userId);
        })
        .select([
          'consultations.*',
          'video_calls.agora_channel_name',
          'video_calls.call_status',
          'patient.name as patient_name',
          'doctor.name as doctor_name',
        ])
        .first();

      if (!consultation) {
        return reply.code(403).send({
          error: 'CONSULTATION_NOT_FOUND',
          message: 'Consultation not found or access denied',
        });
      }

      // Check if consultation is ready for video call
      if (!['scheduled', 'active'].includes(consultation.status)) {
        return reply.code(400).send({
          error: 'INVALID_STATUS',
          message: 'Consultation is not available for video call',
        });
      }

      // Generate Agora token
      const appId = process.env.AGORA_APP_ID;
      const appCertificate = process.env.AGORA_APP_CERTIFICATE;
      // Lazy-require the agora token package so the server doesn't fail to start if it's missing.
      if (!RtcTokenBuilder || !RtcRole) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const pkg = require('agora-access-token');
          RtcTokenBuilder = (pkg && pkg.RtcTokenBuilder) || pkg.RtcTokenBuilder || pkg;
          RtcRole = (pkg && pkg.RtcRole) || pkg.RtcRole || (pkg && pkg.RtcRole) || (pkg && pkg.role) || {};
        } catch (e) {
          fastify.log.error('Agora token package not installed. To enable video tokens install "agora-access-token" via npm.');
          return reply.code(500).send({ error: 'AGORA_NOT_CONFIGURED', message: 'Agora package not installed on server' });
        }
      }
      
      if (!appId || !appCertificate) {
        throw new Error('Agora credentials not configured');
      }

      const uid = parseInt(user.userId.replace(/-/g, '').substring(0, 8), 16);
      const role = user.role === 'doctor' ? RtcRole.PUBLISHER : RtcRole.PUBLISHER;
      const expirationTimeInSeconds = 3600; // 1 hour
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

      const token = RtcTokenBuilder.buildTokenWithUid(
        appId,
        appCertificate,
        consultation.agora_channel_name,
        uid,
        role,
        privilegeExpiredTs
      );

      // Update video call record with token and UID
      const updateData = user.role === 'doctor' ? {
        doctor_token: token,
        agora_uid_doctor: uid.toString(),
      } : {
        patient_token: token,
        agora_uid_patient: uid.toString(),
      };

      await fastify.db('video_calls')
        .where('consultation_id', consultationId)
        .update(updateData);

      // Update consultation status to active if not already
      if (consultation.status === 'scheduled') {
        await fastify.db('consultations')
          .where('id', consultationId)
          .update({
            status: 'active',
            started_at: new Date(),
          });
      }

      return {
        token,
        channelName: consultation.agora_channel_name,
        uid,
        appId,
        role: user.role,
        consultation: {
          id: consultation.id,
          patientName: consultation.patient_name,
          doctorName: consultation.doctor_name,
          scheduledTime: consultation.scheduled_at,
          status: consultation.status,
        },
      };

    } catch (error) {
      fastify.log.error('Join call error:', error);
      return reply.code(500).send({
        error: 'JOIN_ERROR',
        message: 'Failed to join video call',
      });
    }
  });

  // End video call
  fastify.post('/end/:consultationId', {
    schema: {
      tags: ['video'],
      description: 'End a video consultation',
      headers: Type.Object({
        authorization: Type.String(),
      }),
      params: Type.Object({
        consultationId: Type.String(),
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          duration: Type.Number(),
          message: Type.String(),
        }),
      },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { consultationId } = request.params as { consultationId: string };
    const user = request.user;

    try {
      // Get consultation
      const consultation = await fastify.db('consultations')
        .join('video_calls', 'consultations.id', 'video_calls.consultation_id')
        .where('consultations.id', consultationId)
        .where(function() {
          this.where('consultations.patient_id', user.userId)
            .orWhere('consultations.doctor_id', user.userId);
        })
        .select(['consultations.*', 'video_calls.call_started_at'])
        .first();

      if (!consultation) {
        return reply.code(403).send({
          error: 'CONSULTATION_NOT_FOUND',
          message: 'Consultation not found or access denied',
        });
      }

      const endTime = new Date();
      const startTime = new Date(consultation.started_at || consultation.call_started_at);
      const duration = Math.round((endTime.getTime() - startTime.getTime()) / 60000);

      // Update consultation
      await fastify.db('consultations')
        .where('id', consultationId)
        .update({
          status: 'completed',
          ended_at: endTime,
          duration_minutes: duration,
        });

      // Update video call
      await fastify.db('video_calls')
        .where('consultation_id', consultationId)
        .update({
          call_ended_at: endTime,
          call_duration_seconds: duration * 60,
          call_status: 'ended',
        });

      return {
        success: true,
        duration,
        message: 'Video consultation ended successfully',
      };

    } catch (error) {
      fastify.log.error('End call error:', error);
      return reply.code(500).send({
        error: 'END_ERROR',
        message: 'Failed to end video call',
      });
    }
  });

  // Get video consultation history
  fastify.get('/history', {
    schema: {
      tags: ['video'],
      description: 'Get video consultation history',
      headers: Type.Object({
        authorization: Type.String(),
      }),
      querystring: Type.Object({
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 50 })),
        offset: Type.Optional(Type.Number({ minimum: 0 })),
        status: Type.Optional(Type.Union([
          Type.Literal('scheduled'),
          Type.Literal('active'),
          Type.Literal('completed'),
          Type.Literal('cancelled'),
        ])),
      }),
      response: {
        200: Type.Object({
          consultations: Type.Array(Type.Object({
            id: Type.String(),
            patientName: Type.String(),
            doctorName: Type.String(),
            scheduledTime: Type.String(),
            status: Type.String(),
            duration: Type.Optional(Type.Number()),
            callStatus: Type.Optional(Type.String()),
          })),
          total: Type.Number(),
        }),
      },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const user = request.user;
    const { limit = 20, offset = 0, status } = request.query as any;

    try {
      let query = fastify.db('consultations')
        .join('video_calls', 'consultations.id', 'video_calls.consultation_id')
        .leftJoin('users as patient', 'consultations.patient_id', 'patient.id')
        .leftJoin('users as doctor', 'consultations.doctor_id', 'doctor.id')
        .where('consultations.type', 'video')
        .where(function() {
          this.where('consultations.patient_id', user.userId)
            .orWhere('consultations.doctor_id', user.userId);
        });

      if (status) {
        query = query.where('consultations.status', status);
      }

      const consultations = await query
        .select([
          'consultations.id',
          'consultations.scheduled_at',
          'consultations.status',
          'consultations.duration_minutes',
          'video_calls.call_status',
          'patient.name as patient_name',
          'doctor.name as doctor_name',
        ])
        .orderBy('consultations.scheduled_at', 'desc')
        .limit(limit)
        .offset(offset);

      const [{ count }] = await fastify.db('consultations')
        .join('video_calls', 'consultations.id', 'video_calls.consultation_id')
        .where('consultations.type', 'video')
        .where(function() {
          this.where('consultations.patient_id', user.userId)
            .orWhere('consultations.doctor_id', user.userId);
        })
        .count('* as count');

      return {
        consultations: consultations.map(c => ({
          id: c.id,
          patientName: c.patient_name,
          doctorName: c.doctor_name,
          scheduledTime: c.scheduled_at,
          status: c.status,
          duration: c.duration_minutes,
          callStatus: c.call_status,
        })),
        total: parseInt(count as string),
      };

    } catch (error) {
      fastify.log.error('History retrieval error:', error);
      return reply.code(500).send({
        error: 'DATABASE_ERROR',
        message: 'Failed to retrieve consultation history',
      });
    }
  });
};

export default videoRoutes;
