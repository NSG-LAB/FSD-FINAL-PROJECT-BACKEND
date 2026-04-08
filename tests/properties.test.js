const request = require('supertest');
const { Sequelize } = require('sequelize');
const express = require('express');
const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Set up test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_key_for_testing_only';
process.env.MYSQL_DB = process.env.MYSQL_DB || 'property_app_test';
process.env.MYSQL_USER = process.env.MYSQL_USER || 'root';
process.env.MYSQL_PASSWORD = process.env.MYSQL_PASSWORD || 'Root@123';
process.env.MYSQL_HOST = process.env.MYSQL_HOST || 'localhost';
process.env.MYSQL_PORT = process.env.MYSQL_PORT || '3306';

const TEST_DB_NAME = process.env.MYSQL_DB;

// Create test sequelize instance
const sequelize = new Sequelize({
  dialect: 'mysql',
  host: process.env.MYSQL_HOST || 'localhost',
  port: process.env.MYSQL_PORT || '3306',
  username: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || 'Root@123',
  database: TEST_DB_NAME,
  logging: false,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
});

// Define models for tests
const User = sequelize.define('User', {
  id: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  firstName: { type: Sequelize.STRING, allowNull: false },
  lastName: { type: Sequelize.STRING, allowNull: false },
  email: { type: Sequelize.STRING, allowNull: false, unique: true },
  password: { type: Sequelize.STRING, allowNull: false },
  city: { type: Sequelize.STRING, allowNull: false },
  state: { type: Sequelize.STRING, allowNull: false },
  role: { type: Sequelize.ENUM('user', 'admin'), defaultValue: 'user' },
  isVerified: { type: Sequelize.BOOLEAN, defaultValue: false }
}, { timestamps: true });

const Property = sequelize.define('Property', {
  id: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: Sequelize.INTEGER,
    allowNull: false,
    references: { model: User, key: 'id' }
  },
  address: { type: Sequelize.STRING, allowNull: false },
  city: { type: Sequelize.STRING, allowNull: false },
  state: { type: Sequelize.STRING, allowNull: false },
  zipCode: { type: Sequelize.STRING, allowNull: false },
  propertyType: { type: Sequelize.ENUM('house', 'apartment', 'condo', 'townhouse'), allowNull: false },
  bedrooms: { type: Sequelize.INTEGER, allowNull: false },
  bathrooms: { type: Sequelize.DECIMAL(3, 1), allowNull: false },
  squareFootage: { type: Sequelize.INTEGER, allowNull: false },
  yearBuilt: { type: Sequelize.INTEGER },
  purchasePrice: { type: Sequelize.DECIMAL(12, 2) },
  currentValue: { type: Sequelize.DECIMAL(12, 2) },
  monthlyRent: { type: Sequelize.DECIMAL(10, 2) },
  status: { type: Sequelize.ENUM('owned', 'rented', 'sold'), defaultValue: 'owned' }
}, { timestamps: true });

// Set up associations
User.hasMany(Property, { foreignKey: 'userId' });
Property.belongsTo(User, { foreignKey: 'userId' });

// Create Express app for testing
const app = express();
app.use(express.json());

