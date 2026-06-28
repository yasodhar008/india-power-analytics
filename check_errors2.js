import puppeteer from 'puppeteer';
import fs from 'fs';

fs.writeFileSync('.env.local', 'VITE_SUPABASE_URL=https://placeholder.supabase.co\nVITE_SUPABASE_ANON_KEY=placeholder\n');

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

  await page.goto('http://localhost:5173', { waitUntil: 'networkidle2' }).catch(e => console.log('GOTO ERROR:', e));
  await new Promise(r => setTimeout(r, 2000));
  await browser.close();
})();
