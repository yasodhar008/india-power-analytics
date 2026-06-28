import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

  await page.goto('http://localhost:5173', { waitUntil: 'networkidle2' });

  // Try to click the BESS Analytica tab to see if it renders properly
  try {
    await page.evaluate(() => {
      // Find the tab named "BESS Analytica"
      const buttons = Array.from(document.querySelectorAll('button'));
      const bessTab = buttons.find(b => b.textContent.includes('BESS Analytica'));
      if (bessTab) bessTab.click();
      else console.log('BESS Tab not found');
    });

    await new Promise(r => setTimeout(r, 2000));
    console.log('Clicked BESS Analytica');
  } catch(e) {
    console.log('Error clicking:', e);
  }

  await browser.close();
})();
