/**
 * Seed Test Data
 * Migrate 25 sample tracks from old database to new database for testing
 */

import { query } from '../src/db/connection';

const TEST_TRACKS = [
  { spotify_track_id: "5H6CCsFzY6HFsUUUcMqeUo", title: "Countless", artists: [{"id":"6ENUuaqy7QqbKD4M1X3siN","name":"BCD Studio"}], isrc: "SGB502210095", duration_ms: 180000 },
  { spotify_track_id: "190k295KrCdO8dOULl15fW", title: "Predador de Perereca", artists: [{"id":"6N5PRAVXd4vXyXmKseP3jq","name":"BLOW RECORDS"}], isrc: "GXBAV2110732", duration_ms: 180000 },
  { spotify_track_id: "1LkoYGxmYpO6QSEvY5C0Zl", title: "Scotty Doesn't Know", artists: [{"id":"3IJ770I1QPmwVp7yug0eJ4","name":"Lustra"}], isrc: "USCGJ0612390", duration_ms: 180000 },
  { spotify_track_id: "1CmUZGtH29Kx36C1Hleqlz", title: "Thrift Shop (feat. Wanz)", artists: [{"id":"5BcAKTbp20cv7tC5VqPFoC","name":"Macklemore & Ryan Lewis"}], isrc: "GMM881200003", duration_ms: 236720 },
  { spotify_track_id: "2uIX8YMNjGMD7441kqyyNU", title: "ocean eyes", artists: [{"id":"6qqNVTkY8uBg9cP3Jd7DAH","name":"Billie Eilish"}], isrc: "US23A1500056", duration_ms: 200346 },
  { spotify_track_id: "1uigwk5hNV84zRd5YQQRTk", title: "Pocketful of Sunshine", artists: [{"id":"7o95ZoZt5ZYn31e9z1Hc0a","name":"Natasha Bedingfield"}], isrc: "GBARL0701374", duration_ms: 202680 },
  { spotify_track_id: "1gkoTg9lUdJJTxIjrkZDKn", title: "Les", artists: [{"id":"73sIBHcqh3Z3NyqHKZ7FOL","name":"Childish Gambino"}], isrc: "USYAH1100365", duration_ms: 180000 },
  { spotify_track_id: "4Q9qkdqu0qKKjaftRrAK9C", title: "No One Noticed (Extended English)", artists: [{"id":"2sSGPbdZJkaSE2AbcGOACx","name":"The Marías"}], isrc: "USAT22410706", duration_ms: 180000 },
  { spotify_track_id: "0vGsFFCP4Z1GNXpZmSMfhf", title: "All Falls Down", artists: [{"id":"5K4W6rqBFWDnAN6FQUkS6x","name":"Kanye West"}], isrc: "USDJ20301703", duration_ms: 223360 },
  { spotify_track_id: "6xV7Be6XEvkSnighmh2Tzj", title: "Sugar On My Tongue", artists: [{"id":"4V8LLVI7PbaPR0K2TGSxFF","name":"Tyler, The Creator"}], isrc: "USQX92503270", duration_ms: 180000 },
  { spotify_track_id: "4cwb11VlH6JanT0s8g7KNO", title: "Mimosa (Now And Forever) (feat. Nyasia)", artists: [{"id":"0NGAZxHanS9e0iNHpR8f2W","name":"Alok"}], isrc: "DEE862501942", duration_ms: 180000 },
  { spotify_track_id: "5Nf0DAqzschhVUKPjQbZrs", title: "Cooking bossa", artists: [{"id":"1k5ujRfWAc5t7bwtCKyqy0","name":"きっずさうんど"}], isrc: "JPW792101921", duration_ms: 180000 },
  { spotify_track_id: "5vghFB2WeXjQaF8FtMDJja", title: "Ancora tu - Remastered", artists: [{"id":"2caOYPej26UoQOyFnzXW3G","name":"Lucio Battisti"}], isrc: "ITB001700499", duration_ms: 180000 },
  { spotify_track_id: "0ov4HMmvJdWjhGm7429Q4W", title: "Ayo Technology", artists: [{"id":"3q7HBObVc0L8jNeTe5Gofh","name":"50 Cent"}], isrc: "USUM70735445", duration_ms: 244533 },
  { spotify_track_id: "0jjZh3fHqW2JciT1b19oAN", title: "Minuetto", artists: [{"id":"05JkDGFMHqlIz0GPjLh2p3","name":"Mia Martini"}], isrc: "ITB007370550", duration_ms: 180000 },
  { spotify_track_id: "2SvXqxiG2ntfkEWvuABT7u", title: "Il mio canto libero", artists: [{"id":"2caOYPej26UoQOyFnzXW3G","name":"Lucio Battisti"}], isrc: "ITB001701090", duration_ms: 180000 },
  { spotify_track_id: "5NFjbDiKU1AU5G8CED5a9T", title: "Carnaval Chegou - Curtis Cole Remix", artists: [{"id":"3nHifOdw3FgOxPAlg4kzTl","name":"Curtis Cole"}], isrc: "IL6652205286", duration_ms: 180000 },
  { spotify_track_id: "3fpo2lrFJwWGKD91TF6bON", title: "Me Vs. World", artists: [{"id":"4sbChMTavXJEy79YGO0erc","name":"MV Archives"}], isrc: "SE5Q52402933", duration_ms: 180000 },
  { spotify_track_id: "5CthXYTRyMiPh0k4wOW1Gu", title: "Cold Roses, Black Air", artists: [{"id":"2iqWLjV5Ef8Qa6I92UEFFK","name":"Loria"}], isrc: "US39N2538401", duration_ms: 180000 },
  { spotify_track_id: "6qNXkVk19OYLu4CoqjDfZ0", title: "Faccio un casino", artists: [{"id":"5dXlc7MnpaTeUIsHLVe3n4","name":"Coez"}], isrc: "ITNTP1700005", duration_ms: 180000 },
  { spotify_track_id: "1cmQe4EYZI3J0dygdL701Q", title: "Rock That Body", artists: [{"id":"1yxSLGMDHlW21z4YXirZDS","name":"Black Eyed Peas"}], isrc: "USUM70967623", duration_ms: 180000 },
  { spotify_track_id: "2cyLCuYnTA0zcdxYW9O3Yk", title: "Genesis", artists: [{"id":"053q0ukIDRgzwTr4vNSwab","name":"Grimes"}], isrc: "CA21O1200002", duration_ms: 180000 },
  { spotify_track_id: "7LZDbABGg2NfnGsyIs2SeB", title: "Parole parole - 2001 Remastered Version", artists: [{"id":"29p3AmDSZvB8huqODQUKj7","name":"Mina"}], isrc: "GBAYE0101160", duration_ms: 180000 },
  { spotify_track_id: "6OhlAAgBbviJcH3mwKevSb", title: "Sarà perché ti amo", artists: [{"id":"5BwOOeKayeMZXa5SSaiRxv","name":"Ricchi E Poveri"}], isrc: "USBI10000112", duration_ms: 180000 },
  { spotify_track_id: "0W2275seLSrfjHxeWmDb6l", title: "Aleph", artists: [{"id":"3hteYQFiMFbJY7wS0xDymP","name":"Gesaffelstein"}], isrc: "FRZ111300562", duration_ms: 180000 },
];

