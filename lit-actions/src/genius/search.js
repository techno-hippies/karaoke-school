/**
 * Genius Search - FREE VERSION (No Authentication Required)
 * Searches for songs on Genius API with usage tracking
 * Uses exposed API key - no wallet authentication required
 * Updated for ks_web_1 schema
 * 
 * Expected params:
 * - query: The search query string
 * - limit: Optional limit for results (default 10, max 20)
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
  let resultsCount = 0;
  let selectedKeyIndex = null;
  let searchResults = [];

  // Variables for analytics
  let searchQuery = '';
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
      query,
      limit,
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
    if (!query) {
      throw new Error('query parameter is required');
    }

    searchQuery = query;
    
    // Set analytics parameters
    walletAddr = userAddress || 'anonymous';
    userIpParam = userIp || null;
    userIpCountryParam = typeof userIpCountry !== 'undefined' ? userIpCountry : null;
    // Generate deterministic session ID if not provided
    sessionIdParam = sessionId || `web-${walletAddr}-${searchQuery}`.slice(0, 36);
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
    
    // Set default limit and ensure it's within bounds
    const searchLimit = Math.min(Math.max(limit || 10, 1), 20);
    
    // Make the API request to Genius search endpoint using runOnce for determinism
    const searchUrl = `https://api.genius.com/search?q=${encodeURIComponent(query)}&per_page=${searchLimit}`;
    
    const dataString = await Lit.Actions.runOnce({ waitForResponse: true, name: "geniusSearchFetch" }, async () => {
      const response = await fetch(searchUrl, {
        headers: {
          'Authorization': 'Bearer ' + geniusApiKey
        }
      });
      
      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('RATE_LIMITED');
        }
        throw new Error(`Genius API error: ${response.status}`);
      }
      
      const jsonData = await response.json();
      return JSON.stringify(jsonData);
    });
    
    const data = JSON.parse(dataString);
    
    if (data.response && data.response.hits) {
      searchResults = data.response.hits.map(hit => {
        const result = hit.result;
        
        // Process artwork URL
        let artwork_thumbnail = null;
        if (result.song_art_image_thumbnail_url) {
          artwork_thumbnail = result.song_art_image_thumbnail_url;
        } else if (result.header_image_thumbnail_url) {
          artwork_thumbnail = result.header_image_thumbnail_url;
        }

        return {
          genius_id: result.id,
          title: result.title,
          title_with_featured: result.title_with_featured,
          artist: result.primary_artist_names || result.artist_names,
          artist_id: result.primary_artist?.id,
          genius_slug: result.path ? result.path.replace(/^\//, '') : null,
          url: result.url,
          artwork_thumbnail,
          lyrics_state: result.lyrics_state,
          _score: hit.highlights?.length || 0
        };
      });
      resultsCount = searchResults.length;
    }
    
    success = true;
    
  } catch (error) {
    errorType = error.message || 'unknown_error';
    success = false;
    searchResults = [];
    resultsCount = 0;
  } finally {
    // Send analytics using new ks_web_1 schema
    let analyticsStatus = 'not_sent';
    try {
      // Make runOnce name unique per search to ensure analytics run for each query
      const analyticsRunOnceName = `searchAnalytics_${sessionIdParam}`;
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
          action_type: 'search',
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
          input_text: searchQuery,
          output_text: success ? JSON.stringify(searchResults.slice(0, 3)) : null, // Store first 3 results
          metadata: JSON.stringify({
            results_count: resultsCount,
            genius_key_index: selectedKeyIndex,
            search_limit: limit || 10,
            query_length: searchQuery.length,
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
    if (success) {
      Lit.Actions.setResponse({
        response: JSON.stringify({
          success: true,
          results: searchResults,
          count: resultsCount,
          keyUsed: selectedKeyIndex + 1,
          version: 'free_exposed_v3',
          analytics: analyticsStatus
        })
      });
    } else {
      Lit.Actions.setResponse({
        response: JSON.stringify({
          success: false,
          error: errorType || 'Search failed',
          results: [],
          version: 'free_exposed_v3'
        })
      });
    }
  }
};

go();