/**
 * Genius Song Metadata Fetcher - FREE VERSION (No Authentication)
 * Fetches song metadata from Genius API for display purposes
 * Uses exposed API keys - no blockchain writes, instant response
 *
 * Expected params:
 * - songId: The Genius song ID
 *
 * Returns: Song metadata (title, artist, artwork, etc)
 */

const go = async () => {
  // Destructure jsParams first (required by Lit Actions)
  const { songId } = jsParams || {};

  try {
    const geniusId = Number(songId);
    if (!geniusId || geniusId <= 0) {
      throw new Error('Invalid songId parameter');
    }

    console.log(`[Song Metadata] Fetching Genius ID: ${geniusId}`);

    // Use working Genius API key (same as search.js)
    const geniusApiKey = 'z0-uHScJhlvY7rB_HwThSEZhjpmSzlWMnBhaby3tPtqJpfOeQwZ1cc5OG1bdegV7';
    const url = `https://api.genius.com/songs/${geniusId}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${geniusApiKey}`,
        'User-Agent': 'KaraokeSchool/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`Genius API error: HTTP ${response.status}`);
    }

    const data = await response.json();
    if (!data.response || !data.response.song) {
      throw new Error('Invalid response from Genius API');
    }

    const songData = data.response.song;
    console.log(`✅ Song fetched: ${songData.title} by ${songData.primary_artist?.name}`);

    // Return formatted response
    Lit.Actions.setResponse({
      response: JSON.stringify({
        success: true,
        song: {
          id: songData.id,
          title: songData.title,
          title_with_featured: songData.title_with_featured,
          artist: songData.primary_artist?.name || 'Unknown Artist',
          artist_id: songData.primary_artist?.id,
          path: songData.path,
          url: songData.url,
          song_art_image_url: songData.song_art_image_url,
          song_art_image_thumbnail_url: songData.song_art_image_thumbnail_url,
          header_image_url: songData.header_image_url,
          header_image_thumbnail_url: songData.header_image_thumbnail_url,
          release_date_for_display: songData.release_date_for_display,
          youtube_url: songData.youtube_url,
          soundcloud_url: songData.media?.find(m => m.provider === 'soundcloud')?.url,
          spotify_uuid: songData.spotify_uuid,
          apple_music_id: songData.apple_music_id,
          apple_music_player_url: songData.apple_music_player_url,
        }
      })
    });
  } catch (error) {
    console.error('Song metadata fetch failed:', error);
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
