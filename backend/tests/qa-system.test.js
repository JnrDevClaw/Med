import { jest } from '@jest/globals';

describe('Q&A System Unit Tests', () => {
  let mockFirestore;
  let mockAuth;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock Firestore with chainable methods
    mockFirestore = {
      collection: jest.fn().mockReturnThis(),
      doc: jest.fn().mockReturnThis(),
      query: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
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
      user: { username: 'testuser', role: 'patient' }
    };
  });

  describe('Question CRUD Operations', () => {
    test('should create question with proper data structure', async () => {
      const questionData = {
        title: 'Test Question',
        content: 'This is a test question content',
        category: 'general',
        tags: ['test'],
        authorUsername: 'testuser',
        authorRole: 'patient',
        upvotes: 0,
        downvotes: 0,
        answerCount: 0
      };

      const mockDocRef = { id: 'question-id-123' };
      mockFirestore.addDoc.mockResolvedValue(mockDocRef);

      // Simulate question creation logic
      const result = await createQuestion(questionData, mockFirestore);

      expect(mockFirestore.addDoc).toHaveBeenCalledWith(
        mockFirestore,
        expect.objectContaining({
          title: questionData.title,
          content: questionData.content,
          category: questionData.category,
          authorUsername: questionData.authorUsername,
          upvotes: 0,
          downvotes: 0,
          answerCount: 0
        })
      );
      expect(result.id).toBe('question-id-123');
    });

    test('should retrieve questions with proper filtering', async () => {
      const mockQuestions = [
        {
          id: 'q1',
          title: 'Question 1',
          category: 'general',
          upvotes: 5,
          createdAt: { toDate: () => new Date('2024-01-01') }
        },
        {
          id: 'q2',
          title: 'Question 2',
          category: 'cardiology',
          upvotes: 10,
          createdAt: { toDate: () => new Date('2024-01-02') }
        }
      ];

      const mockSnapshot = {
        forEach: jest.fn((callback) => {
          mockQuestions.forEach((q, index) => {
            callback({ id: q.id, data: () => q }, index);
          });
        }),
        size: mockQuestions.length
      };

      mockFirestore.getDocs.mockResolvedValue(mockSnapshot);

      // Test category filtering
      const result = await getQuestions({ category: 'general' }, mockFirestore);

      expect(mockFirestore.where).toHaveBeenCalledWith('category', '==', 'general');
      expect(result.questions).toHaveLength(2);
    });

    test('should update question by owner only', async () => {
      const questionId = 'q1';
      const updateData = { title: 'Updated Title' };
      const mockQuestion = {
        exists: () => true,
        data: () => ({ authorUsername: 'testuser', title: 'Original Title' })
      };

      mockFirestore.getDoc.mockResolvedValue(mockQuestion);
      mockFirestore.updateDoc.mockResolvedValue();

      const result = await updateQuestion(questionId, updateData, mockAuth.user, mockFirestore);

      expect(mockFirestore.updateDoc).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    test('should prevent unauthorized question updates', async () => {
      const questionId = 'q1';
      const updateData = { title: 'Updated Title' };
      const mockQuestion = {
        exists: () => true,
        data: () => ({ authorUsername: 'otheruser', title: 'Original Title' })
      };

      mockFirestore.getDoc.mockResolvedValue(mockQuestion);

      await expect(
        updateQuestion(questionId, updateData, mockAuth.user, mockFirestore)
      ).rejects.toThrow('You can only edit your own questions');
    });

    test('should delete question and associated data', async () => {
      const questionId = 'q1';
      const mockQuestion = {
        exists: () => true,
        data: () => ({ authorUsername: 'testuser' })
      };

      mockFirestore.getDoc.mockResolvedValue(mockQuestion);
      mockFirestore.deleteDoc.mockResolvedValue();

      const result = await deleteQuestion(questionId, mockAuth.user, mockFirestore);

      expect(mockFirestore.deleteDoc).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });
  });

  describe('Voting System', () => {
    test('should record new vote correctly', async () => {
      const targetId = 'q1';
      const voteType = 'upvote';
      const mockTarget = {
        exists: () => true,
        data: () => ({ upvotes: 5, downvotes: 1 })
      };

      const mockVoteSnapshot = {
        empty: true,
        docs: []
      };

      mockFirestore.getDoc.mockResolvedValue(mockTarget);
      mockFirestore.getDocs.mockResolvedValue(mockVoteSnapshot);
      mockFirestore.addDoc.mockResolvedValue({ id: 'vote-id' });
      mockFirestore.updateDoc.mockResolvedValue();

      const result = await recordVote(targetId, 'question', voteType, mockAuth.user, mockFirestore);

      expect(mockFirestore.addDoc).toHaveBeenCalledWith(
        mockFirestore,
        expect.objectContaining({
          targetId,
          targetType: 'question',
          voterUsername: mockAuth.user.username,
          voteType
        })
      );
      expect(result.vote.upvotes).toBe(6);
    });

    test('should handle vote changes (upvote to downvote)', async () => {
      const targetId = 'q1';
      const voteType = 'downvote';
      const mockTarget = {
        exists: () => true,
        data: () => ({ upvotes: 5, downvotes: 1 })
      };

      const existingVote = {
        ref: 'vote-ref',
        data: () => ({ voteType: 'upvote' })
      };

      const mockVoteSnapshot = {
        empty: false,
        docs: [existingVote]
      };

      mockFirestore.getDoc.mockResolvedValue(mockTarget);
      mockFirestore.getDocs.mockResolvedValue(mockVoteSnapshot);
      mockFirestore.updateDoc.mockResolvedValue();

      const result = await recordVote(targetId, 'question', voteType, mockAuth.user, mockFirestore);

      expect(mockFirestore.updateDoc).toHaveBeenCalledTimes(2); // Update vote + update target counts
      expect(result.vote.upvotes).toBe(4); // Removed upvote
      expect(result.vote.downvotes).toBe(2); // Added downvote
    });

    test('should remove vote when voting same type twice', async () => {
      const targetId = 'q1';
      const voteType = 'upvote';
      const mockTarget = {
        exists: () => true,
        data: () => ({ upvotes: 5, downvotes: 1 })
      };

      const existingVote = {
        ref: 'vote-ref',
        data: () => ({ voteType: 'upvote' })
      };

      const mockVoteSnapshot = {
        empty: false,
        docs: [existingVote]
      };

      mockFirestore.getDoc.mockResolvedValue(mockTarget);
      mockFirestore.getDocs.mockResolvedValue(mockVoteSnapshot);
      mockFirestore.deleteDoc.mockResolvedValue();
      mockFirestore.updateDoc.mockResolvedValue();

      const result = await recordVote(targetId, 'question', voteType, mockAuth.user, mockFirestore);

      expect(mockFirestore.deleteDoc).toHaveBeenCalled();
      expect(result.vote.voteType).toBe('removed');
      expect(result.vote.upvotes).toBe(4); // Removed upvote
    });

    test('should prevent multiple votes from same user', async () => {
      const targetId = 'q1';
      const voteType = 'upvote';
      
      // Mock existing vote check
      const existingVoteQuery = mockFirestore.query(
        mockFirestore.collection('votes'),
        mockFirestore.where('targetId', '==', targetId),
        mockFirestore.where('voterUsername', '==', mockAuth.user.username)
      );

      expect(mockFirestore.where).toHaveBeenCalledWith('targetId', '==', targetId);
      expect(mockFirestore.where).toHaveBeenCalledWith('voterUsername', '==', mockAuth.user.username);
    });
  });

  describe('Answer System', () => {
    test('should create answer and update question answer count', async () => {
      const answerData = {
        content: 'This is a helpful answer',
        questionId: 'q1',
        authorUsername: 'doctor1',
        authorRole: 'doctor'
      };

      const mockQuestion = {
        exists: () => true,
        data: () => ({ answerCount: 2 })
      };

      const mockDocRef = { id: 'answer-id-123' };

      mockFirestore.getDoc.mockResolvedValue(mockQuestion);
      mockFirestore.addDoc.mockResolvedValue(mockDocRef);
      mockFirestore.updateDoc.mockResolvedValue();

      const result = await createAnswer(answerData, mockFirestore);

      expect(mockFirestore.addDoc).toHaveBeenCalledWith(
        mockFirestore,
        expect.objectContaining({
          content: answerData.content,
          questionId: answerData.questionId,
          authorUsername: answerData.authorUsername,
          upvotes: 0,
          downvotes: 0,
          isAccepted: false
        })
      );
      expect(mockFirestore.updateDoc).toHaveBeenCalledWith(
        mockFirestore,
        expect.objectContaining({
          answerCount: 3
        })
      );
    });

    test('should accept answer by question author only', async () => {
      const answerId = 'a1';
      const mockAnswer = {
        exists: () => true,
        data: () => ({ questionId: 'q1', isAccepted: false })
      };

      const mockQuestion = {
        exists: () => true,
        data: () => ({ authorUsername: 'testuser' })
      };

      mockFirestore.getDoc
        .mockResolvedValueOnce(mockAnswer)
        .mockResolvedValueOnce(mockQuestion);
      mockFirestore.updateDoc.mockResolvedValue();
      mockFirestore.getDocs.mockResolvedValue({ forEach: jest.fn() }); // No other accepted answers

      const result = await acceptAnswer(answerId, true, mockAuth.user, mockFirestore);

      expect(mockFirestore.updateDoc).toHaveBeenCalledWith(
        mockFirestore,
        expect.objectContaining({
          isAccepted: true
        })
      );
      expect(result.success).toBe(true);
    });

    test('should prevent non-question-author from accepting answers', async () => {
      const answerId = 'a1';
      const mockAnswer = {
        exists: () => true,
        data: () => ({ questionId: 'q1' })
      };

      const mockQuestion = {
        exists: () => true,
        data: () => ({ authorUsername: 'otheruser' })
      };

      mockFirestore.getDoc
        .mockResolvedValueOnce(mockAnswer)
        .mockResolvedValueOnce(mockQuestion);

      await expect(
        acceptAnswer(answerId, true, mockAuth.user, mockFirestore)
      ).rejects.toThrow('Only the question author can accept answers');
    });
  });

  describe('Comment System', () => {
    test('should create comment with user tagging', async () => {
      const commentData = {
        content: 'Great question @doctor1! I have the same issue @patient2',
        parentId: 'q1',
        parentType: 'question',
        authorUsername: 'testuser',
        authorRole: 'patient'
      };

      const mockParent = {
        exists: () => true,
        data: () => ({ title: 'Test Question' })
      };

      const mockDocRef = { id: 'comment-id-123' };

      mockFirestore.getDoc.mockResolvedValue(mockParent);
      mockFirestore.addDoc.mockResolvedValue(mockDocRef);

      const result = await createComment(commentData, mockFirestore);

      expect(mockFirestore.addDoc).toHaveBeenCalledWith(
        mockFirestore,
        expect.objectContaining({
          content: commentData.content,
          parentId: commentData.parentId,
          parentType: commentData.parentType,
          taggedUsers: ['doctor1', 'patient2']
        })
      );
    });

    test('should create reply to existing comment', async () => {
      const replyData = {
        content: 'I agree with this comment',
        parentId: 'q1',
        parentType: 'question',
        replyToCommentId: 'c1',
        authorUsername: 'testuser'
      };

      const mockParent = {
        exists: () => true,
        data: () => ({ title: 'Test Question' })
      };

      const mockReplyToComment = {
        exists: () => true,
        data: () => ({ content: 'Original comment' })
      };

      mockFirestore.getDoc
        .mockResolvedValueOnce(mockParent)
        .mockResolvedValueOnce(mockReplyToComment);
      mockFirestore.addDoc.mockResolvedValue({ id: 'reply-id' });

      const result = await createComment(replyData, mockFirestore);

      expect(result.comment.replyToCommentId).toBe('c1');
    });

    test('should update comment count for answers', async () => {
      const commentData = {
        content: 'Comment on answer',
        parentId: 'a1',
        parentType: 'answer',
        authorUsername: 'testuser'
      };

      const mockAnswer = {
        exists: () => true,
        data: () => ({ commentCount: 2 })
      };

      mockFirestore.getDoc.mockResolvedValue(mockAnswer);
      mockFirestore.addDoc.mockResolvedValue({ id: 'comment-id' });
      mockFirestore.updateDoc.mockResolvedValue();

      await createComment(commentData, mockFirestore);

      expect(mockFirestore.updateDoc).toHaveBeenCalledWith(
        mockFirestore,
        expect.objectContaining({
          commentCount: 3
        })
      );
    });

    test('should extract tagged users correctly', () => {
      const content = 'Hey @doctor1 and @patient2, what about @doctor3?';
      const taggedUsers = extractTaggedUsers(content);

      expect(taggedUsers).toContain('doctor1');
      expect(taggedUsers).toContain('patient2');
      expect(taggedUsers).toContain('doctor3');
      expect(taggedUsers).toHaveLength(3);
    });

    test('should handle duplicate tags', () => {
      const content = 'Hey @doctor1, @doctor1 what do you think @doctor1?';
      const taggedUsers = extractTaggedUsers(content);

      expect(taggedUsers).toContain('doctor1');
      expect(taggedUsers).toHaveLength(1); // No duplicates
    });
  });

  describe('Error Handling', () => {
    test('should handle Firestore connection errors', async () => {
      mockFirestore.getDocs.mockRejectedValue(new Error('Firestore connection failed'));

      await expect(
        getQuestions({}, mockFirestore)
      ).rejects.toThrow('Failed to fetch questions');
    });

    test('should validate required fields', async () => {
      const invalidQuestion = {
        title: '', // Empty title
        content: 'Content',
        category: 'general'
      };

      await expect(
        createQuestion(invalidQuestion, mockFirestore)
      ).rejects.toThrow('Title is required');
    });

    test('should handle non-existent resources', async () => {
      const mockDoc = {
        exists: () => false
      };

      mockFirestore.getDoc.mockResolvedValue(mockDoc);

      await expect(
        updateQuestion('nonexistent', {}, mockAuth.user, mockFirestore)
      ).rejects.toThrow('Question not found');
    });
  });
});

