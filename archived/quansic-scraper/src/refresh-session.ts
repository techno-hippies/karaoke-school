#!/usr/bin/env bun

import { chromium } from 'playwright';
import chalk from 'chalk';

async function refreshSession() {
  console.log(chalk.cyan('🔄 Refreshing Quansic Session\n'));
  
  const email = 'maroonlethia@powerscrews.com';
  const password = 'Temporarypw710!';
  
  const browser = await chromium.launch({ 
    headless: true
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    console.log(chalk.yellow('1. Navigating to login page...'));
    await page.goto('https://explorer.quansic.com');
    
    // Wait for and fill login form
    await page.waitForSelector('input[name="email"]', { timeout: 10000 });
    await page.fill('input[name="email"]', email);
    await page.fill('input[type="password"]', password);
    
    console.log(chalk.yellow('2. Logging in...'));
    await page.click('button:has-text("Login")');
    
    // Wait for login to complete
    await page.waitForTimeout(5000);
    
    // Check if logged in
    const currentUrl = page.url();
    if (!currentUrl.includes('login')) {
      console.log(chalk.green('✅ Login successful!'));
      
      // Save the session
      const storageState = await context.storageState();
      await Bun.write('auth-state.json', JSON.stringify(storageState, null, 2));
      console.log(chalk.green('✅ Session saved to auth-state.json'));
      
      // Test it works
      await page.goto('https://explorer.quansic.com/app-party/Quansic::isni::0000000356358936');
      await page.waitForTimeout(2000);
      const artistName = await page.locator('h2').first().textContent();
      console.log(chalk.green(`✅ Verified access - found artist: ${artistName}`));
      
    } else {
      console.log(chalk.red('❌ Login failed'));
    }
    
  } catch (error) {
    console.error(chalk.red('Error:'), error);
  } finally {
    await browser.close();
  }
}

refreshSession();