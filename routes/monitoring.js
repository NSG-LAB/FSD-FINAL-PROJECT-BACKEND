const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const { authenticateToken, authorizeAdmin } = require('../middleware/auth');
const logger = require('../utils/logger');

const resolveExistingPath = async (candidatePaths) => {
  for (const filePath of candidatePaths) {
    try {
      await fs.access(filePath);
      return filePath;
    } catch (error) {
      // Try next path candidate
    }
  }
  return null;
};

// Get monitoring metrics
router.get('/metrics', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const metricsPath = await resolveExistingPath([
      path.join(__dirname, '../logs/metrics.json'),
      path.join(__dirname, '../../scripts/logs/metrics.json')
    ]);

    if (!metricsPath) {
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
    logger.error('Error reading metrics', { error: error.message });
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
    logger.warn('PM2 status unavailable', { error: error.message });
    const commandUnavailable = error.code === 127 || /pm2/i.test(error.message);
    res.status(commandUnavailable ? 503 : 500).json({
      success: false,
      message: commandUnavailable
        ? 'PM2 is not available in the current runtime environment'
        : 'Failed to get PM2 process status'
    });
  }
});

// Get recent logs
router.get('/logs', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const allowedLogTypes = new Set(['combined', 'err', 'out']);
    const logType = allowedLogTypes.has(req.query.type) ? req.query.type : 'combined';
    const parsedLines = parseInt(req.query.lines, 10);
    const lines = Math.min(Math.max(Number.isFinite(parsedLines) ? parsedLines : 100, 1), 2000);

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
    logger.error('Error reading logs', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to read application logs'
    });
  }
});

module.exports = router;