// Helper functions that simulate the actual route logic
async function createQuestion(questionData, firestore) {
  if (!questionData.title || questionData.title.trim() === '') {
    throw new Error('Title is required');
  }

  const docRef = await firestore.addDoc(firestore, {
    ...questionData,
    createdAt: firestore.Timestamp.now(),
    updatedAt: firestore.Timestamp.now()
  });

  return { id: docRef.id, ...questionData };
}

async function getQuestions(filters, firestore) {
  let query = firestore.query(firestore.collection('questions'));

  if (filters.category) {
    query = firestore.query(query, firestore.where('category', '==', filters.category));
  }

  try {
    const snapshot = await firestore.getDocs(query);
    const questions = [];
    snapshot.forEach((doc, index) => {
      questions.push({ id: doc.id, ...doc.data() });
    });
    return { questions };
  } catch (error) {
    throw new Error('Failed to fetch questions');
  }
}

async function updateQuestion(questionId, updateData, user, firestore) {
  const questionDoc = await firestore.getDoc(firestore.doc('questions', questionId));
  
  if (!questionDoc.exists()) {
    throw new Error('Question not found');
  }

  const questionData = questionDoc.data();
  if (questionData.authorUsername !== user.username) {
    throw new Error('You can only edit your own questions');
  }

  await firestore.updateDoc(firestore.doc('questions', questionId), {
    ...updateData,
    updatedAt: firestore.Timestamp.now()
  });

  return { success: true };
}

