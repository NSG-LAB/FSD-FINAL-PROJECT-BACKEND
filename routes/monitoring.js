const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const { authenticateToken, authorizeAdmin } = require('../middleware/auth');

// Get monitoring metrics
router.get('/metrics', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const metricsPath = path.join(__dirname, '../../scripts/logs/metrics.json');

    // Check if metrics file exists
    try {
      await fs.access(metricsPath);
    } catch (error) {
      return res.json({
        success: true,
        message: 'No metrics data available yet',
        data: null
      });
    }

    // Read metrics file
    const metricsData = await fs.readFile(metricsPath, 'utf8');
    const metrics = JSON.parse(metricsData);

    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    console.error('Error reading metrics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to read monitoring metrics'
    });
  }
});

// Get PM2 process status
router.get('/pm2-status', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const { exec } = require('child_process');
    const util = require('util');
    const execAsync = util.promisify(exec);

    const { stdout } = await execAsync('pm2 jlist');
    const pm2Data = JSON.parse(stdout);

    const backendProcess = pm2Data.find(proc => proc.name === 'real-estate-backend');

    res.json({
      success: true,
      data: {
        process: backendProcess || null,
        allProcesses: pm2Data
      }
    });
  } catch (error) {
    console.error('Error getting PM2 status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get PM2 process status'
    });
  }
});

// Get recent logs
router.get('/logs', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const logType = req.query.type || 'combined'; // err, out, combined
    const lines = parseInt(req.query.lines) || 100;

    const logPath = path.join(__dirname, '../logs', `${logType}.log`);

    // Check if log file exists
    try {
      await fs.access(logPath);
    } catch (error) {
      return res.json({
        success: true,
        message: 'No log data available',
        data: []
      });
    }

    // Read log file
    const logData = await fs.readFile(logPath, 'utf8');
    const logLines = logData.split('\n').filter(line => line.trim()).slice(-lines);

    res.json({
      success: true,
      data: logLines
    });
  } catch (error) {
    console.error('Error reading logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to read application logs'
    });
  }
});

module.exports = router;