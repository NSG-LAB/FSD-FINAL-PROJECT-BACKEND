const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

const { sequelize, User } = require('./models');
const { ensureDatabaseExists } = require('./config/database');

const app = express();

// Middleware
app.use(cors());
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
    console.log(`👤 Default admin user created: ${adminEmail}`);
    return;
  }

  if (existingAdmin.role !== 'admin') {
    await existingAdmin.update({ role: 'admin' });
    console.log(`🔐 Updated role to admin for: ${adminEmail}`);
  }
};

const connectDatabase = async () => {
  try {
    console.log('🔗 Attempting to connect to MySQL...');
    await ensureDatabaseExists();
    console.log('📚 Database ensured');
    await sequelize.authenticate();
    console.log('✅ MySQL connection established');
    await sequelize.sync();
    console.log('🔁 Models synchronized successfully');
    await ensureAdminUser();
    isDatabaseConnected = true;
  } catch (error) {
    isDatabaseConnected = false;
    console.error('❌ MySQL connection error:', error.message);
    console.error('⚠️  Ensure your MySQL service is running and environment variables are configured');
    throw error;
  }
};

// Test endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    mysqlStatus: isDatabaseConnected ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/properties', require('./routes/properties'));
app.use('/api/recommendations', require('./routes/recommendations'));
app.use('/api/valuations', require('./routes/valuations')); // <-- added
app.use('/api/roi', require('./routes/roi'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/reports', require('./routes/reports'));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
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
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Server failed to start due to database connection issues.');
    process.exit(1);
  }
};

// Avoid auto-start in test runs
if (process.env.NODE_ENV !== 'test') {
  startServer();
}

module.exports = app;
