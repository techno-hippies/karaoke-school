# Quansic Scraper

A TypeScript/Bun-based web scraper for extracting music data from Quansic, including artist information, releases, and recordings.

## Setup

1. Install dependencies:
```bash
bun install
bun playwright install chromium
```

2. Login and save session:
```bash
bun run src/login.ts
# Or refresh existing session:
bun run src/refresh-session.ts
```

This saves your authenticated session to `auth-state.json` which is reused for all scraping operations.

## Usage

### Single Artist
```bash
# Using ISNI
bun run src/index.ts artist 0000000356358936

# Using full Quansic ID
bun run src/index.ts artist "Quansic::isni::0000000356358936"

# With debug mode (saves HTML)
bun run src/index.ts artist 0000000356358936 --debug
```

### Batch Processing
```bash
# Edit data/artists.txt to add artist IDs
bun run src/index.ts --artists data/artists.txt --output output/
```

### Options
- `--no-headless` - Show browser window
- `--debug` - Save raw HTML for debugging
- `--output <dir>` - Output directory (default: output/)
- `--timeout <ms>` - Page timeout in milliseconds

## Artist File Format

Edit `data/artists.txt`:
```
# Comments start with #
0000000356358936
Quansic::musicbrainzArtistId::7e5a2a59-6d9f-4a17-b7c2-e1eedb7bd222
Quansic::spotifyId::053q0ukIDRgzwTr4vNSwab
```

## Output

Data is saved as JSON in:
- `output/artists/` - Artist profiles with identifiers, releases, recordings
- `output/debug/` - Raw HTML (when using --debug)
- `output/progress.json` - Scraping progress

## Features

✅ Extracts artist information including:
- Basic info (name, type, nationality, dates)
- All identifiers (ISNI, IPI, MusicBrainz, Spotify, etc.)
- Also known as / name variants
- Releases with UPC codes
- Recordings with ISRC codes (when available)
- Relationships to other artists

✅ Session management:
- Automatic session reuse
- Session refresh script
- No need to login for every scrape

✅ Robust scraping:
- Handles Angular-rendered content
- Automatic retries
- Debug mode for troubleshooting
- Progress tracking

## Credentials

Current test account:
- Email: maroonlethia@powerscrews.com
- Password: Temporarypw710!

## Architecture

- `src/scraper.ts` - Main scraper class
- `src/types.ts` - TypeScript interfaces
- `src/index.ts` - CLI entry point
- `src/login.ts` - Login and session management
- `src/refresh-session.ts` - Refresh authentication
- `src/utils/file-manager.ts` - File I/O and data persistence