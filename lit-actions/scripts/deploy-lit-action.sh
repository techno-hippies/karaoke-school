#!/bin/bash

# Deploy Lit Action: Upload → Encrypt → Permissions → Update Env
# Usage: ./scripts/deploy-lit-action.sh <action-file> <action-name> <env-var-name>
# Example: ./scripts/deploy-lit-action.sh src/karaoke/base-alignment-v2.js "Base Alignment v2" VITE_LIT_ACTION_BASE_ALIGNMENT

set -e  # Exit on error

ACTION_FILE=$1
ACTION_NAME=$2
ENV_VAR=$3

if [ -z "$ACTION_FILE" ] || [ -z "$ACTION_NAME" ] || [ -z "$ENV_VAR" ]; then
  echo "❌ Usage: ./scripts/deploy-lit-action.sh <action-file> <action-name> <env-var-name>"
  echo "   Example: ./scripts/deploy-lit-action.sh src/karaoke/base-alignment-v2.js \"Base Alignment v2\" VITE_LIT_ACTION_BASE_ALIGNMENT"
  exit 1
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 Deploying Lit Action: $ACTION_NAME"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 1. Upload to IPFS
echo ""
echo "📦 Step 1/4: Uploading to IPFS..."
UPLOAD_OUTPUT=$(DOTENV_PRIVATE_KEY=4406ead1460a14dd7112d777c30bbfaaa67f72b5f2b2210b1d2dbbd59a1a5a31 dotenvx run -- node scripts/upload-lit-action.mjs "$ACTION_FILE" "$ACTION_NAME")
CID=$(echo "$UPLOAD_OUTPUT" | grep -oP 'Qm[a-zA-Z0-9]{44}' | head -1)

if [ -z "$CID" ]; then
  echo "❌ Failed to extract CID from upload output"
  echo "$UPLOAD_OUTPUT"
  exit 1
fi

echo "✅ Uploaded! CID: $CID"

# 2. Re-encrypt keys (if needed for this action)
if [[ "$ACTION_FILE" == *"base-alignment"* ]]; then
  echo ""
  echo "🔐 Step 2/4: Re-encrypting ElevenLabs API key..."
  DOTENV_PRIVATE_KEY=4406ead1460a14dd7112d777c30bbfaaa67f72b5f2b2210b1d2dbbd59a1a5a31 dotenvx run -- node scripts/encrypt-keys-v8.mjs \
    --cid $CID \
    --key elevenlabs_api_key \
    --output src/karaoke/keys/elevenlabs_api_key_v11.json
  echo "✅ Keys encrypted!"
elif [[ "$ACTION_FILE" == *"match-and-segment"* ]]; then
  echo ""
  echo "🔐 Step 2/4: Re-encrypting Genius + OpenRouter keys..."
  DOTENV_PRIVATE_KEY=4406ead1460a14dd7112d777c30bbfaaa67f72b5f2b2210b1d2dbbd59a1a5a31 dotenvx run -- node scripts/encrypt-keys-v8.mjs \
    --cid $CID \
    --key genius_api_key \
    --output src/karaoke/keys/genius_api_key_v16.json
  DOTENV_PRIVATE_KEY=4406ead1460a14dd7112d777c30bbfaaa67f72b5f2b2210b1d2dbbd59a1a5a31 dotenvx run -- node scripts/encrypt-keys-v8.mjs \
    --cid $CID \
    --key openrouter_api_key \
    --output src/karaoke/keys/openrouter_api_key_v16.json
  echo "✅ Keys encrypted!"
else
  echo ""
  echo "⏭️  Step 2/4: No keys to encrypt for this action"
fi

# 3. Add PKP permissions
echo ""
echo "🔑 Step 3/4: Adding PKP permissions..."
DOTENV_PRIVATE_KEY=4406ead1460a14dd7112d777c30bbfaaa67f72b5f2b2210b1d2dbbd59a1a5a31 dotenvx run -- bun run scripts/add-pkp-permission.mjs $CID > /dev/null
echo "✅ Permissions added!"

# 4. Update .env in frontend
echo ""
echo "📝 Step 4/4: Updating app/.env.local..."
ENV_FILE="../app/.env.local"

if [ -f "$ENV_FILE" ]; then
  # Update existing variable or add if missing
  if grep -q "^$ENV_VAR=" "$ENV_FILE"; then
    sed -i "s|^$ENV_VAR=.*|$ENV_VAR=$CID|" "$ENV_FILE"
  else
    echo "$ENV_VAR=$CID" >> "$ENV_FILE"
  fi
  echo "✅ Updated $ENV_VAR=$CID"
else
  echo "⚠️  Warning: $ENV_FILE not found, skipping env update"
  echo "   Manually set: $ENV_VAR=$CID"
fi

# Done!
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Deployment Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📍 IPFS CID: $CID"
echo "🌐 Gateway:  https://ipfs.io/ipfs/$CID"
echo "📝 Env Var:  $ENV_VAR=$CID"
echo ""
echo "🔄 Next Steps:"
echo "   1. Restart your frontend dev server"
echo "   2. Test the updated Lit Action"
echo ""
