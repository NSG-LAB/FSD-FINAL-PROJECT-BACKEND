const PDFDocument = require('pdfkit');

/**
 * Generates a professional property valuation report PDF
 * @param {Object} data - Valuation data
 * @returns {Promise<Buffer>} - PDF buffer
 */
const generateValuationReport = async (data) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const buffers = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      // --- Header ---
      doc
        .fillColor('#1B1F4A')
        .fontSize(24)
        .text('GharMulya', 50, 50, { align: 'left' })
        .fontSize(10)
        .text('Professional Property Valuation Report', 50, 80)
        .moveDown();

      // Divider
      doc.moveTo(50, 100).lineTo(550, 100).stroke('#C9A84C');

      // --- Property Summary ---
      doc.moveDown(2);
      doc.fillColor('#1B1F4A').fontSize(16).text('Property Summary', { underline: true });
      doc.fontSize(12).fillColor('#333');
      
      const summaryItems = [
        ['Address', data.address || 'N/A'],
        ['Property Type', data.propertyType || 'Residential'],
        ['Area', `${data.areaSqft} Sq.Ft.`],
        ['Year Built', data.yearBuilt || 'N/A'],
        ['Bedrooms/Bathrooms', `${data.bedrooms}BHK / ${data.bathrooms} Bath`],
      ];

      let yPos = doc.y + 10;
      summaryItems.forEach(([label, value]) => {
        doc.font('Helvetica-Bold').text(`${label}:`, 50, yPos);
        doc.font('Helvetica').text(value, 180, yPos);
        yPos += 20;
      });

      // --- Valuation Results ---
      doc.moveDown(2);
      doc.fillColor('#1B1F4A').fontSize(16).text('Valuation Analysis', { underline: true });
      
      doc.rect(50, doc.y + 10, 500, 80).fill('#F9F7F4');
      doc.fillColor('#1B1F4A').font('Helvetica-Bold').fontSize(14);
      doc.text('Estimated Current Market Value', 70, doc.y - 65);
      doc.fillColor('#2A6E48').fontSize(22).text(`₹${data.currentValue?.toLocaleString()}`, 70, doc.y + 5);
      
      doc.fillColor('#666').fontSize(10).font('Helvetica');
      doc.text(`Range: ₹${data.range?.min?.toLocaleString()} - ₹${data.range?.max?.toLocaleString()}`, 70, doc.y + 5);

      // --- ROI Planning ---
      if (data.improvements && data.improvements.length > 0) {
        doc.moveDown(6);
        doc.fillColor('#1B1F4A').fontSize(16).text('Recommended Enhancements', { underline: true });
        doc.moveDown();

        // Table Header
        const tableY = doc.y;
        doc.fillColor('#1B1F4A').font('Helvetica-Bold').fontSize(10);
        doc.text('Enhancement', 50, tableY);
        doc.text('Est. Cost', 250, tableY, { width: 80, align: 'right' });
        doc.text('Value Add', 350, tableY, { width: 80, align: 'right' });
        doc.text('ROI (%)', 450, tableY, { width: 80, align: 'right' });
        
        doc.moveTo(50, tableY + 15).lineTo(550, tableY + 15).stroke('#EEE');

        let rowY = tableY + 25;
        data.improvements.forEach((imp) => {
          doc.fillColor('#333').font('Helvetica').fontSize(9);
          doc.text(imp.title, 50, rowY, { width: 180 });
          doc.text(`₹${imp.estimatedCost?.toLocaleString()}`, 250, rowY, { width: 80, align: 'right' });
          doc.text(`₹${imp.expectedValueIncrease?.toLocaleString()}`, 350, rowY, { width: 80, align: 'right' });
          doc.text(`${imp.expectedROI}%`, 450, rowY, { width: 80, align: 'right' });
          rowY += 20;
        });

        doc.moveDown(2);
        doc.rect(50, doc.y, 500, 40).fill('#EBF5EE');
        doc.fillColor('#1B1F4A').font('Helvetica-Bold').fontSize(12);
        doc.text('Projected Value After Improvements:', 70, doc.y - 28);
        doc.text(`₹${data.improvedValue?.toLocaleString()}`, 380, doc.y - 28, { align: 'right', width: 140 });
      }

      // --- Footer / Disclaimer ---
      const footerY = 750;
      doc.moveTo(50, footerY).lineTo(550, footerY).stroke('#EEE');
      doc.fontSize(8).fillColor('#999').font('Helvetica');
      doc.text('Disclaimer: This report is an estimate based on provided data and market trends. Actual values may vary. GharMulya does not guarantee financial outcomes.', 50, footerY + 10, { align: 'center', width: 500 });
      doc.text(`Report Generated On: ${new Date().toLocaleDateString()}`, 50, footerY + 30, { align: 'center', width: 500 });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

module.exports = { generateValuationReport };
