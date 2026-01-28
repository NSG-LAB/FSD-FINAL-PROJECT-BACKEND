const mongoose = require('mongoose');

const recommendationSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    enum: [
      'kitchen-bathroom',
      'flooring',
      'wall-paint',
      'lighting-fixtures',
      'garden-outdoor',
      'safety-security',
      'energy-efficiency',
      'interior-design',
      'electrical-plumbing'
    ],
    required: true
  },
  description: {
    type: String,
    required: true
  },
  benefits: [String],
  estimatedCost: {
    min: Number,
    max: Number
  },
  expectedROI: {
    type: Number,
    default: 0
  },
  roiPercentage: {
    type: Number,
    default: 0
  },
  difficulty: {
    type: String,
    enum: ['easy', 'moderate', 'difficult'],
    default: 'moderate'
  },
  timeframe: String,
  images: [String],
  tips: [String],
  applicablePropertyTypes: [
    {
      type: String,
      enum: ['apartment', 'house', 'villa', 'townhouse', 'studio', 'all']
    }
  ],
  applicableCities: [String],
  applicableConditions: [
    {
      type: String,
      enum: ['excellent', 'good', 'average', 'needs-work']
    }
  ],
  beforeAfterImages: [
    {
      before: String,
      after: String,
      description: String
    }
  ],
  relatedRecommendations: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Recommendation'
  }],
  priority: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Recommendation', recommendationSchema);
