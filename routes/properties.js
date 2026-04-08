
const multer = require('multer');
const path = require('path');
const express = require('express');
const { Op } = require('sequelize');
const { sequelize, Property } = require('../models');
const { authenticateToken } = require('../middleware/auth');
const { propertyRules, handleValidationErrors } = require('../middleware/validation');
const logger = require('../utils/logger');
const { clearCache } = require('../middleware/cache');
const { Parser } = require('json2csv');

const router = express.Router();

// Set up multer storage for image uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../uploads/'));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});
const upload = multer({ storage });

// Image upload endpoint
router.post('/upload-image', authenticateToken, upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }
  // Return the file path for preview (relative to /uploads/)
  const filePath = `/uploads/${req.file.filename}`;
  res.json({ success: true, message: 'Image uploaded successfully', filePath });
});

// Export properties as CSV
router.get('/export/csv', authenticateToken, async (req, res) => {
  try {
    const whereClause = req.user.role === 'admin' ? {} : { userId: req.user.userId };
    const properties = await Property.findAll({ where: whereClause });
    const fields = [
      'id', 'userId', 'title', 'description', 'propertyType', 'age', 'builUpArea',
      'bedrooms', 'bathrooms', 'location', 'condition', 'currentValue', 'features',
      'images', 'improvements', 'estimatedNewValue', 'potentialValueIncrease', 'status',
      'createdAt', 'updatedAt', 'deletedAt'
    ];
    const opts = { fields };
    const parser = new Parser(opts);
    const csv = parser.parse(properties.map(p => p.toJSON()));
    res.header('Content-Type', 'text/csv');
    res.attachment('properties_export.csv');
    return res.send(csv);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create property submission
router.post('/', authenticateToken, propertyRules.create, handleValidationErrors, async (req, res) => {
  try {
    const propertyData = {
      ...req.body,
      userId: req.user.userId
    };

    const property = await Property.create(propertyData);

    // Auto-create enhancement checklist items
    const { ensureChecklistForProperty } = require('../services/checklistAutoCreateService');
    await ensureChecklistForProperty(property.id, property.userId);

    // Clear properties cache
    await clearCache('__express__/api/properties*');

    res.status(201).json({
      success: true,
      message: 'Property submitted successfully',
      property
    });
  } catch (error) {
    logger.error('Property creation error:', error.message);
    res.status(400).json({ success: false, message: error.message });
  }
});

// Get all properties
router.get('/', authenticateToken, async (req, res) => {
  try {
    const {
      city,
      propertyType,
      status,
      userId,
      q,
      limit = '10',
      offset = '0',
      sortBy = 'createdAt',
      order = 'DESC'
    } = req.query;

    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
    const parsedOffset = Math.max(parseInt(offset, 10) || 0, 0);
    const allowedSortFields = ['createdAt', 'updatedAt', 'currentValue', 'title', 'status'];
    const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const safeOrder = String(order).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

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
    if (q) {
      whereClause[Op.or] = [
        { title: { [Op.like]: `%${q}%` } },
        { description: { [Op.like]: `%${q}%` } }
      ];
    }

    if (req.user.role !== 'admin') {
      whereClause.userId = req.user.userId;
    } else if (userId) {
      whereClause.userId = userId;
    }

    if (jsonFilters.length) {
      whereClause[Op.and] = jsonFilters;
    }

    const { count, rows } = await Property.findAndCountAll({
      where: whereClause,
      include: [
        { association: 'owner', attributes: ['id', 'firstName', 'lastName', 'email'] },
        { association: 'recommendations', through: { attributes: [] } }
      ],
      order: [[safeSortBy, safeOrder]],
      limit: parsedLimit,
      offset: parsedOffset,
      distinct: true
    });

    res.json({
      success: true,
      count,
      limit: parsedLimit,
      offset: parsedOffset,
      hasMore: parsedOffset + rows.length < count,
      properties: rows
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get property by ID
router.get('/:id', authenticateToken, async (req, res) => {
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

    if (property.userId !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to view this property' });
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

    // Clear properties cache
    await clearCache('__express__/api/properties*');

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

    // Clear properties cache
    await clearCache('__express__/api/properties*');

    res.json({ success: true, message: 'Property deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