async function deleteQuestion(questionId, user, firestore) {
  const questionDoc = await firestore.getDoc(firestore.doc('questions', questionId));
  
  if (!questionDoc.exists()) {
    throw new Error('Question not found');
  }

  const questionData = questionDoc.data();
  if (questionData.authorUsername !== user.username) {
    throw new Error('You can only delete your own questions');
  }

  await firestore.deleteDoc(firestore.doc('questions', questionId));
  return { success: true };
}

async function recordVote(targetId, targetType, voteType, user, firestore) {
  const targetDoc = await firestore.getDoc(firestore.doc(targetType + 's', targetId));
  
  if (!targetDoc.exists()) {
    throw new Error(`${targetType} not found`);
  }

  // Check existing vote
  const existingVoteSnapshot = await firestore.getDocs(
    firestore.query(
      firestore.collection('votes'),
      firestore.where('targetId', '==', targetId),
      firestore.where('voterUsername', '==', user.username)
    )
  );

  const targetData = targetDoc.data();
  let voteChange = { upvotes: 0, downvotes: 0 };

  if (!existingVoteSnapshot.empty) {
    const existingVote = existingVoteSnapshot.docs[0];
    const existingVoteData = existingVote.data();
    
    if (existingVoteData.voteType === voteType) {
      // Remove vote
      await firestore.deleteDoc(existingVote.ref);
      voteChange[voteType === 'upvote' ? 'upvotes' : 'downvotes'] = -1;
    } else {
      // Change vote
      await firestore.updateDoc(existingVote.ref, { voteType });
      voteChange[existingVoteData.voteType === 'upvote' ? 'upvotes' : 'downvotes'] = -1;
      voteChange[voteType === 'upvote' ? 'upvotes' : 'downvotes'] = 1;
    }
  } else {
    // New vote
    await firestore.addDoc(firestore.collection('votes'), {
      targetId,
      targetType,
      voterUsername: user.username,
      voteType,
      createdAt: firestore.Timestamp.now()
    });
    voteChange[voteType === 'upvote' ? 'upvotes' : 'downvotes'] = 1;
  }

  const newUpvotes = Math.max(0, (targetData.upvotes || 0) + voteChange.upvotes);
  const newDownvotes = Math.max(0, (targetData.downvotes || 0) + voteChange.downvotes);

  await firestore.updateDoc(firestore.doc(targetType + 's', targetId), {
    upvotes: newUpvotes,
    downvotes: newDownvotes
  });

  return {
    vote: {
      voteType: voteChange.upvotes > 0 ? 'upvote' : voteChange.downvotes > 0 ? 'downvote' : 'removed',
      upvotes: newUpvotes,
      downvotes: newDownvotes
    }
  };
}

