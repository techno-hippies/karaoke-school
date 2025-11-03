# Environment Configuration Setup

This document explains the environment configuration structure for Karaoke School v1.

## Problem Solved

Previously, running commands with `dotenvx` would fail with `[MISSING_ENV_FILE] missing .env file` because dotenvx was looking for `.env` in the project root, but it only existed in subdirectories like `karaoke-pipeline/`.

## Solution: Root `.env` File

We created a **root-level `.env` file** (`/karaoke-school-v1/.env`) that contains all shared environment variables. This allows `dotenvx` to find the configuration from any directory in the monorepo.

## Files Created

### 1. `.env` (Root Level)
**Location:** `/karaoke-school-v1/.env`

Contains all shared environment variables needed across services:
- Database configuration (`NEON_PROJECT_ID`, `DATABASE_URL`, `NEON_DATABASE_URL`)
- Spotify credentials
- Service URLs
- API keys
- Advanced configuration

**This is the authoritative environment file for the monorepo.**

### 2. `.env.example` (Template)
**Location:** `/karaoke-school-v1/.env.example`

A template showing all available environment variables with descriptions. Use this to:
- Document required variables
- Onboard new developers
- Create local `.env` files in new installations

### 3. `scripts/validate-env.sh` (Validation)
**Location:** `/karaoke-school-v1/scripts/validate-env.sh`

A validation script that checks:
- Root `.env` file exists
- Subdirectory `.env` files exist
- Required tools are installed (`dotenvx`, `bun`)
- Required environment variables are set

**Run anytime to verify environment setup:**
```bash
./scripts/validate-env.sh
```

## How It Works

When you run a command with `dotenvx`, it searches for `.env` in:
1. Current directory
2. Parent directories (up to filesystem root)
3. Home directory

With the root `.env` file in place:
```bash
# From any directory, dotenvx finds the root .env
cd /karaoke-school-v1
dotenvx run -- bun karaoke-pipeline/scripts/contracts/emit-segment-events.ts --limit=10

# From a subdirectory, it still finds the root .env
cd /karaoke-school-v1/karaoke-pipeline
dotenvx run -- bun scripts/contracts/emit-segment-events.ts --limit=10
```

## Directory Structure

```
karaoke-school-v1/
├── .env                          ← ROOT ENV (shared by all services)
├── .env.example                  ← Template for reference
├── ENV-SETUP.md                  ← This file
├── scripts/
│   └── validate-env.sh           ← Validation script
├── karaoke-pipeline/
│   ├── .env                      ← Service-specific overrides (optional)
│   └── scripts/
│       └── contracts/
│           └── emit-segment-events.ts
├── app/
│   ├── .env                      ← Service-specific overrides (optional)
│   └── src/
└── [other directories]
```

## Using the Setup

### First Time Setup
1. **Validate environment:**
   ```bash
   ./scripts/validate-env.sh
   ```

2. **Update `.env` with your values if needed:**
   ```bash
   # Edit as needed
   vi .env
   ```

3. **Verify everything works:**
   ```bash
   dotenvx run -- printenv NEON_PROJECT_ID
   ```

### Running Commands

Now you can run commands from any directory:

```bash
# From root
dotenvx run -- bun karaoke-pipeline/scripts/contracts/emit-segment-events.ts --limit=10

# From karaoke-pipeline (no -f flag needed anymore!)
cd karaoke-pipeline
dotenvx run -- bun scripts/contracts/emit-segment-events.ts --limit=10

# From app
cd app
dotenvx run -- bun run dev
```

## Service-Specific Overrides (Optional)

If you need service-specific environment variables, you can still use subdirectory `.env` files.
`dotenvx` will load both the root `.env` and subdirectory `.env` (subdirectory values override root).

Example: `karaoke-pipeline/.env` can override `DEMUCS_MODE=local` from root.

## Production Deployment

For production, encrypt sensitive values using `dotenvx`:

```bash
# Encrypt the .env file
dotenvx encrypt .env

# Creates a .env.keys file (add to .gitignore)
# And updates .env with encrypted values

# Load encrypted env at runtime
DOTENV_PRIVATE_KEY='...' dotenvx run -- bun scripts/...
```

See: https://dotenvx.com/docs/encryption

## Troubleshooting

### "Missing .env file" error still occurs?
- Run `./scripts/validate-env.sh` to check setup
- Ensure `.env` exists at project root: `/karaoke-school-v1/.env`
- Check that required variables are defined in `.env`

### Variables not loading?
- Verify dotenvx version: `dotenvx --version`
- Check `.env` syntax (no spaces around `=`)
- Run with verbose output: `dotenvx run -vv -- printenv`

### Want to use a specific .env file?
```bash
# Explicitly specify which .env to use
dotenvx run -f /path/to/.env -- command
```

## Files to Commit to Git

- ✅ `.env.example` (template only, safe to commit)
- ✅ `scripts/validate-env.sh` (script, safe to commit)
- ✅ `ENV-SETUP.md` (documentation, safe to commit)
- ❌ `.env` (secrets, add to `.gitignore`)
- ❌ `.env.keys` (encryption keys, add to `.gitignore`)

Update `.gitignore`:
```
.env
.env.local
.env.*.local
.env.keys
.env.*.keys
```

---

**This setup ensures that `dotenvx` always finds the correct environment configuration, regardless of which directory you're working in.**
