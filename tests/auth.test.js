const request = require('supertest');
const { Sequelize } = require('sequelize');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Set up test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_key_for_testing_only';
process.env.MYSQL_DB = 'property_app_test';
process.env.MYSQL_USER = process.env.MYSQL_USER || 'root';
process.env.MYSQL_PASSWORD = process.env.MYSQL_PASSWORD || 'Root@123';
process.env.MYSQL_HOST = process.env.MYSQL_HOST || 'localhost';
process.env.MYSQL_PORT = process.env.MYSQL_PORT || '3306';

// Create test sequelize instance
const sequelize = new Sequelize({
  dialect: 'mysql',
  host: process.env.MYSQL_HOST || 'localhost',
  port: process.env.MYSQL_PORT || '3306',
  username: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || 'Root@123',
  database: 'property_app_test', // Hardcoded for auth tests
  logging: false,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
});

// Define User model for tests
const User = sequelize.define('User', {
  id: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  firstName: {
    type: Sequelize.STRING,
    allowNull: false
  },
  lastName: {
    type: Sequelize.STRING,
    allowNull: false
  },
  email: {
    type: Sequelize.STRING,
    allowNull: false,
    unique: true
  },
  password: {
    type: Sequelize.STRING,
    allowNull: false
  },
  city: {
    type: Sequelize.STRING,
    allowNull: false
  },
  state: {
    type: Sequelize.STRING,
    allowNull: false
  },
  role: {
    type: Sequelize.ENUM('user', 'admin'),
    defaultValue: 'user'
  },
  isVerified: {
    type: Sequelize.BOOLEAN,
    defaultValue: false
  }
}, {
  timestamps: true
});

// Create Express app for testing
const app = express();
app.use(express.json());

// Auth routes for testing
app.post('/api/auth/register', async (req, res) => {
  try {
    const { firstName, lastName, email, password, city, state } = req.body;

    if (!firstName || !lastName || !email || !password || !city || !state) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long' });
    }

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      firstName,
      lastName,
      email,
      password: hashedPassword,
      city,
      state
    });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        city: user.city,
        state: user.state,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        city: user.city,
        state: user.state,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

describe('Auth Routes', () => {
  let loginTestEmail;

  beforeAll(async () => {
    try {
      await sequelize.authenticate();
      await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
      await sequelize.sync({ force: true });
      await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
    } catch (error) {
      console.error('Test database setup failed:', error);
      throw error;
    }
  });

  afterAll(async () => {
    await sequelize.close();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        password: 'password123',
        city: 'Mumbai',
        state: 'Maharashtra'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('User registered successfully');
      expect(response.body.token).toBeDefined();
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe(userData.email);
    });

    it('should return 400 for missing required fields', async () => {
      const incompleteData = {
        firstName: 'John',
        email: 'john.doe@example.com'
        // Missing lastName, password, city, state
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(incompleteData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('All fields are required');
    });

    it('should return 400 if password is too short', async () => {
      const userData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        password: '123',
        city: 'Mumbai',
        state: 'Maharashtra'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Password must be at least 6 characters long');
    });

    it('should return 400 if user already exists', async () => {
      const userData = {
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane.smith@example.com',
        password: 'password123',
        city: 'Delhi',
        state: 'Delhi'
      };

      // First registration
      await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      // Second registration with same email
      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('User already exists');
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Create a fresh test user for each login test
      loginTestEmail = `login${Date.now()}@example.com`;
      const hashedPassword = await bcrypt.hash('password123', 10);
      await User.create({
        firstName: 'Login',
        lastName: 'Test',
        email: loginTestEmail,
        password: hashedPassword,
        city: 'Bangalore',
        state: 'Karnataka'
      });
    });

    it('should login successfully with correct credentials', async () => {
      const loginData = {
        email: loginTestEmail,
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Login successful');
      expect(response.body.token).toBeDefined();
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe(loginData.email);
    });

    it('should return 401 for invalid credentials', async () => {
      const loginData = {
        email: loginTestEmail,
        password: 'wrongpassword'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid credentials');
    });

    it('should return 400 if email or password is missing', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: loginTestEmail })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Email and password are required');
    });
  });
});
