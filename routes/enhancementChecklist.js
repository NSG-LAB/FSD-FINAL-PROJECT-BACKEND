const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// Delete a specific uploaded file from a checklist item
router.delete('/file/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'No file URL provided' });
    const item = await EnhancementChecklist.findByPk(itemId);
    if (!item) return res.status(404).json({ error: 'Checklist item not found' });
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
const enhancementChecklistService = require('../services/enhancementChecklistService');
const { EnhancementChecklist } = require('../models');
const upload = require('../middleware/uploadChecklistPhoto');
// Upload photo(s) for a checklist item
router.post('/upload/:id', upload.array('photos', 5), async (req, res) => {
  try {
    const { id } = req.params;
    const files = req.files;
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }
    // Get current item
    const item = await EnhancementChecklist.findByPk(id);
    if (!item) return res.status(404).json({ error: 'Checklist item not found' });
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
router.post('/', async (req, res) => {
  try {
    const item = await enhancementChecklistService.createChecklistItem(req.body);
    res.status(201).json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get checklist items for a property and type (before/after)
router.get('/:propertyId/:type', async (req, res) => {
  try {
    const { propertyId, type } = req.params;
    const items = await enhancementChecklistService.getChecklistItems(propertyId, type);
    res.json(items);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update a checklist item
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await enhancementChecklistService.updateChecklistItem(id, req.body);
    const updated = await EnhancementChecklist.findByPk(id);
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete a checklist item
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await enhancementChecklistService.deleteChecklistItem(id);
    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
