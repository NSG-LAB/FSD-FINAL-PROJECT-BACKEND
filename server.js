const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const { sequelize } = require('./models');
const { ensureDatabaseExists } = require('./config/database');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ limit: '10mb', extended: true }));

let isDatabaseConnected = false;

const connectDatabase = async () => {
  try {
    console.log('🔗 Attempting to connect to MySQL...');
    await ensureDatabaseExists();
    console.log('📚 Database ensured');
    await sequelize.authenticate();
    console.log('✅ MySQL connection established');
    await sequelize.sync();
    console.log('🔁 Models synchronized successfully');
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

// Routes (To be implemented)
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/properties', require('./routes/properties'));
app.use('/api/recommendations', require('./routes/recommendations'));

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

startServer();

module.exports = app;
