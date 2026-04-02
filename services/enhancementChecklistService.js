const { EnhancementChecklist } = require('../models');

// Create a checklist item
async function createChecklistItem(data) {
  return EnhancementChecklist.create(data);
}

// Get checklist items for a property (before/after)
async function getChecklistItems(propertyId, type) {
  return EnhancementChecklist.findAll({
    where: { propertyId, type },
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

module.exports = {
  createChecklistItem,
  getChecklistItems,
  updateChecklistItem,
  deleteChecklistItem
};
