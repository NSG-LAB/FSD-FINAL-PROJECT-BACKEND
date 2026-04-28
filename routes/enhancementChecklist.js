const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { authenticateToken } = require('../middleware/auth');
const enhancementChecklistService = require('../services/enhancementChecklistService');
const { EnhancementChecklist, Property } = require('../models');
const upload = require('../middleware/uploadChecklistPhoto');

const isAdmin = (req) => req.user?.role === 'admin';

const canAccessItem = (req, item) => item && (item.userId === req.user.userId || isAdmin(req));

const canAccessProperty = async (req, propertyId) => {
  if (isAdmin(req)) {
    return true;
  }

  const property = await Property.findByPk(propertyId, { attributes: ['id', 'userId'] });
  return Boolean(property && property.userId === req.user.userId);
};

// Delete a specific uploaded file from a checklist item
router.delete('/file/:itemId', authenticateToken, async (req, res) => {
  try {
    const { itemId } = req.params;
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'No file URL provided' });
    const item = await EnhancementChecklist.findByPk(itemId);
    if (!item) return res.status(404).json({ error: 'Checklist item not found' });
    if (!canAccessItem(req, item)) {
      return res.status(403).json({ error: 'Not authorized to modify this checklist item' });
    }

    const updatedUrls = (item.attachmentUrls || []).filter(u => u !== url);
    await item.update({ attachmentUrls: updatedUrls });
    // Remove file from disk if local
    if (url.startsWith('/uploads/')) {
      const filePath = path.join(__dirname, '..', url);
      fs.unlink(filePath, err => {}); // Ignore errors
    }
    res.json({ success: true, urls: updatedUrls });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Upload photo(s) for a checklist item
router.post('/upload/:id', authenticateToken, upload.array('photos', 5), async (req, res) => {
  try {
    const { id } = req.params;
    const files = req.files;
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }
    // Get current item
    const item = await EnhancementChecklist.findByPk(id);
    if (!item) return res.status(404).json({ error: 'Checklist item not found' });
    if (!canAccessItem(req, item)) {
      return res.status(403).json({ error: 'Not authorized to modify this checklist item' });
    }

    // Add new file URLs to attachmentUrls
    const newUrls = files.map(f => `/uploads/checklist/${f.filename}`);
    const updatedUrls = Array.isArray(item.attachmentUrls) ? [...item.attachmentUrls, ...newUrls] : newUrls;
    await item.update({ attachmentUrls: updatedUrls });
    res.json({ success: true, urls: updatedUrls });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Create a checklist item
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { propertyId } = req.body;
    const hasAccess = await canAccessProperty(req, propertyId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Not authorized to create checklist item for this property' });
    }

    const payload = {
      ...req.body,
      userId: isAdmin(req) && req.body.userId ? req.body.userId : req.user.userId,
    };

    const item = await enhancementChecklistService.createChecklistItem(payload);
    res.status(201).json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get checklist items for a property and type (before/after)
router.get('/:propertyId/:type', authenticateToken, async (req, res) => {
  try {
    const { propertyId, type } = req.params;
    const hasAccess = await canAccessProperty(req, propertyId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Not authorized to view checklist items for this property' });
    }

    const items = await enhancementChecklistService.getChecklistItems(
      propertyId,
      type,
      isAdmin(req) ? {} : { userId: req.user.userId }
    );
    res.json(items);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update a checklist item
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const existingItem = await EnhancementChecklist.findByPk(id);
    if (!existingItem) {
      return res.status(404).json({ error: 'Checklist item not found' });
    }
    if (!canAccessItem(req, existingItem)) {
      return res.status(403).json({ error: 'Not authorized to update this checklist item' });
    }

    await enhancementChecklistService.updateChecklistItem(id, req.body);
    const updated = await EnhancementChecklist.findByPk(id);
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete a checklist item
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const existingItem = await EnhancementChecklist.findByPk(id);
    if (!existingItem) {
      return res.status(404).json({ error: 'Checklist item not found' });
    }
    if (!canAccessItem(req, existingItem)) {
      return res.status(403).json({ error: 'Not authorized to delete this checklist item' });
    }

    await enhancementChecklistService.deleteChecklistItem(id);
    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Predict property price
router.post('/predict-price', authenticateToken, async (req, res) => {
  try {
    const prediction = await enhancementChecklistService.predictPropertyPrice(req.body);
    res.json(prediction);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Predict renovation ROI
router.post('/predict-roi', authenticateToken, async (req, res) => {
  try {
    const prediction = await enhancementChecklistService.predictRenovationROI(req.body);
    res.json(prediction);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get renovation recommendations
router.post('/recommend-renovations', authenticateToken, async (req, res) => {
  try {
    const recommendations = await enhancementChecklistService.getRenovationRecommendations(req.body);
    res.json(recommendations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
