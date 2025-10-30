# Tests Directory

This directory contains all test files for the karaoke pipeline.

## Core Tests

### Integration Tests
- `test-complete-pipeline.ts` - End-to-end pipeline test with 10 tracks
- `test-steps.ts` - Test individual pipeline steps (2, 6.5, 7, 7.5)
- `test-available-steps.ts` - Test available steps (2, 6.5, 7, 7.5)
- `test-steps-local.ts` - Local versions of step tests

### Service Tests
- `test-alignment.ts` - ElevenLabs forced alignment processor
- `test-translation.ts` - Lyrics translation processor
- `test-demucs-health.ts` - Demucs service health check
- `test-demucs-setup.ts` - Demucs integration setup verification

### Component Tests
- `test-line-parsing.ts` - Line parsing fix verification
- `test-flagged-tracks.ts` - Similarity scores for flagged tracks
- `test-single-separation.ts` - Single audio separation test
- `test-full-separation.ts` - Full track separation with database

### Genius Integration Tests
- `test-genius.ts` - Genius API integration test
- `test-genius-simple.ts` - Simple Genius API diagnostic
- `test-genius-full-storage.ts` - Full Genius data storage verification

### Webhook Tests
- `test-webhook-manual.ts` - Manual webhook simulation

## Usage

Run tests with bun:
```bash
# Run specific test
bun tests/test-alignment.ts

# Run all tests (if you create a runner)
bun run test:all
```

## Test Environment

Most tests require these environment variables:
- `DATABASE_URL` - Neon PostgreSQL connection
- `ELEVENLABS_API_KEY` - For alignment tests
- `OPENROUTER_API_KEY` - For translation tests
- `GENIUS_API_KEY` - For Genius integration tests
