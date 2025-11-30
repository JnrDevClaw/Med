import { jest } from '@jest/globals';
import { build } from '../helpers/app.js';

describe('Answers Routes', () => {
  let app;
  let mockFirestore;
  let mockAuth;

  beforeAll(async () => {
    // Mock Firestore
    mockFirestore = {
      collection: jest.fn(),
      doc: jest.fn(),
      query: jest.fn(),
      where: jest.fn(),
      orderBy: jest.fn(),
      limit: jest.fn(),
      getDocs: jest.fn(),
      getDoc: jest.fn(),
      addDoc: jest.fn(),
      updateDoc: jest.fn(),
      deleteDoc: jest.fn(),
      Timestamp: {
        now: jest.fn(() => ({ toDate: () => new Date() }))
      }
    };

    // Mock authentication
    mockAuth = {
      authenticate: jest.fn((request, reply, done) => {
        request.user = { username: 'testuser', role: 'patient' };
        done();
      })
    };

    app = await build({
      firestore: mockFirestore,
      authenticate: mockAuth.authenticate
    });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /answers/question/:questionId - Answer Retrieval', () => {
    const mockAnswers = [
      {
        id: 'a1',
        content: 'This is a helpful answer',
        questionId: 'q1',
        authorUsername: 'doctor1',
        authorRole: 'doctor',
        upvotes: 10,
        downvotes: 1,
        isAccepted: true,
        commentCount: 3,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'a2',
        content: 'Another answer',
        questionId: 'q1',
        authorUsername: 'patient1',
        authorRole: 'patient',
        upvotes: 5,
        downvotes: 0,
        isAccepted: false,
        commentCount: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    test('should retrieve answers for a question with default sorting', async () => {
      const mockSnapshot = {
        forEach: jest.fn((callback) => {
          mockAnswers.forEach((answer, index) => {
            callback({ 
              id: answer.id, 
              data: () => ({ 
                ...answer, 
                createdAt: { toDate: () => new Date(answer.createdAt) },
                updatedAt: { toDate: () => new Date(answer.updatedAt) }
              }) 
            }, index);
          });
        })
      };

      mockFirestore.collection.mockReturnValue('answers');
      mockFirestore.query.mockReturnValue('query');
      mockFirestore.where.mockReturnValue('filtered');
      mockFirestore.orderBy.mockReturnValue('ordered');
      mockFirestore.limit.mockReturnValue('limited');
      mockFirestore.getDocs.mockResolvedValue(mockSnapshot);

      const response = await app.inject({
        method: 'GET',
        url: '/answers/question/q1'
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.answers).toHaveLength(2);
      expect(data.answers[0].isAccepted).toBe(true); // Accepted answers first
    });

    test('should sort answers by upvotes', async () => {
      const sortedAnswers = [...mockAnswers].sort((a, b) => {
        if (a.isAccepted !== b.isAccepted) return b.isAccepted - a.isAccepted;
        return b.upvotes - a.upvotes;
      });

      const mockSnapshot = {
        forEach: jest.fn((callback) => {
          sortedAnswers.forEach((answer, index) => {
            callback({ 
              id: answer.id, 
              data: () => ({ 
                ...answer, 
                createdAt: { toDate: () => new Date(answer.createdAt) },
                updatedAt: { toDate: () => new Date(answer.updatedAt) }
              }) 
            }, index);
          });
        })
      };

      mockFirestore.getDocs.mockResolvedValue(mockSnapshot);

      const response = await app.inject({
        method: 'GET',
        url: '/answers/question/q1?sortBy=upvotes'
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.answers[0].isAccepted).toBe(true);
      expect(data.answers[0].upvotes).toBeGreaterThanOrEqual(data.answers[1].upvotes);
    });

    test('should sort answers by oldest first', async () => {
      const mockSnapshot = {
        forEach: jest.fn((callback) => {
          mockAnswers.forEach((answer, index) => {
            callback({ 
              id: answer.id, 
              data: () => ({ 
                ...answer, 
                createdAt: { toDate: () => new Date(answer.createdAt) },
                updatedAt: { toDate: () => new Date(answer.updatedAt) }
              }) 
            }, index);
          });
        })
      };

      mockFirestore.getDocs.mockResolvedValue(mockSnapshot);

      const response = await app.inject({
        method: 'GET',
        url: '/answers/question/q1?sortBy=oldest'
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.answers).toHaveLength(2);
    });

    test('should limit number of answers returned', async () => {
      const mockSnapshot = {
        forEach: jest.fn((callback) => {
          mockAnswers.slice(0, 1).forEach((answer, index) => {
            callback({ 
              id: answer.id, 
              data: () => ({ 
                ...answer, 
                createdAt: { toDate: () => new Date(answer.createdAt) },
                updatedAt: { toDate: () => new Date(answer.updatedAt) }
              }) 
            }, index);
          });
        })
      };

      mockFirestore.getDocs.mockResolvedValue(mockSnapshot);

      const response = await app.inject({
        method: 'GET',
        url: '/answers/question/q1?limit=1'
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.answers).toHaveLength(1);
    });
  });

  describe('POST /answers - Answer Creation', () => {
    test('should create answer successfully', async () => {
      const newAnswer = {
        content: 'This is a new answer to the question',
        questionId: 'q1'
      };

      const mockQuestion = {
        exists: () => true,
        data: () => ({ answerCount: 2 })
      };

      const mockDocRef = { id: 'new-answer-id' };

      mockFirestore.getDoc.mockResolvedValue(mockQuestion);
      mockFirestore.addDoc.mockResolvedValue(mockDocRef);
      mockFirestore.updateDoc.mockResolvedValue();
      mockFirestore.Timestamp.now.mockReturnValue({ toDate: () => new Date() });

      const response = await app.inject({
        method: 'POST',
        url: '/answers',
        headers: {
          authorization: 'Bearer valid-token'
        },
        payload: newAnswer
      });

      expect(response.statusCode).toBe(201);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.answer.content).toBe(newAnswer.content);
      expect(data.answer.authorUsername).toBe('testuser');
      expect(data.answer.upvotes).toBe(0);
      expect(data.answer.isAccepted).toBe(false);
      expect(mockFirestore.updateDoc).toHaveBeenCalled(); // Question answer count updated
    });

    test('should return 404 if question does not exist', async () => {
      const newAnswer = {
        content: 'This is a new answer',
        questionId: 'nonexistent'
      };

      const mockQuestion = {
        exists: () => false
      };

      mockFirestore.getDoc.mockResolvedValue(mockQuestion);

      const response = await app.inject({
        method: 'POST',
        url: '/answers',
        headers: {
          authorization: 'Bearer valid-token'
        },
        payload: newAnswer
      });

      expect(response.statusCode).toBe(404);
      const data = JSON.parse(response.payload);
      expect(data.error).toBe('QUESTION_NOT_FOUND');
    });

    test('should validate answer content length', async () => {
      const invalidAnswer = {
        content: 'Short', // Too short
        questionId: 'q1'
      };

      const response = await app.inject({
        method: 'POST',
        url: '/answers',
        headers: {
          authorization: 'Bearer valid-token'
        },
        payload: invalidAnswer
      });

      expect(response.statusCode).toBe(400);
    });

    test('should require authentication', async () => {
      const newAnswer = {
        content: 'This is a new answer to the question',
        questionId: 'q1'
      };

      const response = await app.inject({
        method: 'POST',
        url: '/answers',
        payload: newAnswer
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('POST /answers/:id/vote - Answer Voting', () => {
    test('should record upvote on answer successfully', async () => {
      const mockAnswer = {
        upvotes: 3,
        downvotes: 1
      };

      const mockDoc = {
        exists: () => true,
        data: () => mockAnswer
      };

      const mockVoteSnapshot = {
        empty: true,
        docs: []
      };

      mockFirestore.getDoc.mockResolvedValue(mockDoc);
      mockFirestore.getDocs.mockResolvedValue(mockVoteSnapshot);
      mockFirestore.addDoc.mockResolvedValue({ id: 'vote-id' });
      mockFirestore.updateDoc.mockResolvedValue();

      const response = await app.inject({
        method: 'POST',
        url: '/answers/a1/vote',
        headers: {
          authorization: 'Bearer valid-token'
        },
        payload: { voteType: 'upvote' }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.vote.voteType).toBe('upvote');
      expect(data.vote.upvotes).toBe(4);
    });

    test('should handle vote changes on answers', async () => {
      const mockAnswer = {
        upvotes: 3,
        downvotes: 1
      };

      const mockDoc = {
        exists: () => true,
        data: () => mockAnswer
      };

      const existingVote = {
        ref: 'vote-ref',
        data: () => ({ voteType: 'downvote' })
      };

      const mockVoteSnapshot = {
        empty: false,
        docs: [existingVote]
      };

      mockFirestore.getDoc.mockResolvedValue(mockDoc);
      mockFirestore.getDocs.mockResolvedValue(mockVoteSnapshot);
      mockFirestore.updateDoc.mockResolvedValue();

      const response = await app.inject({
        method: 'POST',
        url: '/answers/a1/vote',
        headers: {
          authorization: 'Bearer valid-token'
        },
        payload: { voteType: 'upvote' }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.vote.upvotes).toBe(4); // Added upvote
      expect(data.vote.downvotes).toBe(0); // Removed downvote
    });

    test('should return 404 for non-existent answer', async () => {
      const mockDoc = {
        exists: () => false
      };

      mockFirestore.getDoc.mockResolvedValue(mockDoc);

      const response = await app.inject({
        method: 'POST',
        url: '/answers/nonexistent/vote',
        headers: {
          authorization: 'Bearer valid-token'
        },
        payload: { voteType: 'upvote' }
      });

      expect(response.statusCode).toBe(404);
      const data = JSON.parse(response.payload);
      expect(data.error).toBe('ANSWER_NOT_FOUND');
    });
  });

  describe('POST /answers/:id/accept - Answer Acceptance', () => {
    test('should accept answer by question author', async () => {
      const mockAnswer = {
        questionId: 'q1',
        isAccepted: false
      };

      const mockQuestion = {
        exists: () => true,
        data: () => ({ authorUsername: 'testuser' })
      };

      const mockAnswerDoc = {
        exists: () => true,
        data: () => mockAnswer
      };

      // Mock other accepted answers query
      const mockOtherAnswers = {
        forEach: jest.fn((callback) => {
          // No other accepted answers
        })
      };

      mockFirestore.getDoc
        .mockResolvedValueOnce(mockAnswerDoc) // Get answer
        .mockResolvedValueOnce(mockQuestion); // Get question
      mockFirestore.getDocs.mockResolvedValue(mockOtherAnswers);
      mockFirestore.updateDoc.mockResolvedValue();

      const response = await app.inject({
        method: 'POST',
        url: '/answers/a1/accept',
        headers: {
          authorization: 'Bearer valid-token'
        },
        payload: { isAccepted: true }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.isAccepted).toBe(true);
      expect(data.message).toBe('Answer accepted successfully');
    });

    test('should unaccept answer by question author', async () => {
      const mockAnswer = {
        questionId: 'q1',
        isAccepted: true
      };

      const mockQuestion = {
        exists: () => true,
        data: () => ({ authorUsername: 'testuser' })
      };

      const mockAnswerDoc = {
        exists: () => true,
        data: () => mockAnswer
      };

      mockFirestore.getDoc
        .mockResolvedValueOnce(mockAnswerDoc)
        .mockResolvedValueOnce(mockQuestion);
      mockFirestore.updateDoc.mockResolvedValue();

      const response = await app.inject({
        method: 'POST',
        url: '/answers/a1/accept',
        headers: {
          authorization: 'Bearer valid-token'
        },
        payload: { isAccepted: false }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.isAccepted).toBe(false);
      expect(data.message).toBe('Answer unaccepted successfully');
    });

    test('should prevent non-question-author from accepting answers', async () => {
      const mockAnswer = {
        questionId: 'q1'
      };

      const mockQuestion = {
        exists: () => true,
        data: () => ({ authorUsername: 'otheruser' })
      };

      const mockAnswerDoc = {
        exists: () => true,
        data: () => mockAnswer
      };

      mockFirestore.getDoc
        .mockResolvedValueOnce(mockAnswerDoc)
        .mockResolvedValueOnce(mockQuestion);

      const response = await app.inject({
        method: 'POST',
        url: '/answers/a1/accept',
        headers: {
          authorization: 'Bearer valid-token'
        },
        payload: { isAccepted: true }
      });

      expect(response.statusCode).toBe(403);
      const data = JSON.parse(response.payload);
      expect(data.error).toBe('UNAUTHORIZED');
    });

    test('should unaccept other answers when accepting new one', async () => {
      const mockAnswer = {
        questionId: 'q1',
        isAccepted: false
      };

      const mockQuestion = {
        exists: () => true,
        data: () => ({ authorUsername: 'testuser' })
      };

      const mockAnswerDoc = {
        exists: () => true,
        data: () => mockAnswer
      };

      // Mock other accepted answers
      const otherAcceptedAnswer = {
        id: 'a2',
        ref: 'answer-ref-2'
      };

      const mockOtherAnswers = {
        forEach: jest.fn((callback) => {
          callback(otherAcceptedAnswer);
        })
      };

      mockFirestore.getDoc
        .mockResolvedValueOnce(mockAnswerDoc)
        .mockResolvedValueOnce(mockQuestion);
      mockFirestore.getDocs.mockResolvedValue(mockOtherAnswers);
      mockFirestore.updateDoc.mockResolvedValue();

      const response = await app.inject({
        method: 'POST',
        url: '/answers/a1/accept',
        headers: {
          authorization: 'Bearer valid-token'
        },
        payload: { isAccepted: true }
      });

      expect(response.statusCode).toBe(200);
      expect(mockFirestore.updateDoc).toHaveBeenCalledTimes(2); // Unaccept other + accept current
    });
  });

  describe('PUT /answers/:id - Answer Updates', () => {
    test('should update answer by owner', async () => {
      const mockAnswer = {
        authorUsername: 'testuser',
        content: 'Original content'
      };

      const mockDoc = {
        exists: () => true,
        data: () => mockAnswer
      };

      const updatedContent = 'Updated answer content';

      mockFirestore.getDoc.mockResolvedValue(mockDoc);
      mockFirestore.updateDoc.mockResolvedValue();

      const response = await app.inject({
        method: 'PUT',
        url: '/answers/a1',
        headers: {
          authorization: 'Bearer valid-token'
        },
        payload: { content: updatedContent }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.answer.content).toBe(updatedContent);
      expect(mockFirestore.updateDoc).toHaveBeenCalled();
    });

    test('should prevent unauthorized answer updates', async () => {
      const mockAnswer = {
        authorUsername: 'otheruser'
      };

      const mockDoc = {
        exists: () => true,
        data: () => mockAnswer
      };

      mockFirestore.getDoc.mockResolvedValue(mockDoc);

      const response = await app.inject({
        method: 'PUT',
        url: '/answers/a1',
        headers: {
          authorization: 'Bearer valid-token'
        },
        payload: { content: 'Updated content' }
      });

      expect(response.statusCode).toBe(403);
      const data = JSON.parse(response.payload);
      expect(data.error).toBe('UNAUTHORIZED');
    });
  });

  describe('DELETE /answers/:id - Answer Deletion', () => {
    test('should delete answer by owner', async () => {
      const mockAnswer = {
        authorUsername: 'testuser',
        questionId: 'q1'
      };

      const mockAnswerDoc = {
        exists: () => true,
        data: () => mockAnswer
      };

      const mockQuestion = {
        exists: () => true,
        data: () => ({ answerCount: 3 })
      };

      mockFirestore.getDoc
        .mockResolvedValueOnce(mockAnswerDoc)
        .mockResolvedValueOnce(mockQuestion);
      mockFirestore.deleteDoc.mockResolvedValue();
      mockFirestore.updateDoc.mockResolvedValue();

      const response = await app.inject({
        method: 'DELETE',
        url: '/answers/a1',
        headers: {
          authorization: 'Bearer valid-token'
        }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(mockFirestore.deleteDoc).toHaveBeenCalled();
      expect(mockFirestore.updateDoc).toHaveBeenCalled(); // Question answer count updated
    });

    test('should prevent unauthorized answer deletion', async () => {
      const mockAnswer = {
        authorUsername: 'otheruser'
      };

      const mockDoc = {
        exists: () => true,
        data: () => mockAnswer
      };

      mockFirestore.getDoc.mockResolvedValue(mockDoc);

      const response = await app.inject({
        method: 'DELETE',
        url: '/answers/a1',
        headers: {
          authorization: 'Bearer valid-token'
        }
      });

      expect(response.statusCode).toBe(403);
      const data = JSON.parse(response.payload);
      expect(data.error).toBe('UNAUTHORIZED');
    });
  });

  describe('Error Handling', () => {
    test('should handle Firestore errors gracefully', async () => {
      mockFirestore.getDocs.mockRejectedValue(new Error('Firestore connection failed'));

      const response = await app.inject({
        method: 'GET',
        url: '/answers/question/q1'
      });

      expect(response.statusCode).toBe(500);
      const data = JSON.parse(response.payload);
      expect(data.error).toBe('INTERNAL_ERROR');
      expect(data.message).toBe('Failed to fetch answers');
    });

    test('should validate vote type for answers', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/answers/a1/vote',
        headers: {
          authorization: 'Bearer valid-token'
        },
        payload: { voteType: 'invalid' }
      });

      expect(response.statusCode).toBe(400);
    });

    test('should validate acceptance boolean', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/answers/a1/accept',
        headers: {
          authorization: 'Bearer valid-token'
        },
        payload: { isAccepted: 'not-boolean' }
      });

      expect(response.statusCode).toBe(400);
    });
  });
});