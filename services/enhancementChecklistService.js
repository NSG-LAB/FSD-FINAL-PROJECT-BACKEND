const { EnhancementChecklist } = require('../models');
const axios = require('axios');

// Create a checklist item
async function createChecklistItem(data) {
  return EnhancementChecklist.create(data);
}

// Get checklist items for a property (before/after)
async function getChecklistItems(propertyId, type, extraWhere = {}) {
  return EnhancementChecklist.findAll({
    where: { propertyId, type, ...extraWhere },
    order: [['createdAt', 'ASC']]
  });
}

// Update checklist item (mark complete, add notes, attachments)
async function updateChecklistItem(id, updates) {
  return EnhancementChecklist.update(updates, { where: { id } });
}

// Delete checklist item
async function deleteChecklistItem(id) {
  return EnhancementChecklist.destroy({ where: { id } });
}

// Call AI service for property price prediction
async function predictPropertyPrice(features) {
  try {
    const response = await axios.post('http://localhost:8000/predict-price', features);
    return response.data;
  } catch (error) {
    console.error('Error calling AI service for price prediction:', error.message);
    throw new Error('AI service unavailable for price prediction.');
  }
}

// Call AI service for ROI prediction
async function predictRenovationROI(data) {
  try {
    const response = await axios.post('http://localhost:8000/predict-roi', data);
    return response.data;
  } catch (error) {
    console.error('Error calling AI service for ROI prediction:', error.message);
    throw new Error('AI service unavailable for ROI prediction.');
  }
}

// Call AI service for renovation recommendations
async function getRenovationRecommendations(features) {
  try {
    const response = await axios.post('http://localhost:8000/recommend-renovations', { property_features: features });
    return response.data;
  } catch (error) {
    console.error('Error calling AI service for renovation recommendations:', error.message);
    throw new Error('AI service unavailable for renovation recommendations.');
  }
}

module.exports = {
  createChecklistItem,
  getChecklistItems,
  updateChecklistItem,
  deleteChecklistItem,
  predictPropertyPrice,
  predictRenovationROI,
  getRenovationRecommendations
};
