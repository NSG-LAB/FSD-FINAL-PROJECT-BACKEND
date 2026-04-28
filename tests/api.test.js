const request = require('supertest');
const app = require('../server'); // Assuming server.js is the entry point
const { sequelize } = require('../models');

beforeAll(async () => {
  await sequelize.sync(); // Ensure database is ready
});

afterAll(async () => {
  await sequelize.close(); // Close DB connection
});

describe('API Input Validation Tests', () => {
  test('POST /api/properties - Missing required fields', async () => {
    const response = await request(app)
      .post('/api/properties')
      .send({});
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('message');
  });

  test('POST /api/properties - Invalid data types', async () => {
    const response = await request(app)
      .post('/api/properties')
      .send({
        title: 12345, // Should be a string
        builtUpArea: 'large', // Should be a number
      });
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('message');
  });

  test('POST /api/properties - SQL injection attempt', async () => {
    const response = await request(app)
      .post('/api/properties')
      .send({
        title: "'; DROP TABLE properties; --",
        builtUpArea: 1000,
      });
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('message');
  });
});

describe('Authentication Tests', () => {
  test('GET /api/properties - Missing JWT token', async () => {
    const response = await request(app).get('/api/properties');
    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('message', 'Unauthorized');
  });

  test('GET /api/properties - Expired JWT token', async () => {
    const expiredToken = 'expired.jwt.token'; // Replace with an actual expired token
    const response = await request(app)
      .get('/api/properties')
      .set('Authorization', `Bearer ${expiredToken}`);
    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('message', 'Token expired');
  });
});

describe('Edge Case Tests', () => {
  test('GET /api/properties - Empty database response', async () => {
    const response = await request(app).get('/api/properties');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('data');
    expect(response.body.data).toEqual([]); // Assuming empty array for no data
  });

  test('POST /api/properties - Duplicate entry', async () => {
    const property = { title: 'Test Property', builtUpArea: 1000 };
    await request(app).post('/api/properties').send(property);
    const response = await request(app).post('/api/properties').send(property);
    expect(response.status).toBe(409);
    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('message', 'Duplicate entry');
  });
});