import { TileDocument } from '@ceramicnetwork/stream-tile';

const userRoutes = async (fastify, opts) => {
  
  // Get current user profile
  fastify.get('/profile', {
    schema: {
      tags: ['users'],
      description: 'Get current user profile',
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
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                did: { type: 'string' },
                name: { type: 'string' },
                email: { type: 'string' },
                role: { type: 'string' },
                verified: { type: 'boolean' },
                createdAt: { type: 'string' },
                profileData: {},
                ceramicProfile: {
                  type: 'object',
                  properties: {
                    streamId: { type: 'string' },
                    lastUpdated: { type: 'string' }
                  }
                }
              }
            }
          }
        }
      },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const user = request.user;

    try {
      // Get user data
      const userData = await fastify.db('users')
        .where('id', user.userId)
        .first();

      if (!userData) {
        return reply.code(404).send({
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
      fastify.log.error('Profile retrieval error:', error);
      return reply.code(500).send({
        error: 'DATABASE_ERROR',
        message: 'Failed to retrieve profile',
      });
    }
  });

  // Update user profile
  fastify.put('/profile', {
    schema: {
      tags: ['users'],
      description: 'Update user profile',
      headers: {
        type: 'object',
        properties: {
          authorization: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1 },
          email: { type: 'string', format: 'email' },
          profileData: {
            type: 'object',
            properties: {
              bio: { type: 'string' },
              specializations: { type: 'array', items: { type: 'string' } },
              experience: { type: 'number' },
              languages: { type: 'array', items: { type: 'string' } },
              availability: {
                type: 'object',
                properties: {
                  timezone: { type: 'string' },
                  weeklyHours: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        day: { type: 'string' },
                        start: { type: 'string' },
                        end: { type: 'string' }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            ceramicStreamId: { type: 'string' }
          }
        }
      },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const user = request.user;
    const { name, email, profileData } = request.body;

    try {
      // Update user data in PostgreSQL
      const updateData = {
        updated_at: new Date(),
      };

      if (name) updateData.name = name;
      if (email) updateData.email = email;
      if (profileData) updateData.metadata = profileData;

      await fastify.db('users')
        .where('id', user.userId)
        .update(updateData);

      let ceramicStreamId = null;
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
          fastify.log.warn('Failed to update Ceramic profile:', ceramicError);
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
      fastify.log.error('Profile update error:', error);
      return reply.code(500).send({
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
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'number', minimum: 1, maximum: 50 },
          offset: { type: 'number', minimum: 0 },
          specialization: { type: 'string' },
          search: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            doctors: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  specializations: { type: 'array', items: { type: 'string' } },
                  experience: { type: 'number' },
                  languages: { type: 'array', items: { type: 'string' } },
                  bio: { type: 'string' },
                  verified: { type: 'boolean' },
                  credentialCount: { type: 'number' },
                  availability: {}
                }
              }
            },
            total: { type: 'number' }
          }
        }
      },
    },
  }, async (request, reply) => {
    const { limit = 20, offset = 0, specialization, search } = request.query;

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
        total: parseInt(count),
      };

    } catch (error) {
      fastify.log.error('Doctors retrieval error:', error);
      return reply.code(500).send({
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
      params: {
        type: 'object',
        properties: {
          doctorId: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            doctor: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                specializations: { type: 'array', items: { type: 'string' } },
                experience: { type: 'number' },
                languages: { type: 'array', items: { type: 'string' } },
                bio: { type: 'string' },
                verified: { type: 'boolean' },
                credentials: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      type: { type: 'string' },
                      issuingAuthority: { type: 'string' },
                      verifiedAt: { type: 'string' }
                    }
                  }
                },
                availability: {}
              }
            }
          }
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' }
          }
        }
      },
    },
  }, async (request, reply) => {
    const { doctorId } = request.params;

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
      fastify.log.error('Doctor profile retrieval error:', error);
      return reply.code(500).send({
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
      headers: {
        type: 'object',
        properties: {
          authorization: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        required: ['confirmDeletion'],
        properties: {
          confirmDeletion: { type: 'boolean' },
          password: { type: 'string' }
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
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const user = request.user;
    const { confirmDeletion } = request.body;

    if (!confirmDeletion) {
      return reply.code(400).send({
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
      fastify.log.error('Account deletion error:', error);
      return reply.code(500).send({
        error: 'DELETION_ERROR',
        message: 'Failed to delete account',
      });
    }
  });
};

// Helper: create or update a TileDocument with user profile data
async function updateCeramicProfile(fastify, did, profileData) {
  const ceramic = fastify.ceramic.client;
  // We use a deterministic TileDocument per user DID so updates overwrite
  const controllers = [ceramic.did.id];
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
