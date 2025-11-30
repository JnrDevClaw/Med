import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore';

const doctorDiscussionsRoutes = async (fastify, opts) => {
  
  // Get all doctor discussions with filtering and pagination
  fastify.get('/', {
    schema: {
      tags: ['doctor-discussions'],
      description: 'Get doctor discussions with filtering and pagination (verified doctors only)',
      querystring: {
        type: 'object',
        properties: {
          category: { type: 'string' },
          sortBy: { type: 'string', enum: ['newest', 'oldest', 'mostActive'] },
          limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
          page: { type: 'number', minimum: 1, default: 1 },
          search: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            discussions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  title: { type: 'string' },
                  content: { type: 'string' },
                  category: { type: 'string' },
                  authorUsername: { type: 'string' },
                  participantCount: { type: 'number' },
                  commentCount: { type: 'number' },
                  tags: { type: 'array', items: { type: 'string' } },
                  createdAt: { type: 'string' },
                  updatedAt: { type: 'string' },
                  lastActivity: { type: 'string' }
                }
              }
            },
            pagination: {
              type: 'object',
              properties: {
                page: { type: 'number' },
                limit: { type: 'number' },
                total: { type: 'number' },
                hasNext: { type: 'boolean' }
              }
            }
          }
        }
      }
    },
    preHandler: [fastify.authenticate, fastify.requireVerifiedDoctor]
  }, async (request, reply) => {
    const { category, sortBy = 'newest', limit: queryLimit = 20, page = 1, search } = request.query;

    try {
      const discussionsRef = collection(fastify.firestore, 'doctorDiscussions');
      let q = query(discussionsRef);

      // Apply category filter
      if (category) {
        q = query(q, where('category', '==', category));
      }

      // Apply search filter (simple text search in title and content)
      if (search) {
        q = query(q, where('title', '>=', search), where('title', '<=', search + '\uf8ff'));
      }

      // Apply sorting
      switch (sortBy) {
        case 'oldest':
          q = query(q, orderBy('createdAt', 'asc'));
          break;
        case 'mostActive':
          q = query(q, orderBy('lastActivity', 'desc'));
          break;
        case 'newest':
        default:
          q = query(q, orderBy('createdAt', 'desc'));
          break;
      }

      // Apply pagination
      q = query(q, limit(queryLimit + 1)); // Get one extra to check if there's a next page

      const querySnapshot = await getDocs(q);
      const discussions = [];
      let hasNext = false;

      querySnapshot.forEach((doc, index) => {
        if (index < queryLimit) {
          const data = doc.data();
          discussions.push({
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
            updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
            lastActivity: data.lastActivity?.toDate?.()?.toISOString() || data.lastActivity
          });
        } else {
          hasNext = true;
        }
      });

      // Get total count for pagination
      const countQuery = query(discussionsRef);
      const countSnapshot = await getDocs(countQuery);
      const total = countSnapshot.size;

      return {
        discussions,
        pagination: {
          page,
          limit: queryLimit,
          total,
          hasNext
        }
      };

    } catch (error) {
      fastify.log.error('Error fetching doctor discussions:', error);
      return reply.code(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to fetch discussions'
      });
    }
  });

  // Get single discussion by ID
  fastify.get('/:id', {
    schema: {
      tags: ['doctor-discussions'],
      description: 'Get a single doctor discussion by ID (verified doctors only)',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            content: { type: 'string' },
            category: { type: 'string' },
            authorUsername: { type: 'string' },
            participantCount: { type: 'number' },
            commentCount: { type: 'number' },
            tags: { type: 'array', items: { type: 'string' } },
            createdAt: { type: 'string' },
            updatedAt: { type: 'string' },
            lastActivity: { type: 'string' }
          }
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    },
    preHandler: [fastify.authenticate, fastify.requireVerifiedDoctor]
  }, async (request, reply) => {
    const { id } = request.params;

    try {
      const discussionDoc = await getDoc(doc(fastify.firestore, 'doctorDiscussions', id));
      
      if (!discussionDoc.exists()) {
        return reply.code(404).send({
          error: 'DISCUSSION_NOT_FOUND',
          message: 'Discussion not found'
        });
      }

      const discussionData = discussionDoc.data();
      return {
        id: discussionDoc.id,
        ...discussionData,
        createdAt: discussionData.createdAt?.toDate?.()?.toISOString() || discussionData.createdAt,
        updatedAt: discussionData.updatedAt?.toDate?.()?.toISOString() || discussionData.updatedAt,
        lastActivity: discussionData.lastActivity?.toDate?.()?.toISOString() || discussionData.lastActivity
      };

    } catch (error) {
      fastify.log.error('Error fetching discussion:', error);
      return reply.code(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to fetch discussion'
      });
    }
  });

  // Create new discussion
  fastify.post('/', {
    schema: {
      tags: ['doctor-discussions'],
      description: 'Create a new doctor discussion (verified doctors only)',
      headers: {
        type: 'object',
        properties: {
          authorization: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        required: ['title', 'content', 'category'],
        properties: {
          title: { type: 'string', minLength: 5, maxLength: 200 },
          content: { type: 'string', minLength: 10, maxLength: 10000 },
          category: { type: 'string', minLength: 1, maxLength: 50 },
          tags: { 
            type: 'array', 
            items: { type: 'string', maxLength: 30 },
            maxItems: 10
          }
        }
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            discussion: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                title: { type: 'string' },
                content: { type: 'string' },
                category: { type: 'string' },
                authorUsername: { type: 'string' },
                participantCount: { type: 'number' },
                commentCount: { type: 'number' },
                tags: { type: 'array', items: { type: 'string' } },
                createdAt: { type: 'string' },
                updatedAt: { type: 'string' },
                lastActivity: { type: 'string' }
              }
            }
          }
        }
      }
    },
    preHandler: [fastify.authenticate, fastify.requireVerifiedDoctor]
  }, async (request, reply) => {
    const { title, content, category, tags = [] } = request.body;
    const user = request.user;

    try {
      const now = Timestamp.now();
      const discussionData = {
        title,
        content,
        category,
        tags,
        authorUsername: user.username,
        participantCount: 1, // Author is first participant
        commentCount: 0,
        participants: [user.username], // Track participants
        createdAt: now,
        updatedAt: now,
        lastActivity: now
      };

      const docRef = await addDoc(collection(fastify.firestore, 'doctorDiscussions'), discussionData);

      const newDiscussion = {
        id: docRef.id,
        ...discussionData,
        createdAt: discussionData.createdAt.toDate().toISOString(),
        updatedAt: discussionData.updatedAt.toDate().toISOString(),
        lastActivity: discussionData.lastActivity.toDate().toISOString()
      };

      // Remove participants array from response (internal tracking)
      delete newDiscussion.participants;

      reply.code(201).send({
        success: true,
        message: 'Discussion created successfully',
        discussion: newDiscussion
      });

    } catch (error) {
      fastify.log.error('Error creating discussion:', error);
      return reply.code(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to create discussion'
      });
    }
  });

  // Update discussion
  fastify.put('/:id', {
    schema: {
      tags: ['doctor-discussions'],
      description: 'Update a doctor discussion (verified doctors only)',
      headers: {
        type: 'object',
        properties: {
          authorization: { type: 'string' }
        }
      },
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        properties: {
          title: { type: 'string', minLength: 5, maxLength: 200 },
          content: { type: 'string', minLength: 10, maxLength: 10000 },
          category: { type: 'string', minLength: 1, maxLength: 50 },
          tags: { 
            type: 'array', 
            items: { type: 'string', maxLength: 30 },
            maxItems: 10
          }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            discussion: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                title: { type: 'string' },
                content: { type: 'string' },
                category: { type: 'string' },
                authorUsername: { type: 'string' },
                participantCount: { type: 'number' },
                commentCount: { type: 'number' },
                tags: { type: 'array', items: { type: 'string' } },
                createdAt: { type: 'string' },
                updatedAt: { type: 'string' },
                lastActivity: { type: 'string' }
              }
            }
          }
        },
        403: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' }
          }
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    },
    preHandler: [fastify.authenticate, fastify.requireVerifiedDoctor]
  }, async (request, reply) => {
    const { id } = request.params;
    const { title, content, category, tags } = request.body;
    const user = request.user;

    try {
      // Check if discussion exists and user owns it
      const discussionDoc = await getDoc(doc(fastify.firestore, 'doctorDiscussions', id));
      
      if (!discussionDoc.exists()) {
        return reply.code(404).send({
          error: 'DISCUSSION_NOT_FOUND',
          message: 'Discussion not found'
        });
      }

      const discussionData = discussionDoc.data();
      if (discussionData.authorUsername !== user.username) {
        return reply.code(403).send({
          error: 'UNAUTHORIZED',
          message: 'You can only edit your own discussions'
        });
      }

      // Prepare update data
      const updateData = {
        updatedAt: Timestamp.now()
      };

      if (title !== undefined) updateData.title = title;
      if (content !== undefined) updateData.content = content;
      if (category !== undefined) updateData.category = category;
      if (tags !== undefined) updateData.tags = tags;

      // Update discussion
      await updateDoc(doc(fastify.firestore, 'doctorDiscussions', id), updateData);

      // Get updated discussion
      const updatedDoc = await getDoc(doc(fastify.firestore, 'doctorDiscussions', id));
      const updatedData = updatedDoc.data();

      const responseData = {
        id: updatedDoc.id,
        ...updatedData,
        createdAt: updatedData.createdAt?.toDate?.()?.toISOString() || updatedData.createdAt,
        updatedAt: updatedData.updatedAt?.toDate?.()?.toISOString() || updatedData.updatedAt,
        lastActivity: updatedData.lastActivity?.toDate?.()?.toISOString() || updatedData.lastActivity
      };

      // Remove participants array from response
      delete responseData.participants;

      return {
        success: true,
        message: 'Discussion updated successfully',
        discussion: responseData
      };

    } catch (error) {
      fastify.log.error('Error updating discussion:', error);
      return reply.code(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to update discussion'
      });
    }
  });

  // Delete discussion
  fastify.delete('/:id', {
    schema: {
      tags: ['doctor-discussions'],
      description: 'Delete a doctor discussion (verified doctors only)',
      headers: {
        type: 'object',
        properties: {
          authorization: { type: 'string' }
        }
      },
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        },
        403: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' }
          }
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    },
    preHandler: [fastify.authenticate, fastify.requireVerifiedDoctor]
  }, async (request, reply) => {
    const { id } = request.params;
    const user = request.user;

    try {
      // Check if discussion exists and user owns it
      const discussionDoc = await getDoc(doc(fastify.firestore, 'doctorDiscussions', id));
      
      if (!discussionDoc.exists()) {
        return reply.code(404).send({
          error: 'DISCUSSION_NOT_FOUND',
          message: 'Discussion not found'
        });
      }

      const discussionData = discussionDoc.data();
      if (discussionData.authorUsername !== user.username) {
        return reply.code(403).send({
          error: 'UNAUTHORIZED',
          message: 'You can only delete your own discussions'
        });
      }

      // Delete discussion
      await deleteDoc(doc(fastify.firestore, 'doctorDiscussions', id));

      // TODO: Also delete associated comments in a transaction or batch operation

      return {
        success: true,
        message: 'Discussion deleted successfully'
      };

    } catch (error) {
      fastify.log.error('Error deleting discussion:', error);
      return reply.code(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to delete discussion'
      });
    }
  });

  // Get discussion categories
  fastify.get('/categories/list', {
    schema: {
      tags: ['doctor-discussions'],
      description: 'Get list of available discussion categories (verified doctors only)',
      response: {
        200: {
          type: 'object',
          properties: {
            categories: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  count: { type: 'number' }
                }
              }
            }
          }
        }
      }
    },
    preHandler: [fastify.authenticate, fastify.requireVerifiedDoctor]
  }, async (request, reply) => {
    try {
      // Get all discussions to count categories
      const discussionsRef = collection(fastify.firestore, 'doctorDiscussions');
      const querySnapshot = await getDocs(discussionsRef);
      
      const categoryCount = {};
      querySnapshot.forEach((doc) => {
        const category = doc.data().category;
        if (category) {
          categoryCount[category] = (categoryCount[category] || 0) + 1;
        }
      });

      const categories = Object.entries(categoryCount).map(([name, count]) => ({
        name,
        count
      }));

      return { categories };

    } catch (error) {
      fastify.log.error('Error fetching discussion categories:', error);
      return reply.code(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to fetch categories'
      });
    }
  });

  // Track discussion participation (internal helper)
  const trackParticipation = async (discussionId, username) => {
    try {
      const discussionRef = doc(fastify.firestore, 'doctorDiscussions', discussionId);
      const discussionDoc = await getDoc(discussionRef);
      
      if (discussionDoc.exists()) {
        const data = discussionDoc.data();
        const participants = data.participants || [];
        
        if (!participants.includes(username)) {
          await updateDoc(discussionRef, {
            participants: [...participants, username],
            participantCount: participants.length + 1,
            lastActivity: Timestamp.now()
          });
        } else {
          // Update last activity even if already a participant
          await updateDoc(discussionRef, {
            lastActivity: Timestamp.now()
          });
        }
      }
    } catch (error) {
      fastify.log.error('Error tracking participation:', error);
    }
  };

  // Make trackParticipation available to other routes (like comments)
  fastify.decorate('trackDiscussionParticipation', trackParticipation);
};

export default doctorDiscussionsRoutes;