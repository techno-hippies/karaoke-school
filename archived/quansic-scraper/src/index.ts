#!/usr/bin/env bun

import { Command } from 'commander';
import chalk from 'chalk';
import { QuansicScraper } from './scraper';
import { FileManager } from './utils/file-manager';
import type { ScraperConfig } from './types';
import path from 'path';

const program = new Command();

program
  .name('quansic-scraper')
  .description('Scrape artist data from Quansic')
  .version('1.0.0')
  .option('-a, --artists <file>', 'Path to artists file', 'data/artists.txt')
  .option('-o, --output <dir>', 'Output directory', 'output')
  .option('-c, --cookies <file>', 'Path to cookies JSON file')
  .option('--headless', 'Run browser in headless mode', true)
  .option('--no-headless', 'Show browser window')
  .option('-d, --debug', 'Enable debug mode (saves raw HTML)', false)
  .option('-t, --timeout <ms>', 'Page timeout in milliseconds', '30000')
  .option('-r, --retry <n>', 'Number of retry attempts', '3')
  .action(async (options) => {
    console.log(chalk.bold.cyan('\n🎵 Quansic Music Data Scraper\n'));
    console.log(chalk.gray('=' .repeat(50)));
    
    const config: ScraperConfig = {
      artistsFile: options.artists,
      outputDir: options.output,
      cookiesFile: options.cookies,
      headless: options.headless,
      debug: options.debug,
      timeout: parseInt(options.timeout),
      retryAttempts: parseInt(options.retry)
    };

    console.log(chalk.blue('📋 Configuration:'));
    console.log(chalk.gray(`   Artists file: ${config.artistsFile}`));
    console.log(chalk.gray(`   Output dir: ${config.outputDir}`));
    console.log(chalk.gray(`   Cookies: ${config.cookiesFile || 'none'}`));
    console.log(chalk.gray(`   Headless: ${config.headless}`));
    console.log(chalk.gray(`   Debug: ${config.debug}`));
    console.log(chalk.gray('=' .repeat(50)));

    const fileManager = new FileManager(config.outputDir);
    const scraper = new QuansicScraper(config);

    try {
      // Read artists list
      console.log(chalk.cyan('\n📂 Loading artists list...'));
      const artists = await fileManager.readArtistsList(config.artistsFile!);
      console.log(chalk.green(`✅ Found ${artists.length} artists to scrape\n`));

      // Initialize scraper
      await scraper.initialize();

      // Start scraping
      console.log(chalk.bold.cyan('🚀 Starting scraping process...\n'));
      await scraper.scrapeArtists(artists);

    } catch (error) {
      console.error(chalk.red('\n❌ Error:'), error);
      process.exit(1);
    } finally {
      await scraper.close();
      console.log(chalk.green('\n✨ Done!\n'));
    }
  });

// Single artist mode
program
  .command('artist <identifier>')
  .description('Scrape a single artist')
  .option('-o, --output <dir>', 'Output directory', 'output')
  .option('-c, --cookies <file>', 'Path to cookies JSON file')
  .option('--headless', 'Run browser in headless mode', true)
  .option('--no-headless', 'Show browser window')
  .option('-d, --debug', 'Enable debug mode', false)
  .action(async (identifier, options) => {
    console.log(chalk.bold.cyan('\n🎵 Quansic Music Data Scraper - Single Artist Mode\n'));
    
    const config: ScraperConfig = {
      artistsFile: '',
      outputDir: options.output,
      cookiesFile: options.cookies,
      headless: options.headless,
      debug: options.debug,
      timeout: 30000,
      retryAttempts: 3
    };

    const scraper = new QuansicScraper(config);
    const fileManager = new FileManager(config.outputDir);

    try {
      await fileManager.ensureOutputDir();
      await scraper.initialize();
      
      console.log(chalk.cyan(`\n🎤 Scraping artist: ${identifier}\n`));
      const artist = await scraper.scrapeArtist(identifier);
      
      if (artist) {
        await fileManager.saveArtist(artist);
        console.log(chalk.green('\n✅ Artist scraped successfully!'));
        console.log(chalk.gray(`   Name: ${artist.name}`));
        console.log(chalk.gray(`   Releases: ${artist.releases?.length || 0}`));
        console.log(chalk.gray(`   Recordings: ${artist.recordings?.length || 0}`));
      } else {
        console.log(chalk.red('\n❌ Failed to scrape artist'));
      }

    } catch (error) {
      console.error(chalk.red('\n❌ Error:'), error);
      process.exit(1);
    } finally {
      await scraper.close();
      console.log(chalk.green('\n✨ Done!\n'));
    }
  });

program.parse();