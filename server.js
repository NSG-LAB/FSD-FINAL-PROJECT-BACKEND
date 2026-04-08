const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const swaggerUi = require('swagger-ui-express');
const dotenv = require('dotenv');
const path = require('path');
const logger = require('./utils/logger');
const openApiSpec = require('./docs/openapi');


const app = express();
// Serve uploaded images statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

// ==========================================
// CRITICAL FIX: Validate required environment variables
// ==========================================
const missingEnvVars = [];

if (!process.env.JWT_SECRET) {
  missingEnvVars.push('JWT_SECRET');
}

const hasMysqlUri = Boolean(process.env.MYSQL_URI);
const hasMysqlDbAndUser = Boolean(process.env.MYSQL_DB || process.env.MYSQLDATABASE)
  && Boolean(process.env.MYSQL_USER || process.env.MYSQLUSER);

if (!hasMysqlUri && !hasMysqlDbAndUser) {
  missingEnvVars.push('MYSQL_URI or MYSQL_DB + MYSQL_USER');
}

if (missingEnvVars.length > 0) {
  logger.error('Missing required environment variables', { missing: missingEnvVars });
  process.exit(1);
}

logger.info('All required environment variables are set');

const { sequelize, User } = require('./models');
const { ensureDatabaseExists, getConnectionConfig } = require('./config/database');
const redisClient = require('./config/redis'); // Redis client
const { cacheMiddleware } = require('./middleware/cache'); // Cache middleware



// ==========================================
// Security Middleware
// ==========================================
const isDevelopment = process.env.NODE_ENV === 'development';
const parseOriginList = (value) =>
  String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const configuredOrigins = [
  ...parseOriginList(process.env.FRONTEND_URL),
  ...parseOriginList(process.env.CORS_ALLOWED_ORIGINS),
];

const allowedOrigins = new Set([
  'http://localhost:3000',
  'http://localhost:5173',
  ...configuredOrigins,
]);

app.use(helmet({
  contentSecurityPolicy: isDevelopment
    ? {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https:'],
          imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
          connectSrc: [
            "'self'",
            'http://localhost:*',
            'http://127.0.0.1:*',
            'ws://localhost:*',
            'ws://127.0.0.1:*',
          ],
        },
      }
    : undefined,
})); // Security headers
app.use(compression()); // Response compression

// ==========================================
// CRITICAL FIX: Whitelist CORS origins
// ==========================================
const corsOptions = {
  origin: (origin, callback) => {
    const isLocalDevOrigin =
      process.env.NODE_ENV === 'development' &&
      typeof origin === 'string' &&
      /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);

    const isHostedFrontendOrigin =
      typeof origin === 'string' &&
      /^https:\/\/[a-z0-9-]+\.(netlify\.app|vercel\.app|github\.io)$/i.test(origin);

    if (!origin || allowedOrigins.has(origin) || isLocalDevOrigin || isHostedFrontendOrigin) {
      callback(null, true);
    } else {
      logger.warn('CORS request blocked', { origin });
      const corsError = new Error('CORS policy violation');
      corsError.statusCode = 403;
      callback(corsError);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ limit: '10mb', extended: true }));

let isDatabaseConnected = false;

const ensureDemoAccounts = async () => {
  const demoAccounts = [
    {
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@demo.com',
      password: 'Admin@123456',
      role: 'admin',
      city: 'Mumbai',
      state: 'Maharashtra',
      bio: 'Administrator account for testing'
    },
    {
      firstName: 'Demo',
      lastName: 'User',
      email: 'user@demo.com',
      password: 'User@123456',
      role: 'user',
      city: 'Bangalore',
      state: 'Karnataka',
      bio: 'Regular user account for testing'
    }
  ];

  for (const account of demoAccounts) {
    const existingUser = await User.findOne({
      where: { email: account.email }
    });

    if (!existingUser) {
      await User.create(account);
      logger.info(`Demo ${account.role} account created: ${account.email}`);
    } else {
      logger.info(`Demo account already exists: ${account.email}`);
    }
  }
};

const ensureAdminUser = async () => {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    return;
  }

  const existingAdmin = await User.scope('withPassword').findOne({
    where: { email: adminEmail },
  });

  if (!existingAdmin) {
    await User.create({
      firstName: 'Admin',
      lastName: 'User',
      email: adminEmail,
      password: adminPassword,
      role: 'admin',
    });
    logger.info(`Default admin user created: ${adminEmail}`);
    return;
  }

  if (existingAdmin.role !== 'admin') {
    await existingAdmin.update({ role: 'admin' });
    logger.info(`Updated role to admin for: ${adminEmail}`);
  }
};

