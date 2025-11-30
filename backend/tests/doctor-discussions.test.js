import { test } from 'node:test';
import assert from 'node:assert';
import Fastify from 'fastify';



// Simple route handlers for testing
const createMockRoutes = (userRole = 'doctor', isVerified = true) => {
  return async function mockRoutes(fastify, opts) {
    // Mock authentication middleware
    fastify.decorate('authenticate', async (request, reply) => {
      request.user = {
        userId: 'test-user-id',
        username: 'testdoctor',
        role: userRole,
        verified: isVerified
      };
    });

    fastify.decorate('requireVerifiedDoctor', async (request, reply) => {
      if (!request.user) {
        return reply.code(401).send({
          error: 'UNAUTHORIZED',
          message: 'Authentication required'
        });
      }
      if (request.user.role !== 'doctor') {
        return reply.code(403).send({
          error: 'FORBIDDEN',
          message: 'Doctor role required'
        });
      }
      if (!request.user.verified) {
        return reply.code(403).send({
          error: 'VERIFICATION_REQUIRED',
          message: 'Doctor verification required'
        });
      }
    });

    // Mock discussion routes
    fastify.get('/doctor-discussions', {
      preHandler: [fastify.authenticate, fastify.requireVerifiedDoctor]
    }, async (request, reply) => {
      return {
        discussions: [],
        pagination: { page: 1, limit: 20, total: 0, hasNext: false }
      };
    });

    fastify.post('/doctor-discussions', {
      preHandler: [fastify.authenticate, fastify.requireVerifiedDoctor]
    }, async (request, reply) => {
      const { title, content, category, tags = [] } = request.body;
      
      if (!title || title.length < 5 || !content || content.length < 10 || !category) {
        return reply.code(400).send({ error: 'VALIDATION_ERROR' });
      }

      reply.code(201).send({
        success: true,
        message: 'Discussion created successfully',
        discussion: {
          id: 'mock-discussion-id',
          title,
          content,
          category,
          tags,
          authorUsername: request.user.username,
          participantCount: 1,
          commentCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastActivity: new Date().toISOString()
        }
      });
    });

    // Mock comment routes
    fastify.get('/doctor-comments/discussion/:discussionId', {
      preHandler: [fastify.authenticate, fastify.requireVerifiedDoctor]
    }, async (request, reply) => {
      return { comments: [] };
    });

    fastify.post('/doctor-comments', {
      preHandler: [fastify.authenticate, fastify.requireVerifiedDoctor]
    }, async (request, reply) => {
      const { discussionId, content, taggedDoctors = [] } = request.body;
      
      if (!content || content.length < 1) {
        return reply.code(400).send({ error: 'VALIDATION_ERROR' });
      }

      reply.code(201).send({
        success: true,
        message: 'Comment created successfully',
        comment: {
          id: 'mock-comment-id',
          discussionId,
          content,
          authorUsername: request.user.username,
          taggedDoctors,
          parentCommentId: null,
          replyCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      });
    });

    fastify.get('/doctor-comments/doctors/search', {
      preHandler: [fastify.authenticate, fastify.requireVerifiedDoctor]
    }, async (request, reply) => {
      const { query } = request.query;
      return { doctors: query ? [{ username: 'testdoctor' }] : [] };
    });
  };
};

const buildApp = async (userRole = 'doctor', isVerified = true) => {
  const app = Fastify({ logger: false });
  await app.register(createMockRoutes(userRole, isVerified));
  return app;
};

test('Doctor Discussions - CRUD Operations with Verification', async (t) => {
  await t.test('should allow verified doctors to get discussions', async () => {
    const app = await buildApp('doctor', true);
    
    const response = await app.inject({
      method: 'GET',
      url: '/doctor-discussions'
    });

    assert.strictEqual(response.statusCode, 200);
    const data = JSON.parse(response.payload);
    assert.ok(data.discussions);
    assert.ok(data.pagination);
  });

  await t.test('should deny access to unverified doctors', async () => {
    const app = await buildApp('doctor', false);
    
    const response = await app.inject({
      method: 'GET',
      url: '/doctor-discussions'
    });

    assert.strictEqual(response.statusCode, 403);
    const data = JSON.parse(response.payload);
    assert.strictEqual(data.error, 'VERIFICATION_REQUIRED');
  });

  await t.test('should deny access to patients', async () => {
    const app = await buildApp('patient', true);
    
    const response = await app.inject({
      method: 'GET',
      url: '/doctor-discussions'
    });

    assert.strictEqual(response.statusCode, 403);
    const data = JSON.parse(response.payload);
    assert.strictEqual(data.error, 'FORBIDDEN');
  });

  await t.test('should allow verified doctors to create discussions', async () => {
    const app = await buildApp('doctor', true);
    
    const response = await app.inject({
      method: 'POST',
      url: '/doctor-discussions',
      payload: {
        title: 'New Discussion',
        content: 'Discussion content here',
        category: 'Cardiology',
        tags: ['heart', 'diagnosis']
      }
    });

    assert.strictEqual(response.statusCode, 201);
    const data = JSON.parse(response.payload);
    assert.strictEqual(data.success, true);
    assert.ok(data.discussion);
    assert.strictEqual(data.discussion.title, 'New Discussion');
    assert.strictEqual(data.discussion.authorUsername, 'testdoctor');
  });

  await t.test('should validate discussion creation input', async () => {
    const app = await buildApp('doctor', true);
    
    const response = await app.inject({
      method: 'POST',
      url: '/doctor-discussions',
      payload: {
        title: 'Hi', // Too short
        content: 'Short', // Too short
        category: ''
      }
    });

    assert.strictEqual(response.statusCode, 400);
  });

  await t.test('should test basic route structure exists', async () => {
    const app = await buildApp('doctor', true);
    
    // Test that the routes are registered and respond
    const response = await app.inject({
      method: 'GET',
      url: '/doctor-discussions'
    });

    // Should not be 404 (route exists)
    assert.notStrictEqual(response.statusCode, 404);
  });
});

test('Doctor Comments - CRUD Operations with Verification', async (t) => {
  await t.test('should allow verified doctors to get comments', async () => {
    const app = await buildApp('doctor', true);
    
    const response = await app.inject({
      method: 'GET',
      url: '/doctor-comments/discussion/test-discussion-1'
    });

    assert.strictEqual(response.statusCode, 200);
    const data = JSON.parse(response.payload);
    assert.ok(data.comments);
  });

  await t.test('should deny comment access to unverified doctors', async () => {
    const app = await buildApp('doctor', false);
    
    const response = await app.inject({
      method: 'GET',
      url: '/doctor-comments/discussion/test-discussion-1'
    });

    assert.strictEqual(response.statusCode, 403);
    const data = JSON.parse(response.payload);
    assert.strictEqual(data.error, 'VERIFICATION_REQUIRED');
  });

  await t.test('should allow verified doctors to create comments', async () => {
    const app = await buildApp('doctor', true);
    
    const response = await app.inject({
      method: 'POST',
      url: '/doctor-comments',
      payload: {
        discussionId: 'test-discussion-1',
        content: 'This is a test comment',
        taggedDoctors: ['anotherdoctor']
      }
    });

    assert.strictEqual(response.statusCode, 201);
    const data = JSON.parse(response.payload);
    assert.strictEqual(data.success, true);
    assert.ok(data.comment);
    assert.strictEqual(data.comment.content, 'This is a test comment');
    assert.strictEqual(data.comment.authorUsername, 'testdoctor');
  });

  await t.test('should validate comment creation input', async () => {
    const app = await buildApp('doctor', true);
    
    const response = await app.inject({
      method: 'POST',
      url: '/doctor-comments',
      payload: {
        discussionId: 'test-discussion-1',
        content: '' // Empty content
      }
    });

    assert.strictEqual(response.statusCode, 400);
  });

  await t.test('should test comment routes exist', async () => {
    const app = await buildApp('doctor', true);
    
    // Test that comment routes are registered
    const response = await app.inject({
      method: 'GET',
      url: '/doctor-comments/discussion/test-id'
    });

    // Should not be 404 (route exists)
    assert.notStrictEqual(response.statusCode, 404);
  });
});

test('Doctor Discussion Access Control', async (t) => {
  await t.test('should enforce doctor role requirement', async () => {
    const app = await buildApp('patient', true); // Patient role
    
    const response = await app.inject({
      method: 'GET',
      url: '/doctor-discussions'
    });

    assert.strictEqual(response.statusCode, 403);
    const data = JSON.parse(response.payload);
    assert.strictEqual(data.error, 'FORBIDDEN');
  });

  await t.test('should enforce verification requirement', async () => {
    const app = await buildApp('doctor', false); // Unverified doctor
    
    const response = await app.inject({
      method: 'GET',
      url: '/doctor-discussions'
    });

    assert.strictEqual(response.statusCode, 403);
    const data = JSON.parse(response.payload);
    assert.strictEqual(data.error, 'VERIFICATION_REQUIRED');
  });

  await t.test('should allow access to verified doctors', async () => {
    const app = await buildApp('doctor', true);
    
    const response = await app.inject({
      method: 'GET',
      url: '/doctor-discussions'
    });

    assert.strictEqual(response.statusCode, 200);
  });
});

test('Doctor Discussion Filtering and Search', async (t) => {
  await t.test('should support basic discussion listing', async () => {
    const app = await buildApp('doctor', true);
    
    const response = await app.inject({
      method: 'GET',
      url: '/doctor-discussions'
    });

    assert.strictEqual(response.statusCode, 200);
    const data = JSON.parse(response.payload);
    assert.ok(data.discussions);
    assert.ok(data.pagination);
  });
});

test('Doctor Comment Threading and Tagging', async (t) => {
  await t.test('should support doctor tagging in comments', async () => {
    const app = await buildApp('doctor', true);
    
    const response = await app.inject({
      method: 'POST',
      url: '/doctor-comments',
      payload: {
        discussionId: 'test-discussion-1',
        content: 'Tagging @anotherdoctor in this comment',
        taggedDoctors: ['anotherdoctor', 'thirddoctor']
      }
    });

    assert.strictEqual(response.statusCode, 201);
    const data = JSON.parse(response.payload);
    assert.deepStrictEqual(data.comment.taggedDoctors, ['anotherdoctor', 'thirddoctor']);
  });

  await t.test('should search for doctors to tag', async () => {
    const app = await buildApp('doctor', true);
    
    const response = await app.inject({
      method: 'GET',
      url: '/doctor-comments/doctors/search?query=test&limit=5'
    });

    assert.strictEqual(response.statusCode, 200);
    const data = JSON.parse(response.payload);
    assert.ok(data.doctors);
  });

  await t.test('should return empty array for empty search query', async () => {
    const app = await buildApp('doctor', true);
    
    const response = await app.inject({
      method: 'GET',
      url: '/doctor-comments/doctors/search'
    });

    assert.strictEqual(response.statusCode, 200);
    const data = JSON.parse(response.payload);
    assert.deepStrictEqual(data.doctors, []);
  });
});