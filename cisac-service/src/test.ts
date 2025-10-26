import 'dotenv/config';
import { CISACService } from './cisac-service.js';

async function main() {
  const apiKey = process.env.TWOCAPTCHA_API_KEY;

  if (!apiKey) {
    console.error('TWOCAPTCHA_API_KEY environment variable is required');
    process.exit(1);
  }

  const cisac = new CISACService({
    apiKey,
    headless: false, // Set to true in production
    slowMo: 100,
  });

  try {
    // Test with a well-known song
    const results = await cisac.search({
      title: 'Yesterday',
      artist: 'The Beatles',
    });

    console.log('\n=== Search Results ===');
    if (results.length > 0) {
      results.forEach((result, index) => {
        console.log(`\n[${index + 1}]`);
        console.log(`ISWC: ${result.iswc}`);
        console.log(`Title: ${result.title}`);
        console.log(`Creators: ${result.creators}`);
        console.log(`Status: ${result.status}`);
      });
    } else {
      console.log('No results found');
    }

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await cisac.close();
  }
}

main();
