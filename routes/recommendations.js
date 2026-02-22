const express = require('express');
const { Recommendation, Property } = require('../models');
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
    const { category, difficulty } = req.query;
    const whereClause = { isActive: true };

    if (category) whereClause.category = category;
    if (difficulty) whereClause.difficulty = difficulty;

    const recommendations = await Recommendation.findAll({
      where: whereClause,
      include: [{ association: 'relatedRecommendations', through: { attributes: [] } }],
      order: [['priority', 'DESC']]
    });

    res.json({ success: true, count: recommendations.length, recommendations });
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

    const allRecommendations = await Recommendation.findAll({
      where: { isActive: true },
      order: [['priority', 'DESC']]
    });

    const filtered = allRecommendations.filter((recommendation) => {
      const propertyTypeMatch =
        !recommendation.applicablePropertyTypes.length ||
        recommendation.applicablePropertyTypes.includes('all') ||
        recommendation.applicablePropertyTypes.includes(property.propertyType);

      const conditionMatch =
        !recommendation.applicableConditions.length ||
        recommendation.applicableConditions.includes(property.condition);

      const cityMatch =
        !recommendation.applicableCities.length ||
        recommendation.applicableCities.includes(property.location?.city);

      return propertyTypeMatch && conditionMatch && cityMatch;
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
