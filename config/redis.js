const redis = require('redis');

const isRedisDisabled = process.env.NODE_ENV === 'test' || process.env.REDIS_DISABLED === 'true';

if (isRedisDisabled) {
  const noopAsync = async () => undefined;
  const testRedisClient = {
    isOpen: false,
    isReady: false,
    on: () => undefined,
    connect: noopAsync,
    quit: noopAsync,
    disconnect: noopAsync,
    ping: async () => 'PONG',
    get: async () => null,
    setEx: noopAsync,
    del: async () => 0,
    keys: async () => []
  };

  module.exports = testRedisClient;
} else {
  // Redis client configuration
  const redisHost = process.env.REDIS_HOST || process.env.REDISHOST || 'localhost';
  const redisPort = process.env.REDIS_PORT || process.env.REDISPORT || 6380;
  const redisPassword = process.env.REDIS_PASSWORD || process.env.REDISPASSWORD || undefined;
  const redisUrl = process.env.REDIS_URL || process.env.REDIS_URL_URL; // Railway sometimes uses REDIS_URL

  console.log('Redis Configuration:', {
    host: redisHost,
    port: redisPort,
    password: redisPassword ? '[REDACTED]' : undefined
  });

  const redisClient = redis.createClient({
    url: redisUrl, // Use URL if available
    socket: !redisUrl ? {
      host: redisHost,
      port: redisPort,
      family: 4, // Force IPv4
    } : undefined,
    password: !redisUrl ? redisPassword : undefined,
    retry_strategy: (options) => {
      if (options.error && options.error.code === 'ECONNREFUSED') {
        console.warn('Redis connection refused');
        return undefined;
      }
      if (options.total_retry_time > 1000 * 60 * 60) {
        console.warn('Redis retry time exhausted');
        return undefined;
      }
      if (options.attempt > 10) {
        console.warn('Redis retry attempts exhausted');
        return undefined;
      }
      // Reconnect after
      return Math.min(options.attempt * 100, 3000);
    }
  });

  // Event listeners for Redis client
  redisClient.on('error', (err) => {
    console.warn('Redis Client Error (non-fatal)', err.message);
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

  // Connect to Redis with graceful fallback
  redisClient.connect().catch((err) => {
    console.warn('Redis connection failed, continuing without Redis cache:', err.message);
    // Don't crash - Redis is optional for this app
  });

  module.exports = redisClient;
}