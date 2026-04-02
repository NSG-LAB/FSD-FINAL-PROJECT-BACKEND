const { EnhancementChecklist } = require('../models');

const BEFORE_ITEMS = [
  'Document current condition (photos)',
  'Get property appraised',
  'Note existing issues',
  'Plan budget',
  'Research contractors',
  'Create timeline'
];
const AFTER_ITEMS = [
  'Get work certified',
  'Take after photos',
  'Collect warranties',
  'Get updated appraisal',
  'Document improvements',
  'Update property records'
];

async function ensureChecklistForProperty(propertyId, userId) {
  const before = await EnhancementChecklist.findAll({ where: { propertyId, type: 'before' } });
  const after = await EnhancementChecklist.findAll({ where: { propertyId, type: 'after' } });
  if (before.length === 0) {
    await Promise.all(BEFORE_ITEMS.map(item => EnhancementChecklist.create({ propertyId, userId, type: 'before', item })));
  }
  if (after.length === 0) {
    await Promise.all(AFTER_ITEMS.map(item => EnhancementChecklist.create({ propertyId, userId, type: 'after', item })));
  }
}

module.exports = { ensureChecklistForProperty };
