const fs = require('fs');
const Tesseract = require('tesseract.js');
const http = require('http');

async function endToEndTest() {
  const imgPath = 'C:\\Users\\rejye\\.gemini\\antigravity\\brain\\47407019-6b96-4bec-b3f6-4e2a4d2a0e37\\media__1774907470074.png';
  if (!fs.existsSync(imgPath)) return console.log('Image not found');
  
  console.log('1. Extracting Text (OCR)...');
  const { data: { text } } = await Tesseract.recognize(imgPath, 'eng');
  console.log('OCR text length:', text.length);
  console.log('--- RAW OCR ---');
  console.log(text.substring(0, 500));
  
  const systemPrompt = 'You are a document parsing system specialized in reading invoices, purchase orders, and order confirmations. You receive OCR text and extract structured data with high accuracy. Extract every number, product name, and price carefully. Output ONLY valid JSON.';
  const prompt = `The following text was extracted via OCR from an invoice/order document:
--- OCR TEXT START ---
${text}
--- OCR TEXT END ---
Parse this invoice text and return a JSON object with this exact structure:
{
  "vendor": "supplier company name",
  "poNumber": "order/confirmation number",
  "orderDate": "YYYY-MM-DD",
  "items": [
    {
      "name": "full product description",
      "category": "General Supplies",
      "sku": "product code or item number",
      "quantity": 1,
      "unitCost": 10.00,
      "packSize": "pack description e.g. 25/BX, 100/CA, Each"
    }
  ],
  "subtotal": 100.00,
  "totalTax": 5.00,
  "shippingCost": 0.00,
  "grandTotal": 105.00,
  "confidence": 90
}
RULES: Extract EVERY line item, use 0 for unclear values, parse numbers exactly.`;

  console.log('2. Querying Qwen2.5-14B via HTTP...');
  const body = JSON.stringify({
    model: 'qwen2.5-14b-instruct',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ],
    temperature: 0.1,
    max_tokens: 4096
  });

  const req = http.request({
    hostname: '127.0.0.1', port: 1234, path: '/v1/chat/completions', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, (res) => {
    let raw = '';
    res.on('data', chunk => raw += chunk);
    res.on('end', () => {
       console.log('Status:', res.statusCode);
       try { 
         const content = JSON.parse(raw).choices[0].message.content;
         console.log('\n--- PARSED JSON ---');
         console.log(content);
       } catch(e) { console.log('Parse error:', e, '\nRaw:', raw.substring(0, 300)); }
    });
  });
  req.on('error', e => console.error('Request failed:', e));
  req.write(body);
  req.end();
}
endToEndTest();
