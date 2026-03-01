const express = require('express');
const { Op } = require('sequelize');
const { sequelize, Recommendation, Property } = require('../models');
const { authenticateToken, authorizeAdmin } = require('../middleware/auth');
const { recommendationRules, handleValidationErrors } = require('../middleware/validation');
const logger = require('../utils/logger');
const { clearCache } = require('../middleware/cache');

const router = express.Router();

const buildRelatedIds = (body) => {
  if (Array.isArray(body.relatedRecommendationIds)) {
    return body.relatedRecommendationIds;
  }
  if (Array.isArray(body.relatedRecommendations)) {
    return body.relatedRecommendations;
  }
  return [];
};

// Get all recommendations
router.get('/', async (req, res) => {
  try {
    const {
      category,
      difficulty,
      q,
      limit = '10',
      offset = '0',
      sortBy = 'priority',
      order = 'DESC'
    } = req.query;

    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
    const parsedOffset = Math.max(parseInt(offset, 10) || 0, 0);
    const allowedSortFields = ['priority', 'title', 'difficulty', 'expectedROI', 'createdAt', 'updatedAt'];
    const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'priority';
    const safeOrder = String(order).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const whereClause = { isActive: true };

    if (category) whereClause.category = category;
    if (difficulty) whereClause.difficulty = difficulty;
    if (q) {
      whereClause.title = { [Op.like]: `%${q}%` };
    }

    const { count, rows } = await Recommendation.findAndCountAll({
      where: whereClause,
      include: [{ association: 'relatedRecommendations', through: { attributes: [] } }],
      order: [[safeSortBy, safeOrder]],
      limit: parsedLimit,
      offset: parsedOffset,
      distinct: true
    });

    res.json({
      success: true,
      count,
      limit: parsedLimit,
      offset: parsedOffset,
      hasMore: parsedOffset + rows.length < count,
      recommendations: rows
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get recommendations for a property
router.get('/property/:propertyId', async (req, res) => {
  try {
    const property = await Property.findByPk(req.params.propertyId);

    if (!property) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }

    const escapedAll = sequelize.escape(JSON.stringify('all'));
    const escapedPropertyType = sequelize.escape(JSON.stringify(property.propertyType));
    const escapedCondition = sequelize.escape(JSON.stringify(property.condition));
    const city = property.location?.city;
    const escapedCity = city ? sequelize.escape(JSON.stringify(city)) : null;

    const filtered = await Recommendation.findAll({
      where: {
        isActive: true,
        [Op.and]: [
          {
            [Op.or]: [
              sequelize.where(sequelize.fn('JSON_LENGTH', sequelize.col('applicablePropertyTypes')), 0),
              sequelize.where(
                sequelize.fn('JSON_CONTAINS', sequelize.col('applicablePropertyTypes'), sequelize.literal(escapedAll)),
                1
              ),
              sequelize.where(
                sequelize.fn('JSON_CONTAINS', sequelize.col('applicablePropertyTypes'), sequelize.literal(escapedPropertyType)),
                1
              )
            ]
          },
          {
            [Op.or]: [
              sequelize.where(sequelize.fn('JSON_LENGTH', sequelize.col('applicableConditions')), 0),
              sequelize.where(
                sequelize.fn('JSON_CONTAINS', sequelize.col('applicableConditions'), sequelize.literal(escapedCondition)),
                1
              )
            ]
          },
          city
            ? {
                [Op.or]: [
                  sequelize.where(sequelize.fn('JSON_LENGTH', sequelize.col('applicableCities')), 0),
                  sequelize.where(
                    sequelize.fn('JSON_CONTAINS', sequelize.col('applicableCities'), sequelize.literal(escapedCity)),
                    1
                  )
                ]
              }
            : sequelize.where(sequelize.fn('JSON_LENGTH', sequelize.col('applicableCities')), 0)
        ]
      },
      order: [['priority', 'DESC']]
    });

    res.json({ success: true, count: filtered.length, recommendations: filtered });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create recommendation (Admin only)
router.post('/', authenticateToken, authorizeAdmin, recommendationRules.create, handleValidationErrors, async (req, res) => {
  try {
    const relatedIds = buildRelatedIds(req.body);
    const {
      relatedRecommendations,
      relatedRecommendationIds,
      ...payload
    } = req.body;

    const recommendation = await Recommendation.create({
      ...payload,
      createdBy: req.user.userId
    });

    if (relatedIds.length) {
      await recommendation.setRelatedRecommendations(relatedIds);
    }

    await recommendation.reload({ include: [{ association: 'relatedRecommendations', through: { attributes: [] } }] });

    // Clear recommendations cache
    await clearCache('__express__/api/recommendations*');

    res.status(201).json({
      success: true,
      message: 'Recommendation created successfully',
      recommendation
    });
  } catch (error) {
    logger.error('Recommendation creation error:', error.message);
    res.status(400).json({ success: false, message: error.message });
  }
});

// Update recommendation (Admin only)
router.put('/:id', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const recommendation = await Recommendation.findByPk(req.params.id, {
      include: [{ association: 'relatedRecommendations', through: { attributes: [] } }]
    });

    if (!recommendation) {
      return res.status(404).json({ success: false, message: 'Recommendation not found' });
    }

    const relatedIds = buildRelatedIds(req.body);
    const {
      relatedRecommendations,
      relatedRecommendationIds,
      ...payload
    } = req.body;

    await recommendation.update({ ...payload });

    if (relatedIds.length) {
      await recommendation.setRelatedRecommendations(relatedIds);
    } else if (req.body.relatedRecommendations || req.body.relatedRecommendationIds) {
      await recommendation.setRelatedRecommendations([]);
    }

    await recommendation.reload({ include: [{ association: 'relatedRecommendations', through: { attributes: [] } }] });

    // Clear recommendations cache
    await clearCache('__express__/api/recommendations*');

    res.json({
      success: true,
      message: 'Recommendation updated successfully',
      recommendation
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete recommendation (Admin only)
router.delete('/:id', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const recommendation = await Recommendation.findByPk(req.params.id);

    if (!recommendation) {
      return res.status(404).json({ success: false, message: 'Recommendation not found' });
    }

    await recommendation.destroy();

    // Clear recommendations cache
    await clearCache('__express__/api/recommendations*');

    res.json({ success: true, message: 'Recommendation deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