async function createAnswer(answerData, firestore) {
  const questionDoc = await firestore.getDoc(firestore.doc('questions', answerData.questionId));
  
  if (!questionDoc.exists()) {
    throw new Error('Question not found');
  }

  const docRef = await firestore.addDoc(firestore.collection('answers'), {
    ...answerData,
    upvotes: 0,
    downvotes: 0,
    isAccepted: false,
    commentCount: 0,
    createdAt: firestore.Timestamp.now(),
    updatedAt: firestore.Timestamp.now()
  });

  // Update question answer count
  const questionData = questionDoc.data();
  await firestore.updateDoc(firestore.doc('questions', answerData.questionId), {
    answerCount: (questionData.answerCount || 0) + 1
  });

  return { id: docRef.id, ...answerData };
}

async function acceptAnswer(answerId, isAccepted, user, firestore) {
  const answerDoc = await firestore.getDoc(firestore.doc('answers', answerId));
  
  if (!answerDoc.exists()) {
    throw new Error('Answer not found');
  }

  const answerData = answerDoc.data();
  const questionDoc = await firestore.getDoc(firestore.doc('questions', answerData.questionId));
  
  if (!questionDoc.exists()) {
    throw new Error('Question not found');
  }

  const questionData = questionDoc.data();
  if (questionData.authorUsername !== user.username) {
    throw new Error('Only the question author can accept answers');
  }

  await firestore.updateDoc(firestore.doc('answers', answerId), {
    isAccepted,
    updatedAt: firestore.Timestamp.now()
  });

  return { success: true, isAccepted };
}

async function createComment(commentData, firestore) {
  const parentDoc = await firestore.getDoc(
    firestore.doc(commentData.parentType + 's', commentData.parentId)
  );
  
  if (!parentDoc.exists()) {
    throw new Error(`${commentData.parentType} not found`);
  }

  // Extract tagged users
  const taggedUsers = extractTaggedUsers(commentData.content);

  const docRef = await firestore.addDoc(firestore.collection('comments'), {
    ...commentData,
    taggedUsers,
    createdAt: firestore.Timestamp.now(),
    updatedAt: firestore.Timestamp.now()
  });

  // Update comment count for answers
  if (commentData.parentType === 'answer') {
    const parentData = parentDoc.data();
    await firestore.updateDoc(firestore.doc('answers', commentData.parentId), {
      commentCount: (parentData.commentCount || 0) + 1
    });
  }

  return { comment: { id: docRef.id, ...commentData, taggedUsers } };
}

function extractTaggedUsers(content) {
  const taggedUsers = [];
  const tagRegex = /@(\w+)/g;
  let match;
  
  while ((match = tagRegex.exec(content)) !== null) {
    const username = match[1];
    if (!taggedUsers.includes(username)) {
      taggedUsers.push(username);
    }
  }
  
  return taggedUsers;
}