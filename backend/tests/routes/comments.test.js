import { jest } from '@jest/globals';
import { build } from '../helpers/app.js';

describe('Comments Routes', () => {
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

  describe('GET /comments/:parentType/:parentId - Comment Retrieval', () => {
    const mockComments = [
      {
        id: 'c1',
        content: 'This is a helpful comment @doctor1',
        parentId: 'q1',
        parentType: 'question',
        authorUsername: 'patient1',
        authorRole: 'patient',
        taggedUsers: ['doctor1'],
        replyToCommentId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'c2',
        content: 'I agree with this comment',
        parentId: 'q1',
        parentType: 'question',
        authorUsername: 'doctor1',
        authorRole: 'doctor',
        taggedUsers: [],
        replyToCommentId: 'c1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    test('should retrieve comments for a question', async () => {
      const mockSnapshot = {
        forEach: jest.fn((callback) => {
          mockComments.forEach((comment, index) => {
            callback({ 
              id: comment.id, 
              data: () => ({ 
                ...comment, 
                createdAt: { toDate: () => new Date(comment.createdAt) },
                updatedAt: { toDate: () => new Date(comment.updatedAt) }
              }) 
            }, index);
          });
        })
      };

      mockFirestore.collection.mockReturnValue('comments');
      mockFirestore.query.mockReturnValue('query');
      mockFirestore.where.mockReturnValue('filtered');
      mockFirestore.orderBy.mockReturnValue('ordered');
      mockFirestore.limit.mockReturnValue('limited');
      mockFirestore.getDocs.mockResolvedValue(mockSnapshot);

      const response = await app.inject({
        method: 'GET',
        url: '/comments/question/q1'
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.comments).toHaveLength(2);
      expect(data.comments[0].parentType).toBe('question');
      expect(data.comments[0].parentId).toBe('q1');
    });

    test('should retrieve comments for an answer', async () => {
      const answerComments = mockComments.map(c => ({ ...c, parentType: 'answer', parentId: 'a1' }));
      const mockSnapshot = {
        forEach: jest.fn((callback) => {
          answerComments.forEach((comment, index) => {
            callback({ 
              id: comment.id, 
              data: () => ({ 
                ...comment, 
                createdAt: { toDate: () => new Date(comment.createdAt) },
                updatedAt: { toDate: () => new Date(comment.updatedAt) }
              }) 
            }, index);
          });
        })
      };

      mockFirestore.getDocs.mockResolvedValue(mockSnapshot);

      const response = await app.inject({
        method: 'GET',
        url: '/comments/answer/a1'
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.comments).toHaveLength(2);
      expect(data.comments[0].parentType).toBe('answer');
      expect(data.comments[0].parentId).toBe('a1');
    });

    test('should limit number of comments returned', async () => {
      const mockSnapshot = {
        forEach: jest.fn((callback) => {
          mockComments.slice(0, 1).forEach((comment, index) => {
            callback({ 
              id: comment.id, 
              data: () => ({ 
                ...comment, 
                createdAt: { toDate: () => new Date(comment.createdAt) },
                updatedAt: { toDate: () => new Date(comment.updatedAt) }
              }) 
            }, index);
          });
        })
      };

      mockFirestore.getDocs.mockResolvedValue(mockSnapshot);

      const response = await app.inject({
        method: 'GET',
        url: '/comments/question/q1?limit=1'
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.comments).toHaveLength(1);
    });

    test('should validate parent type', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/comments/invalid/q1'
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /comments - Comment Creation', () => {
    test('should create comment on question successfully', async () => {
      const newComment = {
        content: 'This is a new comment @doctor1',
        parentId: 'q1',
        parentType: 'question'
      };

      const mockParent = {
        exists: () => true,
        data: () => ({ title: 'Test Question' })
      };

      const mockDocRef = { id: 'new-comment-id' };

      mockFirestore.getDoc.mockResolvedValue(mockParent);
      mockFirestore.addDoc.mockResolvedValue(mockDocRef);
      mockFirestore.Timestamp.now.mockReturnValue({ toDate: () => new Date() });

      const response = await app.inject({
        method: 'POST',
        url: '/comments',
        headers: {
          authorization: 'Bearer valid-token'
        },
        payload: newComment
      });

      expect(response.statusCode).toBe(201);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.comment.content).toBe(newComment.content);
      expect(data.comment.authorUsername).toBe('testuser');
      expect(data.comment.taggedUsers).toContain('doctor1');
    });

    test('should create comment on answer and update comment count', async () => {
      const newComment = {
        content: 'This is a comment on an answer',
        parentId: 'a1',
        parentType: 'answer'
      };

      const mockAnswer = {
        exists: () => true,
        data: () => ({ commentCount: 2 })
      };

      const mockDocRef = { id: 'new-comment-id' };

      mockFirestore.getDoc.mockResolvedValue(mockAnswer);
      mockFirestore.addDoc.mockResolvedValue(mockDocRef);
      mockFirestore.updateDoc.mockResolvedValue();

      const response = await app.inject({
        method: 'POST',
        url: '/comments',
        headers: {
          authorization: 'Bearer valid-token'
        },
        payload: newComment
      });

      expect(response.statusCode).toBe(201);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(mockFirestore.updateDoc).toHaveBeenCalled(); // Answer comment count updated
    });

    test('should create reply to existing comment', async () => {
      const replyComment = {
        content: 'This is a reply to another comment',
        parentId: 'q1',
        parentType: 'question',
        replyToCommentId: 'c1'
      };

      const mockParent = {
        exists: () => true,
        data: () => ({ title: 'Test Question' })
      };

      const mockReplyToComment = {
        exists: () => true,
        data: () => ({ content: 'Original comment' })
      };

      const mockDocRef = { id: 'reply-comment-id' };

      mockFirestore.getDoc
        .mockResolvedValueOnce(mockParent)
        .mockResolvedValueOnce(mockReplyToComment);
      mockFirestore.addDoc.mockResolvedValue(mockDocRef);

      const response = await app.inject({
        method: 'POST',
        url: '/comments',
        headers: {
          authorization: 'Bearer valid-token'
        },
        payload: replyComment
      });

      expect(response.statusCode).toBe(201);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.comment.replyToCommentId).toBe('c1');
    });

    test('should extract tagged users from comment content', async () => {
      const commentWithTags = {
        content: 'Hey @doctor1 and @patient2, what do you think about @doctor3 opinion?',
        parentId: 'q1',
        parentType: 'question'
      };

      const mockParent = {
        exists: () => true,
        data: () => ({ title: 'Test Question' })
      };

      const mockDocRef = { id: 'tagged-comment-id' };

      mockFirestore.getDoc.mockResolvedValue(mockParent);
      mockFirestore.addDoc.mockResolvedValue(mockDocRef);

      const response = await app.inject({
        method: 'POST',
        url: '/comments',
        headers: {
          authorization: 'Bearer valid-token'
        },
        payload: commentWithTags
      });

      expect(response.statusCode).toBe(201);
      const data = JSON.parse(response.payload);
      expect(data.comment.taggedUsers).toContain('doctor1');
      expect(data.comment.taggedUsers).toContain('patient2');
      expect(data.comment.taggedUsers).toContain('doctor3');
      expect(data.comment.taggedUsers).toHaveLength(3);
    });

    test('should return 404 if parent does not exist', async () => {
      const newComment = {
        content: 'Comment on non-existent parent',
        parentId: 'nonexistent',
        parentType: 'question'
      };

      const mockParent = {
        exists: () => false
      };

      mockFirestore.getDoc.mockResolvedValue(mockParent);

      const response = await app.inject({
        method: 'POST',
        url: '/comments',
        headers: {
          authorization: 'Bearer valid-token'
        },
        payload: newComment
      });

      expect(response.statusCode).toBe(404);
      const data = JSON.parse(response.payload);
      expect(data.error).toBe('PARENT_NOT_FOUND');
    });

    test('should return 404 if reply-to comment does not exist', async () => {
      const replyComment = {
        content: 'Reply to non-existent comment',
        parentId: 'q1',
        parentType: 'question',
        replyToCommentId: 'nonexistent'
      };

      const mockParent = {
        exists: () => true,
        data: () => ({ title: 'Test Question' })
      };

      const mockReplyToComment = {
        exists: () => false
      };

      mockFirestore.getDoc
        .mockResolvedValueOnce(mockParent)
        .mockResolvedValueOnce(mockReplyToComment);

      const response = await app.inject({
        method: 'POST',
        url: '/comments',
        headers: {
          authorization: 'Bearer valid-token'
        },
        payload: replyComment
      });

      expect(response.statusCode).toBe(404);
      const data = JSON.parse(response.payload);
      expect(data.error).toBe('REPLY_TO_COMMENT_NOT_FOUND');
    });

    test('should validate comment content length', async () => {
      const invalidComment = {
        content: '', // Empty content
        parentId: 'q1',
        parentType: 'question'
      };

      const response = await app.inject({
        method: 'POST',
        url: '/comments',
        headers: {
          authorization: 'Bearer valid-token'
        },
        payload: invalidComment
      });

      expect(response.statusCode).toBe(400);
    });

    test('should require authentication', async () => {
      const newComment = {
        content: 'This comment requires auth',
        parentId: 'q1',
        parentType: 'question'
      };

      const response = await app.inject({
        method: 'POST',
        url: '/comments',
        payload: newComment
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('PUT /comments/:id - Comment Updates', () => {
    test('should update comment by owner', async () => {
      const mockComment = {
        authorUsername: 'testuser',
        content: 'Original comment'
      };

      const mockDoc = {
        exists: () => true,
        data: () => mockComment
      };

      const updatedContent = 'Updated comment with @newuser tag';

      mockFirestore.getDoc.mockResolvedValue(mockDoc);
      mockFirestore.updateDoc.mockResolvedValue();

      const response = await app.inject({
        method: 'PUT',
        url: '/comments/c1',
        headers: {
          authorization: 'Bearer valid-token'
        },
        payload: { content: updatedContent }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.comment.content).toBe(updatedContent);
      expect(data.comment.taggedUsers).toContain('newuser');
      expect(mockFirestore.updateDoc).toHaveBeenCalled();
    });

    test('should prevent unauthorized comment updates', async () => {
      const mockComment = {
        authorUsername: 'otheruser'
      };

      const mockDoc = {
        exists: () => true,
        data: () => mockComment
      };

      mockFirestore.getDoc.mockResolvedValue(mockDoc);

      const response = await app.inject({
        method: 'PUT',
        url: '/comments/c1',
        headers: {
          authorization: 'Bearer valid-token'
        },
        payload: { content: 'Updated content' }
      });

      expect(response.statusCode).toBe(403);
      const data = JSON.parse(response.payload);
      expect(data.error).toBe('UNAUTHORIZED');
    });

    test('should return 404 for non-existent comment', async () => {
      const mockDoc = {
        exists: () => false
      };

      mockFirestore.getDoc.mockResolvedValue(mockDoc);

      const response = await app.inject({
        method: 'PUT',
        url: '/comments/nonexistent',
        headers: {
          authorization: 'Bearer valid-token'
        },
        payload: { content: 'Updated content' }
      });

      expect(response.statusCode).toBe(404);
      const data = JSON.parse(response.payload);
      expect(data.error).toBe('COMMENT_NOT_FOUND');
    });
  });

  describe('DELETE /comments/:id - Comment Deletion', () => {
    test('should delete comment by owner', async () => {
      const mockComment = {
        authorUsername: 'testuser',
        parentType: 'question',
        parentId: 'q1'
      };

      const mockDoc = {
        exists: () => true,
        data: () => mockComment
      };

      const mockReplies = {
        forEach: jest.fn((callback) => {
          // Mock one reply to be deleted
          callback({ ref: 'reply-ref-1' });
        })
      };

      mockFirestore.getDoc.mockResolvedValue(mockDoc);
      mockFirestore.deleteDoc.mockResolvedValue();
      mockFirestore.getDocs.mockResolvedValue(mockReplies);

      const response = await app.inject({
        method: 'DELETE',
        url: '/comments/c1',
        headers: {
          authorization: 'Bearer valid-token'
        }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(mockFirestore.deleteDoc).toHaveBeenCalledTimes(2); // Comment + reply
    });

    test('should delete comment on answer and update comment count', async () => {
      const mockComment = {
        authorUsername: 'testuser',
        parentType: 'answer',
        parentId: 'a1'
      };

      const mockCommentDoc = {
        exists: () => true,
        data: () => mockComment
      };

      const mockAnswer = {
        exists: () => true,
        data: () => ({ commentCount: 3 })
      };

      const mockReplies = {
        forEach: jest.fn() // No replies
      };

      mockFirestore.getDoc
        .mockResolvedValueOnce(mockCommentDoc)
        .mockResolvedValueOnce(mockAnswer);
      mockFirestore.deleteDoc.mockResolvedValue();
      mockFirestore.getDocs.mockResolvedValue(mockReplies);
      mockFirestore.updateDoc.mockResolvedValue();

      const response = await app.inject({
        method: 'DELETE',
        url: '/comments/c1',
        headers: {
          authorization: 'Bearer valid-token'
        }
      });

      expect(response.statusCode).toBe(200);
      expect(mockFirestore.updateDoc).toHaveBeenCalled(); // Answer comment count updated
    });

    test('should prevent unauthorized comment deletion', async () => {
      const mockComment = {
        authorUsername: 'otheruser'
      };

      const mockDoc = {
        exists: () => true,
        data: () => mockComment
      };

      mockFirestore.getDoc.mockResolvedValue(mockDoc);

      const response = await app.inject({
        method: 'DELETE',
        url: '/comments/c1',
        headers: {
          authorization: 'Bearer valid-token'
        }
      });

      expect(response.statusCode).toBe(403);
      const data = JSON.parse(response.payload);
      expect(data.error).toBe('UNAUTHORIZED');
    });
  });

  describe('GET /comments/:id/replies - Comment Replies', () => {
    test('should retrieve replies to a comment', async () => {
      const mockReplies = [
        {
          id: 'r1',
          content: 'First reply',
          replyToCommentId: 'c1',
          authorUsername: 'user1',
          authorRole: 'patient'
        },
        {
          id: 'r2',
          content: 'Second reply',
          replyToCommentId: 'c1',
          authorUsername: 'doctor1',
          authorRole: 'doctor'
        }
      ];

      const mockSnapshot = {
        forEach: jest.fn((callback) => {
          mockReplies.forEach((reply, index) => {
            callback({ 
              id: reply.id, 
              data: () => ({ 
                ...reply, 
                createdAt: { toDate: () => new Date() },
                updatedAt: { toDate: () => new Date() }
              }) 
            }, index);
          });
        })
      };

      mockFirestore.getDocs.mockResolvedValue(mockSnapshot);

      const response = await app.inject({
        method: 'GET',
        url: '/comments/c1/replies'
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.replies).toHaveLength(2);
      expect(data.replies[0].replyToCommentId).toBe('c1');
    });

    test('should limit number of replies returned', async () => {
      const mockSnapshot = {
        forEach: jest.fn((callback) => {
          callback({ 
            id: 'r1', 
            data: () => ({ 
              content: 'Reply',
              replyToCommentId: 'c1',
              createdAt: { toDate: () => new Date() },
              updatedAt: { toDate: () => new Date() }
            }) 
          });
        })
      };

      mockFirestore.getDocs.mockResolvedValue(mockSnapshot);

      const response = await app.inject({
        method: 'GET',
        url: '/comments/c1/replies?limit=1'
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.replies).toHaveLength(1);
    });
  });

  describe('GET /comments/tagged/:username - Tagged Comments', () => {
    test('should retrieve comments where user is tagged', async () => {
      const mockTaggedComments = [
        {
          id: 'c1',
          content: 'Comment mentioning @testuser',
          parentId: 'q1',
          parentType: 'question',
          authorUsername: 'otheruser',
          authorRole: 'patient'
        }
      ];

      const mockSnapshot = {
        forEach: jest.fn((callback) => {
          mockTaggedComments.forEach((comment, index) => {
            callback({ 
              id: comment.id, 
              data: () => ({ 
                ...comment, 
                createdAt: { toDate: () => new Date() }
              }) 
            }, index);
          });
        })
      };

      mockFirestore.getDocs.mockResolvedValue(mockSnapshot);

      const response = await app.inject({
        method: 'GET',
        url: '/comments/tagged/testuser',
        headers: {
          authorization: 'Bearer valid-token'
        }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.comments).toHaveLength(1);
      expect(data.comments[0].content).toContain('@testuser');
    });

    test('should prevent users from viewing other users tagged comments', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/comments/tagged/otheruser',
        headers: {
          authorization: 'Bearer valid-token'
        }
      });

      expect(response.statusCode).toBe(403);
      const data = JSON.parse(response.payload);
      expect(data.error).toBe('UNAUTHORIZED');
    });

    test('should require authentication for tagged comments', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/comments/tagged/testuser'
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('Error Handling', () => {
    test('should handle Firestore errors gracefully', async () => {
      mockFirestore.getDocs.mockRejectedValue(new Error('Firestore connection failed'));

      const response = await app.inject({
        method: 'GET',
        url: '/comments/question/q1'
      });

      expect(response.statusCode).toBe(500);
      const data = JSON.parse(response.payload);
      expect(data.error).toBe('INTERNAL_ERROR');
      expect(data.message).toBe('Failed to fetch comments');
    });

    test('should validate parent type enum', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/comments/invalid-type/q1'
      });

      expect(response.statusCode).toBe(400);
    });

    test('should validate comment content length limits', async () => {
      const longContent = 'a'.repeat(1001); // Exceeds 1000 char limit
      
      const response = await app.inject({
        method: 'POST',
        url: '/comments',
        headers: {
          authorization: 'Bearer valid-token'
        },
        payload: {
          content: longContent,
          parentId: 'q1',
          parentType: 'question'
        }
      });

      expect(response.statusCode).toBe(400);
    });
  });
});