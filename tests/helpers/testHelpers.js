const jwt = require('jsonwebtoken');
const User = require('../../models/User');
const Task = require('../../models/Task');

const createTestUser = async (userData = {}) => {
  const defaultUserData = {
    username: 'testuser',
    email: 'test@example.com',
    password: 'Test123!',
    firstName: 'Test',
    lastName: 'User',
    role: 'user'
  };

  const user = await User.create({ ...defaultUserData, ...userData });
  return user;
};

const createTestAdmin = async (userData = {}) => {
  return await createTestUser({ 
    username: 'admin', 
    email: 'admin@example.com', 
    role: 'admin',
    ...userData 
  });
};

const generateAuthToken = (user) => {
  return jwt.sign(
    { 
      id: user._id,
      username: user.username,
      role: user.role 
    },
    process.env.JWT_SECRET || 'tasktracker_secret_key',
    { expiresIn: '7d' }
  );
};

const createTestTask = async (taskData = {}, creator) => {
  const defaultTaskData = {
    title: 'Test Task',
    description: 'Test Description',
    status: 'pending',
    priority: 'medium',
    createdBy: creator._id
  };

  const task = await Task.create({ ...defaultTaskData, ...taskData });
  return task;
};

const createMultipleTasks = async (count, creator, baseData = {}) => {
  const tasks = [];
  for (let i = 0; i < count; i++) {
    const task = await createTestTask({
      title: `Test Task ${i + 1}`,
      ...baseData
    }, creator);
    tasks.push(task);
  }
  return tasks;
};

module.exports = {
  createTestUser,
  createTestAdmin,
  generateAuthToken,
  createTestTask,
  createMultipleTasks
};
