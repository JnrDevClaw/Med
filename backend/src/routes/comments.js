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

const commentsRoutes = async (fastify, opts) => {
  
  // Get comments for a question or answer
  fastify.get('/:parentType/:parentId', {
    schema: {
      tags: ['comments'],
      description: 'Get comments for a question or answer',
      params: {
        type: 'object',
        required: ['parentType', 'parentId'],
        properties: {
          parentType: { type: 'string', enum: ['question', 'answer'] },
          parentId: { type: 'string' }
        }
      },
      querystring: {
        type: 'object',
        properties: {
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
                  content: { type: 'string' },
                  parentId: { type: 'string' },
                  parentType: { type: 'string' },
                  authorUsername: { type: 'string' },
                  authorRole: { type: 'string' },
                  taggedUsers: { type: 'array', items: { type: 'string' } },
                  replyToCommentId: { type: ['string', 'null'] },
                  createdAt: { type: 'string' },
                  updatedAt: { type: 'string' }
                }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { parentType, parentId } = request.params;
    const { limit: queryLimit = 50 } = request.query;

    try {
      const commentsRef = collection(fastify.firestore, 'comments');
      const q = query(
        commentsRef,
        where('parentId', '==', parentId),
        where('parentType', '==', parentType),
        orderBy('createdAt', 'asc'),
        limit(queryLimit)
      );

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
      fastify.log.error('Error fetching comments:', error);
      return reply.code(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to fetch comments'
      });
    }
  });

  // Create new comment
  fastify.post('/', {
    schema: {
      tags: ['comments'],
      description: 'Create a new comment',
      headers: {
        type: 'object',
        properties: {
          authorization: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        required: ['content', 'parentId', 'parentType'],
        properties: {
          content: { type: 'string', minLength: 1, maxLength: 1000 },
          parentId: { type: 'string' },
          parentType: { type: 'string', enum: ['question', 'answer'] },
          replyToCommentId: { type: 'string' }
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
                content: { type: 'string' },
                parentId: { type: 'string' },
                parentType: { type: 'string' },
                authorUsername: { type: 'string' },
                authorRole: { type: 'string' },
                taggedUsers: { type: 'array', items: { type: 'string' } },
                replyToCommentId: { type: ['string', 'null'] },
                createdAt: { type: 'string' },
                updatedAt: { type: 'string' }
              }
            }
          }
        }
      }
    },
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { content, parentId, parentType, replyToCommentId } = request.body;
    const user = request.user;

    try {
      // Verify parent exists
      const parentCollection = parentType === 'question' ? 'questions' : 'answers';
      const parentDoc = await getDoc(doc(fastify.firestore, parentCollection, parentId));
      if (!parentDoc.exists()) {
        return reply.code(404).send({
          error: 'PARENT_NOT_FOUND',
          message: `${parentType} not found`
        });
      }

      // Extract tagged users from content (@username)
      const taggedUsers = [];
      const tagRegex = /@(\w+)/g;
      let match;
      while ((match = tagRegex.exec(content)) !== null) {
        const username = match[1];
        if (!taggedUsers.includes(username)) {
          taggedUsers.push(username);
        }
      }

      // Verify reply-to comment exists if specified
      if (replyToCommentId) {
        const replyToDoc = await getDoc(doc(fastify.firestore, 'comments', replyToCommentId));
        if (!replyToDoc.exists()) {
          return reply.code(404).send({
            error: 'REPLY_TO_COMMENT_NOT_FOUND',
            message: 'Comment to reply to not found'
          });
        }
      }

      const commentData = {
        content,
        parentId,
        parentType,
        authorUsername: user.username,
        authorRole: user.role,
        taggedUsers,
        replyToCommentId: replyToCommentId || null,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      const docRef = await addDoc(collection(fastify.firestore, 'comments'), commentData);

      // Update parent comment count if it's an answer
      if (parentType === 'answer') {
        const answerData = parentDoc.data();
        await updateDoc(doc(fastify.firestore, 'answers', parentId), {
          commentCount: (answerData.commentCount || 0) + 1,
          updatedAt: Timestamp.now()
        });
      }

      // Send notifications
      try {
        const parentData = parentDoc.data();
        
        // Notify parent author (if not commenting on own post)
        if (parentData.authorUsername !== user.username) {
          await fastify.notificationService.sendCommentNotification(
            parentData.authorUsername,
            user.username,
            content,
            parentType,
            parentId
          );
        }

        // Notify tagged users
        for (const taggedUsername of taggedUsers) {
          if (taggedUsername !== user.username && taggedUsername !== parentData.authorUsername) {
            await fastify.notificationService.sendUserTaggedNotification(
              taggedUsername,
              user.username,
              content,
              parentType,
              parentId
            );
          }
        }
      } catch (notificationError) {
        fastify.log.warn('Failed to send comment notifications:', notificationError);
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
      tags: ['comments'],
      description: 'Update a comment',
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
        required: ['content'],
        properties: {
          content: { type: 'string', minLength: 1, maxLength: 1000 }
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
                content: { type: 'string' },
                taggedUsers: { type: 'array', items: { type: 'string' } },
                updatedAt: { type: 'string' }
              }
            }
          }
        }
      }
    },
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params;
    const { content } = request.body;
    const user = request.user;

    try {
      // Check if comment exists and user owns it
      const commentDoc = await getDoc(doc(fastify.firestore, 'comments', id));
      
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

      // Extract tagged users from updated content
      const taggedUsers = [];
      const tagRegex = /@(\w+)/g;
      let match;
      while ((match = tagRegex.exec(content)) !== null) {
        const username = match[1];
        if (!taggedUsers.includes(username)) {
          taggedUsers.push(username);
        }
      }

      // Update comment
      await updateDoc(doc(fastify.firestore, 'comments', id), {
        content,
        taggedUsers,
        updatedAt: Timestamp.now()
      });

      return {
        success: true,
        message: 'Comment updated successfully',
        comment: {
          id,
          content,
          taggedUsers,
          updatedAt: new Date().toISOString()
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
      tags: ['comments'],
      description: 'Delete a comment',
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
        }
      }
    },
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params;
    const user = request.user;

    try {
      // Check if comment exists and user owns it
      const commentDoc = await getDoc(doc(fastify.firestore, 'comments', id));
      
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
      await deleteDoc(doc(fastify.firestore, 'comments', id));

      // Update parent comment count if it's an answer
      if (commentData.parentType === 'answer') {
        const answerDoc = await getDoc(doc(fastify.firestore, 'answers', commentData.parentId));
        if (answerDoc.exists()) {
          const answerData = answerDoc.data();
          await updateDoc(doc(fastify.firestore, 'answers', commentData.parentId), {
            commentCount: Math.max(0, (answerData.commentCount || 1) - 1),
            updatedAt: Timestamp.now()
          });
        }
      }

      // Delete any replies to this comment
      const repliesRef = collection(fastify.firestore, 'comments');
      const repliesQuery = query(repliesRef, where('replyToCommentId', '==', id));
      const repliesSnapshot = await getDocs(repliesQuery);
      
      const deletePromises = [];
      repliesSnapshot.forEach((doc) => {
        deletePromises.push(deleteDoc(doc.ref));
      });
      await Promise.all(deletePromises);

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

  // Get replies to a specific comment
  fastify.get('/:id/replies', {
    schema: {
      tags: ['comments'],
      description: 'Get replies to a specific comment',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' }
        }
      },
      querystring: {
        type: 'object',
        properties: {
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
                  content: { type: 'string' },
                  parentId: { type: 'string' },
                  parentType: { type: 'string' },
                  authorUsername: { type: 'string' },
                  authorRole: { type: 'string' },
                  taggedUsers: { type: 'array', items: { type: 'string' } },
                  replyToCommentId: { type: 'string' },
                  createdAt: { type: 'string' },
                  updatedAt: { type: 'string' }
                }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { id } = request.params;
    const { limit: queryLimit = 20 } = request.query;

    try {
      const commentsRef = collection(fastify.firestore, 'comments');
      const q = query(
        commentsRef,
        where('replyToCommentId', '==', id),
        orderBy('createdAt', 'asc'),
        limit(queryLimit)
      );

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
        message: 'Failed to fetch comment replies'
      });
    }
  });

  // Get tagged users for notifications
  fastify.get('/tagged/:username', {
    schema: {
      tags: ['comments'],
      description: 'Get comments where a user is tagged',
      headers: {
        type: 'object',
        properties: {
          authorization: { type: 'string' }
        }
      },
      params: {
        type: 'object',
        required: ['username'],
        properties: {
          username: { type: 'string' }
        }
      },
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'number', minimum: 1, maximum: 100, default: 20 }
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
                  content: { type: 'string' },
                  parentId: { type: 'string' },
                  parentType: { type: 'string' },
                  authorUsername: { type: 'string' },
                  authorRole: { type: 'string' },
                  createdAt: { type: 'string' }
                }
              }
            }
          }
        }
      }
    },
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { username } = request.params;
    const { limit: queryLimit = 20 } = request.query;
    const user = request.user;

    // Users can only see their own tagged comments
    if (user.username !== username) {
      return reply.code(403).send({
        error: 'UNAUTHORIZED',
        message: 'You can only view your own tagged comments'
      });
    }

    try {
      const commentsRef = collection(fastify.firestore, 'comments');
      const q = query(
        commentsRef,
        where('taggedUsers', 'array-contains', username),
        orderBy('createdAt', 'desc'),
        limit(queryLimit)
      );

      const querySnapshot = await getDocs(q);
      const comments = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        comments.push({
          id: doc.id,
          content: data.content,
          parentId: data.parentId,
          parentType: data.parentType,
          authorUsername: data.authorUsername,
          authorRole: data.authorRole,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt
        });
      });

      return { comments };

    } catch (error) {
      fastify.log.error('Error fetching tagged comments:', error);
      return reply.code(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to fetch tagged comments'
      });
    }
  });
};

export default commentsRoutes;