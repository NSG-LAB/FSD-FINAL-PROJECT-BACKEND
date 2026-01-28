const express = require('express');
const { User } = require('../models');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

const serializeUser = (user) => (user ? user.get({ plain: true }) : null);

// Get user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.userId, {
      include: [
        { association: 'savedRecommendations', through: { attributes: [] } },
        {
          association: 'propertySubmissions',
          include: [{ association: 'recommendations', through: { attributes: [] } }]
        }
      ]
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, user: serializeUser(user) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update user profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { firstName, lastName, phone, city, state, bio } = req.body;

    const user = await User.findByPk(req.user.userId);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    await user.update({ firstName, lastName, phone, city, state, bio });

    res.json({ success: true, message: 'Profile updated successfully', user: serializeUser(user) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get all users (Admin only)
router.get('/', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const users = await User.findAll({ order: [['createdAt', 'DESC']] });
    res.json({ success: true, count: users.length, users: users.map(serializeUser) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
