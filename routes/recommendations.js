const express = require('express');
const { Op } = require('sequelize');
const { sequelize, Recommendation, Property } = require('../models');
const { authenticateToken, authorizeAdmin } = require('../middleware/auth');
const { recommendationRules, handleValidationErrors } = require('../middleware/validation');
const logger = require('../utils/logger');
const { clearCache } = require('../middleware/cache');

const router = express.Router();

const avgCost = (estimatedCost = {}) => {
  const min = Number(estimatedCost.min || 0);
  const max = Number(estimatedCost.max || 0);
  if (!min && !max) return 0;
  if (!min) return max;
  if (!max) return min;
  return (min + max) / 2;
};

const parseGoals = (input) => {
  if (Array.isArray(input)) {
    return input.map((goal) => String(goal || '').toLowerCase().trim()).filter(Boolean);
  }
  if (typeof input === 'string') {
    return input
      .split(',')
      .map((goal) => goal.toLowerCase().trim())
      .filter(Boolean);
  }
  return [];
};

const goalScore = (recommendation, goals = []) => {
  if (!goals.length) return 0;

  const category = String(recommendation.category || '').toLowerCase();
  let score = 0;

  for (const goal of goals) {
    if ((goal.includes('eco') || goal.includes('energy') || goal.includes('sustain')) && category === 'energy-efficiency') {
      score += 8;
    }
    if ((goal.includes('safety') || goal.includes('secure')) && category === 'safety-security') {
      score += 8;
    }
    if ((goal.includes('luxury') || goal.includes('premium') || goal.includes('modern'))) {
      if (category === 'interior-design' || category === 'kitchen-bathroom') {
        score += 6;
      }
    }
    if ((goal.includes('quick') || goal.includes('fast')) && recommendation.difficulty === 'easy') {
      score += 5;
    }
    if ((goal.includes('rental') || goal.includes('income')) && category === 'electrical-plumbing') {
      score += 4;
    }
  }

  return score;
};

const withPersonalizedRanking = ({ recommendations, city, budget, propertyAge, userGoals }) => {
  const goals = parseGoals(userGoals);
  const normalizedBudget = Number(budget || 0);
  const normalizedAge = Number(propertyAge || 0);
  const normalizedCity = city ? String(city).toLowerCase() : '';

  const ranked = recommendations.map((recommendation) => {
    const averageCost = avgCost(recommendation.estimatedCost);
    let score = 0;

    score += Number(recommendation.priority || 0) * 2;
    score += Number(recommendation.expectedROI || recommendation.roiPercentage || 0) * 0.3;

    if (normalizedCity && Array.isArray(recommendation.applicableCities) && recommendation.applicableCities.length) {
      const matchedCity = recommendation.applicableCities.some(
        (c) => String(c || '').toLowerCase() === normalizedCity
      );
      score += matchedCity ? 10 : -6;
    }

    if (normalizedBudget > 0 && averageCost > 0) {
      if (averageCost <= normalizedBudget) {
        score += 8;
      } else {
        const overBudgetRatio = (averageCost - normalizedBudget) / normalizedBudget;
        score -= Math.min(10, overBudgetRatio * 10);
      }
    }

    if (normalizedAge >= 15) {
      if (['electrical-plumbing', 'safety-security', 'wall-paint'].includes(recommendation.category)) {
        score += 6;
      }
    } else if (normalizedAge > 0 && normalizedAge <= 7) {
      if (['energy-efficiency', 'interior-design', 'lighting-fixtures'].includes(recommendation.category)) {
        score += 4;
      }
    }

    score += goalScore(recommendation, goals);

    return {
      ...recommendation.get({ plain: true }),
      personalizedScore: Number(score.toFixed(2)),
      estimatedAverageCost: Math.round(averageCost),
    };
  });

  ranked.sort((a, b) => b.personalizedScore - a.personalizedScore);
  return ranked;
};

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
      city,
      budget,
      propertyAge,
      userGoals,
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
    const shouldPersonalize =
      sortBy === 'personalized' || Boolean(city || budget || propertyAge || userGoals);

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

    const recommendations = shouldPersonalize
      ? withPersonalizedRanking({ recommendations: rows, city, budget, propertyAge, userGoals })
      : rows;

    res.json({
      success: true,
      count,
      limit: parsedLimit,
      offset: parsedOffset,
      hasMore: parsedOffset + rows.length < count,
      personalizationApplied: shouldPersonalize,
      recommendations
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get recommendations for a property (owner/admin only)
router.get('/property/:propertyId', authenticateToken, async (req, res) => {
  try {
    const {
      city,
      budget,
      userGoals,
      sortBy = 'priority',
      order = 'DESC',
      limit = '10',
      offset = '0'
    } = req.query;

    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
    const parsedOffset = Math.max(parseInt(offset, 10) || 0, 0);
    const allowedSortFields = ['priority', 'title', 'difficulty', 'expectedROI', 'createdAt', 'updatedAt'];
    const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'priority';
    const safeOrder = String(order).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const property = await Property.findByPk(req.params.propertyId);

    if (!property) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }

    if (req.user.role !== 'admin' && property.userId !== req.user.userId) {
      return res.status(403).json({ success: false, message: 'Not authorized to view this property recommendations' });
    }

    const escapedAll = sequelize.escape(JSON.stringify('all'));
    const escapedPropertyType = sequelize.escape(JSON.stringify(property.propertyType));
    const escapedCondition = sequelize.escape(JSON.stringify(property.condition));
    const propertyCity = property.location?.city;
    const escapedCity = propertyCity ? sequelize.escape(JSON.stringify(propertyCity)) : null;

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
          propertyCity
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
      order: [[safeSortBy, safeOrder]]
    });

    const shouldPersonalize = sortBy === 'personalized' || Boolean(budget || userGoals || city);
    let recommendations = shouldPersonalize
      ? withPersonalizedRanking({
          recommendations: filtered,
          city: city || propertyCity,
          budget,
          propertyAge: property.age,
          userGoals
        })
      : filtered;

    if (shouldPersonalize && sortBy === 'personalized' && safeOrder === 'ASC') {
      recommendations = [...recommendations].reverse();
    }

    const total = recommendations.length;
    const paginatedRecommendations = recommendations.slice(parsedOffset, parsedOffset + parsedLimit);

    res.json({
      success: true,
      count: total,
      limit: parsedLimit,
      offset: parsedOffset,
      hasMore: parsedOffset + paginatedRecommendations.length < total,
      personalizationApplied: shouldPersonalize,
      sortBy: shouldPersonalize && sortBy === 'personalized' ? 'personalized' : safeSortBy,
      order: safeOrder,
      recommendations: paginatedRecommendations
    });
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
