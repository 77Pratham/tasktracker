const Task = require('../../models/Task');
const { createTestUser } = require('../helpers/testHelpers');

describe('Task Model', () => {
  let user;

  beforeEach(async () => {
    user = await createTestUser();
  });

  describe('Task Creation', () => {
    it('should create a new task with valid data', async () => {
      const taskData = {
        title: 'Test Task',
        description: 'Test Description',
        status: 'pending',
        priority: 'high',
        createdBy: user._id,
        dueDate: new Date(Date.now() + 86400000) // Tomorrow
      };

      const task = await Task.create(taskData);

      expect(task.title).toBe(taskData.title);
      expect(task.description).toBe(taskData.description);
      expect(task.status).toBe(taskData.status);
      expect(task.priority).toBe(taskData.priority);
      expect(task.createdBy.toString()).toBe(user._id.toString());
    });

    it('should fail to create task without required fields', async () => {
      const taskData = {
        description: 'Test Description'
        // Missing title and createdBy
      };

      await expect(Task.create(taskData)).rejects.toThrow();
    });

    it('should set default values correctly', async () => {
      const taskData = {
        title: 'Test Task',
        createdBy: user._id
      };

      const task = await Task.create(taskData);

      expect(task.status).toBe('pending');
      expect(task.priority).toBe('medium');
    });

    it('should validate status enum values', async () => {
      const taskData = {
        title: 'Test Task',
        createdBy: user._id,
        status: 'invalid-status'
      };

      await expect(Task.create(taskData)).rejects.toThrow();
    });

    it('should validate priority enum values', async () => {
      const taskData = {
        title: 'Test Task',
        createdBy: user._id,
        priority: 'invalid-priority'
      };

      await expect(Task.create(taskData)).rejects.toThrow();
    });
  });

  describe('Task Virtuals', () => {
    it('should calculate isOverdue correctly', async () => {
      const pastDate = new Date(Date.now() - 86400000); // Yesterday
      const futureDate = new Date(Date.now() + 86400000); // Tomorrow

      const overdueTask = await Task.create({
        title: 'Overdue Task',
        createdBy: user._id,
        dueDate: pastDate,
        status: 'pending'
      });

      const notOverdueTask = await Task.create({
        title: 'Not Overdue Task',
        createdBy: user._id,
        dueDate: futureDate,
        status: 'pending'
      });

      const completedTask = await Task.create({
        title: 'Completed Task',
        createdBy: user._id,
        dueDate: pastDate,
        status: 'completed'
      });

      expect(overdueTask.isOverdue).toBe(true);
      expect(notOverdueTask.isOverdue).toBe(false);
      expect(completedTask.isOverdue).toBe(false);
    });

    it('should calculate daysUntilDue correctly', async () => {
      const tomorrow = new Date(Date.now() + 86400000);
      
      const task = await Task.create({
        title: 'Test Task',
        createdBy: user._id,
        dueDate: tomorrow
      });

      expect(task.daysUntilDue).toBe(1);
    });
  });

  describe('Task Middleware', () => {
    it('should set completedAt when status changes to completed', async () => {
      const task = await Task.create({
        title: 'Test Task',
        createdBy: user._id,
        status: 'pending'
      });

      expect(task.completedAt).toBeUndefined();

      task.status = 'completed';
      await task.save();

      expect(task.completedAt).toBeDefined();
      expect(task.completedAt).toBeInstanceOf(Date);
    });

    it('should unset completedAt when status changes from completed', async () => {
      const task = await Task.create({
        title: 'Test Task',
        createdBy: user._id,
        status: 'completed'
      });

      expect(task.completedAt).toBeDefined();

      task.status = 'pending';
      await task.save();

      expect(task.completedAt).toBeUndefined();
    });
  });
});
