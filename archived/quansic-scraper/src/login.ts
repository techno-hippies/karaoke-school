#!/usr/bin/env bun

import { chromium } from 'playwright';
import chalk from 'chalk';
import * as readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query: string): Promise<string> => {
  return new Promise(resolve => rl.question(query, resolve));
};

async function login() {
  console.log(chalk.cyan('🔐 Quansic Login\n'));
  
  // Get credentials
  const email = await question('Email: ');
  const password = await question('Password: ');
  rl.close();
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 100
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    console.log(chalk.yellow('\n1. Navigating to login page...'));
    await page.goto('https://explorer.quansic.com');
    
    // Wait for login form
    await page.waitForSelector('input[type="email"], input[type="text"], input[name*="email"], input[name*="user"]', { timeout: 10000 });
    
    console.log(chalk.yellow('2. Filling login form...'));
    
    // Try different possible selectors for email/username field
    const emailSelectors = [
      'input[type="email"]',
      'input[name="email"]',
      'input[name="username"]',
      'input[placeholder*="email" i]',
      'input[placeholder*="username" i]',
      'input[type="text"]:first-of-type'
    ];
    
    let emailFilled = false;
    for (const selector of emailSelectors) {
      try {
        await page.fill(selector, email, { timeout: 1000 });
        emailFilled = true;
        console.log(chalk.gray(`  Email filled with selector: ${selector}`));
        break;
      } catch {}
    }
    
    if (!emailFilled) {
      console.log(chalk.red('Could not find email field'));
    }
    
    // Fill password
    await page.fill('input[type="password"]', password);
    console.log(chalk.gray('  Password filled'));
    
    // Submit form - try different methods
    console.log(chalk.yellow('3. Submitting form...'));
    
    // Try clicking submit button
    const submitSelectors = [
      'button[type="submit"]',
      'input[type="submit"]',
      'button:has-text("Login")',
      'button:has-text("Sign in")',
      'button:has-text("Log in")'
    ];
    
    let submitted = false;
    for (const selector of submitSelectors) {
      try {
        await page.click(selector, { timeout: 1000 });
        submitted = true;
        console.log(chalk.gray(`  Clicked: ${selector}`));
        break;
      } catch {}
    }
    
    if (!submitted) {
      // Try pressing Enter
      await page.keyboard.press('Enter');
      console.log(chalk.gray('  Pressed Enter'));
    }
    
    // Wait for navigation
    console.log(chalk.yellow('4. Waiting for login to complete...'));
    await page.waitForTimeout(5000);
    
    // Check if logged in
    const currentUrl = page.url();
    if (!currentUrl.includes('login')) {
      console.log(chalk.green('\n✅ Login successful!'));
      
      // Save the session
      const storageState = await context.storageState();
      await Bun.write('auth-state.json', JSON.stringify(storageState, null, 2));
      console.log(chalk.green('✅ Session saved to auth-state.json'));
      
      // Navigate to test page
      console.log(chalk.yellow('\n5. Testing with artist page...'));
      await page.goto('https://explorer.quansic.com/app-party/Quansic::isni::0000000356358936');
      await page.waitForTimeout(3000);
      
      const artistName = await page.locator('h2').first().textContent();
      console.log(chalk.green(`Artist: ${artistName}`));
      
    } else {
      console.log(chalk.red('\n❌ Login failed - still on login page'));
    }
    
  } catch (error) {
    console.error(chalk.red('Error:'), error);
  }
  
  console.log(chalk.yellow('\nPress Enter to close browser...'));
  await new Promise(resolve => process.stdin.once('data', resolve));
  await browser.close();
}

login();