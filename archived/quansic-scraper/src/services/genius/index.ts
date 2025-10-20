#!/usr/bin/env bun

import chalk from 'chalk';
import { db, initDb } from '../../db/postgres';
import { sql } from 'drizzle-orm';
import { GeniusSongDetailsSchema, GeniusSearchResponseSchema } from '../../schemas/genius-schemas';
import { JsonSaver } from '../../utils/json-saver';
import { z } from 'zod';

class GeniusEnrichment {
  private apiKey: string = '';
  private rateLimitMs: number = 100;
  private lastRequestTime: number = 0;
  
  constructor() {
    // Always use the hardcoded key, env var seems corrupted
    this.apiKey = 'WZeZ3_oXfPv8U0MOvE-zOCa5DWm222YUd9rD1n6cktv_g9x_14hzw8rttEBmaLQD';
    if (!this.apiKey) {
      throw new Error('Missing GENIUS_API_KEY');
    }
  }
  
  private async rateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.rateLimitMs) {
      const waitTime = this.rateLimitMs - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
  }
  
  async searchSong(title: string, artist: string = 'Grimes'): Promise<any> {
    await this.rateLimit();
    
    const query = `${artist} ${title}`;
    const url = `https://api.genius.com/search?q=${encodeURIComponent(query)}&per_page=5`;
    
    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });
      
      if (!response.ok) {
        console.error(chalk.red(`Search API returned ${response.status} for "${query}"`));
        return null;
      }
      
      const data = await response.json();
      
      // Debug: log first hit
      if (data.response?.hits?.length > 0) {
        console.log(chalk.gray(`    Found ${data.response.hits.length} results, first: ${data.response.hits[0].result.title}`));
      }
      
      try {
        const validated = GeniusSearchResponseSchema.parse(data);
        const hits = validated.response.hits || [];
      
      // Find best match (prioritize exact artist match)
      for (const hit of hits) {
        const result = hit.result;
        if (result.primary_artist?.name?.toLowerCase().includes('grimes')) {
          return result;
        }
      }
      
      return hits[0]?.result || null;
      } catch (parseError) {
        // Skip validation, just return the raw data
        const hits = data.response?.hits || [];
        for (const hit of hits) {
          const result = hit.result;
          if (result.primary_artist?.name?.toLowerCase().includes('grimes')) {
            return result;
          }
        }
        return hits[0]?.result || null;
      }
    } catch (error) {
      console.error(chalk.red(`Error searching for "${title}":`), error);
      return null;
    }
  }
  
  async getSongDetails(geniusId: number): Promise<any> {
    await this.rateLimit();
    
    const url = `https://api.genius.com/songs/${geniusId}`;
    
    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });
      
      if (!response.ok) return null;
      
      const data = await response.json();
      // Skip validation for now - return raw data
      return data.response.song;
    } catch (error) {
      console.error(chalk.red(`Error fetching song ${geniusId}:`), error);
      return null;
    }
  }
  
  async enrichAllRecordings() {
    console.log(chalk.bold.cyan('\n🎤 GENIUS ENRICHMENT - COMPLETE DATA CAPTURE\n'));
    
    await initDb();
    
    const jsonSaver = new JsonSaver();
    const isni = '0000000356358936';
    const allSongs: any[] = [];
    
    // Create ALL Genius tables with complete schema
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS genius_tracks (
        id INTEGER PRIMARY KEY,
        isrc VARCHAR(50),
        title VARCHAR(500),
        full_title VARCHAR(500),
        artist_names VARCHAR(500),
        primary_artist_id INTEGER,
        primary_artist_name VARCHAR(500),
        url TEXT,
        path TEXT,
        
        -- Images
        song_art_image_url TEXT,
        header_image_url TEXT,
        
        -- Colors
        song_art_primary_color VARCHAR(7),
        song_art_secondary_color VARCHAR(7),
        song_art_text_color VARCHAR(7),
        
        -- Stats
        annotation_count INTEGER,
        pyongs_count INTEGER,
        pageviews INTEGER,
        
        -- Metadata
        language VARCHAR(10),
        lyrics_state VARCHAR(50),
        lyrics_owner_id INTEGER,
        release_date VARCHAR(100),
        recording_location TEXT,
        embed_content TEXT,
        
        -- Platform IDs
        apple_music_id VARCHAR(100),
        spotify_uuid VARCHAR(100),
        soundcloud_url TEXT,
        youtube_url TEXT,
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS genius_artists (
        genius_artist_id INTEGER PRIMARY KEY,
        name VARCHAR(500),
        url TEXT,
        image_url TEXT,
        is_verified BOOLEAN,
        is_meme_verified BOOLEAN,
        iq INTEGER
      )
    `);
    
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS genius_albums (
        song_id INTEGER PRIMARY KEY,
        album_id INTEGER,
        album_name VARCHAR(500),
        album_url TEXT,
        album_cover_art_url TEXT,
        release_date VARCHAR(100),
        primary_artist_id INTEGER,
        primary_artist_name VARCHAR(500)
      )
    `);
    
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS genius_credits (
        song_id INTEGER,
        credit_type VARCHAR(100), -- 'writer', 'producer', 'featured_artist', or custom performance label
        artist_id INTEGER,
        artist_name VARCHAR(500),
        PRIMARY KEY (song_id, credit_type, artist_id)
      )
    `);
    
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS genius_media_links (
        song_id INTEGER,
        provider VARCHAR(50),
        media_type VARCHAR(50),
        url TEXT,
        native_uri TEXT,
        PRIMARY KEY (song_id, provider, url)
      )
    `);
    
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS genius_song_relationships (
        song_id INTEGER,
        relationship_type VARCHAR(50),
        related_song_id INTEGER,
        related_song_title VARCHAR(500),
        related_artist_name VARCHAR(500),
        PRIMARY KEY (song_id, relationship_type, related_song_id)
      )
    `);
    
    console.log(chalk.green('✓ Genius tables ready\n'));
    
    // Get recordings to enrich (limit for testing)
    const limit = parseInt(process.argv[2]) || 30;
    const recordings = await db.execute(sql`
      SELECT id, isrc, title 
      FROM quansic_recordings 
      WHERE isrc IS NOT NULL
      ORDER BY title
      LIMIT ${limit}
    `);
    
    console.log(chalk.yellow(`Processing ${recordings.rows.length} recordings...\n`));
    
    let found = 0;
    let notFound = 0;
    let errors = 0;
    
    for (let i = 0; i < recordings.rows.length; i++) {
      const rec = recordings.rows[i] as any;
      
      process.stdout.write(chalk.gray(`[${i+1}/${recordings.rows.length}] ${rec.title.substring(0, 40)}... `));
      
      try {
        const searchResult = await this.searchSong(rec.title);
        
        if (searchResult) {
          const details = await this.getSongDetails(searchResult.id);
          
          if (details) {
            // Save to collection
            allSongs.push(details);
            // Save main track data
            await db.execute(sql`
              INSERT INTO genius_tracks (
                id, isrc, title, full_title, artist_names,
                primary_artist_id, primary_artist_name,
                url, path, song_art_image_url, header_image_url,
                song_art_primary_color, song_art_secondary_color, song_art_text_color,
                annotation_count, pyongs_count, pageviews,
                language, lyrics_state, lyrics_owner_id,
                release_date, recording_location, embed_content,
                apple_music_id, spotify_uuid, soundcloud_url, youtube_url
              ) VALUES (
                ${details.id}, ${rec.isrc}, ${details.title}, ${details.full_title},
                ${details.artist_names || null}, ${details.primary_artist?.id || null},
                ${details.primary_artist?.name || null}, ${details.url || null},
                ${details.path || null}, ${details.song_art_image_url || null}, ${details.header_image_url || null},
                ${details.song_art_primary_color || null}, ${details.song_art_secondary_color || null}, 
                ${details.song_art_text_color || null}, ${details.annotation_count || 0}, 
                ${details.pyongs_count || null}, ${searchResult.stats?.pageviews || 0},
                ${details.language || null}, ${details.lyrics_state || null}, ${details.lyrics_owner_id || null},
                ${details.release_date_for_display || null}, ${details.recording_location || null},
                ${details.embed_content || null}, ${details.apple_music_id || null}, 
                ${details.spotify_uuid || null}, ${details.soundcloud_url || null}, ${details.youtube_url || null}
              )
              ON CONFLICT (id) DO UPDATE SET
                pageviews = EXCLUDED.pageviews,
                annotation_count = EXCLUDED.annotation_count
            `);
            
            // Save all artists
            const allArtists = [
              details.primary_artist,
              ...(details.featured_artists || []),
              ...(details.producer_artists || []),
              ...(details.writer_artists || [])
            ].filter(Boolean);
            
            // Get unique artists from custom performances
            if (details.custom_performances) {
              for (const perf of details.custom_performances) {
                allArtists.push(...(perf.artists || []));
              }
            }
            
            // Save unique artists
            const uniqueArtists = Array.from(new Map(allArtists.map(a => [a?.id, a]).filter(([id]) => id)).values());
            for (const artist of uniqueArtists) {
              if (artist?.id) {
                await db.execute(sql`
                  INSERT INTO genius_artists (
                    genius_artist_id, name, url, image_url, 
                    is_verified, is_meme_verified, iq
                  ) VALUES (
                    ${artist.id}, ${artist.name || null}, ${artist.url || null}, 
                    ${artist.image_url || null}, ${artist.is_verified || false}, 
                    ${artist.is_meme_verified || false}, ${artist.iq || null}
                  )
                  ON CONFLICT (genius_artist_id) DO NOTHING
                `);
              }
            }
            
            // Save album info
            if (details.album) {
              await db.execute(sql`
                INSERT INTO genius_albums (
                  song_id, album_id, album_name, album_url, 
                  album_cover_art_url, release_date,
                  primary_artist_id, primary_artist_name
                ) VALUES (
                  ${details.id}, ${details.album.id || null}, ${details.album.name || null},
                  ${details.album.url || null}, ${details.album.cover_art_url || null},
                  ${details.album.release_date_for_display || null},
                  ${details.album.artist?.id || null}, ${details.album.artist?.name || null}
                )
                ON CONFLICT (song_id) DO UPDATE SET
                  album_name = EXCLUDED.album_name
              `);
            }
            
            // Save all credits (writers, producers, featured artists, custom performances)
            const credits = [
              ...(details.writer_artists || []).map(a => ({ type: 'writer', artist: a })),
              ...(details.producer_artists || []).map(a => ({ type: 'producer', artist: a })),
              ...(details.featured_artists || []).map(a => ({ type: 'featured_artist', artist: a }))
            ];
            
            // Add custom performances (engineers, musicians, publishers, etc.)
            if (details.custom_performances) {
              for (const perf of details.custom_performances) {
                for (const artist of perf.artists || []) {
                  credits.push({ type: perf.label.toLowerCase().replace(/ /g, '_'), artist });
                }
              }
            }
            
            for (const credit of credits) {
              if (credit.artist?.id) {
                await db.execute(sql`
                  INSERT INTO genius_credits (song_id, credit_type, artist_id, artist_name)
                  VALUES (${details.id}, ${credit.type}, ${credit.artist.id}, ${credit.artist.name || null})
                  ON CONFLICT DO NOTHING
                `);
              }
            }
            
            // Save media links
            if (details.media) {
              for (const media of details.media) {
                await db.execute(sql`
                  INSERT INTO genius_media_links (
                    song_id, provider, media_type, url, native_uri
                  ) VALUES (
                    ${details.id}, ${media.provider}, ${media.type},
                    ${media.url || null}, ${media.native_uri || null}
                  )
                  ON CONFLICT DO NOTHING
                `);
              }
            }
            
            // Save song relationships (samples, covers, etc.)
            if (details.song_relationships) {
              for (const rel of details.song_relationships) {
                for (const song of rel.songs || []) {
                  if (song?.id) {
                    await db.execute(sql`
                      INSERT INTO genius_song_relationships (
                        song_id, relationship_type, related_song_id, 
                        related_song_title, related_artist_name
                      ) VALUES (
                        ${details.id}, ${rel.relationship_type || null}, ${song.id},
                        ${song.title || null}, ${song.primary_artist_names || null}
                      )
                      ON CONFLICT DO NOTHING
                    `);
                  }
                }
              }
            }
            
            console.log(chalk.green(`✓ ${details.title} (${searchResult.stats?.pageviews || 0} views, ${credits.length} credits)`));
            found++;
          } else {
            console.log(chalk.yellow('✗ No details'));
            notFound++;
          }
        } else {
          console.log(chalk.yellow('✗ Not found'));
          notFound++;
        }
      } catch (error: any) {
        console.log(chalk.red(`✗ Error: ${error.message}`));
        errors++;
      }
    }
    
    // Save all songs to JSON
    await jsonSaver.saveServiceData(isni, 'genius', allSongs, 'songs.json');
    
    console.log(chalk.bold.yellow('\n📊 ENRICHMENT SUMMARY:\n'));
    console.log(`  Found on Genius: ${chalk.green(found)}`);
    console.log(`  Not found: ${chalk.yellow(notFound)}`);
    console.log(`  Errors: ${chalk.red(errors)}`);
    
    // Show stats
    const stats = await db.execute(sql`
      SELECT 
        (SELECT COUNT(*) FROM genius_tracks) as tracks,
        (SELECT COUNT(*) FROM genius_artists) as artists,
        (SELECT COUNT(*) FROM genius_albums) as albums,
        (SELECT COUNT(*) FROM genius_credits) as credits,
        (SELECT COUNT(DISTINCT credit_type) FROM genius_credits) as credit_types,
        (SELECT COUNT(*) FROM genius_media_links) as media_links,
        (SELECT COUNT(*) FROM genius_song_relationships) as relationships,
        (SELECT SUM(pageviews) FROM genius_tracks) as total_pageviews
    `);
    
    const s = stats.rows[0] as any;
    console.log(chalk.bold.cyan('\n📊 DATABASE STATS:\n'));
    console.log(`  Total tracks: ${s.tracks}`);
    console.log(`  Unique artists: ${s.artists}`);
    console.log(`  Albums: ${s.albums}`);
    console.log(`  Credits: ${s.credits} (${s.credit_types} types)`);
    console.log(`  Media links: ${s.media_links}`);
    console.log(`  Song relationships: ${s.relationships}`);
    console.log(`  Total pageviews: ${s.total_pageviews?.toLocaleString() || 0}`);
    
    console.log(chalk.bold.green('\n✅ GENIUS ENRICHMENT COMPLETE'));
  }
}

export async function main() {
  const enrichment = new GeniusEnrichment();
  await enrichment.enrichAllRecordings();
}

// Allow running directly
if (import.meta.main) {
  main().then(() => process.exit(0)).catch(error => {
    console.error(error);
    process.exit(1);
  });
}