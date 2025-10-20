#!/usr/bin/env bun

import chalk from 'chalk';
import { db, initDb } from '../../db/postgres';
import { sql } from 'drizzle-orm';
import { SpotifyTrackSchema, SpotifySearchResponseSchema } from '../../schemas/spotify-schemas';
import { JsonSaver } from '../../utils/json-saver';
import { z } from 'zod';

class SpotifyEnrichment {
  private accessToken: string = '';
  private tokenExpiry: Date = new Date();
  
  async authenticate() {
    const clientId = process.env.SPOTIFY_CLIENT_ID || '67211696824445baa62a6b46820c65d1';
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET || 'f923bc7955984c7c9585a54bfdc4606b';
    
    const tokenUrl = 'https://accounts.spotify.com/api/token';
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials'
    });
    
    if (!response.ok) {
      throw new Error(`Failed to authenticate: ${response.statusText}`);
    }
    
    const data = await response.json();
    this.accessToken = data.access_token;
    this.tokenExpiry = new Date(Date.now() + (data.expires_in * 1000));
    
    console.log(chalk.green('✓ Authenticated with Spotify API'));
  }
  
  async searchByISRC(isrc: string): Promise<z.infer<typeof SpotifyTrackSchema> | null> {
    if (!this.accessToken || this.tokenExpiry < new Date()) {
      await this.authenticate();
    }
    
    const searchUrl = `https://api.spotify.com/v1/search?q=isrc:${isrc}&type=track&limit=1`;
    
    const response = await fetch(searchUrl, {
      headers: { 'Authorization': `Bearer ${this.accessToken}` }
    });
    
    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '1');
      console.log(chalk.yellow(`Rate limited, waiting ${retryAfter}s...`));
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      return this.searchByISRC(isrc);
    }
    
    if (!response.ok) return null;
    
    try {
      const data = await response.json();
      const validated = SpotifySearchResponseSchema.parse(data);
      return validated.tracks.items[0] || null;
    } catch (error) {
      console.error(chalk.red(`Validation error for ${isrc}:`, error));
      return null;
    }
  }
  
  async enrichAllRecordings() {
    console.log(chalk.bold.cyan('\n🎵 SPOTIFY ENRICHMENT - COMPLETE DATA CAPTURE\n'));
    
    await initDb();
    await this.authenticate();
    
    const jsonSaver = new JsonSaver();
    const isni = '0000000356358936';  // Grimes ISNI
    const allTracks: any[] = [];
    
    // Create ALL Spotify tables with complete schema
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS spotify_tracks (
        isrc VARCHAR(50) PRIMARY KEY,
        spotify_id VARCHAR(50) NOT NULL,
        spotify_uri VARCHAR(100),
        track_name VARCHAR(500),
        disc_number INTEGER,
        track_number INTEGER,
        duration_ms INTEGER,
        explicit BOOLEAN,
        is_playable BOOLEAN,
        is_local BOOLEAN,
        popularity INTEGER,
        preview_url TEXT,
        
        -- Album data
        album_id VARCHAR(50),
        album_name VARCHAR(500),
        album_uri VARCHAR(100),
        album_type VARCHAR(50),
        album_total_tracks INTEGER,
        release_date VARCHAR(20),
        release_date_precision VARCHAR(10),
        album_image_large TEXT,
        album_image_medium TEXT,
        album_image_small TEXT,
        
        -- JSON fields for complex data
        artist_ids JSONB,
        artist_names JSONB,
        available_markets JSONB,
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS spotify_artists (
        spotify_artist_id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(500),
        uri VARCHAR(200),
        href TEXT,
        external_url TEXT
      )
    `);
    
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS spotify_track_artists (
        spotify_track_id VARCHAR(50),
        spotify_artist_id VARCHAR(50),
        artist_order INTEGER,
        is_album_artist BOOLEAN DEFAULT false,
        PRIMARY KEY (spotify_track_id, spotify_artist_id)
      )
    `);
    
    console.log(chalk.green('✓ Spotify tables ready\n'));
    
    // Get all recordings with ISRCs from Quansic
    const recordings = await db.execute(sql`
      SELECT id, isrc, title FROM quansic_recordings 
      WHERE isrc IS NOT NULL 
      ORDER BY id
    `);
    
    console.log(chalk.yellow(`Processing ${recordings.rows.length} recordings...\n`));
    
    let enriched = 0;
    let notFound = 0;
    let errors = 0;
    
    for (let i = 0; i < recordings.rows.length; i++) {
      const rec = recordings.rows[i] as any;
      
      process.stdout.write(chalk.gray(`[${i+1}/${recordings.rows.length}] ${rec.isrc}: ${rec.title.substring(0, 30)}... `));
      
      try {
        const track = await this.searchByISRC(rec.isrc);
        
        if (track) {
          // Save track to collection
          allTracks.push(track);
          // Extract album images
          const albumImages = track.album.images || [];
          const largeImage = albumImages.find(img => img.height === 640) || albumImages[0];
          const mediumImage = albumImages.find(img => img.height === 300) || albumImages[1];
          const smallImage = albumImages.find(img => img.height === 64) || albumImages[2];
          
          // Save complete track data
          await db.execute(sql`
            INSERT INTO spotify_tracks (
              isrc, spotify_id, spotify_uri, track_name,
              disc_number, track_number, duration_ms,
              explicit, is_playable, is_local, popularity, preview_url,
              album_id, album_name, album_uri, album_type, album_total_tracks,
              release_date, release_date_precision,
              album_image_large, album_image_medium, album_image_small,
              artist_ids, artist_names, available_markets
            ) VALUES (
              ${rec.isrc}, ${track.id}, ${track.uri}, ${track.name},
              ${track.disc_number}, ${track.track_number}, ${track.duration_ms},
              ${track.explicit}, ${track.is_playable || true}, ${track.is_local}, 
              ${track.popularity}, ${track.preview_url},
              ${track.album.id}, ${track.album.name}, ${track.album.uri},
              ${track.album.album_type}, ${track.album.total_tracks},
              ${track.album.release_date}, ${track.album.release_date_precision},
              ${largeImage?.url}, ${mediumImage?.url}, ${smallImage?.url},
              ${JSON.stringify(track.artists.map(a => a.id))},
              ${JSON.stringify(track.artists.map(a => a.name))},
              ${JSON.stringify(track.available_markets || [])}
            )
            ON CONFLICT (isrc) DO UPDATE SET
              spotify_id = EXCLUDED.spotify_id,
              track_name = EXCLUDED.track_name,
              duration_ms = EXCLUDED.duration_ms,
              popularity = EXCLUDED.popularity,
              explicit = EXCLUDED.explicit
          `);
          
          // Update quansic_recordings with Spotify ID and duration
          await db.execute(sql`
            UPDATE quansic_recordings 
            SET spotify_id = ${track.id},
                duration_ms = ${track.duration_ms}
            WHERE id = ${rec.isrc}
          `);
          
          // Save all artists (both track and album artists)
          const allArtists = [...track.artists, ...track.album.artists];
          const uniqueArtists = Array.from(new Map(allArtists.map(a => [a.id, a])).values());
          
          for (const artist of uniqueArtists) {
            await db.execute(sql`
              INSERT INTO spotify_artists (
                spotify_artist_id, name, uri, href, external_url
              ) VALUES (
                ${artist.id}, ${artist.name}, ${artist.uri},
                ${artist.href || null}, ${artist.external_urls.spotify}
              )
              ON CONFLICT (spotify_artist_id) DO NOTHING
            `);
          }
          
          // Save track-artist relationships
          for (let j = 0; j < track.artists.length; j++) {
            await db.execute(sql`
              INSERT INTO spotify_track_artists (
                spotify_track_id, spotify_artist_id, artist_order, is_album_artist
              ) VALUES (
                ${track.id}, ${track.artists[j].id}, ${j}, false
              )
              ON CONFLICT DO NOTHING
            `);
          }
          
          // Save album artists separately
          for (const albumArtist of track.album.artists) {
            await db.execute(sql`
              INSERT INTO spotify_track_artists (
                spotify_track_id, spotify_artist_id, artist_order, is_album_artist
              ) VALUES (
                ${track.id}, ${albumArtist.id}, 0, true
              )
              ON CONFLICT DO NOTHING
            `);
          }
          
          console.log(chalk.green(`✓ ${track.name} (${track.popularity}/100, ${track.explicit ? 'E' : 'C'})`));
          enriched++;
        } else {
          console.log(chalk.yellow('✗ Not found on Spotify'));
          notFound++;
        }
        
      } catch (error: any) {
        console.log(chalk.red(`✗ Error: ${error.message}`));
        errors++;
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    // Save all tracks to JSON
    await jsonSaver.saveServiceData(isni, 'spotify', allTracks, 'tracks.json');
    
    console.log(chalk.bold.yellow('\n📊 ENRICHMENT SUMMARY:\n'));
    console.log(`  Enriched: ${chalk.green(enriched)}`);
    console.log(`  Not found: ${chalk.yellow(notFound)}`);
    console.log(`  Errors: ${chalk.red(errors)}`);
    
    // Show final stats
    const stats = await db.execute(sql`
      SELECT 
        (SELECT COUNT(*) FROM spotify_tracks) as tracks,
        (SELECT COUNT(*) FROM spotify_tracks WHERE explicit = true) as explicit_tracks,
        (SELECT COUNT(*) FROM spotify_artists) as artists,
        (SELECT COUNT(*) FROM spotify_track_artists) as relationships,
        (SELECT AVG(popularity)::INT FROM spotify_tracks) as avg_popularity
    `);
    
    const s = stats.rows[0] as any;
    console.log(chalk.bold.cyan('\n📊 DATABASE STATS:\n'));
    console.log(`  Total tracks: ${s.tracks}`);
    console.log(`  Explicit tracks: ${s.explicit_tracks}`);
    console.log(`  Unique artists: ${s.artists}`);
    console.log(`  Track-artist relationships: ${s.relationships}`);
    console.log(`  Average popularity: ${s.avg_popularity}/100`);
    
    console.log(chalk.bold.green('\n✅ SPOTIFY ENRICHMENT COMPLETE'));
  }
}

export async function main() {
  const enrichment = new SpotifyEnrichment();
  await enrichment.enrichAllRecordings();
}

// Allow running directly
if (import.meta.main) {
  main().then(() => process.exit(0)).catch(error => {
    console.error(error);
    process.exit(1);
  });
}