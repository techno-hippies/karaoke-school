/**
 * Match and Segment v2: Combined single-query approach with Gemini 2.5 Flash Lite
 *
 * Single API call that:
 * 1. Determines if Genius and LRClib songs match
 * 2. If they match, segments the song into sections (verse, chorus, etc.)
 * 3. Returns structured JSON with match decision + sections
 */

const go = async () => {
  const {
    geniusId,
    geniusKeyAccessControlConditions,
    geniusKeyCiphertext,
    geniusKeyDataToEncryptHash,
    openrouterKeyAccessControlConditions,
    openrouterKeyCiphertext,
    openrouterKeyDataToEncryptHash
  } = jsParams || {};

  try {
    // Step 1: Decrypt keys
    console.log('[1/3] Decrypting keys...');
    const [geniusKey, openrouterKey] = await Promise.all([
      Lit.Actions.decryptAndCombine({
        accessControlConditions: geniusKeyAccessControlConditions,
        ciphertext: geniusKeyCiphertext,
        dataToEncryptHash: geniusKeyDataToEncryptHash,
        authSig: null,
        chain: 'ethereum'
      }),
      Lit.Actions.decryptAndCombine({
        accessControlConditions: openrouterKeyAccessControlConditions,
        ciphertext: openrouterKeyCiphertext,
        dataToEncryptHash: openrouterKeyDataToEncryptHash,
        authSig: null,
        chain: 'ethereum'
      })
    ]);
    console.log('Keys decrypted');

    // Step 2: Fetch Genius
    console.log('[2/3] Fetching Genius...');
    const geniusResp = await fetch(`https://api.genius.com/songs/${geniusId}`, {
      headers: { 'Authorization': `Bearer ${geniusKey}` }
    });
    const geniusData = await geniusResp.json();
    const artist = geniusData.response?.song?.artist_names || 'N/A';
    const title = geniusData.response?.song?.title || 'N/A';
    const album = geniusData.response?.song?.album?.name || 'N/A';
    console.log(`Genius: ${artist} - ${title}`);

    // Step 3: Fetch LRClib with scoring
    console.log('[3/3] Fetching LRClib...');
    const lrcResp = await fetch(`https://lrclib.net/api/search?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`);
    const lrcData = await lrcResp.json();

    // Score each result
    const scored = lrcData.map(result => {
      let score = 0;

      // Artist match (most important - 50 points)
      const artistLower = artist.toLowerCase();
      const resultArtistLower = result.artistName.toLowerCase();
      if (resultArtistLower.includes(artistLower) || artistLower.includes(resultArtistLower)) {
        score += 50;
      }

      // Title match (critical - 40 points)
      if (result.trackName.toLowerCase() === title.toLowerCase()) {
        score += 40;
      }

      // Album match (nice-to-have - 10 points, only if both exist)
      if (album !== 'N/A' && result.albumName &&
          result.albumName.toLowerCase().includes(album.toLowerCase())) {
        score += 10;
      }

      return { ...result, score };
    });

    // Take highest scoring
    const lrcMatch = scored.sort((a, b) => b.score - a.score)[0];
    console.log(`LRClib: Found ${lrcData.length} results, best match score: ${lrcMatch.score}, duration: ${lrcMatch.duration}s`);

    // Get full synced lyrics
    const lrcFullResp = await fetch(`https://lrclib.net/api/get?artist_name=${encodeURIComponent(lrcMatch.artistName)}&track_name=${encodeURIComponent(lrcMatch.trackName)}&duration=${lrcMatch.duration}`);
    const lrcFull = await lrcFullResp.json();
    const lyrics = lrcFull.syncedLyrics || '';
    console.log(`Got ${lyrics.split('\n').length} lines of lyrics`);

    // Step 4: Combined match + segment query
    console.log('[4/4] Asking Gemini 2.5 Flash Lite to match and segment...');
    const prompt = `Compare these two songs and determine if they are the EXACT same song:

Genius: ${artist} - ${title} (${album})
LRClib: ${lrcMatch.artistName} - ${lrcMatch.trackName} (${lrcMatch.albumName || 'N/A'})

If they ARE the same song, analyze these LRC-formatted lyrics and identify song sections:

${lyrics}

Instructions:
1. Determine if the songs match (compare artist and title)
2. If they match, parse the LRC lyrics and segment into standard song sections
3. Label sections: "Intro", "Verse 1", "Verse 2", "Chorus", "Bridge", "Outro"
4. Chorus can repeat multiple times but use the same label "Chorus" each time
5. Set confidence based on match quality: high (exact match), medium (similar), low (uncertain)`;

    const apiResp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openrouterKey}`,
        'Content-Type': 'application/json',
        'X-Title': 'Karaoke School Match and Segment v2',
        'HTTP-Referer': 'https://karaoke.school'
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite-preview-09-2025',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,
        max_tokens: 4000,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'match_and_segment',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                isMatch: {
                  type: 'boolean',
                  description: 'Whether the Genius and LRClib songs are the same'
                },
                confidence: {
                  type: 'string',
                  enum: ['high', 'medium', 'low'],
                  description: 'Confidence level of the match decision'
                },
                sections: {
                  type: 'array',
                  description: 'Song sections (only if isMatch is true)',
                  items: {
                    type: 'object',
                    properties: {
                      type: {
                        type: 'string',
                        description: 'Section label: Intro, Verse 1, Verse 2, Chorus, Bridge, Outro'
                      },
                      startTime: { type: 'number' },
                      endTime: { type: 'number' },
                      duration: { type: 'number' }
                    },
                    required: ['type', 'startTime', 'endTime', 'duration'],
                    additionalProperties: false
                  }
                }
              },
              required: ['isMatch', 'confidence', 'sections'],
              additionalProperties: false
            }
          }
        }
      })
    });

    const apiData = await apiResp.json();

    // Check for API errors
    if (apiData.error) {
      throw new Error(`OpenRouter API error: ${apiData.error.message || JSON.stringify(apiData.error)}`);
    }

    const content = apiData.choices?.[0]?.message?.content || '{"isMatch":false,"confidence":"low","sections":[]}';

    // Structured output guarantees valid JSON
    let result;
    try {
      result = JSON.parse(content);
    } catch (parseError) {
      console.log('Failed to parse response:', content.substring(0, 200));
      throw new Error(`JSON parse failed: ${parseError.message}`);
    }

    console.log(`Match: ${result.isMatch} (${result.confidence} confidence)`);
    console.log(`Sections: ${result.sections.length}`);

    Lit.Actions.setResponse({
      response: JSON.stringify({
        success: true,
        genius: { artist, title, album },
        lrclib: {
          artist: lrcMatch.artistName,
          title: lrcMatch.trackName,
          album: lrcMatch.albumName,
          lyricsLines: lyrics.split('\n').length,
          matchScore: lrcMatch.score
        },
        isMatch: result.isMatch,
        confidence: result.confidence,
        sections: result.sections
      })
    });
  } catch (error) {
    Lit.Actions.setResponse({
      response: JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack
      })
    });
  }
};

go();
