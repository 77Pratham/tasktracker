const Task = require('../models/Task');
const User = require('../models/User');
const { validationResult } = require('express-validator');
const mongoose = require('mongoose');

// Get all tasks with filtering, sorting, and pagination
const getTasks = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      priority,
      assignee,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      dueDate
    } = req.query;

    // Build filter object
    const filter = { createdBy: req.user.id };

    if (status && status !== 'all') {
      filter.status = status;
    }

    if (priority && priority !== 'all') {
      filter.priority = priority;
    }

    if (assignee && assignee !== 'all') {
      filter.assignee = assignee;
    }

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { assigneeName: { $regex: search, $options: 'i' } }
      ];
    }

    if (dueDate) {
      const date = new Date(dueDate);
      filter.dueDate = {
        $gte: new Date(date.setHours(0, 0, 0, 0)),
        $lt: new Date(date.setHours(23, 59, 59, 999))
      };
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [tasks, total] = await Promise.all([
      Task.find(filter)
        .populate('assignee', 'firstName lastName username')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      Task.countDocuments(filter)
    ]);

    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      success: true,
      data: {
        tasks,
        pagination: {
          current: parseInt(page),
          total: totalPages,
          count: tasks.length,
          totalCount: total
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get single task
const getTask = async (req, res, next) => {
  try {
    const task = await Task.findOne({
      _id: req.params.id,
      $or: [
        { createdBy: req.user.id },
        { assignee: req.user.id }
      ]
    }).populate('assignee createdBy', 'firstName lastName username');

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    res.json({
      success: true,
      data: task
    });
  } catch (error) {
    next(error);
  }
};

// Create new task
const createTask = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const taskData = {
      ...req.body,
      createdBy: req.user.id
    };

    // If assignee email is provided, find the user
    if (req.body.assigneeEmail) {
      const assigneeUser = await User.findOne({ email: req.body.assigneeEmail });
      if (assigneeUser) {
        taskData.assignee = assigneeUser._id;
        taskData.assigneeName = assigneeUser.fullName;
      } else {
        taskData.assigneeName = req.body.assigneeEmail;
      }
    }

    const task = await Task.create(taskData);
    
    // Populate the created task
    await task.populate('assignee createdBy', 'firstName lastName username');

    res.status(201).json({
      success: true,
      data: task,
      message: 'Task created successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Update task
const updateTask = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const task = await Task.findOne({
      _id: req.params.id,
      $or: [
        { createdBy: req.user.id },
        { assignee: req.user.id }
      ]
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    // Handle assignee update
    if (req.body.assigneeEmail) {
      const assigneeUser = await User.findOne({ email: req.body.assigneeEmail });
      if (assigneeUser) {
        req.body.assignee = assigneeUser._id;
        req.body.assigneeName = assigneeUser.fullName;
      } else {
        req.body.assigneeName = req.body.assigneeEmail;
        req.body.assignee = null;
      }
    }

    Object.assign(task, req.body);
    await task.save();
    
    await task.populate('assignee createdBy', 'firstName lastName username');

    res.json({
      success: true,
      data: task,
      message: 'Task updated successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Delete task
const deleteTask = async (req, res, next) => {
  try {
    const task = await Task.findOneAndDelete({
      _id: req.params.id,
      createdBy: req.user.id
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found or unauthorized'
      });
    }

    res.json({
      success: true,
      message: 'Task deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Get task statistics
const getTaskStats = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    const stats = await Task.aggregate([
      {
        $match: {
          $or: [
            { createdBy: new mongoose.Types.ObjectId(userId) },
            { assignee: new mongoose.Types.ObjectId(userId) }
          ]
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          completed: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          pending: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
          },
          inProgress: {
            $sum: { $cond: [{ $eq: ['$status', 'in-progress'] }, 1, 0] }
          },
          overdue: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ['$status', 'completed'] },
                    { $lt: ['$dueDate', new Date()] },
                    { $ne: ['$dueDate', null] }
                  ]
                },
                1,
                0
              ]
            }
          },
          highPriority: {
            $sum: { $cond: [{ $eq: ['$priority', 'high'] }, 1, 0] }
          }
        }
      }
    ]);

    const result = stats[0] || {
      total: 0,
      completed: 0,
      pending: 0,
      inProgress: 0,
      overdue: 0,
      highPriority: 0
    };

    // Calculate completion rate
    result.completionRate = result.total > 0 
      ? Math.round((result.completed / result.total) * 100) 
      : 0;

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

// Bulk update tasks
const bulkUpdateTasks = async (req, res, next) => {
  try {
    const { taskIds, updates } = req.body;

    if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Task IDs array is required'
      });
    }

    const result = await Task.updateMany(
      {
        _id: { $in: taskIds },
        createdBy: req.user.id
      },
      { $set: updates }
    );

    res.json({
      success: true,
      data: {
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount
      },
      message: `${result.modifiedCount} tasks updated successfully`
    });
  } catch (error) {
    next(error);
  }
};

// Export tasks
const exportTasks = async (req, res, next) => {
  try {
    const { format = 'json' } = req.query;
    
    const tasks = await Task.find({
      $or: [
        { createdBy: req.user.id },
        { assignee: req.user.id }
      ]
    })
    .populate('assignee createdBy', 'firstName lastName username')
    .select('-__v');

    if (format === 'csv') {
      // Convert to CSV format
      const csv = convertToCSV(tasks);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="tasks.csv"');
      return res.send(csv);
    }

    res.json({
      success: true,
      data: tasks,
      count: tasks.length
    });
  } catch (error) {
    next(error);
  }
};

// Helper function to convert tasks to CSV
const convertToCSV = (tasks) => {
  const headers = [
    'Title', 'Description', 'Status', 'Priority', 
    'Due Date', 'Assignee', 'Created At', 'Completed At'
  ];
  
  const rows = tasks.map(task => [
    task.title,
    task.description || '',
    task.status,
    task.priority,
    task.dueDate ? task.dueDate.toISOString().split('T')[0] : '',
    task.assigneeName || '',
    task.createdAt.toISOString().split('T')[0],
    task.completedAt ? task.completedAt.toISOString().split('T')[0] : ''
  ]);

  return [headers, ...rows].map(row => 
    row.map(field => `"${field}"`).join(',')
  ).join('\n');
};

module.exports = {
  getTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
  getTaskStats,
  bulkUpdateTasks,
  exportTasks
};