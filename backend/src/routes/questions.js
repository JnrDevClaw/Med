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
  startAfter,
  Timestamp,
} from 'firebase/firestore';

const questionsRoutes = async (fastify, opts) => {
  
  // Get all questions with filtering and pagination
  fastify.get('/', {
    schema: {
      tags: ['questions'],
      description: 'Get questions with filtering and pagination',
      querystring: {
        type: 'object',
        properties: {
          category: { type: 'string' },
          sortBy: { type: 'string', enum: ['upvotes', 'oldest', 'newest'] },
          limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
          page: { type: 'number', minimum: 1, default: 1 },
          search: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            questions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  title: { type: 'string' },
                  content: { type: 'string' },
                  category: { type: 'string' },
                  authorUsername: { type: 'string' },
                  authorRole: { type: 'string' },
                  upvotes: { type: 'number' },
                  downvotes: { type: 'number' },
                  answerCount: { type: 'number' },
                  tags: { type: 'array', items: { type: 'string' } },
                  createdAt: { type: 'string' },
                  updatedAt: { type: 'string' }
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
    }
  }, async (request, reply) => {
    const { category, sortBy = 'newest', limit: queryLimit = 20, page = 1, search } = request.query;

    try {
      // Build filters for optimized pagination
      const filters = [];
      
      if (category) {
        filters.push({ field: 'category', operator: '==', value: category });
      }

      if (search) {
        // Note: Firestore doesn't support full-text search natively
        // This is a basic implementation - in production, consider using Algolia or similar
        filters.push({ field: 'title', operator: '>=', value: search });
        filters.push({ field: 'title', operator: '<=', value: search + '\uf8ff' });
      }

      // Determine sort field and direction
      let orderByField = 'createdAt';
      let orderDirection = 'desc';
      
      switch (sortBy) {
        case 'upvotes':
          orderByField = 'upvotes';
          orderDirection = 'desc';
          break;
        case 'oldest':
          orderByField = 'createdAt';
          orderDirection = 'asc';
          break;
        case 'newest':
        default:
          orderByField = 'createdAt';
          orderDirection = 'desc';
          break;
      }

      // Use optimized pagination if available
      let result;
      if (fastify.getPaginatedResults) {
        result = await fastify.getPaginatedResults('questions', {
          filters,
          orderByField,
          orderDirection,
          limit: queryLimit,
          cacheKey: `questions:${category || 'all'}:${sortBy}:${search || 'nosearch'}:${queryLimit}`
        });
      } else {
        // Fallback to original implementation
        const questionsRef = collection(fastify.firestore, 'questions');
        let q = query(questionsRef);

        // Apply filters
        filters.forEach(filter => {
          q = query(q, where(filter.field, filter.operator, filter.value));
        });

        // Apply sorting
        q = query(q, orderBy(orderByField, orderDirection));
      }

      // Apply pagination
      const offset = (page - 1) * queryLimit;
      q = query(q, limit(queryLimit + 1)); // Get one extra to check if there's a next page

      const querySnapshot = await getDocs(q);
      const questions = [];
      let hasNext = false;

      querySnapshot.forEach((doc, index) => {
        if (index < queryLimit) {
          questions.push({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
            updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || doc.data().updatedAt
          });
        } else {
          hasNext = true;
        }
      });

      // Get total count for pagination (this is expensive in Firestore, consider caching)
      const countQuery = query(questionsRef);
      const countSnapshot = await getDocs(countQuery);
      const total = countSnapshot.size;

      return {
        questions,
        pagination: {
          page,
          limit: queryLimit,
          total,
          hasNext
        }
      };

    } catch (error) {
      fastify.log.error('Error fetching questions:', error);
      return reply.code(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to fetch questions'
      });
    }
  });

  // Get single question by ID
  fastify.get('/:id', {
    schema: {
      tags: ['questions'],
      description: 'Get a single question by ID',
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
            authorRole: { type: 'string' },
            upvotes: { type: 'number' },
            downvotes: { type: 'number' },
            answerCount: { type: 'number' },
            tags: { type: 'array', items: { type: 'string' } },
            createdAt: { type: 'string' },
            updatedAt: { type: 'string' }
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
    }
  }, async (request, reply) => {
    const { id } = request.params;

    try {
      const questionDoc = await getDoc(doc(fastify.firestore, 'questions', id));
      
      if (!questionDoc.exists()) {
        return reply.code(404).send({
          error: 'QUESTION_NOT_FOUND',
          message: 'Question not found'
        });
      }

      const questionData = questionDoc.data();
      return {
        id: questionDoc.id,
        ...questionData,
        createdAt: questionData.createdAt?.toDate?.()?.toISOString() || questionData.createdAt,
        updatedAt: questionData.updatedAt?.toDate?.()?.toISOString() || questionData.updatedAt
      };

    } catch (error) {
      fastify.log.error('Error fetching question:', error);
      return reply.code(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to fetch question'
      });
    }
  });

  // Create new question
  fastify.post('/', {
    schema: {
      tags: ['questions'],
      description: 'Create a new question',
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
          content: { type: 'string', minLength: 10, maxLength: 5000 },
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
            question: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                title: { type: 'string' },
                content: { type: 'string' },
                category: { type: 'string' },
                authorUsername: { type: 'string' },
                authorRole: { type: 'string' },
                upvotes: { type: 'number' },
                downvotes: { type: 'number' },
                answerCount: { type: 'number' },
                tags: { type: 'array', items: { type: 'string' } },
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
    const { title, content, category, tags = [] } = request.body;
    const user = request.user;

    try {
      const questionData = {
        title,
        content,
        category,
        tags,
        authorUsername: user.username,
        authorRole: user.role,
        upvotes: 0,
        downvotes: 0,
        answerCount: 0,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      const docRef = await addDoc(collection(fastify.firestore, 'questions'), questionData);

      const newQuestion = {
        id: docRef.id,
        ...questionData,
        createdAt: questionData.createdAt.toDate().toISOString(),
        updatedAt: questionData.updatedAt.toDate().toISOString()
      };

      reply.code(201).send({
        success: true,
        message: 'Question created successfully',
        question: newQuestion
      });

    } catch (error) {
      fastify.log.error('Error creating question:', error);
      return reply.code(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to create question'
      });
    }
  });

  // Update question
  fastify.put('/:id', {
    schema: {
      tags: ['questions'],
      description: 'Update a question',
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
          content: { type: 'string', minLength: 10, maxLength: 5000 },
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
            question: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                title: { type: 'string' },
                content: { type: 'string' },
                category: { type: 'string' },
                authorUsername: { type: 'string' },
                authorRole: { type: 'string' },
                upvotes: { type: 'number' },
                downvotes: { type: 'number' },
                answerCount: { type: 'number' },
                tags: { type: 'array', items: { type: 'string' } },
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
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params;
    const { title, content, category, tags } = request.body;
    const user = request.user;

    try {
      // Check if question exists and user owns it
      const questionDoc = await getDoc(doc(fastify.firestore, 'questions', id));
      
      if (!questionDoc.exists()) {
        return reply.code(404).send({
          error: 'QUESTION_NOT_FOUND',
          message: 'Question not found'
        });
      }

      const questionData = questionDoc.data();
      if (questionData.authorUsername !== user.username) {
        return reply.code(403).send({
          error: 'UNAUTHORIZED',
          message: 'You can only edit your own questions'
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

      // Update question
      await updateDoc(doc(fastify.firestore, 'questions', id), updateData);

      // Get updated question
      const updatedDoc = await getDoc(doc(fastify.firestore, 'questions', id));
      const updatedData = updatedDoc.data();

      return {
        success: true,
        message: 'Question updated successfully',
        question: {
          id: updatedDoc.id,
          ...updatedData,
          createdAt: updatedData.createdAt?.toDate?.()?.toISOString() || updatedData.createdAt,
          updatedAt: updatedData.updatedAt?.toDate?.()?.toISOString() || updatedData.updatedAt
        }
      };

    } catch (error) {
      fastify.log.error('Error updating question:', error);
      return reply.code(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to update question'
      });
    }
  });

  // Delete question
  fastify.delete('/:id', {
    schema: {
      tags: ['questions'],
      description: 'Delete a question',
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
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params;
    const user = request.user;

    try {
      // Check if question exists and user owns it
      const questionDoc = await getDoc(doc(fastify.firestore, 'questions', id));
      
      if (!questionDoc.exists()) {
        return reply.code(404).send({
          error: 'QUESTION_NOT_FOUND',
          message: 'Question not found'
        });
      }

      const questionData = questionDoc.data();
      if (questionData.authorUsername !== user.username) {
        return reply.code(403).send({
          error: 'UNAUTHORIZED',
          message: 'You can only delete your own questions'
        });
      }

      // Delete question
      await deleteDoc(doc(fastify.firestore, 'questions', id));

      // TODO: Also delete associated answers and comments
      // This should be done in a transaction or batch operation

      return {
        success: true,
        message: 'Question deleted successfully'
      };

    } catch (error) {
      fastify.log.error('Error deleting question:', error);
      return reply.code(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to delete question'
      });
    }
  });

  // Vote on question (upvote/downvote)
  fastify.post('/:id/vote', {
    schema: {
      tags: ['questions'],
      description: 'Vote on a question (upvote/downvote)',
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
        required: ['voteType'],
        properties: {
          voteType: { type: 'string', enum: ['upvote', 'downvote'] }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            vote: {
              type: 'object',
              properties: {
                voteType: { type: 'string' },
                upvotes: { type: 'number' },
                downvotes: { type: 'number' }
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
      }
    },
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params;
    const { voteType } = request.body;
    const user = request.user;

    try {
      // Check if question exists
      const questionDoc = await getDoc(doc(fastify.firestore, 'questions', id));
      
      if (!questionDoc.exists()) {
        return reply.code(404).send({
          error: 'QUESTION_NOT_FOUND',
          message: 'Question not found'
        });
      }

      // Check if user has already voted on this question
      const votesRef = collection(fastify.firestore, 'votes');
      const existingVoteQuery = query(
        votesRef,
        where('targetId', '==', id),
        where('targetType', '==', 'question'),
        where('voterUsername', '==', user.username)
      );
      const existingVoteSnapshot = await getDocs(existingVoteQuery);
      
      let voteChange = { upvotes: 0, downvotes: 0 };
      
      if (!existingVoteSnapshot.empty) {
        // User has already voted, update the vote
        const existingVote = existingVoteSnapshot.docs[0];
        const existingVoteData = existingVote.data();
        
        if (existingVoteData.voteType === voteType) {
          // Same vote type, remove the vote
          await deleteDoc(existingVote.ref);
          voteChange[voteType === 'upvote' ? 'upvotes' : 'downvotes'] = -1;
        } else {
          // Different vote type, update the vote
          await updateDoc(existingVote.ref, {
            voteType,
            updatedAt: Timestamp.now()
          });
          // Remove old vote and add new vote
          voteChange[existingVoteData.voteType === 'upvote' ? 'upvotes' : 'downvotes'] = -1;
          voteChange[voteType === 'upvote' ? 'upvotes' : 'downvotes'] = 1;
        }
      } else {
        // New vote
        await addDoc(votesRef, {
          targetId: id,
          targetType: 'question',
          voterUsername: user.username,
          voteType,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        });
        voteChange[voteType === 'upvote' ? 'upvotes' : 'downvotes'] = 1;
      }

      // Update question vote counts
      const questionData = questionDoc.data();
      const newUpvotes = Math.max(0, (questionData.upvotes || 0) + voteChange.upvotes);
      const newDownvotes = Math.max(0, (questionData.downvotes || 0) + voteChange.downvotes);

      await updateDoc(doc(fastify.firestore, 'questions', id), {
        upvotes: newUpvotes,
        downvotes: newDownvotes,
        updatedAt: Timestamp.now()
      });

      return {
        success: true,
        message: 'Vote recorded successfully',
        vote: {
          voteType: voteChange.upvotes > 0 ? 'upvote' : voteChange.downvotes > 0 ? 'downvote' : 'removed',
          upvotes: newUpvotes,
          downvotes: newDownvotes
        }
      };

    } catch (error) {
      fastify.log.error('Error voting on question:', error);
      return reply.code(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to record vote'
      });
    }
  });

  // Get user's vote on a question
  fastify.get('/:id/vote', {
    schema: {
      tags: ['questions'],
      description: 'Get user\'s vote on a question',
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
            vote: {
              type: ['object', 'null'],
              properties: {
                voteType: { type: 'string' },
                createdAt: { type: 'string' }
              }
            }
          }
        }
      }
    },
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params;
    const user = request.user;

    try {
      const votesRef = collection(fastify.firestore, 'votes');
      const voteQuery = query(
        votesRef,
        where('targetId', '==', id),
        where('targetType', '==', 'question'),
        where('voterUsername', '==', user.username)
      );
      const voteSnapshot = await getDocs(voteQuery);
      
      if (voteSnapshot.empty) {
        return { vote: null };
      }

      const voteData = voteSnapshot.docs[0].data();
      return {
        vote: {
          voteType: voteData.voteType,
          createdAt: voteData.createdAt?.toDate?.()?.toISOString() || voteData.createdAt
        }
      };

    } catch (error) {
      fastify.log.error('Error fetching user vote:', error);
      return reply.code(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to fetch vote'
      });
    }
  });

  // Get question categories
  fastify.get('/categories/list', {
    schema: {
      tags: ['questions'],
      description: 'Get list of available question categories',
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
    }
  }, async (request, reply) => {
    try {
      // Get all questions to count categories
      // In production, consider maintaining a separate categories collection
      const questionsRef = collection(fastify.firestore, 'questions');
      const querySnapshot = await getDocs(questionsRef);
      
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
      fastify.log.error('Error fetching categories:', error);
      return reply.code(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to fetch categories'
      });
    }
  });
};

export default questionsRoutes;