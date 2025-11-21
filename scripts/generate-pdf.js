const fs = require('fs');
const path = require('path');

async function main() {
  const puppeteer = require('puppeteer');
  const htmlPath = path.resolve(__dirname, '..', 'docs', 'social-messaging-mvp.html');
  const pdfPath = path.resolve(__dirname, '..', 'docs', 'social-messaging-mvp.pdf');
  if (!fs.existsSync(htmlPath)) {
    throw new Error(`HTML not found at ${htmlPath}`);
  }
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.goto('file://' + htmlPath, { waitUntil: 'networkidle0' });
  await page.pdf({ path: pdfPath, format: 'A4', printBackground: true, margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' } });
  await browser.close();
  console.log('Generated PDF at', pdfPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