async function seedTestData() {
  console.log('🌱 Seeding test data...\n');

  // 1. Create dummy TikTok creator
  console.log('Creating test TikTok creator...');
  await query(`
    INSERT INTO tiktok_creators (username, display_name, follower_count, total_videos)
    VALUES ('test_user', 'Test User', 1000000, 100)
    ON CONFLICT (username) DO NOTHING
  `);

  // 2. Create TikTok videos for each track
  console.log('Creating test TikTok videos...');
  for (let i = 0; i < TEST_TRACKS.length; i++) {
    const videoId = `test_video_${i + 1}`;
    await query(`
      INSERT INTO tiktok_videos (
        video_id, creator_username, video_url, description,
        music_title, music_author, play_count, duration_ms
      )
      VALUES ($1, 'test_user', $2, $3, $4, $5, 100000, $6)
      ON CONFLICT (video_id) DO NOTHING
    `, [
      videoId,
      `https://tiktok.com/test/${videoId}`,
      `Test video for ${TEST_TRACKS[i].title}`,
      TEST_TRACKS[i].title,
      TEST_TRACKS[i].artists[0].name,
      TEST_TRACKS[i].duration_ms
    ]);
  }

  // 3. Create tracks
  console.log('Creating test tracks...');
  for (let i = 0; i < TEST_TRACKS.length; i++) {
    const track = TEST_TRACKS[i];
    const videoId = `test_video_${i + 1}`;

    await query(`
      INSERT INTO tracks (
        spotify_track_id, tiktok_video_id, title, artists,
        isrc, duration_ms, primary_artist_id, primary_artist_name, stage
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
      ON CONFLICT (spotify_track_id) DO UPDATE SET
        title = EXCLUDED.title,
        artists = EXCLUDED.artists,
        isrc = EXCLUDED.isrc,
        duration_ms = EXCLUDED.duration_ms,
        primary_artist_id = EXCLUDED.primary_artist_id,
        primary_artist_name = EXCLUDED.primary_artist_name
    `, [
      track.spotify_track_id,
      videoId,
      track.title,
      JSON.stringify(track.artists),
      track.isrc,
      track.duration_ms,
      track.artists[0].id,
      track.artists[0].name
    ]);
  }

  // 4. Create enrichment tasks
  console.log('Creating enrichment tasks...');
  const taskTypes = [
    'iswc_discovery',
    'musicbrainz',
    'genius_songs',
    'genius_artists',
    'lyrics_discovery'
  ];

  for (const track of TEST_TRACKS) {
    for (const taskType of taskTypes) {
      await query(`
        INSERT INTO enrichment_tasks (spotify_track_id, task_type, status)
        VALUES ($1, $2, 'pending')
        ON CONFLICT (spotify_track_id, task_type) DO NOTHING
      `, [track.spotify_track_id, taskType]);
    }
  }

  console.log('\n✅ Test data seeded successfully!\n');
  console.log(`   📊 ${TEST_TRACKS.length} tracks`);
  console.log(`   📊 ${TEST_TRACKS.length * taskTypes.length} enrichment tasks`);
  console.log('');
}

// Run if called directly
if (import.meta.main) {
  seedTestData()
    .catch(error => {
      console.error('❌ Seeding failed:', error);
      process.exit(1);
    });
}
