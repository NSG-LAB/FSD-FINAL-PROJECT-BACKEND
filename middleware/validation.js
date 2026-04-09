const { body, param, query, validationResult } = require('express-validator');

// ==========================================
// Validation Middleware
// ==========================================

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: errors.array().map(err => ({
        field: err.param,
        message: err.msg
      }))
    });
  }
  next();
};

// Auth validation rules
const authRules = {
  register: [
    body('firstName')
      .trim()
      .notEmpty().withMessage('First name required')
      .isLength({ max: 50 }).withMessage('First name max 50 chars'),
    body('lastName')
      .trim()
      .notEmpty().withMessage('Last name required')
      .isLength({ max: 50 }).withMessage('Last name max 50 chars'),
    body('email')
      .trim()
      .isEmail().withMessage('Invalid email format')
      .normalizeEmail(),
    body('password')
      .isLength({ min: 8 }).withMessage('Password min 8 characters')
      .matches(/[A-Z]/).withMessage('Must contain uppercase letter')
      .matches(/[0-9]/).withMessage('Must contain number'),
    body('city')
      .optional()
      .trim()
      .isLength({ max: 100 }).withMessage('City max 100 chars'),
    body('state')
      .optional()
      .trim()
      .isLength({ max: 100 }).withMessage('State max 100 chars')
  ],

  login: [
    body('email')
      .trim()
      .isEmail().withMessage('Invalid email format')
      .normalizeEmail(),
    body('password')
      .notEmpty().withMessage('Password required')
  ]
};

// Property validation rules
const propertyRules = {
  create: [
    body().custom((_, { req }) => {
      if (req.body.builtUpArea === undefined && req.body.builUpArea !== undefined) {
        req.body.builtUpArea = req.body.builUpArea;
      }
      if (req.body.builtUpArea === undefined) {
        throw new Error('Built-up area required');
      }
      return true;
    }),
    body('title')
      .trim()
      .notEmpty().withMessage('Title required')
      .isLength({ max: 200 }).withMessage('Title max 200 chars'),
    body('propertyType')
      .isIn(['apartment', 'house', 'villa', 'townhouse', 'studio']).withMessage('Invalid property type'),
    body('age')
      .isInt({ min: 0, max: 150 }).withMessage('Age must be 0-150'),
    body('builtUpArea')
      .isInt({ min: 100, max: 100000 }).withMessage('Area must be 100-100000 sqft'),
    body('bedrooms')
      .isInt({ min: 0, max: 20 }).withMessage('Bedrooms must be 0-20'),
    body('bathrooms')
      .isInt({ min: 0, max: 20 }).withMessage('Bathrooms must be 0-20'),
    body('condition')
      .isIn(['excellent', 'good', 'average', 'needs-work']).withMessage('Invalid condition'),
    body('currentValue')
      .isInt({ min: 0 }).withMessage('Value must be positive')
  ]
};

// Recommendation validation rules
const recommendationRules = {
  create: [
    body('title')
      .trim()
      .notEmpty().withMessage('Title required')
      .isLength({ max: 200 }).withMessage('Title max 200 chars'),
    body('category')
      .isIn(['kitchen-bathroom', 'flooring', 'wall-paint', 'lighting-fixtures', 'garden-outdoor', 'safety-security', 'energy-efficiency', 'interior-design', 'electrical-plumbing'])
      .withMessage('Invalid category'),
    body('description')
      .trim()
      .notEmpty().withMessage('Description required')
      .isLength({ max: 5000 }).withMessage('Description max 5000 chars'),
    body('expectedROI')
      .isInt({ min: 0, max: 500 }).withMessage('ROI must be 0-500%'),
    body('difficulty')
      .isIn(['easy', 'moderate', 'difficult']).withMessage('Invalid difficulty')
  ]
};

// User profile validation rules
const userRules = {
  updateProfile: [
    body('firstName')
      .optional()
      .trim()
      .isLength({ min: 1, max: 50 }).withMessage('First name must be 1-50 chars'),
    body('lastName')
      .optional()
      .trim()
      .isLength({ min: 1, max: 50 }).withMessage('Last name must be 1-50 chars'),
    body('phone')
      .optional({ nullable: true })
      .trim()
      .isLength({ max: 20 }).withMessage('Phone max 20 chars'),
    body('city')
      .optional({ nullable: true })
      .trim()
      .isLength({ max: 100 }).withMessage('City max 100 chars'),
    body('state')
      .optional({ nullable: true })
      .trim()
      .isLength({ max: 100 }).withMessage('State max 100 chars'),
    body('bio')
      .optional({ nullable: true })
      .trim()
      .isLength({ max: 1000 }).withMessage('Bio max 1000 chars'),
    body('profileImage')
      .optional({ nullable: true })
      .trim()
      .isURL().withMessage('Profile image must be a valid URL')
  ]
};

module.exports = {
  handleValidationErrors,
  authRules,
  propertyRules,
  recommendationRules,
  userRules
};
