const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Property = sequelize.define('Property', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  propertyType: {
    type: DataTypes.ENUM('apartment', 'house', 'villa', 'townhouse', 'studio'),
    allowNull: false
  },
  age: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  builUpArea: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  bedrooms: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  bathrooms: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  location: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: () => ({})
  },
  condition: {
    type: DataTypes.ENUM('excellent', 'good', 'average', 'needs-work'),
    allowNull: false
  },
  currentValue: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false
  },
  features: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: () => []
  },
  images: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: () => []
  },
  improvements: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: () => []
  },
  estimatedNewValue: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0
  },
  potentialValueIncrease: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0
  },
  status: {
    type: DataTypes.ENUM('pending', 'reviewed', 'recommended'),
    defaultValue: 'pending'
  }
}, {
  timestamps: true
});

module.exports = Property;
