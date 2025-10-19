/**
 * Generate Artist Profile v1
 *
 * Incrementally builds out artist profile generation:
 * - Step 1: Fetch Genius artist data ✓ (current)
 * - Step 2: Mint PKP for artist (TODO)
 * - Step 3: Create Lens account (TODO)
 * - Step 4: Register in ArtistRegistryV2 (TODO)
 *
 * Expected params:
 * - geniusArtistId: Genius artist ID (required)
 */

const go = async () => {
  const startTime = Date.now();
  let success = false;
  let errorType = null;
  let artistData = null;

  try {
    // Extract parameters
    const { geniusArtistId } = jsParams || {};

    // Validate required parameters
    if (!geniusArtistId) {
      throw new Error('geniusArtistId parameter is required');
    }

    console.log(`🎨 Generating profile for artist ${geniusArtistId}`);

    // STEP 1: Fetch Genius artist metadata
    // Use exposed API key (same as artist.js)
    const geniusApiKey = 'z0-uHScJhlvY7rB_HwThSEZhjpmSzlWMnBhaby3tPtqJpfOeQwZ1cc5OG1bdegV7';

    console.log('📥 Fetching artist data from Genius...');
    const artistUrl = `https://api.genius.com/artists/${geniusArtistId}?text_format=plain`;

    const dataString = await Lit.Actions.runOnce({
      waitForResponse: true,
      name: `geniusArtistFetch_${geniusArtistId}`
    }, async () => {
      const response = await fetch(artistUrl, {
        headers: {
          'Authorization': 'Bearer ' + geniusApiKey
        }
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('RATE_LIMITED');
        }
        if (response.status === 404) {
          throw new Error('ARTIST_NOT_FOUND');
        }
        throw new Error(`Genius API error: ${response.status}`);
      }

      const jsonData = await response.json();
      return JSON.stringify(jsonData);
    });

    const data = JSON.parse(dataString);

    if (data.response && data.response.artist) {
      const artist = data.response.artist;

      artistData = {
        id: artist.id,
        name: artist.name,
        url: artist.url,
        image_url: artist.image_url,
        header_image_url: artist.header_image_url,
        description: artist.description?.plain || '',
        instagram_name: artist.instagram_name || null,
        twitter_name: artist.twitter_name || null,
        facebook_name: artist.facebook_name || null,
        followers_count: artist.followers_count || 0,
        is_verified: artist.is_verified || false,
        alternate_names: artist.alternate_names || []
      };

      console.log(`✅ Fetched artist: ${artistData.name}`);
      console.log(`   Followers: ${artistData.followers_count.toLocaleString()}`);
      console.log(`   Verified: ${artistData.is_verified ? 'Yes' : 'No'}`);
    }

    // TODO Step 2: Mint PKP for this artist
    // TODO Step 3: Create Lens account
    // TODO Step 4: Register in ArtistRegistryV2

    success = true;

  } catch (error) {
    errorType = error.message || 'unknown_error';
    success = false;
    console.error('❌ Error:', errorType);
  } finally {
    const duration = Date.now() - startTime;
    console.log(`⏱️  Duration: ${duration}ms`);

    // Return result
    if (success && artistData) {
      Lit.Actions.setResponse({
        response: JSON.stringify({
          success: true,
          step: 1,
          stepName: 'fetch_genius_data',
          artist: artistData,
          // TODO: Add pkp, lensAccount, registryTx in later steps
          processingTimeMs: duration,
          version: 'generate-profile-v1'
        })
      });
    } else {
      Lit.Actions.setResponse({
        response: JSON.stringify({
          success: false,
          error: errorType || 'Profile generation failed',
          version: 'generate-profile-v1'
        })
      });
    }
  }
};

go();
