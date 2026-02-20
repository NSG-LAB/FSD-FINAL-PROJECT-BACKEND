const express = require('express');
const { body, validationResult } = require('express-validator');
const { Recommendation } = require('../models');
const { createROIPlan } = require('../services/roiPlannerService');

const router = express.Router();

router.post(
  '/plan',
  [
    body('budget').optional().isFloat({ min: 0 }),
    body('propertyType').optional().isString(),
    body('propertyCondition').optional().isIn(['excellent', 'good', 'average', 'needs-work']),
    body('city').optional().isString(),
    body('topN').optional().isInt({ min: 1, max: 10 }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const {
        budget = 0,
        propertyType,
        propertyCondition = 'good',
        city,
        topN = 5,
      } = req.body;

      const recommendations = await Recommendation.findAll({
        where: { isActive: true },
        order: [['priority', 'DESC']],
      });

      const filtered = recommendations.filter((rec) => {
        const typeMatch =
          !propertyType ||
          !Array.isArray(rec.applicablePropertyTypes) ||
          rec.applicablePropertyTypes.length === 0 ||
          rec.applicablePropertyTypes.includes('all') ||
          rec.applicablePropertyTypes.includes(propertyType);

        const conditionMatch =
          !Array.isArray(rec.applicableConditions) ||
          rec.applicableConditions.length === 0 ||
          rec.applicableConditions.includes(propertyCondition);

        const cityMatch =
          !city ||
          !Array.isArray(rec.applicableCities) ||
          rec.applicableCities.length === 0 ||
          rec.applicableCities.includes(city);

        return typeMatch && conditionMatch && cityMatch;
      });

      const plan = createROIPlan({
        recommendations: filtered,
        budget: Number(budget),
        propertyCondition,
        topN: Number(topN),
      });

      return res.json({
        success: true,
        message: 'ROI plan generated',
        plan,
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
);

module.exports = router;
