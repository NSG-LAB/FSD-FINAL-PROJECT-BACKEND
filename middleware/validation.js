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
        message: err.msg,
        value: err.value || null
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
    body('title')
      .trim()
      .notEmpty().withMessage('Title is required.')
      .isLength({ min: 10, max: 100 }).withMessage('Title must be between 10 and 100 characters.'),
    body('description')
      .trim()
      .notEmpty().withMessage('Description is required.')
      .isLength({ min: 20, max: 500 }).withMessage('Description must be between 20 and 500 characters.'),
    body('propertyType')
      .isIn(['apartment', 'house', 'villa', 'townhouse', 'studio']).withMessage('Invalid property type.'),
    body('age')
      .isInt({ min: 0, max: 150 }).withMessage('Property age must be between 0 and 150 years.'),
    body('builtUpArea')
      .isInt({ min: 100, max: 100000 }).withMessage('Built-up area must be between 100 and 100,000 sqft.'),
    body('bedrooms')
      .isInt({ min: 0, max: 20 }).withMessage('Number of bedrooms must be between 0 and 20.'),
    body('bathrooms')
      .isInt({ min: 0, max: 20 }).withMessage('Number of bathrooms must be between 0 and 20.'),
    body('condition')
      .isIn(['excellent', 'good', 'average', 'needs-work']).withMessage('Invalid property condition.'),
    body('currentValue')
      .isInt({ min: 0 }).withMessage('Current value must be a positive number.'),
    body('suggestions')
      .optional()
      .isArray().withMessage('Suggestions must be an array.')
      .custom(value => {
        if (!value.every(item => typeof item === 'string' && item.length >= 10 && item.length <= 200)) {
          throw new Error('Each suggestion must be a string between 10 and 200 characters.');
        }
        return true;
      })
  ],
  update: [
    body('title')
      .optional()
      .trim()
      .isLength({ min: 10, max: 100 }).withMessage('Title must be between 10 and 100 characters.'),
    body('description')
      .optional()
      .trim()
      .isLength({ min: 20, max: 500 }).withMessage('Description must be between 20 and 500 characters.'),
    body('propertyType')
      .optional()
      .isIn(['apartment', 'house', 'villa', 'townhouse', 'studio']).withMessage('Invalid property type.'),
    body('age')
      .optional()
      .isInt({ min: 0, max: 150 }).withMessage('Property age must be between 0 and 150 years.'),
    body('builtUpArea')
      .optional()
      .isInt({ min: 100, max: 100000 }).withMessage('Built-up area must be between 100 and 100,000 sqft.'),
    body('bedrooms')
      .optional()
      .isInt({ min: 0, max: 20 }).withMessage('Number of bedrooms must be between 0 and 20.'),
    body('bathrooms')
      .optional()
      .isInt({ min: 0, max: 20 }).withMessage('Number of bathrooms must be between 0 and 20.'),
    body('condition')
      .optional()
      .isIn(['excellent', 'good', 'average', 'needs-work']).withMessage('Invalid property condition.'),
    body('currentValue')
      .optional()
      .isInt({ min: 0 }).withMessage('Current value must be a positive number.'),
    body('suggestions')
      .optional()
      .isArray().withMessage('Suggestions must be an array.')
      .custom(value => {
        if (!value.every(item => typeof item === 'string' && item.length >= 10 && item.length <= 200)) {
          throw new Error('Each suggestion must be a string between 10 and 200 characters.');
        }
        return true;
      })
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
