const { sequelize } = require('../config/database');
const User = require('./User');
const Property = require('./Property');
const Recommendation = require('./Recommendation');
const Notification = require('./Notification');
const EnhancementChecklist = require('./EnhancementChecklist');
// EnhancementChecklist associations
Property.hasMany(EnhancementChecklist, {
  as: 'enhancementChecklists',
  foreignKey: 'propertyId'
});

EnhancementChecklist.belongsTo(Property, {
  as: 'property',
  foreignKey: 'propertyId'
});

User.hasMany(EnhancementChecklist, {
  as: 'userEnhancementChecklists',
  foreignKey: 'userId'
});

EnhancementChecklist.belongsTo(User, {
  as: 'user',
  foreignKey: 'userId'
});

User.hasMany(Property, {
  as: 'propertySubmissions',
  foreignKey: 'userId'
});

Property.belongsTo(User, {
  as: 'owner',
  foreignKey: 'userId'
});

User.belongsToMany(Recommendation, {
  through: 'UserSavedRecommendations',
  as: 'savedRecommendations',
  foreignKey: 'userId',
  otherKey: 'recommendationId'
});

Recommendation.belongsToMany(User, {
  through: 'UserSavedRecommendations',
  as: 'savedByUsers',
  foreignKey: 'recommendationId',
  otherKey: 'userId'
});

Property.belongsToMany(Recommendation, {
  through: 'PropertyRecommendations',
  as: 'recommendations',
  foreignKey: 'propertyId',
  otherKey: 'recommendationId'
});

Recommendation.belongsToMany(Property, {
  through: 'PropertyRecommendations',
  as: 'properties',
  foreignKey: 'recommendationId',
  otherKey: 'propertyId'
});

Recommendation.belongsToMany(Recommendation, {
  through: 'RecommendationRelations',
  as: 'relatedRecommendations',
  foreignKey: 'recommendationId',
  otherKey: 'relatedRecommendationId'
});

Recommendation.belongsTo(User, {
  as: 'creator',
  foreignKey: 'createdBy'
});

User.hasMany(Notification, {
  as: 'notifications',
  foreignKey: 'userId'
});

Notification.belongsTo(User, {
  as: 'user',
  foreignKey: 'userId'
});

module.exports = {
  sequelize,
  User,
  Property,
  Recommendation,
  Notification,
  EnhancementChecklist
};
