import { TileDocument } from '@ceramicnetwork/stream-tile';

const userRoutes = async (fastify, opts) => {
  
  // Get user profile by username
  fastify.get('/profile/:username', {
    schema: {
      tags: ['users'],
      description: 'Get user profile by username',
      params: {
        type: 'object',
        properties: {
          username: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            user: {
              type: 'object',
              properties: {
                username: { type: 'string' },
                role: { type: 'string' },
                verified: { type: 'boolean' },
                profileData: {}
              }
            }
          }
        }
      },
    },
  }, async (request, reply) => {
    const { username } = request.params;

    try {
      // Get user metadata
      const userMetadata = await fastify.userProfile.getUserMetadata(username);
      
      // Get public profile data (filtered for privacy)
      const fullProfile = await fastify.userProfile.getUserProfile(username);
      
      // Filter sensitive information for public access
      const publicProfile = {
        username: fullProfile.username,
        role: fullProfile.role,
        bio: fullProfile.bio,
        specializations: fullProfile.specializations,
        experience: fullProfile.experience,
        languages: fullProfile.languages,
        availability: fullProfile.availability
      };

      return {
        user: {
          username: userMetadata.username,
          role: userMetadata.role,
          verified: userMetadata.verified,
          profileData: publicProfile
        }
      };

    } catch (error) {
      fastify.log.error('Profile retrieval error:', error);
      
      if (error.message.includes('not found')) {
        return reply.code(404).send({
          error: 'USER_NOT_FOUND',
          message: error.message,
        });
      }
      
      return reply.code(500).send({
        error: 'PROFILE_ERROR',
        message: 'Failed to retrieve profile',
      });
    }
  });

  // Get current user profile
  fastify.get('/profile', {
    schema: {
      tags: ['users'],
      description: 'Get current user profile from IPFS',
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
                username: { type: 'string' },
                role: { type: 'string' },
                verified: { type: 'boolean' },
                email: { type: 'string' },
                createdAt: { type: 'string' },
                updatedAt: { type: 'string' },
                profileData: {}
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
      // Get user metadata from Firestore
      const userMetadata = await fastify.userProfile.getUserMetadata(user.username);
      
      // Get complete profile from IPFS
      const fullProfile = await fastify.userProfile.getUserProfile(user.username);

      return {
        user: {
          id: userMetadata.id,
          username: userMetadata.username,
          role: userMetadata.role,
          verified: userMetadata.verified,
          email: userMetadata.email,
          createdAt: userMetadata.createdAt,
          updatedAt: userMetadata.updatedAt,
          profileData: fullProfile
        }
      };

    } catch (error) {
      fastify.log.error('Profile retrieval error:', error);
      
      if (error.message.includes('not found')) {
        return reply.code(404).send({
          error: 'USER_NOT_FOUND',
          message: error.message,
        });
      }
      
      if (error.message.includes('network issues')) {
        return reply.code(503).send({
          error: 'SERVICE_UNAVAILABLE',
          message: 'Profile temporarily unavailable due to network issues',
        });
      }
      
      return reply.code(500).send({
        error: 'PROFILE_ERROR',
        message: 'Failed to retrieve profile',
      });
    }
  });

  // Update user profile
  fastify.put('/profile', {
    schema: {
      tags: ['users'],
      description: 'Update user profile on IPFS',
      headers: {
        type: 'object',
        properties: {
          authorization: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        properties: {
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
            newCid: { type: 'string' }
          }
        }
      },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const user = request.user;
    const { email, profileData } = request.body;

    try {
      // Prepare updates
      const updates = {};
      if (email) updates.email = email;
      if (profileData) {
        Object.assign(updates, profileData);
      }

      // Update profile using UserProfileService
      const newCid = await fastify.userProfile.updateUserProfile(user.username, updates);

      return {
        success: true,
        message: 'Profile updated successfully',
        newCid,
      };

    } catch (error) {
      fastify.log.error('Profile update error:', error);
      
      if (error.message.includes('not found')) {
        return reply.code(404).send({
          error: 'USER_NOT_FOUND',
          message: error.message,
        });
      }
      
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
                  username: { type: 'string' },
                  specializations: { type: 'array', items: { type: 'string' } },
                  experience: { type: 'number' },
                  languages: { type: 'array', items: { type: 'string' } },
                  bio: { type: 'string' },
                  verified: { type: 'boolean' },
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
      // Get verified doctors from Firestore
      const doctors = await fastify.userProfile.firestoreService.getUsersByRole('doctor', true);
      
      let filteredDoctors = doctors;
      
      // Apply search and specialization filters
      if (search || specialization) {
        const profilePromises = filteredDoctors.map(async (doctor) => {
          try {
            const profile = await fastify.userProfile.getUserProfile(doctor.username);
            return { ...doctor, profile };
          } catch (error) {
            fastify.log.warn(`Failed to get profile for doctor ${doctor.username}:`, error);
            return { ...doctor, profile: null };
          }
        });
        
        const doctorsWithProfiles = await Promise.all(profilePromises);
        
        filteredDoctors = doctorsWithProfiles.filter(doctor => {
          if (!doctor.profile) return false;
          
          if (specialization && !doctor.profile.specializations?.includes(specialization)) {
            return false;
          }
          
          if (search) {
            const searchLower = search.toLowerCase();
            const matchesUsername = doctor.username.toLowerCase().includes(searchLower);
            const matchesBio = doctor.profile.bio?.toLowerCase().includes(searchLower);
            if (!matchesUsername && !matchesBio) {
              return false;
            }
          }
          
          return true;
        });
      }
      
      // Apply pagination
      const total = filteredDoctors.length;
      const paginatedDoctors = filteredDoctors.slice(offset, offset + limit);
      
      // Get profiles for paginated results if not already loaded
      const resultPromises = paginatedDoctors.map(async (doctor) => {
        if (doctor.profile) {
          return {
            id: doctor.id,
            username: doctor.username,
            specializations: doctor.profile.specializations || [],
            experience: doctor.profile.experience,
            languages: doctor.profile.languages || [],
            bio: doctor.profile.bio,
            verified: doctor.verified,
            availability: doctor.profile.availability,
          };
        } else {
          try {
            const profile = await fastify.userProfile.getUserProfile(doctor.username);
            return {
              id: doctor.id,
              username: doctor.username,
              specializations: profile.specializations || [],
              experience: profile.experience,
              languages: profile.languages || [],
              bio: profile.bio,
              verified: doctor.verified,
              availability: profile.availability,
            };
          } catch (error) {
            fastify.log.warn(`Failed to get profile for doctor ${doctor.username}:`, error);
            return {
              id: doctor.id,
              username: doctor.username,
              specializations: [],
              experience: 0,
              languages: [],
              bio: '',
              verified: doctor.verified,
              availability: null,
            };
          }
        }
      });
      
      const results = await Promise.all(resultPromises);

      return {
        doctors: results,
        total,
      };

    } catch (error) {
      fastify.log.error('Doctors retrieval error:', error);
      return reply.code(500).send({
        error: 'SERVICE_ERROR',
        message: 'Failed to retrieve doctors',
      });
    }
  });

  // Get doctor public profile by username
  fastify.get('/doctors/:username', {
    schema: {
      tags: ['users'],
      description: 'Get doctor public profile by username',
      params: {
        type: 'object',
        properties: {
          username: { type: 'string' }
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
                username: { type: 'string' },
                specializations: { type: 'array', items: { type: 'string' } },
                experience: { type: 'number' },
                languages: { type: 'array', items: { type: 'string' } },
                bio: { type: 'string' },
                verified: { type: 'boolean' },
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
    const { username } = request.params;

    try {
      // Get doctor metadata
      const doctor = await fastify.userProfile.firestoreService.getUserByUsername(username);

      if (!doctor || doctor.role !== 'doctor' || !doctor.verified) {
        return reply.code(404).send({
          error: 'DOCTOR_NOT_FOUND',
          message: 'Verified doctor not found',
        });
      }

      // Get doctor profile from IPFS
      const profile = await fastify.userProfile.getUserProfile(username);

      return {
        doctor: {
          id: doctor.id,
          username: doctor.username,
          specializations: profile.specializations || [],
          experience: profile.experience,
          languages: profile.languages || [],
          bio: profile.bio,
          verified: doctor.verified,
          availability: profile.availability,
        },
      };

    } catch (error) {
      fastify.log.error('Doctor profile retrieval error:', error);
      
      if (error.message.includes('not found')) {
        return reply.code(404).send({
          error: 'DOCTOR_NOT_FOUND',
          message: 'Verified doctor not found',
        });
      }
      
      return reply.code(500).send({
        error: 'SERVICE_ERROR',
        message: 'Failed to retrieve doctor profile',
      });
    }
  });

  // Batch retrieve user profiles
  fastify.post('/profiles/batch', {
    schema: {
      tags: ['users'],
      description: 'Retrieve multiple user profiles at once',
      body: {
        type: 'object',
        required: ['usernames'],
        properties: {
          usernames: {
            type: 'array',
            items: { type: 'string' },
            maxItems: 20 // Limit batch size
          }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            profiles: {
              type: 'object',
              additionalProperties: {
                oneOf: [
                  {
                    type: 'object',
                    properties: {
                      username: { type: 'string' },
                      role: { type: 'string' },
                      verified: { type: 'boolean' }
                    }
                  },
                  {
                    type: 'object',
                    properties: {
                      error: { type: 'string' }
                    }
                  }
                ]
              }
            },
            retrieved: { type: 'number' },
            failed: { type: 'number' }
          }
        }
      },
    },
  }, async (request, reply) => {
    const { usernames } = request.body;

    try {
      const profiles = await fastify.userProfile.batchGetUserProfiles(usernames);
      
      let retrieved = 0;
      let failed = 0;
      
      for (const [username, profile] of Object.entries(profiles)) {
        if (profile.error) {
          failed++;
        } else {
          retrieved++;
          // Filter sensitive information for public access
          profiles[username] = {
            username: profile.username,
            role: profile.role,
            bio: profile.bio,
            specializations: profile.specializations,
            experience: profile.experience,
            languages: profile.languages,
            availability: profile.availability
          };
        }
      }

      return {
        profiles,
        retrieved,
        failed
      };

    } catch (error) {
      fastify.log.error('Batch profile retrieval error:', error);
      return reply.code(500).send({
        error: 'BATCH_ERROR',
        message: 'Failed to retrieve profiles',
      });
    }
  });

  // Clear profile cache (admin endpoint)
  fastify.delete('/cache/profiles', {
    schema: {
      tags: ['users'],
      description: 'Clear user profile cache',
      headers: {
        type: 'object',
        properties: {
          authorization: { type: 'string' }
        }
      },
      querystring: {
        type: 'object',
        properties: {
          username: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            cleared: { type: 'string' }
          }
        }
      },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { username } = request.query;

    try {
      if (username) {
        fastify.userProfile.clearCache(username);
        return {
          success: true,
          message: 'Profile cache cleared',
          cleared: `user: ${username}`
        };
      } else {
        fastify.userProfile.clearCache();
        return {
          success: true,
          message: 'All profile cache cleared',
          cleared: 'all profiles'
        };
      }

    } catch (error) {
      fastify.log.error('Cache clear error:', error);
      return reply.code(500).send({
        error: 'CACHE_ERROR',
        message: 'Failed to clear cache',
      });
    }
  });

  // Get cache statistics
  fastify.get('/cache/profiles/stats', {
    schema: {
      tags: ['users'],
      description: 'Get profile cache statistics',
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
            totalEntries: { type: 'number' },
            validEntries: { type: 'number' },
            expiredEntries: { type: 'number' },
            maxSize: { type: 'number' },
            cacheTimeout: { type: 'number' }
          }
        }
      },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const stats = fastify.userProfile.getCacheStats();
      return stats;

    } catch (error) {
      fastify.log.error('Cache stats error:', error);
      return reply.code(500).send({
        error: 'STATS_ERROR',
        message: 'Failed to get cache statistics',
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
          confirmDeletion: { type: 'boolean' }
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
      // Clear user from cache first
      fastify.userProfile.clearCache(user.username);

      // Delete user from Firestore
      await fastify.userProfile.firestoreService.deleteUser(user.username);

      // TODO: Remove data from IPFS
      // This would involve removing the IPFS content (though it's immutable)
      // In practice, we'd mark the user as deleted and stop serving the content

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
