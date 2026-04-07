const express = require('express');
const { generateValuationReport } = require('../services/reportService');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * @route POST /api/reports/valuation-pdf
 * @desc Generate and download a valuation report PDF
 * @access Public (or Private depending on middleware)
 */
router.post('/valuation-pdf', async (req, res) => {
  try {
    const { valuationInput = {}, valuationResult = {}, roiPlan = null } = req.body || {};

    // Combine data for the report service
    const reportData = {
      ...valuationInput,
      ...valuationResult,
      roiPlan,
      // Ensure we have current date
      generatedAt: new Date().toISOString()
    };

    // Add address if missing from input but might be in valuationResult
    if (!reportData.address && valuationResult.address) {
      reportData.address = valuationResult.address;
    }

    const pdfBuffer = await generateValuationReport(reportData);
    
    const fileName = `GharMulya_Report_${Date.now()}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    
    return res.end(pdfBuffer);
  } catch (error) {
    logger.error('Error generating valuation PDF', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to generate PDF report',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
