const { Type } = require('@sinclair/typebox');

module.exports = async function (fastify, opts) {
  fastify.get('/profile', {
    schema: {
      tags: ['users'],
      description: 'Get current user profile',
      headers: Type.Object({ authorization: Type.String() }),
      response: { 200: Type.Object({ user: Type.Object({ id: Type.String(), did: Type.String(), name: Type.String(), email: Type.Optional(Type.String()), role: Type.String(), verified: Type.Boolean(), createdAt: Type.String(), profileData: Type.Optional(Type.Any()), ceramicProfile: Type.Optional(Type.Any()) }) }) },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const user = request.user;
    try {
      const userData = await fastify.db('users').where('id', user.userId).first();
      if (!userData) return reply.code(404).send({ error: 'USER_NOT_FOUND', message: 'User not found' });
      const ceramicProfile = await fastify.db('ceramic_profiles').where('user_id', user.userId).first();
      return { user: { id: userData.id, did: userData.did, name: userData.name, email: userData.email, role: userData.role, verified: userData.verified, createdAt: userData.created_at, profileData: userData.metadata, ceramicProfile: ceramicProfile ? { streamId: ceramicProfile.profile_stream_id, lastUpdated: ceramicProfile.updated_at } : null } };
    } catch (error) {
      fastify.log.error('Profile retrieval error:', error);
      return reply.code(500).send({ error: 'DATABASE_ERROR', message: 'Failed to retrieve profile' });
    }
  });

  fastify.put('/profile', {
    schema: {
      tags: ['users'],
      description: 'Update user profile',
      headers: Type.Object({ authorization: Type.String() }),
      body: Type.Object({ name: Type.Optional(Type.String({ minLength: 1 })), email: Type.Optional(Type.String({ format: 'email' })), profileData: Type.Optional(Type.Any()) }),
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const user = request.user;
    const { name, email, profileData } = request.body;
    try {
      const updateData = { updated_at: new Date() };
      if (name) updateData.name = name;
      if (email) updateData.email = email;
      if (profileData) updateData.metadata = profileData;

      await fastify.db('users').where('id', user.userId).update(updateData);

      let ceramicStreamId = null;
      if (fastify.ceramic?.client?.did) {
        try {
          // placeholder for updateCeramicProfile function
          // ceramicStreamId = await updateCeramicProfile(fastify, user.did, { name: name || undefined, email: email || undefined, ...profileData });
          const existing = await fastify.db('ceramic_profiles').where('user_id', user.userId).first();
          if (existing) {
            await fastify.db('ceramic_profiles').where('user_id', user.userId).update({ profile_stream_id: ceramicStreamId, profile_data: JSON.stringify({ name: name || undefined, email: email || undefined, ...profileData }), updated_at: new Date() });
          } else {
            await fastify.db('ceramic_profiles').insert({ user_id: user.userId, did: user.did, profile_stream_id: ceramicStreamId, profile_data: JSON.stringify({ name: name || undefined, email: email || undefined, ...profileData }) });
          }
        } catch (ceramicError) {
          fastify.log.warn('Failed to update Ceramic profile:', ceramicError);
        }
      } else {
        fastify.log.warn('Ceramic DID not authenticated; skipping on-chain profile update');
      }

      return { success: true, message: 'Profile updated successfully', ceramicStreamId };
    } catch (error) {
      fastify.log.error('Profile update error:', error);
      return reply.code(500).send({ error: 'UPDATE_ERROR', message: 'Failed to update profile' });
    }
  });

  // The rest of user routes (doctors listing, doctor profile, delete account) are intentionally omitted for brevity.
};