// Mock auth middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Properties routes for testing
app.get('/api/properties', authenticateToken, async (req, res) => {
  try {
    const properties = await Property.findAll({
      where: { userId: req.user.id },
      include: [{ model: User, attributes: ['firstName', 'lastName', 'email'] }]
    });

    res.json({
      success: true,
      data: properties
    });
  } catch (error) {
    console.error('Get properties error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/properties', authenticateToken, async (req, res) => {
  try {
    const {
      address, city, state, zipCode, propertyType,
      bedrooms, bathrooms, squareFootage, yearBuilt,
      purchasePrice, currentValue, monthlyRent, status
    } = req.body;

    if (!address || !city || !state || !zipCode || !propertyType ||
        bedrooms === undefined || bathrooms === undefined || !squareFootage) {
      return res.status(400).json({ success: false, message: 'Required fields are missing' });
    }

    const property = await Property.create({
      userId: req.user.id,
      address, city, state, zipCode, propertyType,
      bedrooms, bathrooms, squareFootage, yearBuilt,
      purchasePrice, currentValue, monthlyRent, status
    });

    res.status(201).json({
      success: true,
      message: 'Property added successfully',
      data: property
    });
  } catch (error) {
    console.error('Create property error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/api/properties/:id', authenticateToken, async (req, res) => {
  try {
    const property = await Property.findOne({
      where: { id: req.params.id, userId: req.user.id },
      include: [{ model: User, attributes: ['firstName', 'lastName', 'email'] }]
    });

    if (!property) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }

    res.json({
      success: true,
      data: property
    });
  } catch (error) {
    console.error('Get property error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.put('/api/properties/:id', authenticateToken, async (req, res) => {
  try {
    const {
      address, city, state, zipCode, propertyType,
      bedrooms, bathrooms, squareFootage, yearBuilt,
      purchasePrice, currentValue, monthlyRent, status
    } = req.body;

    const [updatedRowsCount] = await Property.update({
      address, city, state, zipCode, propertyType,
      bedrooms, bathrooms, squareFootage, yearBuilt,
      purchasePrice, currentValue, monthlyRent, status
    }, {
      where: { id: req.params.id, userId: req.user.id }
    });

    if (updatedRowsCount === 0) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }

    const updatedProperty = await Property.findByPk(req.params.id);
    res.json({
      success: true,
      message: 'Property updated successfully',
      data: updatedProperty
    });
  } catch (error) {
    console.error('Update property error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.delete('/api/properties/:id', authenticateToken, async (req, res) => {
  try {
    const deletedRowsCount = await Property.destroy({
      where: { id: req.params.id, userId: req.user.id }
    });

    if (deletedRowsCount === 0) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }

    res.json({
      success: true,
      message: 'Property deleted successfully'
    });
  } catch (error) {
    console.error('Delete property error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Helper function to create test user and get token
const createTestUserAndGetToken = async () => {
  const user = await User.create({
    firstName: 'Test',
    lastName: 'User',
    email: 'test@example.com',
    password: 'hashedpassword',
    city: 'TestCity',
    state: 'TestState'
  });

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );

  return { user, token };
};

describe('Properties Routes', () => {
  let testUser, authToken;

  beforeAll(async () => {
    try {
      // Recreate schema within configured test DB without requiring DB-level CREATE/DROP privileges.
      await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
      await sequelize.sync({ force: true });
      await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');

      const result = await createTestUserAndGetToken();
      testUser = result.user;
      authToken = result.token;
    } catch (error) {
      console.error('Test database setup failed:', error);
      throw error;
    }
  });

  afterAll(async () => {
    await sequelize.close();
  });

  describe('GET /api/properties', () => {
    it('should return empty array when no properties exist', async () => {
      const response = await request(app)
        .get('/api/properties')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
    });

    it('should return user properties', async () => {
      // Create a test property
      await Property.create({
        userId: testUser.id,
        address: '123 Test St',
        city: 'TestCity',
        state: 'TestState',
        zipCode: '12345',
        propertyType: 'house',
        bedrooms: 3,
        bathrooms: 2.5,
        squareFootage: 2000
      });

      const response = await request(app)
        .get('/api/properties')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].address).toBe('123 Test St');
    });

    it('should return 401 without auth token', async () => {
      const response = await request(app)
        .get('/api/properties')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Access token required');
    });
  });

  describe('POST /api/properties', () => {
    it('should create a new property', async () => {
      const propertyData = {
        address: '456 New St',
        city: 'NewCity',
        state: 'NewState',
        zipCode: '67890',
        propertyType: 'apartment',
        bedrooms: 2,
        bathrooms: 1,
        squareFootage: 1000,
        yearBuilt: 2020,
        purchasePrice: 200000,
        currentValue: 220000,
        monthlyRent: 1500,
        status: 'owned'
      };

      const response = await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${authToken}`)
        .send(propertyData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Property added successfully');
      expect(response.body.data.address).toBe(propertyData.address);
      expect(response.body.data.userId).toBe(testUser.id);
    });

    it('should return 400 for missing required fields', async () => {
      const incompleteData = {
        address: '456 New St',
        city: 'NewCity'
        // Missing required fields
      };

      const response = await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${authToken}`)
        .send(incompleteData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Required fields are missing');
    });
  });

  describe('GET /api/properties/:id', () => {
    let testProperty;

    beforeEach(async () => {
      testProperty = await Property.create({
        userId: testUser.id,
        address: '789 Detail St',
        city: 'DetailCity',
        state: 'DetailState',
        zipCode: '11111',
        propertyType: 'condo',
        bedrooms: 1,
        bathrooms: 1,
        squareFootage: 800
      });
    });

    it('should return property details', async () => {
      const response = await request(app)
        .get(`/api/properties/${testProperty.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testProperty.id);
      expect(response.body.data.address).toBe(testProperty.address);
    });

    it('should return 404 for non-existent property', async () => {
      const response = await request(app)
        .get('/api/properties/99999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Property not found');
    });
  });

  describe('PUT /api/properties/:id', () => {
    let testProperty;

    beforeEach(async () => {
      testProperty = await Property.create({
        userId: testUser.id,
        address: '999 Update St',
        city: 'UpdateCity',
        state: 'UpdateState',
        zipCode: '22222',
        propertyType: 'house',
        bedrooms: 4,
        bathrooms: 3,
        squareFootage: 2500
      });
    });

    it('should update property successfully', async () => {
      const updateData = {
        address: '999 Updated St',
        bedrooms: 5,
        bathrooms: 3.5
      };

      const response = await request(app)
        .put(`/api/properties/${testProperty.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Property updated successfully');
      expect(response.body.data.address).toBe(updateData.address);
      expect(response.body.data.bedrooms).toBe(updateData.bedrooms);
    });

    it('should return 404 for non-existent property', async () => {
      const response = await request(app)
        .put('/api/properties/99999')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ address: 'New Address' })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Property not found');
    });
  });

  describe('DELETE /api/properties/:id', () => {
    let testProperty;

    beforeEach(async () => {
      testProperty = await Property.create({
        userId: testUser.id,
        address: '000 Delete St',
        city: 'DeleteCity',
        state: 'DeleteState',
        zipCode: '33333',
        propertyType: 'townhouse',
        bedrooms: 3,
        bathrooms: 2,
        squareFootage: 1800
      });
    });

    it('should delete property successfully', async () => {
      const response = await request(app)
        .delete(`/api/properties/${testProperty.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Property deleted successfully');

      // Verify property is deleted
      const deletedProperty = await Property.findByPk(testProperty.id);
      expect(deletedProperty).toBeNull();
    });

    it('should return 404 for non-existent property', async () => {
      const response = await request(app)
        .delete('/api/properties/99999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Property not found');
    });
  });
});