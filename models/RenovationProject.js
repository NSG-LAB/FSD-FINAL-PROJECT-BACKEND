const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const RenovationProject = sequelize.define('RenovationProject', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  propertyId: {
    type: DataTypes.UUID,
    allowNull: false
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
  status: {
    type: DataTypes.ENUM('planning', 'in-progress', 'on-hold', 'completed'),
    defaultValue: 'planning'
  },
  city: {
    type: DataTypes.STRING,
    allowNull: true
  },
  plannedBudget: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0
  },
  spentBudget: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0
  },
  expectedValueUplift: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0
  },
  completionPercentage: {
    type: DataTypes.FLOAT,
    defaultValue: 0
  },
  userGoals: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: () => []
  },
  tasks: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: () => []
  },
  progressTimeline: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: () => []
  },
  startDate: {
    type: DataTypes.DATE,
    allowNull: true
  },
  targetDate: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  timestamps: true,
  paranoid: true
});

module.exports = RenovationProject;
