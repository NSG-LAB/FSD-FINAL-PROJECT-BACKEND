const express = require('express');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const logger = require('../utils/logger');
const { authenticateToken } = require('../middleware/auth');
const { authRules, handleValidationErrors } = require('../middleware/validation');
const { loginLimiter, registerLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

const buildToken = (user) =>
  jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );

const toPublicUser = (userInstance) => {
  if (!userInstance) return null;
  const user = userInstance.get({ plain: true });
  delete user.password;
  return user;
};

// Register
router.post('/register', registerLimiter, authRules.register, handleValidationErrors, async (req, res) => {
  try {
    const { firstName, lastName, email, password, city, state } = req.body;
    logger.info('Registration request:', { firstName, lastName, email, city, state });

    // Check if user exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    const user = await User.create({
      firstName,
      lastName,
      email,
      password,
      city,
      state
    });

    const token = buildToken(user);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: toPublicUser(user)
    });
  } catch (error) {
    logger.error('Registration error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Login
router.post('/login', loginLimiter, authRules.login, handleValidationErrors, async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.scope('withPassword').findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = buildToken(user);

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: toPublicUser(user)
    });
  } catch (error) {
    logger.error('Login error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Logout (stateless JWT logout handled client-side by clearing token)
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    return res.json({
      success: true,
      message: 'Logout successful. Remove token from client storage.'
    });
  } catch (error) {
    logger.error('Logout error:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