const connectDatabase = async () => {
  try {
    const dbConfig = getConnectionConfig();
    logger.info('Active DB target', {
      host: dbConfig.host,
      port: dbConfig.port,
      database: dbConfig.database,
      username: dbConfig.username
    });

    logger.info('Attempting to connect to MySQL...');
    await ensureDatabaseExists();
    logger.info('Database ensured');
    await sequelize.authenticate();
    logger.info('MySQL connection established');
    const shouldAlterSchema = process.env.DB_SYNC_ALTER
      ? String(process.env.DB_SYNC_ALTER).toLowerCase() === 'true'
      : process.env.NODE_ENV === 'development';

    await sequelize.sync({ alter: shouldAlterSchema });
    logger.info('Models synchronized successfully');
    await ensureDemoAccounts();
    await ensureAdminUser();
    isDatabaseConnected = true;
  } catch (error) {
    isDatabaseConnected = false;
    logger.error('MySQL connection failed', { error: error.message, host: process.env.MYSQL_HOST });
    throw error;
  }
};

// Test endpoint
app.get('/api/health', async (req, res) => {
  let redisStatus = 'disconnected';
  try {
    await redisClient.ping();
    redisStatus = 'connected';
  } catch (error) {
    redisStatus = 'disconnected';
  }

  res.json({
    success: true,
    message: 'Server is running',
    mysqlStatus: isDatabaseConnected ? 'connected' : 'disconnected',
    redisStatus,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/openapi.json', (req, res) => {
  res.json(openApiSpec);
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/properties', cacheMiddleware(600), require('./routes/properties')); // Cache for 10 minutes
app.use('/api/recommendations', cacheMiddleware(300), require('./routes/recommendations')); // Cache for 5 minutes
app.use('/api/valuations', require('./routes/valuations')); // <-- added
app.use('/api/roi', require('./routes/roi'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/enhancement-checklist', require('./routes/enhancementChecklist'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/analytics', cacheMiddleware(120), require('./routes/analytics')); // Analytics dashboard (cache 2 minutes)
app.use('/api/monitoring', require('./routes/monitoring')); // Performance monitoring

// Error handling middleware
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(statusCode).json({ 
    success: false, 
    message: statusCode === 500 ? 'Something went wrong!' : err.message,
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Start Server
const PORT = process.env.PORT || 5000;
let serverInstance = null;

const startListening = (preferredPort, retriesRemaining = 15) =>
  new Promise((resolve, reject) => {
    const server = app.listen(preferredPort);

    server.once('listening', () => {
      resolve({ server, port: preferredPort });
    });

    server.once('error', (error) => {
      if (error.code === 'EADDRINUSE' && isDevelopment && retriesRemaining > 0) {
        const fallbackPort = Number(preferredPort) + 1;
        logger.warn(`Port ${preferredPort} is in use. Retrying on port ${fallbackPort}...`);
        resolve(startListening(fallbackPort, retriesRemaining - 1));
        return;
      }

      reject(error);
    });
  });

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const connectDatabaseWithRetry = async () => {
  let attempt = 0;

  while (!isDatabaseConnected) {
    attempt += 1;
    try {
      await connectDatabase();
      return;
    } catch (error) {
      const backoffMs = Math.min(30000, attempt * 5000);
      logger.warn('Database init failed; retrying in background', {
        attempt,
        retryInMs: backoffMs,
        error: error.message,
      });
      await delay(backoffMs);
    }
  }
};

const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received. Shutting down gracefully...`);

  try {
    if (serverInstance) {
      await new Promise((resolve) => serverInstance.close(resolve));
      logger.info('HTTP server closed');
    }
  } catch (error) {
    logger.warn('Error while closing HTTP server', { error: error.message });
  }

  try {
    if (redisClient?.isOpen) {
      await redisClient.quit();
      logger.info('Redis client disconnected');
    }
  } catch (error) {
    logger.warn('Error while closing Redis client', { error: error.message });
  }

  try {
    await sequelize.close();
    logger.info('MySQL connection closed');
  } catch (error) {
    logger.warn('Error while closing MySQL connection', { error: error.message });
  }

  process.exit(0);
};

const startServer = async () => {
  try {
    const preferredPort = Number(PORT) || 5000;
    const { server, port } = await startListening(preferredPort);
    serverInstance = server;
    logger.info(`Server running on port ${port}`);

    // Keep startup fast for container platforms; DB can come up shortly after boot.
    void connectDatabaseWithRetry();
  } catch (error) {
    logger.error('Server failed to start.', { error: error.message });
    process.exit(1);
  }
};

process.on('SIGTERM', () => {
  void gracefulShutdown('SIGTERM');
});

process.on('SIGINT', () => {
  void gracefulShutdown('SIGINT');
});

// Avoid auto-start in test runs
if (process.env.NODE_ENV !== 'test') {
  startServer();
}

module.exports = app;
