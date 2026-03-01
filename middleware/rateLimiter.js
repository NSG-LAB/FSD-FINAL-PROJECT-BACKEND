const rateLimit = require('express-rate-limit');

// ==========================================
// Rate Limiters - Brute Force & DDoS Protection
// ==========================================

const isDevelopment = process.env.NODE_ENV === 'development';

const createLimiter = ({ windowMs, max, message, skipSuccessfulRequests = false }) =>
  rateLimit({
    windowMs,
    max: isDevelopment ? Math.max(max * 20, 100) : max,
    message,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests,
  });

// Strict limit for auth endpoints (brute force protection)
const loginLimiter = createLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: 'Too many login attempts, please try again later',
  skipSuccessfulRequests: true,
});

const registerLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many registration attempts, please try again later',
  skipSuccessfulRequests: true,
});

// General API limiter
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { loginLimiter, registerLimiter, apiLimiter };
