# Lit Actions - Agent Guide

Quick reference for AI agents working on the lit-actions module.

## Key Concepts

- **Lit Action**: JavaScript code running on Lit Protocol nodes
- **PKP**: Programmable Key Pair - signs transactions when conditions are met
- **CID**: IPFS Content ID - uniquely identifies uploaded action code
- **ACC**: Access Control Conditions - determines who can decrypt/sign

## Common Tasks

### Deploy Updated Action

```bash
cd lit-actions
set -a && source .env && set +a
bun scripts/setup.ts exercise  # or karaoke, karaoke-line
```

This:
1. Uploads action to IPFS → new CID
2. Adds PKP permission for CID
3. Re-encrypts API keys for CID
4. Updates `cids/dev.json`

Frontend imports from `cids/dev.json` and `keys/dev/` directly - no manual sync needed.

### Test Action

```bash
LIT_NETWORK=naga-dev bun tests/exercise/test-exercise-grader-say-it-back.ts
```

### Debug Decryption Issues

If "Decryption failure" occurs:
1. Check `cids/dev.json` matches what frontend uses
2. Check `keys/dev/*/` has keys encrypted for that CID
3. Re-run `bun scripts/setup.ts <action>` to fix

## File Locations

| What | Where |
|------|-------|
| Action code | `actions/*.js` |
| CIDs | `cids/{dev,test,mainnet}.json` |
| Encrypted keys | `keys/{dev,test,mainnet}/` |
| PKP credentials | `output/pkp-naga-{dev,test}.json` |
| Environment config | `config/lit-envs.json` |
| Tests | `tests/{exercise,karaoke}/` |

## Environment Variables

```bash
VOXTRAL_API_KEY      # Mistral STT API
OPENROUTER_API_KEY   # For Gemini grading
PINATA_JWT           # IPFS upload
PRIVATE_KEY          # PKP management wallet
LIT_NETWORK          # naga-dev | naga-test | mainnet
```

## Contracts (Lens Testnet - 37111)

```
ExerciseEvents: 0xcB2b397E02b50A0eeCecb922bb76aBE46DFb7832
KaraokeEvents:  0x8f97C17e599bb823e42d936309706628A93B33B8
PKP (dev):      0x5CF2f231D15F3e71f997AAE0f3037ec3fafa8379
```

## Data Flow

```
User Audio → Lit Action → Voxtral STT → Score → PKP Sign → Contract Event
                ↓
         Decrypt API Key (ACC: CID match)
```
