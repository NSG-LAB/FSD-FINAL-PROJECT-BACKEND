const express = require('express');
const { Op } = require('sequelize');
const { sequelize, Property } = require('../models');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Create property submission
router.post('/', authenticateToken, async (req, res) => {
  try {
    const propertyData = {
      ...req.body,
      userId: req.user.userId
    };

    const property = await Property.create(propertyData);

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
    const whereClause = {};
    if (propertyType) {
      whereClause.propertyType = propertyType;
    }
    if (status) {
      whereClause.status = status;
    }

    const jsonFilters = [];
    if (city) {
      jsonFilters.push(sequelize.where(sequelize.json('location.city'), city));
    }
    if (jsonFilters.length) {
      whereClause[Op.and] = jsonFilters;
    }

    const properties = await Property.findAll({
      where: whereClause,
      include: [
        { association: 'owner', attributes: ['id', 'firstName', 'lastName', 'email'] },
        { association: 'recommendations', through: { attributes: [] } }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json({ success: true, count: properties.length, properties });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get property by ID
router.get('/:id', async (req, res) => {
  try {
    const property = await Property.findByPk(req.params.id, {
      include: [
        { association: 'owner' },
        { association: 'recommendations', through: { attributes: [] } }
      ]
    });

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
    const property = await Property.findByPk(req.params.id);

    if (!property) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }

    if (property.userId !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to update this property' });
    }

    await property.update({ ...req.body });

    res.json({ success: true, message: 'Property updated successfully', property });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete property
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const property = await Property.findByPk(req.params.id);

    if (!property) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }

    if (property.userId !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this property' });
    }

    await property.destroy();

    res.json({ success: true, message: 'Property deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
