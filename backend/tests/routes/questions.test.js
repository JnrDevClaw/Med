import { jest } from '@jest/globals';
import { build } from '../helpers/app.js';

describe('Questions Routes', () => {
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

  describe('GET /questions - Question Retrieval', () => {
    const mockQuestions = [
      {
        id: 'q1',
        title: 'Test Question 1',
        content: 'Test content 1',
        category: 'general',
        authorUsername: 'user1',
        authorRole: 'patient',
        upvotes: 5,
        downvotes: 1,
        answerCount: 2,
        tags: ['test'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'q2',
        title: 'Test Question 2',
        content: 'Test content 2',
        category: 'cardiology',
        authorUsername: 'doctor1',
        authorRole: 'doctor',
        upvotes: 10,
        downvotes: 0,
        answerCount: 5,
        tags: ['heart'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    test('should retrieve questions with default sorting (newest)', async () => {
      const mockSnapshot = {
        forEach: jest.fn((callback) => {
          mockQuestions.forEach((q, index) => {
            callback({ id: q.id, data: () => ({ ...q, createdAt: { toDate: () => new Date(q.createdAt) } }) }, index);
          });
        }),
        size: mockQuestions.length
      };

      mockFirestore.collection.mockReturnValue('questions');
      mockFirestore.query.mockReturnValue('query');
      mockFirestore.orderBy.mockReturnValue('ordered');
      mockFirestore.limit.mockReturnValue('limited');
      mockFirestore.getDocs.mockResolvedValue(mockSnapshot);

      const response = await app.inject({
        method: 'GET',
        url: '/questions'
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.questions).toHaveLength(2);
      expect(data.questions[0].title).toBe('Test Question 1');
      expect(data.pagination).toBeDefined();
    });

    test('should filter questions by category', async () => {
      const cardiologyQuestions = mockQuestions.filter(q => q.category === 'cardiology');
      const mockSnapshot = {
        forEach: jest.fn((callback) => {
          cardiologyQuestions.forEach((q, index) => {
            callback({ id: q.id, data: () => ({ ...q, createdAt: { toDate: () => new Date(q.createdAt) } }) }, index);
          });
        }),
        size: cardiologyQuestions.length
      };

      mockFirestore.where.mockReturnValue('filtered');
      mockFirestore.getDocs.mockResolvedValue(mockSnapshot);

      const response = await app.inject({
        method: 'GET',
        url: '/questions?category=cardiology'
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.questions).toHaveLength(1);
      expect(data.questions[0].category).toBe('cardiology');
    });

    test('should sort questions by upvotes', async () => {
      const sortedQuestions = [...mockQuestions].sort((a, b) => b.upvotes - a.upvotes);
      const mockSnapshot = {
        forEach: jest.fn((callback) => {
          sortedQuestions.forEach((q, index) => {
            callback({ id: q.id, data: () => ({ ...q, createdAt: { toDate: () => new Date(q.createdAt) } }) }, index);
          });
        }),
        size: sortedQuestions.length
      };

      mockFirestore.getDocs.mockResolvedValue(mockSnapshot);

      const response = await app.inject({
        method: 'GET',
        url: '/questions?sortBy=upvotes'
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.questions[0].upvotes).toBeGreaterThanOrEqual(data.questions[1].upvotes);
    });

    test('should handle pagination correctly', async () => {
      const mockSnapshot = {
        forEach: jest.fn((callback) => {
          // Return 21 items to test hasNext
          for (let i = 0; i < 21; i++) {
            callback({ 
              id: `q${i}`, 
              data: () => ({ 
                ...mockQuestions[0], 
                id: `q${i}`,
                createdAt: { toDate: () => new Date() }
              }) 
            }, i);
          }
        }),
        size: 100
      };

      mockFirestore.getDocs.mockResolvedValue(mockSnapshot);

      const response = await app.inject({
        method: 'GET',
        url: '/questions?limit=20&page=1'
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.questions).toHaveLength(20);
      expect(data.pagination.hasNext).toBe(true);
      expect(data.pagination.page).toBe(1);
      expect(data.pagination.limit).toBe(20);
    });

    test('should handle search functionality', async () => {
      const searchResults = mockQuestions.filter(q => 
        q.title.toLowerCase().includes('test') || q.content.toLowerCase().includes('test')
      );
      const mockSnapshot = {
        forEach: jest.fn((callback) => {
          searchResults.forEach((q, index) => {
            callback({ id: q.id, data: () => ({ ...q, createdAt: { toDate: () => new Date(q.createdAt) } }) }, index);
          });
        }),
        size: searchResults.length
      };

      mockFirestore.getDocs.mockResolvedValue(mockSnapshot);

      const response = await app.inject({
        method: 'GET',
        url: '/questions?search=test'
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.questions.length).toBeGreaterThan(0);
    });
  });

  describe('GET /questions/:id - Single Question Retrieval', () => {
    test('should retrieve single question by ID', async () => {
      const mockQuestion = {
        id: 'q1',
        title: 'Test Question',
        content: 'Test content',
        category: 'general',
        authorUsername: 'testuser',
        authorRole: 'patient',
        upvotes: 5,
        downvotes: 1,
        answerCount: 2,
        tags: ['test'],
        createdAt: { toDate: () => new Date() },
        updatedAt: { toDate: () => new Date() }
      };

      const mockDoc = {
        exists: () => true,
        id: 'q1',
        data: () => mockQuestion
      };

      mockFirestore.doc.mockReturnValue('doc');
      mockFirestore.getDoc.mockResolvedValue(mockDoc);

      const response = await app.inject({
        method: 'GET',
        url: '/questions/q1'
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.id).toBe('q1');
      expect(data.title).toBe('Test Question');
    });

    test('should return 404 for non-existent question', async () => {
      const mockDoc = {
        exists: () => false
      };

      mockFirestore.getDoc.mockResolvedValue(mockDoc);

      const response = await app.inject({
        method: 'GET',
        url: '/questions/nonexistent'
      });

      expect(response.statusCode).toBe(404);
      const data = JSON.parse(response.payload);
      expect(data.error).toBe('QUESTION_NOT_FOUND');
    });
  });

  describe('POST /questions - Question Creation', () => {
    test('should create question successfully', async () => {
      const newQuestion = {
        title: 'New Test Question',
        content: 'This is a test question content',
        category: 'general',
        tags: ['test', 'new']
      };

      const mockDocRef = { id: 'new-question-id' };
      mockFirestore.addDoc.mockResolvedValue(mockDocRef);
      mockFirestore.Timestamp.now.mockReturnValue({ toDate: () => new Date() });

      const response = await app.inject({
        method: 'POST',
        url: '/questions',
        headers: {
          authorization: 'Bearer valid-token'
        },
        payload: newQuestion
      });

      expect(response.statusCode).toBe(201);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.question.title).toBe(newQuestion.title);
      expect(data.question.authorUsername).toBe('testuser');
      expect(data.question.upvotes).toBe(0);
      expect(data.question.downvotes).toBe(0);
    });

    test('should validate required fields', async () => {
      const invalidQuestion = {
        title: 'Test', // Too short
        content: 'Short', // Too short
        category: ''
      };

      const response = await app.inject({
        method: 'POST',
        url: '/questions',
        headers: {
          authorization: 'Bearer valid-token'
        },
        payload: invalidQuestion
      });

      expect(response.statusCode).toBe(400);
    });

    test('should require authentication', async () => {
      const newQuestion = {
        title: 'New Test Question',
        content: 'This is a test question content',
        category: 'general'
      };

      const response = await app.inject({
        method: 'POST',
        url: '/questions',
        payload: newQuestion
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('PUT /questions/:id - Question Updates', () => {
    test('should update question successfully by owner', async () => {
      const mockQuestion = {
        authorUsername: 'testuser',
        title: 'Original Title',
        content: 'Original content'
      };

      const mockDoc = {
        exists: () => true,
        data: () => mockQuestion
      };

      const updatedData = {
        title: 'Updated Title',
        content: 'Updated content'
      };

      mockFirestore.getDoc.mockResolvedValue(mockDoc);
      mockFirestore.updateDoc.mockResolvedValue();

      const response = await app.inject({
        method: 'PUT',
        url: '/questions/q1',
        headers: {
          authorization: 'Bearer valid-token'
        },
        payload: updatedData
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(mockFirestore.updateDoc).toHaveBeenCalled();
    });

    test('should prevent unauthorized updates', async () => {
      const mockQuestion = {
        authorUsername: 'otheruser',
        title: 'Original Title'
      };

      const mockDoc = {
        exists: () => true,
        data: () => mockQuestion
      };

      mockFirestore.getDoc.mockResolvedValue(mockDoc);

      const response = await app.inject({
        method: 'PUT',
        url: '/questions/q1',
        headers: {
          authorization: 'Bearer valid-token'
        },
        payload: { title: 'Updated Title' }
      });

      expect(response.statusCode).toBe(403);
      const data = JSON.parse(response.payload);
      expect(data.error).toBe('UNAUTHORIZED');
    });
  });

  describe('DELETE /questions/:id - Question Deletion', () => {
    test('should delete question successfully by owner', async () => {
      const mockQuestion = {
        authorUsername: 'testuser'
      };

      const mockDoc = {
        exists: () => true,
        data: () => mockQuestion
      };

      mockFirestore.getDoc.mockResolvedValue(mockDoc);
      mockFirestore.deleteDoc.mockResolvedValue();

      const response = await app.inject({
        method: 'DELETE',
        url: '/questions/q1',
        headers: {
          authorization: 'Bearer valid-token'
        }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(mockFirestore.deleteDoc).toHaveBeenCalled();
    });

    test('should prevent unauthorized deletion', async () => {
      const mockQuestion = {
        authorUsername: 'otheruser'
      };

      const mockDoc = {
        exists: () => true,
        data: () => mockQuestion
      };

      mockFirestore.getDoc.mockResolvedValue(mockDoc);

      const response = await app.inject({
        method: 'DELETE',
        url: '/questions/q1',
        headers: {
          authorization: 'Bearer valid-token'
        }
      });

      expect(response.statusCode).toBe(403);
      const data = JSON.parse(response.payload);
      expect(data.error).toBe('UNAUTHORIZED');
    });
  });

  describe('POST /questions/:id/vote - Voting System', () => {
    test('should record upvote successfully', async () => {
      const mockQuestion = {
        upvotes: 5,
        downvotes: 1
      };

      const mockDoc = {
        exists: () => true,
        data: () => mockQuestion
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
        url: '/questions/q1/vote',
        headers: {
          authorization: 'Bearer valid-token'
        },
        payload: { voteType: 'upvote' }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.vote.voteType).toBe('upvote');
      expect(data.vote.upvotes).toBe(6);
    });

    test('should handle vote changes (upvote to downvote)', async () => {
      const mockQuestion = {
        upvotes: 5,
        downvotes: 1
      };

      const mockDoc = {
        exists: () => true,
        data: () => mockQuestion
      };

      const existingVote = {
        ref: 'vote-ref',
        data: () => ({ voteType: 'upvote' })
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
        url: '/questions/q1/vote',
        headers: {
          authorization: 'Bearer valid-token'
        },
        payload: { voteType: 'downvote' }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.vote.upvotes).toBe(4); // Removed upvote
      expect(data.vote.downvotes).toBe(2); // Added downvote
    });

    test('should remove vote when voting same type twice', async () => {
      const mockQuestion = {
        upvotes: 5,
        downvotes: 1
      };

      const mockDoc = {
        exists: () => true,
        data: () => mockQuestion
      };

      const existingVote = {
        ref: 'vote-ref',
        data: () => ({ voteType: 'upvote' })
      };

      const mockVoteSnapshot = {
        empty: false,
        docs: [existingVote]
      };

      mockFirestore.getDoc.mockResolvedValue(mockDoc);
      mockFirestore.getDocs.mockResolvedValue(mockVoteSnapshot);
      mockFirestore.deleteDoc.mockResolvedValue();
      mockFirestore.updateDoc.mockResolvedValue();

      const response = await app.inject({
        method: 'POST',
        url: '/questions/q1/vote',
        headers: {
          authorization: 'Bearer valid-token'
        },
        payload: { voteType: 'upvote' }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.vote.voteType).toBe('removed');
      expect(data.vote.upvotes).toBe(4); // Removed upvote
    });
  });

  describe('GET /questions/:id/vote - User Vote Retrieval', () => {
    test('should return user vote if exists', async () => {
      const mockVote = {
        voteType: 'upvote',
        createdAt: { toDate: () => new Date() }
      };

      const mockVoteSnapshot = {
        empty: false,
        docs: [{ data: () => mockVote }]
      };

      mockFirestore.getDocs.mockResolvedValue(mockVoteSnapshot);

      const response = await app.inject({
        method: 'GET',
        url: '/questions/q1/vote',
        headers: {
          authorization: 'Bearer valid-token'
        }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.vote.voteType).toBe('upvote');
    });

    test('should return null if no vote exists', async () => {
      const mockVoteSnapshot = {
        empty: true,
        docs: []
      };

      mockFirestore.getDocs.mockResolvedValue(mockVoteSnapshot);

      const response = await app.inject({
        method: 'GET',
        url: '/questions/q1/vote',
        headers: {
          authorization: 'Bearer valid-token'
        }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.vote).toBeNull();
    });
  });

  describe('GET /questions/categories/list - Categories', () => {
    test('should return question categories with counts', async () => {
      const mockQuestions = [
        { data: () => ({ category: 'general' }) },
        { data: () => ({ category: 'general' }) },
        { data: () => ({ category: 'cardiology' }) }
      ];

      const mockSnapshot = {
        forEach: jest.fn((callback) => {
          mockQuestions.forEach(callback);
        })
      };

      mockFirestore.getDocs.mockResolvedValue(mockSnapshot);

      const response = await app.inject({
        method: 'GET',
        url: '/questions/categories/list'
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.categories).toHaveLength(2);
      expect(data.categories.find(c => c.name === 'general').count).toBe(2);
      expect(data.categories.find(c => c.name === 'cardiology').count).toBe(1);
    });
  });

  describe('Error Handling', () => {
    test('should handle Firestore errors gracefully', async () => {
      mockFirestore.getDocs.mockRejectedValue(new Error('Firestore connection failed'));

      const response = await app.inject({
        method: 'GET',
        url: '/questions'
      });

      expect(response.statusCode).toBe(500);
      const data = JSON.parse(response.payload);
      expect(data.error).toBe('INTERNAL_ERROR');
      expect(data.message).toBe('Failed to fetch questions');
    });

    test('should validate vote type', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/questions/q1/vote',
        headers: {
          authorization: 'Bearer valid-token'
        },
        payload: { voteType: 'invalid' }
      });

      expect(response.statusCode).toBe(400);
    });
  });
});