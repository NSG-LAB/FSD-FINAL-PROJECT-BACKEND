const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_key_for_testing_only';

const mockPropertyModel = {
  create: jest.fn(),
  findAndCountAll: jest.fn(),
  findByPk: jest.fn(),
  findAll: jest.fn()
};

const mockSequelize = {
  where: jest.fn(),
  json: jest.fn(),
  fn: jest.fn(),
  col: jest.fn(),
  literal: jest.fn(),
  escape: jest.fn((v) => `'${String(v)}'`)
};

jest.mock('../models', () => ({
  sequelize: mockSequelize,
  Property: mockPropertyModel
}));

jest.mock('../services/checklistAutoCreateService', () => ({
  ensureChecklistForProperty: jest.fn().mockResolvedValue(undefined)
}));

const mockClearCache = jest.fn().mockResolvedValue(undefined);
jest.mock('../middleware/cache', () => ({
  clearCache: (...args) => mockClearCache(...args)
}));

jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

const propertiesRouter = require('../routes/properties');

const createApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/properties', propertiesRouter);
  return app;
};

const tokenFor = (payload) => jwt.sign(payload, process.env.JWT_SECRET);

describe('Properties Routes (integration-style with real route module)', () => {
  let app;
  const uploadsDir = path.join(__dirname, '..', 'uploads');

  beforeEach(() => {
    app = createApp();
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (!fs.existsSync(uploadsDir)) return;
    for (const name of fs.readdirSync(uploadsDir)) {
      if (name.startsWith('property-')) {
        fs.unlinkSync(path.join(uploadsDir, name));
      }
    }
  });

  describe('GET /api/properties', () => {
    it('returns 401 without auth token', async () => {
      const response = await request(app)
        .get('/api/properties')
        .expect(401);

      expect(response.body.message).toBe('Access token required');
    });

    it('returns properties for authenticated user', async () => {
      mockPropertyModel.findAndCountAll.mockResolvedValue({
        count: 1,
        rows: [{ id: 'prop-1', title: 'My House' }]
      });

      const response = await request(app)
        .get('/api/properties')
        .set('Authorization', `Bearer ${tokenFor({ userId: 'u-1', role: 'user' })}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.properties).toHaveLength(1);
    });
  });

  describe('POST /api/properties', () => {
    it('creates a property and clears cache', async () => {
      mockPropertyModel.create.mockResolvedValue({
        id: 'prop-2',
        userId: 'u-1',
        title: 'New Property'
      });

      const response = await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${tokenFor({ userId: 'u-1', role: 'user' })}`)
        .send({
          title: 'New Property',
          propertyType: 'house',
          age: 10,
          builtUpArea: 1200,
          bedrooms: 3,
          bathrooms: 2,
          condition: 'good',
          currentValue: 10000000
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(mockClearCache).toHaveBeenCalledWith('__express__/api/properties*');
    });
  });

  describe('GET /api/properties/:id authorization', () => {
    it('blocks non-owner non-admin access', async () => {
      mockPropertyModel.findByPk.mockResolvedValue({
        id: 'prop-1',
        userId: 'owner-id'
      });

      const response = await request(app)
        .get('/api/properties/prop-1')
        .set('Authorization', `Bearer ${tokenFor({ userId: 'other-user', role: 'user' })}`)
        .expect(403);

      expect(response.body.message).toMatch(/Not authorized/);
    });

    it('allows admin access', async () => {
      mockPropertyModel.findByPk.mockResolvedValue({
        id: 'prop-1',
        userId: 'owner-id'
      });

      const response = await request(app)
        .get('/api/properties/prop-1')
        .set('Authorization', `Bearer ${tokenFor({ userId: 'admin-id', role: 'admin' })}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/properties/upload-image', () => {
    it('rejects unsupported file types', async () => {
      const response = await request(app)
        .post('/api/properties/upload-image')
        .set('Authorization', `Bearer ${tokenFor({ userId: 'u-1', role: 'user' })}`)
        .attach('image', Buffer.from('plain text'), {
          filename: 'note.txt',
          contentType: 'text/plain'
        })
        .expect(400);

      expect(response.body.message).toMatch(/Only JPG, PNG, and WEBP images are allowed/);
    });

    it('accepts png uploads', async () => {
      const response = await request(app)
        .post('/api/properties/upload-image')
        .set('Authorization', `Bearer ${tokenFor({ userId: 'u-1', role: 'user' })}`)
        .attach('image', Buffer.from('fake png bytes'), {
          filename: 'photo.png',
          contentType: 'image/png'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.filePath).toMatch(/^\/uploads\/property-/);
    });
  });
});
