const express = require('express');
const jwt = require('jsonwebtoken');
const { User } = require('../models');

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
router.post('/register', async (req, res) => {
  try {
    const { firstName, lastName, email, password, city, state } = req.body;
    console.log('Registration request:', { firstName, lastName, email, city, state });

    // Validation
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

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
    console.error('Registration error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

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
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
