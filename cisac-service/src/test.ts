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
    // Test API search with known ISWC (Born to Make You Happy - Britney Spears)
    const iswc = 'T0001559074';
    console.log(`\nTesting API search for ISWC: ${iswc}`);

    const data = await cisac.searchByIswc(iswc);

    console.log('\n=== API Search Results ===');
    console.log(`ISWC: ${data.iswc}`);
    console.log(`Original Title: ${data.originalTitle}`);
    console.log(`Status: ${data.iswcStatus}`);
    console.log(`\nInterested Parties (${data.interestedParties.length}):`);
    data.interestedParties.forEach((party: any, index: number) => {
      console.log(`  ${index + 1}. ${party.name} (${party.role}) - ${party.affiliation}`);
    });
    console.log(`\nWorks Found: ${data.works.length}`);

    if (data.otherTitles && data.otherTitles.length > 0) {
      console.log(`\nOther Titles (${data.otherTitles.length}):`);
      data.otherTitles.slice(0, 5).forEach((title: any) => {
        console.log(`  - ${title.title} (${title.type})`);
      });
    }

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await cisac.close();
  }
}

main();
