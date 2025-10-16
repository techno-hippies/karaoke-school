/**
 * Genius Artist Metadata - FREE VERSION (No Authentication Required)
 * Fetches full artist metadata from Genius API
 * Uses exposed API key - no wallet authentication required
 * Updated for ks_web_1 schema
 *
 * Expected params:
 * - artistId: The Genius artist ID (required)
 * - includeTopSongs: Whether to fetch top songs (default: true, fetches 10 songs)
 * - userAddress: The user's wallet address (optional)
 * - language: User's browser language (e.g., 'en-US', 'zh-CN')
 * - userIp: User's IP for country detection (not stored in analytics)
 * - userIpCountry: User's country code
 * - userAgent: User agent string
 * - sessionId: Session identifier
 *
 * Analytics params (optional):
 * - dbUrlCiphertext, dbUrlDataToEncryptHash
 * - dbTokenCiphertext, dbTokenDataToEncryptHash
 * - dbUrlAccessControlConditions, dbTokenAccessControlConditions
 */

// Helper function for deterministic hashing
async function sha256(message) {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

const go = async () => {
  const startTime = Date.now();
  let success = false;
  let errorType = null;
  let selectedKeyIndex = null;
  let artistData = null;
  let topSongs = [];

  // Variables for analytics
  let artistIdParam = '';
  let walletAddr = 'anonymous';
  let userIpParam = null;
  let userIpCountryParam = null;
  let sessionIdParam = null;
  let userAgentParam = 'unknown';
  let languageParam = null;
  let dbEndpoint = null;
  let dbCredentials = null;

  try {
    // Extract parameters from jsParams
    const {
      artistId,
      includeTopSongs = true,
      userAddress,
      userIp,
      userIpCountry,
      userAgent,
      sessionId,
      language,
      userLanguage,
      dbUrlCiphertext,
      dbUrlDataToEncryptHash,
      dbUrlAccessControlConditions,
      dbTokenCiphertext,
      dbTokenDataToEncryptHash,
      dbTokenAccessControlConditions
    } = jsParams || {};

    // Validate required parameters
    if (!artistId) {
      throw new Error('artistId parameter is required');
    }

    artistIdParam = artistId;

    // Set analytics parameters
    walletAddr = userAddress || 'anonymous';
    userIpParam = userIp || null;
    userIpCountryParam = typeof userIpCountry !== 'undefined' ? userIpCountry : null;
    // Generate deterministic session ID if not provided
    sessionIdParam = sessionId || `web-${walletAddr}-artist-${artistId}`.slice(0, 36);
    userAgentParam = userAgent || 'unknown';
    languageParam = language || userLanguage || null;

    // Use exposed Genius API key (no encryption needed)
    const geniusApiKey = 'z0-uHScJhlvY7rB_HwThSEZhjpmSzlWMnBhaby3tPtqJpfOeQwZ1cc5OG1bdegV7';
    selectedKeyIndex = 0; // Single key, no selection needed

    // Decrypt DB credentials if provided (optional for analytics)
    console.log('🔐 DB creds check:', {
      hasUrlCiphertext: !!dbUrlCiphertext,
      hasTokenCiphertext: !!dbTokenCiphertext,
      hasUrlHash: !!dbUrlDataToEncryptHash,
      hasTokenHash: !!dbTokenDataToEncryptHash,
      hasUrlACC: !!dbUrlAccessControlConditions,
      hasTokenACC: !!dbTokenAccessControlConditions
    });

    if (dbUrlCiphertext && dbTokenCiphertext && dbUrlAccessControlConditions && dbTokenAccessControlConditions) {
      try {
        console.log('🔐 Attempting to decrypt DB credentials...');
        [dbEndpoint, dbCredentials] = await Promise.all([
          Lit.Actions.decryptAndCombine({
            accessControlConditions: dbUrlAccessControlConditions,
            ciphertext: dbUrlCiphertext,
            dataToEncryptHash: dbUrlDataToEncryptHash,
            authSig: null,
            chain: 'ethereum'
          }),
          Lit.Actions.decryptAndCombine({
            accessControlConditions: dbTokenAccessControlConditions,
            ciphertext: dbTokenCiphertext,
            dataToEncryptHash: dbTokenDataToEncryptHash,
            authSig: null,
            chain: 'ethereum'
          })
        ]);
        console.log('✅ DB credentials decrypted successfully');
        console.log('📊 DB endpoint:', dbEndpoint ? dbEndpoint.substring(0, 50) + '...' : 'none');
      } catch (dbError) {
        console.log('❌ Failed to decrypt DB credentials:', dbError.message);
        // Analytics optional - continue without
      }
    } else {
      console.log('⚠️ DB credentials not provided in params (analytics will be skipped)');
    }

    // Make the API request to Genius artist endpoint using runOnce for determinism
    const artistUrl = `https://api.genius.com/artists/${artistId}?text_format=plain`;

    const dataString = await Lit.Actions.runOnce({ waitForResponse: true, name: "geniusArtistFetch" }, async () => {
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
    }

    // Fetch top songs if requested
    if (includeTopSongs && artistData) {
      console.log('📝 Fetching top songs...');
      const songsString = await Lit.Actions.runOnce({ waitForResponse: true, name: "geniusArtistSongs" }, async () => {
        try {
          const songsUrl = `https://api.genius.com/artists/${artistId}/songs?sort=popularity&per_page=10`;
          const songsResponse = await fetch(songsUrl, {
            headers: {
              'Authorization': 'Bearer ' + geniusApiKey
            }
          });

          if (!songsResponse.ok) {
            console.log('⚠️ Failed to fetch top songs:', songsResponse.status);
            return JSON.stringify({ songs: [] });
          }

          const songsData = await songsResponse.json();
          return JSON.stringify(songsData);
        } catch (error) {
          console.log('⚠️ Error fetching top songs:', error.message);
          return JSON.stringify({ songs: [] });
        }
      });

      const songsData = JSON.parse(songsString);
      if (songsData.response && songsData.response.songs) {
        topSongs = songsData.response.songs.map(song => ({
          id: song.id,
          title: song.title,
          title_with_featured: song.title_with_featured,
          artist_names: song.artist_names,
          url: song.url,
          song_art_image_thumbnail_url: song.song_art_image_thumbnail_url,
          path: song.path
        }));
        console.log(`✅ Fetched ${topSongs.length} top songs`);
      }
    }

    success = true;

  } catch (error) {
    errorType = error.message || 'unknown_error';
    success = false;
    artistData = null;
    topSongs = [];
  } finally {
    // Send analytics using new ks_web_1 schema
    let analyticsStatus = 'not_sent';
    try {
      // Make runOnce name unique per request to ensure analytics run for each call
      const analyticsRunOnceName = `artistAnalytics_${sessionIdParam}`;
      analyticsStatus = await Lit.Actions.runOnce({ waitForResponse: true, name: analyticsRunOnceName }, async () => {

        const METRICS_SALT = 'ks_metrics_2025';
        const countryCode = userIpCountryParam || 'XX';
        const userHash = await sha256(walletAddr + METRICS_SALT);
        const userAgentHash = await sha256(userAgentParam + METRICS_SALT);

        // Prepare analytics data for ks_web_1 schema
        const usageData = {
          timestamp: new Date().toISOString(),
          event_id: crypto.randomUUID(),
          user_hash: userHash,
          country_code: countryCode,
          action_type: 'artist_metadata',
          tier: 'free',
          success: success,
          error_type: errorType,
          processing_ms: Date.now() - startTime,
          session_id: sessionIdParam,
          user_agent_hash: userAgentHash,
          language: languageParam,
          parent_event_id: null,
          pipeline_step: null,
          model_used: null,
          tokens_used: null,
          prompt_tokens: null,
          completion_tokens: null,
          provider_latency_ms: null,
          generation_time_ms: null,
          total_latency_ms: Date.now() - startTime,
          cost_usd: null,
          input_text: `artist_id:${artistIdParam}`,
          output_text: success ? JSON.stringify({ name: artistData?.name, followers: artistData?.followers_count }) : null,
          metadata: JSON.stringify({
            genius_key_index: selectedKeyIndex,
            artist_id: artistIdParam,
            api_key_type: 'exposed',
            top_songs_count: topSongs.length
          })
        };

        if (!dbEndpoint || !dbCredentials) {
          console.log('📊 Analytics skipped - missing credentials');
          return "analytics skipped";
        }

        // Convert to NDJSON for ks_web_1
        const ndjsonData = JSON.stringify(usageData) + '\n';
        console.log('📊 Sending analytics to:', dbEndpoint);
        console.log('📊 Analytics data:', ndjsonData);

        try {
          const dataResponse = await fetch(dbEndpoint, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${dbCredentials}`,
              'Content-Type': 'application/x-ndjson'
            },
            body: ndjsonData
          });
          const result = dataResponse.ok ? "analytics sent" : `analytics failed: ${dataResponse.status}`;
          console.log('📊 Analytics result:', result);
          return result;
        } catch (fetchError) {
          console.log('📊 Analytics error:', fetchError.message);
          return "analytics error";
        }
      });
    } catch (metricsError) {
      // Metrics errors are ignored
    }

    // Now send the response after analytics
    if (success && artistData) {
      Lit.Actions.setResponse({
        response: JSON.stringify({
          success: true,
          artist: artistData,
          topSongs: topSongs,
          keyUsed: selectedKeyIndex + 1,
          version: 'artist_free_v1',
          analytics: analyticsStatus
        })
      });
    } else {
      Lit.Actions.setResponse({
        response: JSON.stringify({
          success: false,
          error: errorType || 'Artist metadata fetch failed',
          artist: null,
          topSongs: [],
          version: 'artist_free_v1'
        })
      });
    }
  }
};

go();
