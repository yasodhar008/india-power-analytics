import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();

  // Set fake local storage to bypass auth
  await page.goto('http://localhost:5173');
  await page.evaluate(() => {
    // Note: since we use AuthContext which checks supabase.auth.getSession,
    // it's tricky to mock without modifying the app code slightly or fully mocking supabase.
  });

  await browser.close();
})();
