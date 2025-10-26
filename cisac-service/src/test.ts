import 'dotenv/config';
import { CISACService } from './cisac-service.js';
import { convertISWCFormat } from './utils.js';

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
    // Test token caching with real ISWCs from Neon database
    // Format: Database uses T-XXX.XXX.XXX-X, CISAC needs TXXXXXXXXXX (remove dashes/dots only)

    // ISWCs from Neon database (MusicBrainz format)
    const dbISWCs = [
      { iswc: 'T-910.940.292-8', title: 'Nightcall' },
      { iswc: 'T-061.239.697-0', title: 'Somebody That I Used to Know' },
      { iswc: 'T-801.384.775-2', title: 'Be My Lover' },
      { iswc: 'T-070.145.563-1', title: "Somebody's Watching Me" },
    ];

    // Convert to CISAC format
    const testISWCs = dbISWCs.map(({ iswc, title }) => ({
      dbFormat: iswc,
      cisacFormat: convertISWCFormat(iswc),
      title,
    }));

    console.log(`\n🎵 Testing CISAC token caching with ${testISWCs.length} ISWCs from database`);
    console.log(`Format conversion: T-XXX.XXX.XXX-X → TXXXXXXXXXX (remove dashes/dots)\n`);
    console.log(`Note: Only first request will solve captcha, rest use cached token!\n`);

    for (let i = 0; i < testISWCs.length; i++) {
      const { dbFormat, cisacFormat, title } = testISWCs[i];
      console.log(`\n${'='.repeat(60)}`);
      console.log(`Test ${i + 1}/${testISWCs.length}: ${title}`);
      console.log(`Database format: ${dbFormat}`);
      console.log(`CISAC format: ${cisacFormat}`);
      console.log('='.repeat(60));

      try {
        const data = await cisac.searchByIswc(cisacFormat);

        console.log(`\n✅ SUCCESS!`);
        console.log(`   Original Title: ${data.originalTitle}`);
        console.log(`   Status: ${data.iswcStatus}`);
        console.log(`   Interested Parties: ${data.interestedParties.length}`);
        console.log(`   Works Found: ${data.works.length}`);

        if (i === 0) {
          console.log('\n🔑 First request - captcha solved, token cached for ~59 minutes');
        } else {
          console.log('\n🔑 Using cached token (no captcha!)');
        }
      } catch (error: any) {
        console.log(`\n❌ FAILED: ${error.message}`);
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ TOKEN CACHING TEST COMPLETE`);
    console.log(`   Cost savings: 1 captcha for ${testISWCs.length} requests!`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await cisac.close();
  }
}

main();
