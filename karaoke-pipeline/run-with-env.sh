#!/bin/bash
# Helper script to run commands with correct dotenvx key
# Usage: ./run-with-env.sh bun src/processors/15-segment-stt-gemini.ts

# Get the private key from .env.keys
PRIVATE_KEY=$(grep "DOTENV_PRIVATE_KEY=" .env.keys | head -1 | cut -d'=' -f2)

if [ -z "$PRIVATE_KEY" ]; then
  echo "Error: Could not find DOTENV_PRIVATE_KEY in .env.keys"
  exit 1
fi

# Run the command with dotenvx
DOTENV_PRIVATE_KEY="$PRIVATE_KEY" dotenvx run -f .env -- "$@"
