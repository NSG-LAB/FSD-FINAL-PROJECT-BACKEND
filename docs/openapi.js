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
    { name: 'Recommendations' },
    { name: 'Valuations' },
    { name: 'Renovation Projects' },
    { name: 'Users' },
    { name: 'Notifications' },
    { name: 'Enhancement Checklist' },
    { name: 'Reports' },
    { name: 'ROI' },
    { name: 'Analytics' },
    { name: 'Monitoring' }
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
    },
    '/recommendations/property/{propertyId}': {
      get: {
        tags: ['Recommendations'],
        summary: 'Get recommendations tailored for a specific property (owner/admin)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'propertyId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'city', in: 'query', schema: { type: 'string' } },
          { name: 'budget', in: 'query', schema: { type: 'number' } },
          { name: 'userGoals', in: 'query', schema: { type: 'string' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100 } },
          { name: 'offset', in: 'query', schema: { type: 'integer', minimum: 0 } },
          {
            name: 'sortBy',
            in: 'query',
            schema: {
              type: 'string',
              enum: ['priority', 'title', 'difficulty', 'expectedROI', 'createdAt', 'updatedAt', 'personalized']
            }
          },
          { name: 'order', in: 'query', schema: { type: 'string', enum: ['ASC', 'DESC'] } }
        ],
        responses: {
          200: { description: 'Property recommendation list response' },
          401: { description: 'Unauthorized' },
          403: { description: 'Forbidden' },
          404: { description: 'Property not found' }
        }
      }
    },
    '/valuations/cost-estimate': {
      post: {
        tags: ['Valuations'],
        summary: 'Estimate renovation cost range by city, area type, and category',
        responses: {
          200: { description: 'Cost estimate generated' },
          400: { description: 'Validation error' }
        }
      }
    },
    '/renovation-projects': {
      get: {
        tags: ['Renovation Projects'],
        summary: 'List renovation tracker projects for current user/admin',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'q', in: 'query', schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'city', in: 'query', schema: { type: 'string' } },
          { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'minCompletion', in: 'query', schema: { type: 'number', minimum: 0, maximum: 100 } },
          { name: 'maxCompletion', in: 'query', schema: { type: 'number', minimum: 0, maximum: 100 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100 } },
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1 } },
          { name: 'offset', in: 'query', schema: { type: 'integer', minimum: 0 } },
          {
            name: 'sortBy',
            in: 'query',
            schema: {
              type: 'string',
              enum: [
                'createdAt',
                'updatedAt',
                'title',
                'status',
                'city',
                'completionPercentage',
                'plannedBudget',
                'spentBudget',
                'expectedValueUplift'
              ]
            }
          },
          { name: 'sortOrder', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'] } }
        ],
        responses: {
          200: { description: 'Renovation project list' },
          401: { description: 'Unauthorized' }
        }
      },
      post: {
        tags: ['Renovation Projects'],
        summary: 'Create a renovation project tracker',
        security: [{ bearerAuth: [] }],
        responses: {
          201: { description: 'Renovation project created' },
          400: { description: 'Validation error' }
        }
      }
    },
    '/renovation-projects/export/csv': {
      get: {
        tags: ['Renovation Projects'],
        summary: 'Export filtered renovation tracker projects as CSV (admin only)',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'CSV export stream' },
          403: { description: 'Admin access required' }
        }
      }
    },
    '/renovation-projects/analytics/uplift-vs-spend': {
      get: {
        tags: ['Renovation Projects'],
        summary: 'Get uplift vs spend timeline analytics for filtered renovation trackers (admin only)',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Analytics timeline response' },
          403: { description: 'Admin access required' }
        }
      }
    },
    '/users/profile': {
      get: {
        tags: ['Users'],
        summary: 'Get current user profile',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'User profile' },
          401: { description: 'Unauthorized' }
        }
      },
      put: {
        tags: ['Users'],
        summary: 'Update current user profile',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Profile updated' },
          400: { description: 'Validation error' }
        }
      }
    },
    '/notifications': {
      get: {
        tags: ['Notifications'],
        summary: 'List notifications',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Notifications list' }
        }
      }
    },
    '/enhancement-checklist/{propertyId}': {
      get: {
        tags: ['Enhancement Checklist'],
        summary: 'Get enhancement checklist for property',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'propertyId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          200: { description: 'Checklist response' },
          404: { description: 'Property not found' }
        }
      }
    },
    '/reports/property/{propertyId}': {
      get: {
        tags: ['Reports'],
        summary: 'Generate property report',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'propertyId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          200: { description: 'Generated report' },
          403: { description: 'Forbidden' }
        }
      }
    },
    '/roi/analyze': {
      post: {
        tags: ['ROI'],
        summary: 'Analyze ROI for selected recommendations and property',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'ROI analysis response' },
          400: { description: 'Validation error' }
        }
      }
    },
    '/analytics/dashboard': {
      get: {
        tags: ['Analytics'],
        summary: 'Get analytics dashboard data',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Analytics dashboard payload' }
        }
      }
    },
    '/monitoring/metrics': {
      get: {
        tags: ['Monitoring'],
        summary: 'Get backend monitoring metrics (admin)',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Metrics payload' },
          403: { description: 'Admin access required' }
        }
      }
    },
    '/monitoring/pm2-status': {
      get: {
        tags: ['Monitoring'],
        summary: 'Get PM2 runtime status (admin)',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'PM2 process state' },
          503: { description: 'PM2 unavailable in runtime environment' }
        }
      }
    },
    '/monitoring/logs': {
      get: {
        tags: ['Monitoring'],
        summary: 'Get recent logs (admin)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'type', in: 'query', schema: { type: 'string', enum: ['combined', 'err', 'out'] } },
          { name: 'lines', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 2000 } }
        ],
        responses: {
          200: { description: 'Recent log lines' }
        }
      }
    }
  }
};

module.exports = openApiSpec;
