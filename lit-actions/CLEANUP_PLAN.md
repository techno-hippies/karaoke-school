# Lit Actions Cleanup Plan

## ✅ KEEP (Core Working Files)

### Working Lit Actions
- `src/karaoke/karaoke-grader-v6-performance-grader.js` ✅ TESTED & WORKING
- `src/karaoke/fsrs/` - FSRS algorithm (may need later)

### Reference Patterns (Archive but keep)
- `src/karaoke/karaoke-scorer-v4.js` → Move to archive (referenced in docs)
- `src/karaoke/study-scorer-v1.js` → Move to archive (has FSRS)
- `src/stt/karaoke-scorer-v4.js` → Delete duplicate

### Scripts (Keep)
- `scripts/mint-pkp.ts`
- `scripts/add-pkp-permission.mjs`
- `scripts/upload-lit-action.mjs`
- `scripts/get-pkp-pubkey.mjs`

### Tests (Keep)
- `src/test/test-karaoke-grader-v6.mjs` ✅ WORKING

### Data
- `output/pkp-credentials.json`
- `.env` (with raw private key now)

## 🗑️ DELETE

### Root Test Files (All outdated)
- `test_grader_lit_action.js`
- `test-v17.mjs`
- `test-v17-debug.mjs`
- `test-v18.mjs`

### Old Scripts
- `scripts/encrypt-keys-v8.mjs`
- `scripts/encrypt-keys-v9-contract-based.mjs`
- `scripts/encrypt-voxstral-key-v1.mjs`
- `scripts/encrypt-voxtral-for-v6.mjs` (just used once)
- `scripts/get-pkp-info.mjs`
- `scripts/get-pkp-info-via-client.mjs`
- `scripts/recover-pkp-pubkey.mjs`
- `scripts/permit-study-scorer.mjs`
- `scripts/update-active-keys.mjs`
- `scripts/update-pkp-permissions.ts`

### Old Test Files (Keep archive/, delete rest)
- `src/test/*.mjs` except test-karaoke-grader-v6.mjs
- `src/test/*.js` all

### Old Lit Actions (Move to archive)
- `src/karaoke/match-and-segment-v*.js` (v2-v10)
- `src/karaoke/karaoke-scorer-v4-simplified.js`
- `src/karaoke/update-karaoke-contract-batch.js`
- `src/artist/generate-profile-v*.js`
- `src/decrypt/decrypt-symmetric-key-v1.js`
- `src/genius/*.js`
- `src/quiz/trivia-generator-v1.js`
- `src/study/study-session-recorder-v1.js`
- `src/stt/test-segment-events.js`

## 📋 UPDATE

### README.md
- Remove references to old scorers
- Update with v6 as primary
- Simplify to current working state

### AGENTS.md
- Mark old actions as archived
- Update with v6 as primary working example
- Keep reference to v4 pattern for historical context
