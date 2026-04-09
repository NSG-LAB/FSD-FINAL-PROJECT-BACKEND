const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_key_for_testing_only';

const mockUserModel = {
  findOne: jest.fn(),
  create: jest.fn(),
  scope: jest.fn()
};

jest.mock('../models', () => ({
  User: mockUserModel
}));

jest.mock('../middleware/rateLimiter', () => ({
  loginLimiter: (req, res, next) => next(),
  registerLimiter: (req, res, next) => next()
}));

jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

const authRouter = require('../routes/auth');

const createApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  return app;
};

describe('Auth Routes (integration-style with real route module)', () => {
  let app;

  beforeEach(() => {
    app = createApp();
    jest.clearAllMocks();
  });

  describe('POST /api/auth/register', () => {
    it('registers a new user', async () => {
      mockUserModel.findOne.mockResolvedValue(null);
      mockUserModel.create.mockResolvedValue({
        id: 'user-1',
        email: 'john@example.com',
        role: 'user',
        get: () => ({
          id: 'user-1',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          role: 'user',
          password: 'hashed'
        })
      });

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          password: 'Password123',
          city: 'Mumbai',
          state: 'Maharashtra'
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.user.email).toBe('john@example.com');
      expect(response.body.user.password).toBeUndefined();
      expect(response.body.token).toBeDefined();
    });

    it('rejects duplicate email', async () => {
      mockUserModel.findOne.mockResolvedValue({ id: 'existing' });

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          firstName: 'Jane',
          lastName: 'Doe',
          email: 'jane@example.com',
          password: 'Password123',
          city: 'Pune',
          state: 'Maharashtra'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Email already registered');
    });
  });

  describe('POST /api/auth/login', () => {
    it('logs in with valid credentials', async () => {
      const mockUser = {
        id: 'user-2',
        email: 'login@example.com',
        role: 'user',
        comparePassword: jest.fn().mockResolvedValue(true),
        get: () => ({
          id: 'user-2',
          email: 'login@example.com',
          role: 'user',
          password: 'hashed'
        })
      };
      mockUserModel.scope.mockReturnValue({
        findOne: jest.fn().mockResolvedValue(mockUser)
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'login@example.com', password: 'Password123' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.token).toBeDefined();
      expect(response.body.user.password).toBeUndefined();
    });

    it('returns 401 for invalid credentials', async () => {
      mockUserModel.scope.mockReturnValue({
        findOne: jest.fn().mockResolvedValue(null)
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'missing@example.com', password: 'Password123' })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid credentials');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('rejects when token is missing', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .expect(401);

      expect(response.body.message).toBe('Access token required');
    });

    it('rejects invalid token', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', 'Bearer invalid-token')
        .expect(403);

      expect(response.body.message).toBe('Invalid or expired token');
    });

    it('succeeds with valid token', async () => {
      const token = jwt.sign(
        { userId: 'user-1', email: 'user@example.com', role: 'user' },
        process.env.JWT_SECRET
      );

      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });
});
