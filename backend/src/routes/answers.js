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

const answersRoutes = async (fastify, opts) => {
  
  // Get answers for a question
  fastify.get('/question/:questionId', {
    schema: {
      tags: ['answers'],
      description: 'Get answers for a specific question',
      params: {
        type: 'object',
        required: ['questionId'],
        properties: {
          questionId: { type: 'string' }
        }
      },
      querystring: {
        type: 'object',
        properties: {
          sortBy: { type: 'string', enum: ['upvotes', 'oldest', 'newest'] },
          limit: { type: 'number', minimum: 1, maximum: 100, default: 20 }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            answers: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  content: { type: 'string' },
                  questionId: { type: 'string' },
                  authorUsername: { type: 'string' },
                  authorRole: { type: 'string' },
                  upvotes: { type: 'number' },
                  downvotes: { type: 'number' },
                  isAccepted: { type: 'boolean' },
                  commentCount: { type: 'number' },
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
    const { questionId } = request.params;
    const { sortBy = 'upvotes', limit: queryLimit = 20 } = request.query;

    try {
      const answersRef = collection(fastify.firestore, 'answers');
      let q = query(answersRef, where('questionId', '==', questionId));

      // Apply sorting
      switch (sortBy) {
        case 'upvotes':
          q = query(q, orderBy('isAccepted', 'desc'), orderBy('upvotes', 'desc'), orderBy('createdAt', 'desc'));
          break;
        case 'oldest':
          q = query(q, orderBy('isAccepted', 'desc'), orderBy('createdAt', 'asc'));
          break;
        case 'newest':
        default:
          q = query(q, orderBy('isAccepted', 'desc'), orderBy('createdAt', 'desc'));
          break;
      }

      q = query(q, limit(queryLimit));

      const querySnapshot = await getDocs(q);
      const answers = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        answers.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt
        });
      });

      return { answers };

    } catch (error) {
      fastify.log.error('Error fetching answers:', error);
      return reply.code(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to fetch answers'
      });
    }
  });

  // Create new answer
  fastify.post('/', {
    schema: {
      tags: ['answers'],
      description: 'Create a new answer',
      headers: {
        type: 'object',
        properties: {
          authorization: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        required: ['content', 'questionId'],
        properties: {
          content: { type: 'string', minLength: 10, maxLength: 5000 },
          questionId: { type: 'string' }
        }
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            answer: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                content: { type: 'string' },
                questionId: { type: 'string' },
                authorUsername: { type: 'string' },
                authorRole: { type: 'string' },
                upvotes: { type: 'number' },
                downvotes: { type: 'number' },
                isAccepted: { type: 'boolean' },
                commentCount: { type: 'number' },
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
    const { content, questionId } = request.body;
    const user = request.user;

    try {
      // Verify question exists
      const questionDoc = await getDoc(doc(fastify.firestore, 'questions', questionId));
      if (!questionDoc.exists()) {
        return reply.code(404).send({
          error: 'QUESTION_NOT_FOUND',
          message: 'Question not found'
        });
      }

      const answerData = {
        content,
        questionId,
        authorUsername: user.username,
        authorRole: user.role,
        upvotes: 0,
        downvotes: 0,
        isAccepted: false,
        commentCount: 0,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      const docRef = await addDoc(collection(fastify.firestore, 'answers'), answerData);

      // Update question answer count
      const questionData = questionDoc.data();
      await updateDoc(doc(fastify.firestore, 'questions', questionId), {
        answerCount: (questionData.answerCount || 0) + 1,
        updatedAt: Timestamp.now()
      });

      // Send notification to question author (if not answering own question)
      if (questionData.authorUsername !== user.username) {
        try {
          await fastify.notificationService.sendQuestionAnsweredNotification(
            questionData.authorUsername,
            user.username,
            questionData.title,
            questionId
          );
        } catch (notificationError) {
          fastify.log.warn('Failed to send answer notification:', notificationError);
        }
      }

      const newAnswer = {
        id: docRef.id,
        ...answerData,
        createdAt: answerData.createdAt.toDate().toISOString(),
        updatedAt: answerData.updatedAt.toDate().toISOString()
      };

      reply.code(201).send({
        success: true,
        message: 'Answer created successfully',
        answer: newAnswer
      });

    } catch (error) {
      fastify.log.error('Error creating answer:', error);
      return reply.code(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to create answer'
      });
    }
  });

  // Vote on answer (upvote/downvote)
  fastify.post('/:id/vote', {
    schema: {
      tags: ['answers'],
      description: 'Vote on an answer (upvote/downvote)',
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
        }
      }
    },
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params;
    const { voteType } = request.body;
    const user = request.user;

    try {
      // Check if answer exists
      const answerDoc = await getDoc(doc(fastify.firestore, 'answers', id));
      
      if (!answerDoc.exists()) {
        return reply.code(404).send({
          error: 'ANSWER_NOT_FOUND',
          message: 'Answer not found'
        });
      }

      // Check if user has already voted on this answer
      const votesRef = collection(fastify.firestore, 'votes');
      const existingVoteQuery = query(
        votesRef,
        where('targetId', '==', id),
        where('targetType', '==', 'answer'),
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
          targetType: 'answer',
          voterUsername: user.username,
          voteType,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        });
        voteChange[voteType === 'upvote' ? 'upvotes' : 'downvotes'] = 1;
      }

      // Update answer vote counts
      const answerData = answerDoc.data();
      const newUpvotes = Math.max(0, (answerData.upvotes || 0) + voteChange.upvotes);
      const newDownvotes = Math.max(0, (answerData.downvotes || 0) + voteChange.downvotes);

      await updateDoc(doc(fastify.firestore, 'answers', id), {
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
      fastify.log.error('Error voting on answer:', error);
      return reply.code(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to record vote'
      });
    }
  });

  // Accept/unaccept answer (only question author can do this)
  fastify.post('/:id/accept', {
    schema: {
      tags: ['answers'],
      description: 'Accept or unaccept an answer (question author only)',
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
        required: ['isAccepted'],
        properties: {
          isAccepted: { type: 'boolean' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            isAccepted: { type: 'boolean' }
          }
        }
      }
    },
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params;
    const { isAccepted } = request.body;
    const user = request.user;

    try {
      // Get answer
      const answerDoc = await getDoc(doc(fastify.firestore, 'answers', id));
      
      if (!answerDoc.exists()) {
        return reply.code(404).send({
          error: 'ANSWER_NOT_FOUND',
          message: 'Answer not found'
        });
      }

      const answerData = answerDoc.data();

      // Get question to verify user is the author
      const questionDoc = await getDoc(doc(fastify.firestore, 'questions', answerData.questionId));
      
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
          message: 'Only the question author can accept answers'
        });
      }

      // If accepting this answer, unaccept all other answers for this question
      if (isAccepted) {
        const answersRef = collection(fastify.firestore, 'answers');
        const otherAnswersQuery = query(
          answersRef,
          where('questionId', '==', answerData.questionId),
          where('isAccepted', '==', true)
        );
        const otherAnswersSnapshot = await getDocs(otherAnswersQuery);
        
        const unacceptPromises = [];
        otherAnswersSnapshot.forEach((doc) => {
          if (doc.id !== id) {
            unacceptPromises.push(updateDoc(doc.ref, {
              isAccepted: false,
              updatedAt: Timestamp.now()
            }));
          }
        });
        await Promise.all(unacceptPromises);
      }

      // Update answer acceptance status
      await updateDoc(doc(fastify.firestore, 'answers', id), {
        isAccepted,
        updatedAt: Timestamp.now()
      });

      return {
        success: true,
        message: isAccepted ? 'Answer accepted successfully' : 'Answer unaccepted successfully',
        isAccepted
      };

    } catch (error) {
      fastify.log.error('Error accepting answer:', error);
      return reply.code(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to update answer acceptance'
      });
    }
  });

  // Update answer
  fastify.put('/:id', {
    schema: {
      tags: ['answers'],
      description: 'Update an answer',
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
          content: { type: 'string', minLength: 10, maxLength: 5000 }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            answer: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                content: { type: 'string' },
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
      // Check if answer exists and user owns it
      const answerDoc = await getDoc(doc(fastify.firestore, 'answers', id));
      
      if (!answerDoc.exists()) {
        return reply.code(404).send({
          error: 'ANSWER_NOT_FOUND',
          message: 'Answer not found'
        });
      }

      const answerData = answerDoc.data();
      if (answerData.authorUsername !== user.username) {
        return reply.code(403).send({
          error: 'UNAUTHORIZED',
          message: 'You can only edit your own answers'
        });
      }

      // Update answer
      await updateDoc(doc(fastify.firestore, 'answers', id), {
        content,
        updatedAt: Timestamp.now()
      });

      return {
        success: true,
        message: 'Answer updated successfully',
        answer: {
          id,
          content,
          updatedAt: new Date().toISOString()
        }
      };

    } catch (error) {
      fastify.log.error('Error updating answer:', error);
      return reply.code(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to update answer'
      });
    }
  });

  // Delete answer
  fastify.delete('/:id', {
    schema: {
      tags: ['answers'],
      description: 'Delete an answer',
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
      // Check if answer exists and user owns it
      const answerDoc = await getDoc(doc(fastify.firestore, 'answers', id));
      
      if (!answerDoc.exists()) {
        return reply.code(404).send({
          error: 'ANSWER_NOT_FOUND',
          message: 'Answer not found'
        });
      }

      const answerData = answerDoc.data();
      if (answerData.authorUsername !== user.username) {
        return reply.code(403).send({
          error: 'UNAUTHORIZED',
          message: 'You can only delete your own answers'
        });
      }

      // Delete answer
      await deleteDoc(doc(fastify.firestore, 'answers', id));

      // Update question answer count
      const questionDoc = await getDoc(doc(fastify.firestore, 'questions', answerData.questionId));
      if (questionDoc.exists()) {
        const questionData = questionDoc.data();
        await updateDoc(doc(fastify.firestore, 'questions', answerData.questionId), {
          answerCount: Math.max(0, (questionData.answerCount || 1) - 1),
          updatedAt: Timestamp.now()
        });
      }

      return {
        success: true,
        message: 'Answer deleted successfully'
      };

    } catch (error) {
      fastify.log.error('Error deleting answer:', error);
      return reply.code(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to delete answer'
      });
    }
  });
};

export default answersRoutes;