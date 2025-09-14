// @ts-nocheck
import { FastifyPluginAsync } from 'fastify';
import type { FastifyInstance } from 'fastify';
import { TileDocument } from '@ceramicnetwork/stream-tile';
import { Type, Static } from '@sinclair/typebox';

const UpdateProfileSchema = Type.Object({
  name: Type.Optional(Type.String({ minLength: 1 })),
  email: Type.Optional(Type.String({ format: 'email' })),
  profileData: Type.Optional(Type.Object({
    bio: Type.Optional(Type.String()),
    specializations: Type.Optional(Type.Array(Type.String())),
    experience: Type.Optional(Type.Number()),
    languages: Type.Optional(Type.Array(Type.String())),
    availability: Type.Optional(Type.Object({
      timezone: Type.String(),
      weeklyHours: Type.Array(Type.Object({
        day: Type.String(),
        start: Type.String(),
        end: Type.String(),
      })),
    })),
  })),
});

type UpdateProfileRequest = Static<typeof UpdateProfileSchema>;

const userRoutes: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  
  // Get current user profile
  fastify.get('/profile', {
    schema: {
      tags: ['users'],
      description: 'Get current user profile',
      headers: Type.Object({
        authorization: Type.String(),
      }),
      response: {
        200: Type.Object({
          user: Type.Object({
            id: Type.String(),
            did: Type.String(),
            name: Type.String(),
            email: Type.Optional(Type.String()),
            role: Type.String(),
            verified: Type.Boolean(),
            createdAt: Type.String(),
            profileData: Type.Optional(Type.Any()),
            ceramicProfile: Type.Optional(Type.Object({
              streamId: Type.Optional(Type.String()),
              lastUpdated: Type.Optional(Type.String()),
            })),
          }),
        }),
      },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
  const user = (request as any).user;

    try {
      // Get user data
      const userData = await fastify.db('users')
        .where('id', user.userId)
        .first();

      if (!userData) {
  return (reply as any).code(404).send({
          error: 'USER_NOT_FOUND',
          message: 'User not found',
        });
      }

      // Get Ceramic profile data
      const ceramicProfile = await fastify.db('ceramic_profiles')
        .where('user_id', user.userId)
        .first();

      return {
        user: {
          id: userData.id,
          did: userData.did,
          name: userData.name,
          email: userData.email,
          role: userData.role,
          verified: userData.verified,
          createdAt: userData.created_at,
          profileData: userData.metadata,
          ceramicProfile: ceramicProfile ? {
            streamId: ceramicProfile.profile_stream_id,
            lastUpdated: ceramicProfile.updated_at,
          } : null,
        },
      };

    } catch (error) {
  fastify.log.error('Profile retrieval error:', error as any);
  return (reply as any).code(500).send({
        error: 'DATABASE_ERROR',
        message: 'Failed to retrieve profile',
      });
    }
  });

  // Update user profile
  fastify.put<{ Body: UpdateProfileRequest }>('/profile', {
    schema: {
      tags: ['users'],
      description: 'Update user profile',
      headers: Type.Object({
        authorization: Type.String(),
      }),
      body: UpdateProfileSchema,
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          message: Type.String(),
          ceramicStreamId: Type.Optional(Type.String()),
        }),
      },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
  const user = (request as any).user;
    const { name, email, profileData } = request.body;

    try {
      // Update user data in PostgreSQL
      const updateData: any = {
        updated_at: new Date(),
      };

      if (name) updateData.name = name;
      if (email) updateData.email = email;
      if (profileData) updateData.metadata = profileData;

  await fastify.db('users')
        .where('id', user.userId)
        .update(updateData);

      let ceramicStreamId: string | null = null;
      if (fastify.ceramic?.client?.did) {
        try {
          ceramicStreamId = await updateCeramicProfile(fastify, user.did, {
            name: name || undefined,
            email: email || undefined,
            ...profileData,
          });

          // Upsert Ceramic profile record
          const existing = await fastify.db('ceramic_profiles').where('user_id', user.userId).first();
          if (existing) {
            await fastify.db('ceramic_profiles')
              .where('user_id', user.userId)
              .update({
                profile_stream_id: ceramicStreamId,
                profile_data: JSON.stringify({
                  name: name || undefined,
                  email: email || undefined,
                  ...profileData,
                }),
                updated_at: new Date(),
              });
          } else {
            await fastify.db('ceramic_profiles')
              .insert({
                user_id: user.userId,
                did: user.did,
                profile_stream_id: ceramicStreamId,
                profile_data: JSON.stringify({
                  name: name || undefined,
                  email: email || undefined,
                  ...profileData,
                }),
              });
          }
        } catch (ceramicError) {
    fastify.log.warn('Failed to update Ceramic profile:', ceramicError as any);
        }
      } else {
        fastify.log.warn('Ceramic DID not authenticated; skipping on-chain profile update');
      }

      return {
        success: true,
        message: 'Profile updated successfully',
        ceramicStreamId,
      };

    } catch (error) {
  fastify.log.error('Profile update error:', error as any);
  return (reply as any).code(500).send({
        error: 'UPDATE_ERROR',
        message: 'Failed to update profile',
      });
    }
  });

  // Get public doctor profiles (for patients to browse)
  fastify.get('/doctors', {
    schema: {
      tags: ['users'],
      description: 'Get verified doctor profiles',
      querystring: Type.Object({
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 50 })),
        offset: Type.Optional(Type.Number({ minimum: 0 })),
        specialization: Type.Optional(Type.String()),
        search: Type.Optional(Type.String()),
      }),
      response: {
        200: Type.Object({
          doctors: Type.Array(Type.Object({
            id: Type.String(),
            name: Type.String(),
            specializations: Type.Optional(Type.Array(Type.String())),
            experience: Type.Optional(Type.Number()),
            languages: Type.Optional(Type.Array(Type.String())),
            bio: Type.Optional(Type.String()),
            verified: Type.Boolean(),
            credentialCount: Type.Number(),
            availability: Type.Optional(Type.Any()),
          })),
          total: Type.Number(),
        }),
      },
    },
  }, async (request, reply) => {
    const { limit = 20, offset = 0, specialization, search } = request.query as any;

    try {
      let query = fastify.db('users')
        .leftJoin('doctor_credentials', function() {
          this.on('users.id', 'doctor_credentials.doctor_id')
            .andOn('doctor_credentials.status', '=', fastify.db.raw('?', ['verified']));
        })
        .where('users.role', 'doctor')
        .where('users.verified', true)
        .groupBy('users.id');

      if (specialization) {
        query = query.whereRaw("users.metadata->>'specializations' @> ?", [JSON.stringify([specialization])]);
      }

      if (search) {
        query = query.where(function() {
          this.where('users.name', 'ilike', `%${search}%`)
            .orWhereRaw("users.metadata->>'bio' ilike ?", [`%${search}%`]);
        });
      }

      const doctors = await query
        .select([
          'users.id',
          'users.name',
          'users.metadata',
          'users.verified',
          fastify.db.raw('COUNT(doctor_credentials.id) as credential_count'),
        ])
        .orderBy('users.name')
        .limit(limit)
        .offset(offset);

      const [{ count }] = await fastify.db('users')
        .where('role', 'doctor')
        .where('verified', true)
        .count('* as count');

      return {
        doctors: doctors.map(doctor => ({
          id: doctor.id,
          name: doctor.name,
          specializations: doctor.metadata?.specializations || [],
          experience: doctor.metadata?.experience,
          languages: doctor.metadata?.languages || [],
          bio: doctor.metadata?.bio,
          verified: doctor.verified,
          credentialCount: parseInt(doctor.credential_count) || 0,
          availability: doctor.metadata?.availability,
        })),
        total: parseInt(count as string),
      };

    } catch (error) {
  fastify.log.error('Doctors retrieval error:', error as any);
  return (reply as any).code(500).send({
        error: 'DATABASE_ERROR',
        message: 'Failed to retrieve doctors',
      });
    }
  });

  // Get doctor public profile
  fastify.get('/doctors/:doctorId', {
    schema: {
      tags: ['users'],
      description: 'Get doctor public profile',
      params: Type.Object({
        doctorId: Type.String(),
      }),
      response: {
        200: Type.Object({
          doctor: Type.Object({
            id: Type.String(),
            name: Type.String(),
            specializations: Type.Optional(Type.Array(Type.String())),
            experience: Type.Optional(Type.Number()),
            languages: Type.Optional(Type.Array(Type.String())),
            bio: Type.Optional(Type.String()),
            verified: Type.Boolean(),
            credentials: Type.Array(Type.Object({
              type: Type.String(),
              issuingAuthority: Type.String(),
              verifiedAt: Type.String(),
            })),
            availability: Type.Optional(Type.Any()),
          }),
        }),
        404: Type.Object({
          error: Type.String(),
          message: Type.String(),
        }),
      },
    },
  }, async (request, reply) => {
    const { doctorId } = request.params as { doctorId: string };

    try {
      // Get doctor data
      const doctor = await fastify.db('users')
        .where('id', doctorId)
        .where('role', 'doctor')
        .where('verified', true)
        .first();

      if (!doctor) {
        return reply.code(404).send({
          error: 'DOCTOR_NOT_FOUND',
          message: 'Verified doctor not found',
        });
      }

      // Get verified credentials
      const credentials = await fastify.db('doctor_credentials')
        .where('doctor_id', doctorId)
        .where('status', 'verified')
        .select(['credential_type', 'issuing_authority', 'verified_at']);

      return {
        doctor: {
          id: doctor.id,
          name: doctor.name,
          specializations: doctor.metadata?.specializations || [],
          experience: doctor.metadata?.experience,
          languages: doctor.metadata?.languages || [],
          bio: doctor.metadata?.bio,
          verified: doctor.verified,
          credentials: credentials.map(c => ({
            type: c.credential_type,
            issuingAuthority: c.issuing_authority,
            verifiedAt: c.verified_at,
          })),
          availability: doctor.metadata?.availability,
        },
      };

    } catch (error) {
  fastify.log.error('Doctor profile retrieval error:', error as any);
  return (reply as any).code(500).send({
        error: 'DATABASE_ERROR',
        message: 'Failed to retrieve doctor profile',
      });
    }
  });

  // Delete user account
  fastify.delete('/account', {
    schema: {
      tags: ['users'],
      description: 'Delete user account and all associated data',
      headers: Type.Object({
        authorization: Type.String(),
      }),
      body: Type.Object({
        confirmDeletion: Type.Boolean(),
        password: Type.Optional(Type.String()), // For additional security
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          message: Type.String(),
        }),
      },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
  const user = (request as any).user;
    const { confirmDeletion } = request.body as any;

    if (!confirmDeletion) {
  return (reply as any).code(400).send({
        error: 'CONFIRMATION_REQUIRED',
        message: 'Account deletion confirmation required',
      });
    }

    try {
      // Delete user data (cascading deletes will handle related records)
  await fastify.db('users')
        .where('id', user.userId)
        .delete();

      // TODO: Remove data from Ceramic network
      // This would involve removing or marking the DID data as deleted

      return {
        success: true,
        message: 'Account deleted successfully',
      };

    } catch (error) {
  fastify.log.error('Account deletion error:', error as any);
  return (reply as any).code(500).send({
        error: 'DELETION_ERROR',
        message: 'Failed to delete account',
      });
    }
  });
};

// Helper: create or update a TileDocument with user profile data
async function updateCeramicProfile(fastify: FastifyInstance, did: string, profileData: any): Promise<string> {
  const ceramic = fastify.ceramic.client;
  // We use a deterministic TileDocument per user DID so updates overwrite
  const controllers = [ceramic.did!.id];
  const family = 'med-platform-user-profile';
  const tags = ['user-profile'];

  // Compose the content; include user DID to make document self-descriptive
  const content = {
    userDid: did,
    updatedAt: new Date().toISOString(),
    ...profileData,
  };

  try {
    const doc = await TileDocument.deterministic(ceramic, { controllers, family, tags });
    await doc.update(content);
    return doc.id.toString();
  } catch (e) {
    const doc = await TileDocument.create(ceramic, content, { controllers, family, tags });
    return doc.id.toString();
  }
}

export default userRoutes;
