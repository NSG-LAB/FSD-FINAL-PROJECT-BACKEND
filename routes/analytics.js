const express = require('express');
const { Op, Sequelize } = require('sequelize');
const { sequelize, User, Property, Recommendation, Notification } = require('../models');
const { authenticateToken, authorizeAdmin } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Get dashboard overview stats
router.get('/overview', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    // Get date range (default to last 30 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const [
      totalUsers,
      activeUsers,
      newUsers,
      totalProperties,
      newProperties,
      totalRecommendations,
      activeRecommendations,
      totalNotifications,
      unreadNotifications,
      userRoles,
      propertyTypes
    ] = await Promise.all([
      User.count(),
      User.count({
        where: {
          isActive: true
        }
      }),
      User.count({
        where: {
          createdAt: {
            [Op.between]: [startDate, endDate]
          }
        }
      }),
      Property.count(),
      Property.count({
        where: {
          createdAt: {
            [Op.between]: [startDate, endDate]
          }
        }
      }),
      Recommendation.count(),
      Recommendation.count({
        where: { isActive: true }
      }),
      Notification.count(),
      Notification.count({
        where: { isRead: false }
      }),
      User.findAll({
        attributes: [
          'role',
          [Sequelize.fn('COUNT', Sequelize.col('role')), 'count']
        ],
        group: ['role']
      }),
      Property.findAll({
        attributes: [
          'propertyType',
          [Sequelize.fn('COUNT', Sequelize.col('propertyType')), 'count']
        ],
        group: ['propertyType']
      })
    ]);

    res.json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          active: activeUsers,
          new: newUsers
        },
        properties: {
          total: totalProperties,
          new: newProperties
        },
        recommendations: {
          total: totalRecommendations,
          active: activeRecommendations
        },
        notifications: {
          total: totalNotifications,
          unread: unreadNotifications
        },
        distributions: {
          userRoles: userRoles.map(role => ({
            role: role.role,
            count: parseInt(role.dataValues.count)
          })),
          propertyTypes: propertyTypes.map(type => ({
            type: type.propertyType,
            count: parseInt(type.dataValues.count)
          }))
        }
      }
    });
  } catch (error) {
    logger.error('Analytics overview error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get user activity analytics
router.get('/user-activity', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const { period = '30' } = req.query;
    const days = parseInt(period);
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Daily user registrations
    const userRegistrations = await User.findAll({
      attributes: [
        [Sequelize.fn('DATE', Sequelize.col('createdAt')), 'date'],
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
      ],
      where: {
        createdAt: {
          [Op.between]: [startDate, endDate]
        }
      },
      group: [Sequelize.fn('DATE', Sequelize.col('createdAt'))],
      order: [[Sequelize.fn('DATE', Sequelize.col('createdAt')), 'ASC']]
    });

    // Daily property submissions
    const propertySubmissions = await Property.findAll({
      attributes: [
        [Sequelize.fn('DATE', Sequelize.col('createdAt')), 'date'],
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
      ],
      where: {
        createdAt: {
          [Op.between]: [startDate, endDate]
        }
      },
      group: [Sequelize.fn('DATE', Sequelize.col('createdAt'))],
      order: [[Sequelize.fn('DATE', Sequelize.col('createdAt')), 'ASC']]
    });

    // Top active users (by property count)
    const topUsersRaw = await Property.findAll({
      attributes: [
        'userId',
        [Sequelize.fn('COUNT', Sequelize.col('Property.id')), 'propertyCount']
      ],
      include: [{
        association: 'owner',
        attributes: ['id', 'firstName', 'lastName', 'email']
      }],
      group: ['Property.userId', 'owner.id'],
      order: [[Sequelize.fn('COUNT', Sequelize.col('Property.id')), 'DESC']],
      limit: 10
    });

    const topUsers = topUsersRaw.map((row) => ({
      id: row.owner?.id || row.userId,
      name: row.owner ? `${row.owner.firstName} ${row.owner.lastName}` : 'Unknown User',
      email: row.owner?.email || null,
      propertyCount: parseInt(row.dataValues.propertyCount)
    }));

    res.json({
      success: true,
      data: {
        userRegistrations: userRegistrations.map(reg => ({
          date: reg.dataValues.date,
          count: parseInt(reg.dataValues.count)
        })),
        propertySubmissions: propertySubmissions.map(sub => ({
          date: sub.dataValues.date,
          count: parseInt(sub.dataValues.count)
        })),
        topUsers
      }
    });
  } catch (error) {
    logger.error('User activity analytics error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get property analytics
router.get('/properties', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const cityExpr = Sequelize.fn(
      'JSON_UNQUOTE',
      Sequelize.fn('JSON_EXTRACT', Sequelize.col('location'), Sequelize.literal("'$.city'"))
    );
    const stateExpr = Sequelize.fn(
      'JSON_UNQUOTE',
      Sequelize.fn('JSON_EXTRACT', Sequelize.col('location'), Sequelize.literal("'$.state'"))
    );

    // Property status distribution
    const propertyStatus = await Property.findAll({
      attributes: [
        'status',
        [Sequelize.fn('COUNT', Sequelize.col('status')), 'count']
      ],
      group: ['status']
    });

    // Properties by city/state
    const propertiesByLocation = await Property.findAll({
      attributes: [
        [cityExpr, 'city'],
        [stateExpr, 'state'],
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
      ],
      where: {
        [Op.and]: [
          sequelize.where(cityExpr, { [Op.ne]: null }),
          sequelize.where(cityExpr, { [Op.ne]: '' }),
          sequelize.where(stateExpr, { [Op.ne]: null }),
          sequelize.where(stateExpr, { [Op.ne]: '' })
        ]
      },
      group: [cityExpr, stateExpr],
      order: [[Sequelize.fn('COUNT', Sequelize.col('id')), 'DESC']],
      limit: 20
    });

    // Average property values by type
    const avgValuesByType = await Property.findAll({
      attributes: [
        'propertyType',
        [Sequelize.fn('AVG', Sequelize.col('currentValue')), 'avgValue'],
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
      ],
      where: {
        currentValue: { [Op.ne]: null }
      },
      group: ['propertyType']
    });

    res.json({
      success: true,
      data: {
        statusDistribution: propertyStatus.map(status => ({
          status: status.status,
          count: parseInt(status.dataValues.count)
        })),
        locationDistribution: propertiesByLocation.map(loc => ({
          location: `${loc.city}, ${loc.state}`,
          count: parseInt(loc.dataValues.count)
        })),
        averageValues: avgValuesByType.map(type => ({
          type: type.propertyType,
          avgValue: parseFloat(type.dataValues.avgValue),
          count: parseInt(type.dataValues.count)
        }))
      }
    });
  } catch (error) {
    logger.error('Property analytics error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get system performance metrics
router.get('/performance', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    // API usage statistics (this would need to be implemented with logging middleware)
    // For now, return basic system info
    const systemInfo = {
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      nodeVersion: process.version,
      platform: process.platform
    };

    // Database connection status
    let dbStatus = 'unknown';
    try {
      await sequelize.authenticate();
      dbStatus = 'connected';
    } catch (error) {
      dbStatus = 'disconnected';
    }

    // Redis status (from health check)
    const redisStatus = 'connected'; // Assuming it's connected since we're here

    res.json({
      success: true,
      data: {
        system: systemInfo,
        database: {
          status: dbStatus,
          dialect: sequelize.getDialect()
        },
        cache: {
          status: redisStatus
        }
      }
    });
  } catch (error) {
    logger.error('Performance analytics error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;