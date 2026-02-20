const express = require('express');
const PDFDocument = require('pdfkit');

const router = express.Router();

router.post('/valuation-pdf', (req, res) => {
  const { valuationInput = {}, valuationResult = {}, roiPlan = null } = req.body || {};

  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  const fileName = `valuation-report-${Date.now()}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

  doc.pipe(res);

  doc.fontSize(20).text('Property Value Enhancement Report', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(10).fillColor('gray').text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
  doc.fillColor('black');
  doc.moveDown(1.5);

  doc.fontSize(14).text('Valuation Inputs', { underline: true });
  doc.moveDown(0.5);
  doc.fontSize(11);
  doc.text(`Area (sqft): ${valuationInput.areaSqft ?? '-'}`);
  doc.text(`Age (years): ${valuationInput.ageYears ?? '-'}`);
  doc.text(`Bedrooms: ${valuationInput.bedrooms ?? '-'}`);
  doc.text(`Bathrooms: ${valuationInput.bathrooms ?? '-'}`);
  doc.text(`Condition Score: ${valuationInput.conditionScore ?? '-'}`);

  doc.moveDown(1);
  doc.fontSize(14).text('Valuation Results', { underline: true });
  doc.moveDown(0.5);
  doc.fontSize(11);
  doc.text(`Current Value: ₹${Number(valuationResult.currentValue || 0).toLocaleString()}`);
  doc.text(`Improved Value: ₹${Number(valuationResult.improvedValue || 0).toLocaleString()}`);
  doc.text(`Confidence: ${valuationResult.confidence || '-'}`);
  if (valuationResult.range) {
    doc.text(
      `Range: ₹${Number(valuationResult.range.min || 0).toLocaleString()} - ₹${Number(
        valuationResult.range.max || 0
      ).toLocaleString()}`
    );
  }

  if (roiPlan) {
    doc.moveDown(1);
    doc.fontSize(14).text('ROI Plan Summary', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(11);
    doc.text(`Budget: ₹${Number(roiPlan.budget || 0).toLocaleString()}`);
    doc.text(`Total Cost: ₹${Number(roiPlan.totalCost || 0).toLocaleString()}`);
    doc.text(`Estimated Gain: ₹${Number(roiPlan.totalEstimatedGain || 0).toLocaleString()}`);
    doc.text(`Blended ROI: ${roiPlan.blendedROI || 0}%`);

    if (Array.isArray(roiPlan.recommendations) && roiPlan.recommendations.length) {
      doc.moveDown(0.6);
      doc.fontSize(12).text('Top Recommendations:');
      doc.moveDown(0.3);

      roiPlan.recommendations.slice(0, 5).forEach((item, index) => {
        doc
          .fontSize(10)
          .text(
            `${index + 1}. ${item.title} | Cost: ₹${Number(item.estimatedCost || 0).toLocaleString()} | ROI: ${
              item.roiPercentage || 0
            }% | Payback: ${item.paybackMonths || 0} months`
          );
      });
    }
  }

  doc.end();
});

module.exports = router;
