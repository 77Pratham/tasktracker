const request = require('supertest');
const app = require('../../server');
const { createTestUser, createTestTask, createMultipleTasks, generateAuthToken } = require('../helpers/testHelpers');

describe('Task Routes', () => {
  let user, token;

  beforeEach(async () => {
    user = await createTestUser();
    token = generateAuthToken(user);
  });

  describe('GET /api/tasks', () => {
    it('should get all tasks for authenticated user', async () => {
      await createMultipleTasks(3, user);

      const response = await request(app)
        .get('/api/tasks')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tasks).toHaveLength(3);
      expect(response.body.data.pagination).toBeDefined();
    });

    it('should filter tasks by status', async () => {
      await createTestTask({ status: 'pending' }, user);
      await createTestTask({ status: 'completed' }, user);
      await createTestTask({ status: 'in-progress' }, user);

      const response = await request(app)
        .get('/api/tasks?status=completed')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tasks).toHaveLength(1);
      expect(response.body.data.tasks[0].status).toBe('completed');
    });

    it('should filter tasks by priority', async () => {
      await createTestTask({ priority: 'high' }, user);
      await createTestTask({ priority: 'low' }, user);

      const response = await request(app)
        .get('/api/tasks?priority=high')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tasks).toHaveLength(1);
      expect(response.body.data.tasks[0].priority).toBe('high');
    });

    it('should search tasks by title and description', async () => {
      await createTestTask({ title: 'Important Task', description: 'Very important' }, user);
      await createTestTask({ title: 'Regular Task', description: 'Regular work' }, user);

      const response = await request(app)
        .get('/api/tasks?search=important')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tasks).toHaveLength(1);
      expect(response.body.data.tasks[0].title).toBe('Important Task');
    });

    it('should paginate results correctly', async () => {
      await createMultipleTasks(15, user);

      const response = await request(app)
        .get('/api/tasks?page=1&limit=10')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tasks).toHaveLength(10);
      expect(response.body.data.pagination.current).toBe(1);
      expect(response.body.data.pagination.total).toBe(2);
    });

    it('should fail without authentication', async () => {
      const response = await request(app)
        .get('/api/tasks')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/tasks/:id', () => {
    let task;

    beforeEach(async () => {
      task = await createTestTask({}, user);
    });

    it('should get single task by id', async () => {
      const response = await request(app)
        .get(`/api/tasks/${task._id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe(task.title);
      expect(response.body.data._id).toBe(task._id.toString());
    });

    it('should fail to get task that does not exist', async () => {
      const nonExistentId = '507f1f77bcf86cd799439011';

      const response = await request(app)
        .get(`/api/tasks/${nonExistentId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Task not found');
    });

    it('should fail to get task created by another user', async () => {
      const otherUser = await createTestUser({ 
        username: 'otheruser', 
        email: 'other@example.com' 
      });
      const otherTask = await createTestTask({}, otherUser);

      const response = await request(app)
        .get(`/api/tasks/${otherTask._id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/tasks', () => {
    it('should create a new task with valid data', async () => {
      const taskData = {
        title: 'New Task',
        description: 'New task description',
        priority: 'high',
        status: 'pending',
        dueDate: new Date(Date.now() + 86400000).toISOString()
      };

      const response = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send(taskData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe(taskData.title);
      expect(response.body.data.description).toBe(taskData.description);
      expect(response.body.data.createdBy).toBe(user._id.toString());
    });

    it('should create task with minimal required data', async () => {
      const taskData = {
        title: 'Minimal Task'
      };

      const response = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send(taskData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe(taskData.title);
      expect(response.body.data.status).toBe('pending');
      expect(response.body.data.priority).toBe('medium');
    });

    it('should fail to create task without title', async () => {
      const taskData = {
        description: 'Task without title'
      };

      const response = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send(taskData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
    });

    it('should fail to create task with invalid status', async () => {
      const taskData = {
        title: 'Test Task',
        status: 'invalid-status'
      };

      const response = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send(taskData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/tasks/:id', () => {
    let task;

    beforeEach(async () => {
      task = await createTestTask({}, user);
    });

    it('should update task with valid data', async () => {
      const updateData = {
        title: 'Updated Task',
        description: 'Updated description',
        status: 'in-progress',
        priority: 'high'
      };

      const response = await request(app)
        .put(`/api/tasks/${task._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe(updateData.title);
      expect(response.body.data.description).toBe(updateData.description);
      expect(response.body.data.status).toBe(updateData.status);
    });

    it('should fail to update task that does not exist', async () => {
      const nonExistentId = '507f1f77bcf86cd799439011';
      const updateData = { title: 'Updated Task' };

      const response = await request(app)
        .put(`/api/tasks/${nonExistentId}`)
        .set('Authorization', `Bearer ${token}`)
        .send(updateData)
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should fail to update task created by another user', async () => {
      const otherUser = await createTestUser({ 
        username: 'otheruser', 
        email: 'other@example.com' 
      });
      const otherTask = await createTestTask({}, otherUser);
      const updateData = { title: 'Updated Task' };

      const response = await request(app)
        .put(`/api/tasks/${otherTask._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send(updateData)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/tasks/:id', () => {
    let task;

    beforeEach(async () => {
      task = await createTestTask({}, user);
    });

    it('should delete task successfully', async () => {
      const response = await request(app)
        .delete(`/api/tasks/${task._id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Task deleted successfully');
    });

    it('should fail to delete task that does not exist', async () => {
      const nonExistentId = '507f1f77bcf86cd799439011';

      const response = await request(app)
        .delete(`/api/tasks/${nonExistentId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should fail to delete task created by another user', async () => {
      const otherUser = await createTestUser({ 
        username: 'otheruser', 
        email: 'other@example.com' 
      });
      const otherTask = await createTestTask({}, otherUser);

      const response = await request(app)
        .delete(`/api/tasks/${otherTask._id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/tasks/stats', () => {
    beforeEach(async () => {
      await createTestTask({ status: 'pending' }, user);
      await createTestTask({ status: 'completed' }, user);
      await createTestTask({ status: 'in-progress' }, user);
      await createTestTask({ 
        status: 'pending', 
        dueDate: new Date(Date.now() - 86400000) // Yesterday (overdue)
      }, user);
    });

    it('should return task statistics', async () => {
      const response = await request(app)
        .get('/api/tasks/stats')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.total).toBe(4);
      expect(response.body.data.pending).toBe(2);
      expect(response.body.data.completed).toBe(1);
      expect(response.body.data.inProgress).toBe(1);
      expect(response.body.data.overdue).toBe(1);
      expect(response.body.data.completionRate).toBe(25); // 1/4 = 25%
    });
  });
});