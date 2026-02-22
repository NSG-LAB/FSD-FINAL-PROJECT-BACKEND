const redisClient = require('../config/redis');

// Cache middleware for GET requests
const cacheMiddleware = (duration = 300) => { // Default 5 minutes
  return async (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    const key = `__express__${req.originalUrl || req.url}`;

    try {
      const cachedResponse = await redisClient.get(key);
      if (cachedResponse) {
        const parsedResponse = JSON.parse(cachedResponse);
        return res.json(parsedResponse);
      }
    } catch (error) {
      console.error('Redis cache read error:', error);
      // Continue without cache if error
    }

    // Store original send method
    const originalSend = res.json;

    // Override res.json to cache the response
    res.json = function(data) {
      try {
        const responseString = JSON.stringify(data);
        redisClient.setEx(key, duration, responseString).catch(err => {
          console.error('Redis cache write error:', err);
        });
      } catch (error) {
        console.error('Response serialization error:', error);
      }

      // Call original send method
      originalSend.call(this, data);
    };

    next();
  };
};

// Utility functions for manual caching
const setCache = async (key, value, duration = 300) => {
  try {
    const valueString = JSON.stringify(value);
    await redisClient.setEx(key, duration, valueString);
  } catch (error) {
    console.error('Redis set cache error:', error);
  }
};

const getCache = async (key) => {
  try {
    const cachedValue = await redisClient.get(key);
    return cachedValue ? JSON.parse(cachedValue) : null;
  } catch (error) {
    console.error('Redis get cache error:', error);
    return null;
  }
};

const deleteCache = async (key) => {
  try {
    await redisClient.del(key);
  } catch (error) {
    console.error('Redis delete cache error:', error);
  }
};

const clearCache = async (pattern = '*') => {
  try {
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(keys);
    }
  } catch (error) {
    console.error('Redis clear cache error:', error);
  }
};

module.exports = {
  cacheMiddleware,
  setCache,
  getCache,
  deleteCache,
  clearCache
};