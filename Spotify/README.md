# Spotify Database Import

This project imports the Spotify dataset from SQL dump files into a Neon PostgreSQL database.

## Dataset Overview

The Spotify dataset contains:
- **Artists**: 214k records with metadata like popularity, followers, genres
- **Albums**: 408k records with release information, types, and labels  
- **Tracks**: 2.1M records with audio metadata, previews, and relationships
- **Relationship tables**: Artist-Album and Track-Artist mappings
- **External IDs**: Cross-platform identifiers and images

## Tables Structure

### Core Tables
- `spotify_artist` - Artist information (214k records)
- `spotify_album` - Album metadata (408k records) 
- `spotify_track` - Track information (2.1M records)

### Relationship Tables
- `spotify_album_artist` - Album-to-artist relationships
- `spotify_track_artist` - Track-to-artist relationships

### Supplemental Tables
- `spotify_artist_image` - Artist image references
- `spotify_album_image` - Album image references
- `spotify_album_externalid` - External platform IDs for albums
- `spotify_track_externalid` - External platform IDs for tracks

## Usage

1. Ensure `.env` file contains your Neon database connection string
2. Create tables: `bun run create-tables`
3. Import all data: `bun run import-data` 
4. Verify import: `bun run verify`

## Data Source

Files imported from: `/media/t42/me/QBittorrent/MusicBrainz Tidal Spotify Deezer Dataset 06 July 2025/`
