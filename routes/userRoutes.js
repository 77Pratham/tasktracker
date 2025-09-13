const express = require('express');
const router = express.Router();
const { authorize } = require('../middleware/auth');
const {
  getUsers,
  getUser,
  updateUser,
  deleteUser,
  getUserStats
} = require('../controllers/userController');

// GET /api/users - Get all users (admin/manager only)
router.get('/', authorize(['admin', 'manager']), getUsers);

// GET /api/users/stats - Get user statistics (admin only)
router.get('/stats', authorize(['admin']), getUserStats);

// GET /api/users/:id - Get single user (admin/manager only)
router.get('/:id', authorize(['admin', 'manager']), getUser);

// PUT /api/users/:id - Update user (admin only)
router.put('/:id', authorize(['admin']), updateUser);

// DELETE /api/users/:id - Delete user (admin only)
router.delete('/:id', authorize(['admin']), deleteUser);

module.exports = router;
