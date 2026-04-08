const express = require('express');
const { Op } = require('sequelize');
const { User, Property, Recommendation, Notification } = require('../models');
const { authenticateToken, authorizeAdmin } = require('../middleware/auth');
const { userRules, handleValidationErrors } = require('../middleware/validation');

const router = express.Router();

const serializeUser = (user) => (user ? user.get({ plain: true }) : null);

const parsePagination = (req) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
  return { limit, offset };
};

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

// Get profile summary (user/admin aware)
router.get('/profile/summary', authenticateToken, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.userId, {
      include: [{ association: 'savedRecommendations', through: { attributes: [] } }]
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const isAdmin = user.role === 'admin';
    let summary;

    if (isAdmin) {
      const [totalUsers, totalProperties, totalRecommendations, totalNotifications] = await Promise.all([
        User.count(),
        Property.count(),
        Recommendation.count(),
        Notification.count()
      ]);

      summary = {
        role: 'admin',
        totalUsers,
        totalProperties,
        totalRecommendations,
        totalNotifications
      };
    } else {
      const [totalProperties, pendingProperties] = await Promise.all([
        Property.count({ where: { userId: user.id } }),
        Property.count({ where: { userId: user.id, status: 'pending' } })
      ]);

      summary = {
        role: 'user',
        totalProperties,
        pendingProperties,
        savedRecommendations: user.savedRecommendations?.length || 0
      };
    }

    res.json({
      success: true,
      user: serializeUser(user),
      summary
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update user profile
router.put('/profile', authenticateToken, userRules.updateProfile, handleValidationErrors, async (req, res) => {
  try {
    const { firstName, lastName, phone, city, state, bio, profileImage } = req.body;

    const user = await User.findByPk(req.user.userId);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    await user.update({ firstName, lastName, phone, city, state, bio, profileImage });

    res.json({ success: true, message: 'Profile updated successfully', user: serializeUser(user) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get all users (Admin only)
router.get('/', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const { q, role } = req.query;
    const { limit, offset } = parsePagination(req);

    const whereClause = {};
    if (q) {
      whereClause[Op.or] = [
        { firstName: { [Op.like]: `%${q}%` } },
        { lastName: { [Op.like]: `%${q}%` } },
        { email: { [Op.like]: `%${q}%` } }
      ];
    }
    if (role === 'user' || role === 'admin') {
      whereClause.role = role;
    }

    const { count, rows } = await User.findAndCountAll({
      where: whereClause,
      order: [['createdAt', 'DESC']],
      limit,
      offset
    });

    res.json({
      success: true,
      count,
      limit,
      offset,
      hasMore: offset + rows.length < count,
      users: rows.map(serializeUser)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
