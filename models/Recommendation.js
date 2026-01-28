const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Recommendation = sequelize.define('Recommendation', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  category: {
    type: DataTypes.ENUM(
      'kitchen-bathroom',
      'flooring',
      'wall-paint',
      'lighting-fixtures',
      'garden-outdoor',
      'safety-security',
      'energy-efficiency',
      'interior-design',
      'electrical-plumbing'
    ),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  benefits: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: () => []
  },
  estimatedCost: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: () => ({ min: 0, max: 0 })
  },
  expectedROI: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  roiPercentage: {
    type: DataTypes.FLOAT,
    defaultValue: 0
  },
  difficulty: {
    type: DataTypes.ENUM('easy', 'moderate', 'difficult'),
    defaultValue: 'moderate'
  },
  timeframe: {
    type: DataTypes.STRING,
    allowNull: true
  },
  images: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: () => []
  },
  tips: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: () => []
  },
  applicablePropertyTypes: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: () => []
  },
  applicableCities: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: () => []
  },
  applicableConditions: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: () => []
  },
  beforeAfterImages: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: () => []
  },
  priority: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  createdBy: {
    type: DataTypes.UUID,
    allowNull: true
  }
}, {
  timestamps: true
});

module.exports = Recommendation;
