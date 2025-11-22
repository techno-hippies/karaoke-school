/**
 * Export fresh cookies after manually solving CAPTCHA
 * Run this, solve CAPTCHA, it will save fresh cookies to www.tiktok.com_cookies.txt
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

async function main() {
  console.log('🔐 Fresh Cookie Exporter\n');
  console.log('This will:');
  console.log('1. Open browser with your existing cookies');
  console.log('2. Navigate to TikTok');
  console.log('3. You solve any CAPTCHA');
  console.log('4. After 30 seconds, export fresh cookies\n');

  // Load existing cookies
  const cookieFilePath = resolve(process.cwd(), 'www.tiktok.com_cookies.txt');
  const existingCookies = [];

  try {
    const cookieContent = readFileSync(cookieFilePath, 'utf-8');
    for (const line of cookieContent.split('\n')) {
      if (!line || line.startsWith('#')) continue;
      const parts = line.split('\t');
      if (parts.length < 7) continue;
      const [domain, _, path, secure, expiration, name, value] = parts;
      existingCookies.push({
        name: name.trim(),
        value: value.trim(),
        domain: domain.trim().replace(/^\./, ''),
        path: path.trim() || '/',
        expires: Number(expiration.trim()) || undefined,
        secure: secure.trim().toUpperCase() === 'TRUE',
        httpOnly: false
      });
    }
    console.log(`📦 Loaded ${existingCookies.length} existing cookies\n`);
  } catch (e) {
    console.log('⚠️  No existing cookies found, starting fresh\n');
  }

  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-blink-features=AutomationControlled']
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 }
  });

  if (existingCookies.length > 0) {
    await context.addCookies(existingCookies);
  }

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    window.chrome = { runtime: {} };
  });

  const page = await context.newPage();

  console.log('🌐 Opening TikTok...');
  await page.goto('https://www.tiktok.com/@idazeile', {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });

  console.log('\n⏰ Waiting 30 seconds...');
  console.log('   → Solve any CAPTCHA if it appears');
  console.log('   → Browse around to establish session');
  console.log('   → Cookies will be exported automatically\n');

  await page.waitForTimeout(30000);

  // Export cookies
  const freshCookies = await context.cookies();

  console.log(`\n💾 Exporting ${freshCookies.length} fresh cookies...`);

  // Convert to Netscape format
  const lines = ['# Netscape HTTP Cookie File', '# https://curl.haxx.se/rfc/cookie_spec.html', '# This is a generated file! Do not edit.', ''];

  for (const cookie of freshCookies) {
    const domain = cookie.domain.startsWith('.') ? cookie.domain : `.${cookie.domain}`;
    const includeSubdomains = 'TRUE';
    const path = cookie.path || '/';
    const secure = cookie.secure ? 'TRUE' : 'FALSE';
    const expiration = cookie.expires || 0;
    const name = cookie.name;
    const value = cookie.value;

    lines.push(`${domain}\t${includeSubdomains}\t${path}\t${secure}\t${expiration}\t${name}\t${value}`);
  }

  writeFileSync(cookieFilePath, lines.join('\n'));
  console.log(`✅ Saved to: ${cookieFilePath}\n`);

  await browser.close();

  console.log('🎉 Done! Your scraper should now work with these fresh cookies.');
}

main().catch(console.error);
