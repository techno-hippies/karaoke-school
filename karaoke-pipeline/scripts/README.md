# Scripts Directory

This directory contains utility scripts, data migration tools, and operational commands for the karaoke pipeline.

## Pipeline Operations

### Status & Monitoring
- `check-pipeline-status.ts` - Real-time pipeline status dashboard
- `find-flagged.ts` - Find tracks flagged for review

### Migrations & Data Management
- `migrate-karaoke-segments.ts` - Database migration for karaoke segments
- `cleanup-language-data.ts` - Clean up language data inconsistencies
- `backfill-genius-data.ts` - Backfill Genius annotation data

### Processing & Orchestration
- `run-orchestrator.ts` - Main pipeline orchestrator runner
- `process-all-separations.ts` - Process all pending audio separations
- `run-steps-9-10.ts` - Run segment selection and fal.ai enhancement steps

## Usage

Run scripts with bun:
```bash
# Check pipeline status
bun scripts:status

# Run specific script
bun scripts/check-pipeline-status.ts

# Run all script commands
bun scripts
```

## Environment Requirements

Most scripts require these environment variables:
- `DATABASE_URL` - Neon PostgreSQL connection
- `OPENROUTER_API_KEY` - For AI processing
- `GENIUS_API_KEY` - For Genius integration
- `ELEVENLABS_API_KEY` - For alignment processing

## Script Categories

### 📊 Monitoring
Scripts for checking pipeline health and status
- `check-pipeline-status.ts`
- `find-flagged.ts`

### 🔄 Migration  
Database and data migration scripts
- `migrate-karaoke-segments.ts`
- `cleanup-language-data.ts`

### 🎵 Processing
Core pipeline processing scripts
- `process-all-separations.ts`
- `run-orchestrator.ts`
- `run-steps-9-10.ts`

### 📝 Backfill
Data backfill and enrichment scripts
- `backfill-genius-data.ts`
