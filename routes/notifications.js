const express = require('express');
const { Op } = require('sequelize');
const { body, validationResult } = require('express-validator');
const { Notification } = require('../models');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const { unreadOnly, dueOnly } = req.query;
    const where = { userId: req.user.userId };

    if (unreadOnly === 'true') {
      where.isRead = false;
    }

    if (dueOnly === 'true') {
      where.dueAt = { [Op.lte]: new Date() };
    }

    const notifications = await Notification.findAll({
      where,
      order: [['createdAt', 'DESC']],
    });

    return res.json({ success: true, count: notifications.length, notifications });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.post(
  '/',
  authenticateToken,
  [body('title').notEmpty(), body('message').notEmpty(), body('dueAt').optional().isISO8601()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { title, message, dueAt, type = 'reminder' } = req.body;

      const notification = await Notification.create({
        userId: req.user.userId,
        title,
        message,
        dueAt: dueAt || null,
        type,
      });

      return res.status(201).json({
        success: true,
        message: 'Reminder created successfully',
        notification,
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
);

router.patch('/:id/read', authenticateToken, async (req, res) => {
  try {
    const notification = await Notification.findOne({
      where: {
        id: req.params.id,
        userId: req.user.userId,
      },
    });

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    await notification.update({ isRead: true });

    return res.json({ success: true, message: 'Notification marked as read', notification });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
