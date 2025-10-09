/**
 * Genius Song Metadata - FREE VERSION (No Authentication Required)
 * Fetches full song metadata from Genius API
 * Uses exposed API key - no wallet authentication required
 * Updated for ks_web_1 schema
 *
 * Expected params:
 * - songId: The Genius song ID (required)
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
  let songData = null;

  // Variables for analytics
  let songIdParam = '';
  let walletAddr = 'anonymous';
  let userIpParam = null;
  let userIpCountryParam = null;
  let sessionIdParam = null;
  let userAgentParam = 'unknown';
  let languageParam = null;
  let dbEndpoint = null;
  let dbCredentials = null;

  try {
    // Extract parameters from jsParams (v8 pattern)
    const {
      songId,
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
    if (!songId) {
      throw new Error('songId parameter is required');
    }

    songIdParam = songId;

    // Set analytics parameters
    walletAddr = userAddress || 'anonymous';
    userIpParam = userIp || null;
    userIpCountryParam = typeof userIpCountry !== 'undefined' ? userIpCountry : null;
    // Generate deterministic session ID if not provided
    sessionIdParam = sessionId || `web-${walletAddr}-song-${songId}`.slice(0, 36);
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

    // Make the API request to Genius song endpoint using runOnce for determinism
    const songUrl = `https://api.genius.com/songs/${songId}?text_format=plain`;

    const dataString = await Lit.Actions.runOnce({ waitForResponse: true, name: "geniusSongFetch" }, async () => {
      const response = await fetch(songUrl, {
        headers: {
          'Authorization': 'Bearer ' + geniusApiKey
        }
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('RATE_LIMITED');
        }
        if (response.status === 404) {
          throw new Error('SONG_NOT_FOUND');
        }
        throw new Error(`Genius API error: ${response.status}`);
      }

      const jsonData = await response.json();
      return JSON.stringify(jsonData);
    });

    const data = JSON.parse(dataString);

    if (data.response && data.response.song) {
      const song = data.response.song;

      songData = {
        id: song.id,
        title: song.title,
        title_with_featured: song.title_with_featured,
        artist: song.primary_artist?.name || song.artist_names,
        artist_id: song.primary_artist?.id,
        path: song.path,
        url: song.url,
        song_art_image_url: song.song_art_image_url,
        song_art_image_thumbnail_url: song.song_art_image_thumbnail_url,
        header_image_url: song.header_image_url,
        header_image_thumbnail_url: song.header_image_thumbnail_url,
        release_date_for_display: song.release_date_for_display,
        description: song.description?.plain || '',
        youtube_url: song.youtube_url,
        soundcloud_url: song.soundcloud_url || null,
        spotify_uuid: song.spotify_uuid || null,
        apple_music_id: song.apple_music_id || null,
        apple_music_player_url: song.apple_music_player_url || null,
        media: (song.media || []).map(m => ({
          provider: m.provider,
          url: m.url,
          type: m.type
        })),
        featured_artists: (song.featured_artists || []).map(a => ({
          id: a.id,
          name: a.name,
          url: a.url
        })),
        producer_artists: (song.producer_artists || []).map(a => ({
          id: a.id,
          name: a.name,
          url: a.url
        })),
        writer_artists: (song.writer_artists || []).map(a => ({
          id: a.id,
          name: a.name,
          url: a.url
        }))
      };
    }

    success = true;

  } catch (error) {
    errorType = error.message || 'unknown_error';
    success = false;
    songData = null;
  } finally {
    // Send analytics using new ks_web_1 schema
    let analyticsStatus = 'not_sent';
    try {
      // Make runOnce name unique per request to ensure analytics run for each call
      const analyticsRunOnceName = `songAnalytics_${sessionIdParam}`;
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
          action_type: 'song_metadata',
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
          input_text: `song_id:${songIdParam}`,
          output_text: success ? JSON.stringify({ title: songData?.title, artist: songData?.artist }) : null,
          metadata: JSON.stringify({
            genius_key_index: selectedKeyIndex,
            song_id: songIdParam,
            api_key_type: 'exposed'
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
    if (success && songData) {
      Lit.Actions.setResponse({
        response: JSON.stringify({
          success: true,
          song: songData,
          keyUsed: selectedKeyIndex + 1,
          version: 'song_free_v1',
          analytics: analyticsStatus
        })
      });
    } else {
      Lit.Actions.setResponse({
        response: JSON.stringify({
          success: false,
          error: errorType || 'Song metadata fetch failed',
          song: null,
          version: 'song_free_v1'
        })
      });
    }
  }
};

go();
