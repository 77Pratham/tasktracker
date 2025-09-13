const express = require('express');
const router = express.Router();
const {
  getTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
  getTaskStats,
  bulkUpdateTasks,
  exportTasks
} = require('../controllers/taskController');
const { validateTask } = require('../middleware/validation');
const { authorize } = require('../middleware/auth');

// GET /api/tasks - Get all tasks with filtering and pagination
router.get('/', getTasks);

// GET /api/tasks/stats - Get task statistics
router.get('/stats', getTaskStats);

// GET /api/tasks/export - Export tasks
router.get('/export', exportTasks);

// GET /api/tasks/:id - Get single task
router.get('/:id', getTask);

// POST /api/tasks - Create new task
router.post('/', validateTask, createTask);

// PUT /api/tasks/:id - Update task
router.put('/:id', validateTask, updateTask);

// PATCH /api/tasks/bulk - Bulk update tasks
router.patch('/bulk', authorize(['admin', 'manager']), bulkUpdateTasks);

// DELETE /api/tasks/:id - Delete task
router.delete('/:id', deleteTask);

module.exports = router;