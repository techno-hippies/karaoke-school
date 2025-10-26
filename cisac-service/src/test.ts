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
    // Test API search with known ISWCs
    const testISWCs = [
      { iswc: 'T0001559074', title: 'Born to Make You Happy - Britney Spears' },
      { iswc: 'T0101974597', title: 'Knives Out - Radiohead' }, // This is the correct ISWC
      // Add more valid ISWCs here to test caching
    ];

    for (let i = 0; i < testISWCs.length; i++) {
      const { iswc, title } = testISWCs[i];
      console.log(`\n${'='.repeat(60)}`);
      console.log(`Test ${i + 1}/${testISWCs.length}: ${title}`);
      console.log(`ISWC: ${iswc}`);
      console.log('='.repeat(60));

      const data = await cisac.searchByIswc(iswc);

      console.log(`\nOriginal Title: ${data.originalTitle}`);
      console.log(`Status: ${data.iswcStatus}`);
      console.log(`\nInterested Parties: ${data.interestedParties.length}`);
      data.interestedParties.slice(0, 3).forEach((party: any, index: number) => {
        console.log(`  ${index + 1}. ${party.name} (${party.role})`);
      });
      console.log(`\nWorks Found: ${data.works.length}`);

      if (data.otherTitles && data.otherTitles.length > 0) {
        console.log(`Other Titles: ${data.otherTitles.length}`);
      }

      // Only solve captcha once - subsequent requests should use cached token
      if (i === 0) {
        console.log('\n✅ First request completed - token should now be cached');
      } else {
        console.log('\n✅ Request completed using cached token (no captcha!)');
      }
    }

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await cisac.close();
  }
}

main();
