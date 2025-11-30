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

const doctorCommentsRoutes = async (fastify, opts) => {
  
  // Get comments for a discussion
  fastify.get('/discussion/:discussionId', {
    schema: {
      tags: ['doctor-comments'],
      description: 'Get comments for a doctor discussion (verified doctors only)',
      params: {
        type: 'object',
        required: ['discussionId'],
        properties: {
          discussionId: { type: 'string' }
        }
      },
      querystring: {
        type: 'object',
        properties: {
          sortBy: { type: 'string', enum: ['newest', 'oldest'] },
          limit: { type: 'number', minimum: 1, maximum: 100, default: 50 }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            comments: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  discussionId: { type: 'string' },
                  content: { type: 'string' },
                  authorUsername: { type: 'string' },
                  taggedDoctors: { type: 'array', items: { type: 'string' } },
                  parentCommentId: { type: ['string', 'null'] },
                  replyCount: { type: 'number' },
                  createdAt: { type: 'string' },
                  updatedAt: { type: 'string' }
                }
              }
            }
          }
        }
      }
    },
    preHandler: [fastify.authenticate, fastify.requireVerifiedDoctor]
  }, async (request, reply) => {
    const { discussionId } = request.params;
    const { sortBy = 'oldest', limit: queryLimit = 50 } = request.query;

    try {
      // Verify discussion exists and user has access
      const discussionDoc = await getDoc(doc(fastify.firestore, 'doctorDiscussions', discussionId));
      if (!discussionDoc.exists()) {
        return reply.code(404).send({
          error: 'DISCUSSION_NOT_FOUND',
          message: 'Discussion not found'
        });
      }

      const commentsRef = collection(fastify.firestore, 'doctorComments');
      let q = query(
        commentsRef,
        where('discussionId', '==', discussionId)
      );

      // Apply sorting
      switch (sortBy) {
        case 'newest':
          q = query(q, orderBy('createdAt', 'desc'));
          break;
        case 'oldest':
        default:
          q = query(q, orderBy('createdAt', 'asc'));
          break;
      }

      q = query(q, limit(queryLimit));

      const querySnapshot = await getDocs(q);
      const comments = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        comments.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt
        });
      });

      return { comments };

    } catch (error) {
      fastify.log.error('Error fetching discussion comments:', error);
      return reply.code(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to fetch comments'
      });
    }
  });

  // Get replies to a specific comment
  fastify.get('/:commentId/replies', {
    schema: {
      tags: ['doctor-comments'],
      description: 'Get replies to a specific comment (verified doctors only)',
      params: {
        type: 'object',
        required: ['commentId'],
        properties: {
          commentId: { type: 'string' }
        }
      },
      querystring: {
        type: 'object',
        properties: {
          sortBy: { type: 'string', enum: ['newest', 'oldest'] },
          limit: { type: 'number', minimum: 1, maximum: 100, default: 20 }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            replies: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  discussionId: { type: 'string' },
                  content: { type: 'string' },
                  authorUsername: { type: 'string' },
                  taggedDoctors: { type: 'array', items: { type: 'string' } },
                  parentCommentId: { type: 'string' },
                  replyCount: { type: 'number' },
                  createdAt: { type: 'string' },
                  updatedAt: { type: 'string' }
                }
              }
            }
          }
        }
      }
    },
    preHandler: [fastify.authenticate, fastify.requireVerifiedDoctor]
  }, async (request, reply) => {
    const { commentId } = request.params;
    const { sortBy = 'oldest', limit: queryLimit = 20 } = request.query;

    try {
      const commentsRef = collection(fastify.firestore, 'doctorComments');
      let q = query(
        commentsRef,
        where('parentCommentId', '==', commentId)
      );

      // Apply sorting
      switch (sortBy) {
        case 'newest':
          q = query(q, orderBy('createdAt', 'desc'));
          break;
        case 'oldest':
        default:
          q = query(q, orderBy('createdAt', 'asc'));
          break;
      }

      q = query(q, limit(queryLimit));

      const querySnapshot = await getDocs(q);
      const replies = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        replies.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt
        });
      });

      return { replies };

    } catch (error) {
      fastify.log.error('Error fetching comment replies:', error);
      return reply.code(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to fetch replies'
      });
    }
  });

  // Create new comment
  fastify.post('/', {
    schema: {
      tags: ['doctor-comments'],
      description: 'Create a new comment on a doctor discussion (verified doctors only)',
      headers: {
        type: 'object',
        properties: {
          authorization: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        required: ['discussionId', 'content'],
        properties: {
          discussionId: { type: 'string' },
          content: { type: 'string', minLength: 1, maxLength: 2000 },
          parentCommentId: { type: ['string', 'null'] },
          taggedDoctors: { 
            type: 'array', 
            items: { type: 'string' },
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
            comment: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                discussionId: { type: 'string' },
                content: { type: 'string' },
                authorUsername: { type: 'string' },
                taggedDoctors: { type: 'array', items: { type: 'string' } },
                parentCommentId: { type: ['string', 'null'] },
                replyCount: { type: 'number' },
                createdAt: { type: 'string' },
                updatedAt: { type: 'string' }
              }
            }
          }
        }
      }
    },
    preHandler: [fastify.authenticate, fastify.requireVerifiedDoctor]
  }, async (request, reply) => {
    const { discussionId, content, parentCommentId = null, taggedDoctors = [] } = request.body;
    const user = request.user;

    try {
      // Verify discussion exists
      const discussionDoc = await getDoc(doc(fastify.firestore, 'doctorDiscussions', discussionId));
      if (!discussionDoc.exists()) {
        return reply.code(404).send({
          error: 'DISCUSSION_NOT_FOUND',
          message: 'Discussion not found'
        });
      }

      // If replying to a comment, verify parent comment exists
      if (parentCommentId) {
        const parentCommentDoc = await getDoc(doc(fastify.firestore, 'doctorComments', parentCommentId));
        if (!parentCommentDoc.exists()) {
          return reply.code(404).send({
            error: 'PARENT_COMMENT_NOT_FOUND',
            message: 'Parent comment not found'
          });
        }
      }

      const now = Timestamp.now();
      const commentData = {
        discussionId,
        content,
        authorUsername: user.username,
        taggedDoctors: taggedDoctors || [],
        parentCommentId,
        replyCount: 0,
        createdAt: now,
        updatedAt: now
      };

      const docRef = await addDoc(collection(fastify.firestore, 'doctorComments'), commentData);

      // Update discussion comment count and last activity
      const discussionRef = doc(fastify.firestore, 'doctorDiscussions', discussionId);
      const discussionData = discussionDoc.data();
      await updateDoc(discussionRef, {
        commentCount: (discussionData.commentCount || 0) + 1,
        lastActivity: now
      });

      // If this is a reply, update parent comment reply count
      if (parentCommentId) {
        const parentCommentRef = doc(fastify.firestore, 'doctorComments', parentCommentId);
        const parentCommentDoc = await getDoc(parentCommentRef);
        if (parentCommentDoc.exists()) {
          const parentData = parentCommentDoc.data();
          await updateDoc(parentCommentRef, {
            replyCount: (parentData.replyCount || 0) + 1
          });
        }
      }

      // Track participation in discussion
      if (fastify.trackDiscussionParticipation) {
        await fastify.trackDiscussionParticipation(discussionId, user.username);
      }

      const newComment = {
        id: docRef.id,
        ...commentData,
        createdAt: commentData.createdAt.toDate().toISOString(),
        updatedAt: commentData.updatedAt.toDate().toISOString()
      };

      reply.code(201).send({
        success: true,
        message: 'Comment created successfully',
        comment: newComment
      });

    } catch (error) {
      fastify.log.error('Error creating comment:', error);
      return reply.code(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to create comment'
      });
    }
  });

  // Update comment
  fastify.put('/:id', {
    schema: {
      tags: ['doctor-comments'],
      description: 'Update a comment (verified doctors only)',
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
          content: { type: 'string', minLength: 1, maxLength: 2000 },
          taggedDoctors: { 
            type: 'array', 
            items: { type: 'string' },
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
            comment: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                discussionId: { type: 'string' },
                content: { type: 'string' },
                authorUsername: { type: 'string' },
                taggedDoctors: { type: 'array', items: { type: 'string' } },
                parentCommentId: { type: ['string', 'null'] },
                replyCount: { type: 'number' },
                createdAt: { type: 'string' },
                updatedAt: { type: 'string' }
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
    const { content, taggedDoctors } = request.body;
    const user = request.user;

    try {
      // Check if comment exists and user owns it
      const commentDoc = await getDoc(doc(fastify.firestore, 'doctorComments', id));
      
      if (!commentDoc.exists()) {
        return reply.code(404).send({
          error: 'COMMENT_NOT_FOUND',
          message: 'Comment not found'
        });
      }

      const commentData = commentDoc.data();
      if (commentData.authorUsername !== user.username) {
        return reply.code(403).send({
          error: 'UNAUTHORIZED',
          message: 'You can only edit your own comments'
        });
      }

      // Prepare update data
      const updateData = {
        updatedAt: Timestamp.now()
      };

      if (content !== undefined) updateData.content = content;
      if (taggedDoctors !== undefined) updateData.taggedDoctors = taggedDoctors;

      // Update comment
      await updateDoc(doc(fastify.firestore, 'doctorComments', id), updateData);

      // Get updated comment
      const updatedDoc = await getDoc(doc(fastify.firestore, 'doctorComments', id));
      const updatedData = updatedDoc.data();

      return {
        success: true,
        message: 'Comment updated successfully',
        comment: {
          id: updatedDoc.id,
          ...updatedData,
          createdAt: updatedData.createdAt?.toDate?.()?.toISOString() || updatedData.createdAt,
          updatedAt: updatedData.updatedAt?.toDate?.()?.toISOString() || updatedData.updatedAt
        }
      };

    } catch (error) {
      fastify.log.error('Error updating comment:', error);
      return reply.code(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to update comment'
      });
    }
  });

  // Delete comment
  fastify.delete('/:id', {
    schema: {
      tags: ['doctor-comments'],
      description: 'Delete a comment (verified doctors only)',
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
      // Check if comment exists and user owns it
      const commentDoc = await getDoc(doc(fastify.firestore, 'doctorComments', id));
      
      if (!commentDoc.exists()) {
        return reply.code(404).send({
          error: 'COMMENT_NOT_FOUND',
          message: 'Comment not found'
        });
      }

      const commentData = commentDoc.data();
      if (commentData.authorUsername !== user.username) {
        return reply.code(403).send({
          error: 'UNAUTHORIZED',
          message: 'You can only delete your own comments'
        });
      }

      // Delete comment
      await deleteDoc(doc(fastify.firestore, 'doctorComments', id));

      // Update discussion comment count
      const discussionRef = doc(fastify.firestore, 'doctorDiscussions', commentData.discussionId);
      const discussionDoc = await getDoc(discussionRef);
      if (discussionDoc.exists()) {
        const discussionData = discussionDoc.data();
        await updateDoc(discussionRef, {
          commentCount: Math.max(0, (discussionData.commentCount || 1) - 1)
        });
      }

      // If this was a reply, update parent comment reply count
      if (commentData.parentCommentId) {
        const parentCommentRef = doc(fastify.firestore, 'doctorComments', commentData.parentCommentId);
        const parentCommentDoc = await getDoc(parentCommentRef);
        if (parentCommentDoc.exists()) {
          const parentData = parentCommentDoc.data();
          await updateDoc(parentCommentRef, {
            replyCount: Math.max(0, (parentData.replyCount || 1) - 1)
          });
        }
      }

      // TODO: Also delete any replies to this comment in a batch operation

      return {
        success: true,
        message: 'Comment deleted successfully'
      };

    } catch (error) {
      fastify.log.error('Error deleting comment:', error);
      return reply.code(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to delete comment'
      });
    }
  });

  // Search for doctors to tag (helper endpoint)
  fastify.get('/doctors/search', {
    schema: {
      tags: ['doctor-comments'],
      description: 'Search for verified doctors to tag (verified doctors only)',
      querystring: {
        type: 'object',
        properties: {
          query: { type: 'string', minLength: 1 },
          limit: { type: 'number', minimum: 1, maximum: 20, default: 10 }
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
                  username: { type: 'string' }
                }
              }
            }
          }
        }
      }
    },
    preHandler: [fastify.authenticate, fastify.requireVerifiedDoctor]
  }, async (request, reply) => {
    const { query: searchQuery, limit: queryLimit = 10 } = request.query;

    try {
      if (!searchQuery) {
        return { doctors: [] };
      }

      // Search for verified doctors by username
      const usersRef = collection(fastify.firestore, 'users');
      const q = query(
        usersRef,
        where('role', '==', 'doctor'),
        where('verified', '==', true),
        where('username', '>=', searchQuery),
        where('username', '<=', searchQuery + '\uf8ff'),
        limit(queryLimit)
      );

      const querySnapshot = await getDocs(q);
      const doctors = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        doctors.push({
          username: data.username
        });
      });

      return { doctors };

    } catch (error) {
      fastify.log.error('Error searching doctors:', error);
      return reply.code(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to search doctors'
      });
    }
  });
};

export default doctorCommentsRoutes;