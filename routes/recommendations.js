const express = require('express');
const Recommendation = require('../models/Recommendation');
const { authenticateToken, authorizeAdmin } = require('../middleware/auth');

const router = express.Router();

// Get all recommendations
router.get('/', async (req, res) => {
  try {
    const { category, city, difficulty } = req.query;
    let filter = { isActive: true };

    if (category) filter.category = category;
    if (difficulty) filter.difficulty = difficulty;

    const recommendations = await Recommendation.find(filter)
      .populate('relatedRecommendations')
      .sort('-priority');

    res.json({ success: true, count: recommendations.length, recommendations });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get recommendations for a property
router.get('/property/:propertyId', async (req, res) => {
  try {
    const Property = require('../models/Property');
    const property = await Property.findById(req.params.propertyId);

    if (!property) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }

    const filter = {
      isActive: true,
      $or: [
        { applicablePropertyTypes: property.propertyType },
        { applicablePropertyTypes: 'all' }
      ],
      $or: [
        { applicableConditions: property.condition },
        { applicableConditions: { $size: 0 } }
      ]
    };

    const recommendations = await Recommendation.find(filter).sort('-priority');

    res.json({ success: true, count: recommendations.length, recommendations });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create recommendation (Admin only)
router.post('/', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const recommendationData = {
      ...req.body,
      createdBy: req.user.userId
    };

    const recommendation = new Recommendation(recommendationData);
    await recommendation.save();

    res.status(201).json({
      success: true,
      message: 'Recommendation created successfully',
      recommendation
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Update recommendation (Admin only)
router.put('/:id', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const recommendation = await Recommendation.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: Date.now() },
      { new: true }
    );

    if (!recommendation) {
      return res.status(404).json({ success: false, message: 'Recommendation not found' });
    }

    res.json({
      success: true,
      message: 'Recommendation updated successfully',
      recommendation
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete recommendation (Admin only)
router.delete('/:id', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const recommendation = await Recommendation.findByIdAndDelete(req.params.id);

    if (!recommendation) {
      return res.status(404).json({ success: false, message: 'Recommendation not found' });
    }

    res.json({ success: true, message: 'Recommendation deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
