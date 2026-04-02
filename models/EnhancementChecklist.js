const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const EnhancementChecklist = sequelize.define('EnhancementChecklist', {
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
  type: {
    type: DataTypes.ENUM('before', 'after'),
    allowNull: false
  },
  item: {
    type: DataTypes.STRING,
    allowNull: false
  },
  completed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  attachmentUrls: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: () => []
  }
}, {
  timestamps: true,
  paranoid: true
});

module.exports = EnhancementChecklist;
