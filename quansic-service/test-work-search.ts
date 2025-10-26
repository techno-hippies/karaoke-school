// Test if we can search for works using ISRC or recording details
const QUANSIC_EMAIL = process.env.QUANSIC_EMAIL!;
const QUANSIC_PASSWORD = process.env.QUANSIC_PASSWORD!;

// Test different possible endpoints to find work from recording
async function testWorkSearch() {
  const serviceUrl = 'https://jutf5ip5d9e9d0nvmpv2k9l6kk.ingress.d3akash.cloud';
  
  // First get the recording to extract MusicBrainz ID
  const recordingResp = await fetch(`${serviceUrl}/enrich-recording`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isrc: 'USRC11902726' })
  });
  
  const recordingData = await recordingResp.json();
  console.log('Recording MusicBrainz ID:', recordingData.data.platform_ids.musicbrainz);
  
  // Try to find if there's a work lookup by recording MBID
  const mbid = recordingData.data.platform_ids.musicbrainz;
  
  // Test endpoint: lookup work by recording mbid
  try {
    const testUrl = `https://explorer.quansic.com/api/q/lookup/work/recording/${mbid}`;
    console.log(`\nTrying: ${testUrl}`);
    const resp = await fetch(testUrl);
    console.log(`Status: ${resp.status}`);
    if (resp.ok) {
      const data = await resp.json();
      console.log('SUCCESS! Data:', JSON.stringify(data).substring(0, 300));
    }
  } catch (e: any) {
    console.log('Failed:', e.message);
  }
  
  // Test: search works by ISRC
  try {
    const testUrl = `https://explorer.quansic.com/api/q/search/works?isrc=USRC11902726`;
    console.log(`\nTrying: ${testUrl}`);
    const resp = await fetch(testUrl);
    console.log(`Status: ${resp.status}`);
    if (resp.ok) {
      const data = await resp.json();
      console.log('SUCCESS! Data:', JSON.stringify(data).substring(0, 300));
    }
  } catch (e: any) {
    console.log('Failed:', e.message);
  }
}

testWorkSearch();
