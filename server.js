const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const dotenv = require('dotenv');
const path = require('path');
const logger = require('./utils/logger');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

// ==========================================
// CRITICAL FIX: Validate required environment variables
// ==========================================
const requiredEnvVars = ['JWT_SECRET', 'MYSQL_DB', 'MYSQL_USER'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  logger.error('Missing required environment variables', { missing: missingEnvVars });
  process.exit(1);
}

logger.info('All required environment variables are set');

const { sequelize, User } = require('./models');
const { ensureDatabaseExists } = require('./config/database');
const redisClient = require('./config/redis'); // Redis client
const { cacheMiddleware } = require('./middleware/cache'); // Cache middleware

const app = express();

// ==========================================
// Security Middleware
// ==========================================
app.use(helmet()); // Security headers
app.use(compression()); // Response compression

// ==========================================
// CRITICAL FIX: Whitelist CORS origins
// ==========================================
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5173', // Vite dev server
      process.env.FRONTEND_URL
    ].filter(Boolean);

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn('CORS request blocked', { origin });
      callback(new Error('CORS policy violation'));
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
    logger.info('Attempting to connect to MySQL...');
    await ensureDatabaseExists();
    logger.info('Database ensured');
    await sequelize.authenticate();
    logger.info('MySQL connection established');
    await sequelize.sync();
    logger.info('Models synchronized successfully');
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

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/properties', cacheMiddleware(600), require('./routes/properties')); // Cache for 10 minutes
app.use('/api/recommendations', cacheMiddleware(300), require('./routes/recommendations')); // Cache for 5 minutes
app.use('/api/valuations', require('./routes/valuations')); // <-- added
app.use('/api/roi', require('./routes/roi'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/analytics', require('./routes/analytics')); // Analytics dashboard
app.use('/api/monitoring', require('./routes/monitoring')); // Performance monitoring

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ 
    success: false, 
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Start Server
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDatabase();
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Server failed to start due to database connection issues.');
    process.exit(1);
  }
};

// Avoid auto-start in test runs
if (process.env.NODE_ENV !== 'test') {
  startServer();
}

module.exports = app;
