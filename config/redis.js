const redis = require('redis');

// Redis client configuration
const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = process.env.REDIS_PORT || 6380;
const redisPassword = process.env.REDIS_PASSWORD || undefined;

console.log('Redis Configuration:', {
  host: redisHost,
  port: redisPort,
  password: redisPassword ? '[REDACTED]' : undefined
});

const redisClient = redis.createClient({
  host: redisHost,
  port: redisPort,
  password: redisPassword,
  family: 4, // Force IPv4
  retry_strategy: (options) => {
    if (options.error && options.error.code === 'ECONNREFUSED') {
      console.error('Redis connection refused');
      return new Error('Redis connection refused');
    }
    if (options.total_retry_time > 1000 * 60 * 60) {
      console.error('Redis retry time exhausted');
      return new Error('Retry time exhausted');
    }
    if (options.attempt > 10) {
      console.error('Redis retry attempts exhausted');
      return undefined;
    }
    // Reconnect after
    return Math.min(options.attempt * 100, 3000);
  }
});

// Event listeners for Redis client
redisClient.on('error', (err) => {
  console.error('Redis Client Error', err);
});

redisClient.on('connect', () => {
  console.log('Connected to Redis');
});

redisClient.on('ready', () => {
  console.log('Redis client ready');
});

redisClient.on('end', () => {
  console.log('Redis connection ended');
});

// Connect to Redis
redisClient.connect().catch(console.error);

module.exports = redisClient;