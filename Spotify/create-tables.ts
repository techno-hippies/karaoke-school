import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!);

async function createTables() {
  console.log('Creating Spotify tables in Neon database...');

  try {
    // Drop existing tables if they exist
    await sql`DROP TABLE IF EXISTS spotify_track_artist CASCADE`;
    await sql`DROP TABLE IF EXISTS spotify_album_artist CASCADE`;
    await sql`DROP TABLE IF EXISTS spotify_track_externalid CASCADE`;
    await sql`DROP TABLE IF EXISTS spotify_album_externalid CASCADE`;
    await sql`DROP TABLE IF EXISTS spotify_album_image CASCADE`;
    await sql`DROP TABLE IF EXISTS spotify_artist_image CASCADE`;
    await sql`DROP TABLE IF EXISTS spotify_track CASCADE`;
    await sql`DROP TABLE IF EXISTS spotify_album CASCADE`;
    await sql`DROP TABLE IF EXISTS spotify_artist CASCADE`;

    console.log('Dropped existing tables');

    // Create artists table
    await sql`
      CREATE TABLE spotify_artist (
        id text NOT NULL PRIMARY KEY,
        name text NOT NULL,
        popularity integer NOT NULL,
        type text NOT NULL,
        uri text NOT NULL,
        totalfollowers integer NOT NULL,
        href text NOT NULL,
        genres text NOT NULL,
        lastsynctime timestamp without time zone DEFAULT CURRENT_TIMESTAMP
      );
    `;
    console.log('Created spotify_artist table');

    // Create albums table
    await sql`
      CREATE TABLE spotify_album (
        albumid text NOT NULL PRIMARY KEY,
        albumgroup text NOT NULL,
        albumtype text NOT NULL,
        name text NOT NULL,
        releasedate text NOT NULL,
        releasedateprecision text NOT NULL,
        totaltracks integer NOT NULL,
        type text NOT NULL,
        uri text NOT NULL,
        label text NOT NULL,
        popularity integer NOT NULL,
        artistid text
      );
    `;
    console.log('Created spotify_album table');

    // Create tracks table
    await sql`
      CREATE TABLE spotify_track (
        trackid text NOT NULL PRIMARY KEY,
        albumid text NOT NULL,
        discnumber integer NOT NULL,
        durationms integer NOT NULL,
        explicit boolean NOT NULL,
        href text NOT NULL,
        isplayable boolean NOT NULL,
        name text NOT NULL,
        previewurl text NOT NULL,
        tracknumber integer NOT NULL,
        type text NOT NULL,
        uri text NOT NULL
      );
    `;
    console.log('Created spotify_track table');

    // Create album_artist relationship table
    await sql`
      CREATE TABLE spotify_album_artist (
        albumid text NOT NULL,
        artistid text NOT NULL,
        type text NOT NULL
      );
    `;
    console.log('Created spotify_album_artist table');

    // Create track_artist relationship table
    await sql`
      CREATE TABLE spotify_track_artist (
        trackid text NOT NULL,
        artistid text NOT NULL,
        type text NOT NULL
      );
    `;
    console.log('Created spotify_track_artist table');

    // Create artist_image table (schema matches dump)
    await sql`
      CREATE TABLE spotify_artist_image (
        artistid text NOT NULL,
        height integer NOT NULL,
        width integer NOT NULL,
        url text NOT NULL
      );
    `;
    console.log('Created spotify_artist_image table');

    // Create album_image table
    await sql`
      CREATE TABLE spotify_album_image (
        albumid text NOT NULL,
        height integer NOT NULL,
        width integer NOT NULL,
        url text NOT NULL
      );
    `;
    console.log('Created spotify_album_image table');

    // Create album_externalid table (key-value format)
    await sql`
      CREATE TABLE spotify_album_externalid (
        albumid text NOT NULL,
        name text NOT NULL,
        value text NOT NULL
      );
    `;
    console.log('Created spotify_album_externalid table');

    // Create track_externalid table (key-value format)
    await sql`
      CREATE TABLE spotify_track_externalid (
        trackid text NOT NULL,
        name text NOT NULL,
        value text NOT NULL
      );
    `;
    console.log('Created spotify_track_externalid table');

    // Create indexes for better performance
    await sql`CREATE INDEX idx_spotify_album_albumid ON spotify_album(albumid)`;
    await sql`CREATE INDEX idx_spotify_album_artistid ON spotify_album(artistid)`;
    await sql`CREATE INDEX idx_spotify_track_albumid ON spotify_track(albumid)`;
    await sql`CREATE INDEX idx_spotify_track_trackid ON spotify_track(trackid)`;
    await sql`CREATE INDEX idx_spotify_album_artist_albumid ON spotify_album_artist(albumid)`;
    await sql`CREATE INDEX idx_spotify_album_artist_artistid ON spotify_album_artist(artistid)`;
    await sql`CREATE INDEX idx_spotify_track_artist_trackid ON spotify_track_artist(trackid)`;
    await sql`CREATE INDEX idx_spotify_track_artist_artistid ON spotify_track_artist(artistid)`;
    console.log('Created indexes');

    console.log('All Spotify tables created successfully!');

  } catch (error) {
    console.error('Error creating tables:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

if (require.main === module) {
  createTables();
}
