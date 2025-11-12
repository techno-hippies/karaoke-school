/**
 * Manual CAPTCHA solver + API capture
 * Opens browser, loads cookies, lets you solve CAPTCHA, then captures API responses
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

// Parse cookies from file
function loadCookies() {
  const cookieFilePath = resolve(process.cwd(), 'www.tiktok.com_cookies.txt');
  const cookieContent = readFileSync(cookieFilePath, 'utf-8');
  const cookies = [];

  for (const line of cookieContent.split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const parts = line.split('\t');
    if (parts.length < 7) continue;
    const [domain, _, path, secure, expiration, name, value] = parts;
    cookies.push({
      name: name.trim(),
      value: value.trim(),
      domain: domain.trim().replace(/^\./, ''),
      path: path.trim() || '/',
      expires: Number(expiration.trim()) || undefined,
      secure: secure.trim().toUpperCase() === 'TRUE',
      httpOnly: false
    });
  }

  console.log(`📦 Loaded ${cookies.length} cookies`);
  return cookies;
}

async function main() {
  const username = process.argv[2] || 'idazeile';
  console.log(`🎯 Capturing TikTok API for @${username}`);

  const cookies = loadCookies();
  const capturedResponses: any[] = [];

  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-blink-features=AutomationControlled']
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 }
  });

  // Add cookies
  await context.addCookies(cookies);

  // Add anti-detection
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    window.chrome = { runtime: {} };
  });

  const page = await context.newPage();

  // Capture ALL responses
  page.on('response', async (response) => {
    const url = response.url();

    // Look for TikTok API endpoints
    if (url.includes('item_list') || url.includes('api.tiktok') || url.includes('SIGI_STATE')) {
      try {
        const text = await response.text();
        if (text.length > 100) {
          console.log(`\n✅ Captured API response:`);
          console.log(`   URL: ${url.substring(0, 100)}...`);
          console.log(`   Status: ${response.status()}`);
          console.log(`   Size: ${text.length} bytes`);

          capturedResponses.push({
            url,
            status: response.status(),
            headers: response.headers(),
            body: text
          });
        }
      } catch (e) {
        // Ignore errors
      }
    }
  });

  console.log(`\n🌐 Opening TikTok profile: @${username}`);
  console.log(`⏳ Solve the CAPTCHA if it appears...`);
  console.log(`📝 The script will capture API responses for 60 seconds`);
  console.log(`   Then press Ctrl+C or close the browser\n`);

  await page.goto(`https://www.tiktok.com/@${username}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });

  // Wait for user to solve CAPTCHA and browse
  console.log(`⏰ Waiting 60 seconds for you to interact with the page...`);
  await page.waitForTimeout(60000);

  await browser.close();

  // Save captured data
  if (capturedResponses.length > 0) {
    const outputPath = resolve(process.cwd(), 'captured-tiktok-responses.json');
    writeFileSync(outputPath, JSON.stringify(capturedResponses, null, 2));
    console.log(`\n💾 Saved ${capturedResponses.length} responses to: ${outputPath}`);

    // Try to parse and show music data
    for (const resp of capturedResponses) {
      try {
        const data = JSON.parse(resp.body);
        if (data.itemList && Array.isArray(data.itemList)) {
          console.log(`\n🎵 Found ${data.itemList.length} videos in response`);
          const firstVideo = data.itemList[0];
          if (firstVideo?.music) {
            console.log(`\n📊 First video music data:`);
            console.log(JSON.stringify(firstVideo.music, null, 2));
          }
        }
      } catch (e) {
        // Not JSON or different format
      }
    }
  } else {
    console.log(`\n⚠️  No API responses captured`);
  }
}

main().catch(console.error);
