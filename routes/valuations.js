const express = require('express');
const { body, validationResult } = require('express-validator');
const { estimateValue } = require('../services/valuationService');

const router = express.Router();

router.post(
  '/estimate',
  [
    body('areaSqft').isFloat({ gt: 100 }),
    body('ageYears').isFloat({ min: 0 }),
    body('bedrooms').isInt({ min: 0 }),
    body('bathrooms').isInt({ min: 0 }),
    body('conditionScore').optional().isInt({ min: 1, max: 5 }),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const result = estimateValue(req.body);
    return res.status(200).json(result);
  }
);

module.exports = router;
