const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Property Value Enhancement API',
    version: '1.0.0',
    description: 'Core API documentation for authentication, properties, and recommendations.'
  },
  servers: [
    {
      url: '/api',
      description: 'Current API base path'
    }
  ],
  tags: [
    { name: 'Health' },
    { name: 'Auth' },
    { name: 'Properties' },
    { name: 'Recommendations' }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      }
    }
  },
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Get application health status',
        responses: {
          200: { description: 'Service health details' }
        }
      }
    },
    '/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register a new user',
        responses: {
          201: { description: 'User registered successfully' },
          400: { description: 'Validation or duplicate email error' }
        }
      }
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login and obtain JWT token',
        responses: {
          200: { description: 'Login successful' },
          401: { description: 'Invalid credentials' }
        }
      }
    },
    '/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Logout current user (client token invalidation flow)',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Logout successful' },
          401: { description: 'Token required' }
        }
      }
    },
    '/properties': {
      get: {
        tags: ['Properties'],
        summary: 'List properties with pagination/filter/sort/search',
        parameters: [
          { name: 'city', in: 'query', schema: { type: 'string' } },
          { name: 'propertyType', in: 'query', schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'q', in: 'query', schema: { type: 'string' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100 } },
          { name: 'offset', in: 'query', schema: { type: 'integer', minimum: 0 } },
          { name: 'sortBy', in: 'query', schema: { type: 'string' } },
          { name: 'order', in: 'query', schema: { type: 'string', enum: ['ASC', 'DESC'] } }
        ],
        responses: {
          200: { description: 'Property list response' }
        }
      },
      post: {
        tags: ['Properties'],
        summary: 'Create a property',
        security: [{ bearerAuth: [] }],
        responses: {
          201: { description: 'Property created successfully' },
          401: { description: 'Unauthorized' }
        }
      }
    },
    '/recommendations': {
      get: {
        tags: ['Recommendations'],
        summary: 'List recommendations with pagination/filter/sort/search',
        parameters: [
          { name: 'category', in: 'query', schema: { type: 'string' } },
          { name: 'difficulty', in: 'query', schema: { type: 'string' } },
          { name: 'q', in: 'query', schema: { type: 'string' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100 } },
          { name: 'offset', in: 'query', schema: { type: 'integer', minimum: 0 } },
          { name: 'sortBy', in: 'query', schema: { type: 'string' } },
          { name: 'order', in: 'query', schema: { type: 'string', enum: ['ASC', 'DESC'] } }
        ],
        responses: {
          200: { description: 'Recommendation list response' }
        }
      }
    }
  }
};

module.exports = openApiSpec;
