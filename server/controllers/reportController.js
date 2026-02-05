
const DailyReport = require('../models/DailyReport');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

exports.createReport = async (req, res) => {
  try {
    const report = new DailyReport(req.body);
    await report.save();
    res.status(201).json({ success: true, data: report });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

exports.generatePDF = async (req, res) => {
  try {
    const report = req.body;
    
    // Launch Puppeteer
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    // Construct HTML content (Visual layout clone)
    const content = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Helvetica', sans-serif; padding: 40px; color: #111; }
          .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 30px; }
          .title { font-size: 24px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; }
          .subtitle { font-size: 14px; text-transform: uppercase; margin-top: 5px; color: #555; }
          .meta { display: flex; justify-content: space-between; font-weight: bold; margin-bottom: 30px; font-size: 14px; }
          .section { margin-bottom: 30px; }
          .section-header { background: #eee; padding: 5px 10px; font-weight: bold; font-size: 14px; text-transform: uppercase; border-left: 5px solid #000; margin-bottom: 15px; }
          .row { display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 14px; }
          .col { width: 48%; }
          .col-header { border-bottom: 1px solid #aaa; padding-bottom: 2px; margin-bottom: 5px; font-weight: bold; font-size: 12px; text-transform: uppercase; }
          .total-row { border-top: 1px solid #000; margin-top: 5px; padding-top: 2px; font-weight: 900; }
          table { width: 100%; border-collapse: collapse; font-size: 14px; }
          th { text-align: left; background: #f5f5f5; border-bottom: 1px solid #000; padding: 5px; }
          td { padding: 5px; border-bottom: 1px solid #ddd; }
          .footer { margin-top: 60px; display: flex; justify-content: flex-end; }
          .sig-line { width: 250px; text-align: center; border-top: 1px solid #000; padding-top: 5px; font-weight: bold; font-size: 12px; text-transform: uppercase; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">Immediate Care Plus</div>
          <div class="subtitle">Daily Medical Close Report</div>
        </div>
        
        <div class="meta">
          <div>DATE: ${new Date().toLocaleDateString()}</div>
          <div>MANAGER: ${(report.user || 'Unknown').toUpperCase()}</div>
        </div>

        <div class="section">
          <div class="section-header">1. Financial Reconciliation</div>
          <div class="row">
            <div class="col">
              <div class="col-header">Collection Methods</div>
              ${Object.entries(report.financials.methods).map(([k,v]) => `<div class="row"><span style="text-transform:capitalize">${k}</span> <span>$${Number(v).toFixed(2)}</span></div>`).join('')}
              <div class="row total-row"><span>TOTAL</span> <span>$${Object.values(report.financials.methods).reduce((a,b)=>a+Number(b),0).toFixed(2)}</span></div>
            </div>
            <div class="col">
               <div class="col-header">System Types</div>
               ${Object.entries(report.financials.types).map(([k,v]) => `<div class="row"><span style="text-transform:capitalize">${k.replace(/([A-Z])/g, ' $1').trim()}</span> <span>$${Number(v).toFixed(2)}</span></div>`).join('')}
               <div class="row total-row"><span>TOTAL</span> <span>$${Object.values(report.financials.types).reduce((a,b)=>a+Number(b),0).toFixed(2)}</span></div>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-header">2. Patient Volume</div>
          <table>
            <thead><tr><th>Insurance Class</th><th style="text-align:right">Count</th></tr></thead>
            <tbody>
              ${Object.entries(report.insurances).map(([k,v]) => `<tr><td style="text-transform:capitalize">${k.replace(/_/g, ' ')}</td><td style="text-align:right">${v}</td></tr>`).join('')}
              <tr style="background:#333; color:#fff; font-weight:bold"><td>TOTAL</td><td style="text-align:right">${Object.values(report.insurances).reduce((a,b)=>a+Number(b),0)}</td></tr>
            </tbody>
          </table>
        </div>

        <div class="section">
           <div class="section-header">3. Statistics</div>
           <div class="row" style="justify-content: flex-start; gap: 40px;">
              <div>New: <strong>${report.stats.newPts}</strong></div>
              <div>Established: <strong>${report.stats.estPts}</strong></div>
              <div>X-Rays: <strong>${report.stats.xrays}</strong></div>
           </div>
        </div>

        <div class="footer">
          <div class="sig-line">Authorized Signature</div>
        </div>
      </body>
      </html>
    `;

    await page.setContent(content);
    const pdfBuffer = await page.pdf({ format: 'Letter' });
    await browser.close();

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Length': pdfBuffer.length,
      'Content-Disposition': `attachment; filename="DailyReport_${Date.now()}.pdf"`
    });
    
    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
