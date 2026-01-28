const express = require('express');
const Property = require('../models/Property');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Create property submission
router.post('/', authenticateToken, async (req, res) => {
  try {
    const propertyData = {
      ...req.body,
      userId: req.user.userId
    };

    const property = new Property(propertyData);
    await property.save();

    res.status(201).json({
      success: true,
      message: 'Property submitted successfully',
      property
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Get all properties
router.get('/', async (req, res) => {
  try {
    const { city, propertyType, status } = req.query;
    let filter = {};

    if (city) filter['location.city'] = city;
    if (propertyType) filter.propertyType = propertyType;
    if (status) filter.status = status;

    const properties = await Property.find(filter)
      .populate('userId', 'firstName lastName email')
      .populate('recommendations');

    res.json({ success: true, count: properties.length, properties });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get property by ID
router.get('/:id', async (req, res) => {
  try {
    const property = await Property.findById(req.params.id)
      .populate('userId')
      .populate('recommendations');

    if (!property) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }

    res.json({ success: true, property });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update property
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);

    if (!property) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }

    if (property.userId.toString() !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to update this property' });
    }

    const updatedProperty = await Property.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: Date.now() },
      { new: true }
    );

    res.json({ success: true, message: 'Property updated successfully', property: updatedProperty });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete property
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);

    if (!property) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }

    if (property.userId.toString() !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this property' });
    }

    await Property.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: 'Property deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
