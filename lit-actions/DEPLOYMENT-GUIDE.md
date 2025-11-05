# Lit Action Deployment Guide

**Single-command deployment pipeline for Lit Actions**

---

## 🚀 Quick Start

### Deploy a Lit Action (One Command!)

```bash
cd lit-actions
dotenvx run -f .env -- node scripts/deploy-lit-action-full.mjs study/sat-it-back-v1.js "Karaoke Grader v9"
```

**That's it!** This single command:
1. ✅ Validates your code
2. ✅ Uploads to IPFS
3. ✅ Re-encrypts API keys for the new CID
4. ✅ Updates `app/src/lib/contracts/addresses.ts`
5. ✅ Creates deployment summary

---

## 📋 What the Script Does

### Step 1: Validation
Checks for:
- ✅ `voxtralEncryptedKey` parameter (correct spelling)
- ✅ `Lit.Actions.decryptAndCombine` call
- ✅ `gradeLinePerformance` function
- ❌ Old `voxstralEncryptedKey` naming (with S) - was incorrect spelling

### Step 2: IPFS Upload
- Uploads to Pinata
- Returns new CID
- Creates gateway URL

### Step 3: Re-encrypt Keys
- Encrypts `VOXTRAL_API_KEY` for new CID
- Saves to `keys/voxtral_api_key.json`
- Access control locked to specific CID

### Step 4: Update App
Automatically updates `app/src/lib/contracts/addresses.ts`:
- `LIT_ACTION_IPFS_CID` → new CID
- `LIT_ACTION_VOXTRAL_KEY.ciphertext` → new encrypted key
- `LIT_ACTION_VOXTRAL_KEY.dataToEncryptHash` → new hash
- `accessControlConditions.value` → new CID

### Step 5: Deployment Summary
Creates JSON file in `deployments/` with:
- Deployment name and timestamp
- New CID and gateway URL
- Encrypted key details
- Files updated
- Next steps

---

## 🧪 Test Before Deploying (Dry Run)

```bash
dotenvx run -f .env -- node scripts/deploy-lit-action-full.mjs study/sat-it-back-v1.js "Test Deploy" --dry-run
```

**Dry run:**
- ✅ Validates code
- ✅ Shows what would be updated
- ❌ Doesn't upload to IPFS
- ❌ Doesn't modify files

---

## 📚 Examples

### Deploy New Version
```bash
dotenvx run -f .env -- node scripts/deploy-lit-action-full.mjs \
  study/sat-it-back-v1.js \
  "Karaoke Grader v10 - Bug fixes"
```

### Deploy Different Lit Action
```bash
dotenvx run -f .env -- node scripts/deploy-lit-action-full.mjs \
  study/new-grader.js \
  "New Grading Algorithm v1"
```

### Test Deployment
```bash
dotenvx run -f .env -- node scripts/deploy-lit-action-full.mjs \
  study/sat-it-back-v1.js \
  "Test Deployment" \
  --dry-run
```

---

## 🔍 After Deployment

### 1. Restart App Dev Server
```bash
cd app
# Kill existing server (Ctrl+C)
bun run dev
```

### 2. Test Grading Flow
1. Visit study page: `http://localhost:5173/song/{workId}/study`
2. Practice a line
3. Check browser console for errors
4. Verify no decryption failures

### 3. Check Console Logs
Look for:
```javascript
[useLitActionGrader] Executing Lit Action: QmNew...
[useLitActionGrader] Grading result: { score: 95, transcript: "...", rating: "Easy" }
// NO "Failed to decrypt" errors!
```

### 4. Verify Line Progression
- Should show multiple cards per song
- Each card should display different line text
- Card counter: "Card N of M" where M > 1

---

## ⚠️ Troubleshooting

### Validation Failed
```
❌ FAIL: Missing voxtralEncryptedKey parameter
```

**Fix:** Update Lit Action to use `voxtralEncryptedKey` (correct spelling, not voxstral)

### Upload Failed
```
❌ Error: Pinata upload failed
```

**Fix:** Check `PINATA_JWT` environment variable:
```bash
dotenvx run -f .env -- sh -c 'echo "PINATA_JWT: ${PINATA_JWT:0:20}..."'
```

### Encryption Failed
```
❌ Error: VOXTRAL_API_KEY not found
```

**Fix:** Check environment variable:
```bash
dotenvx run -f .env -- sh -c 'echo "VOXTRAL_API_KEY length: ${#VOXTRAL_API_KEY}"'
```

### App Update Failed
```
❌ Error: Cannot find addresses.ts
```

**Fix:** Run from `lit-actions/` directory:
```bash
cd /path/to/karaoke-school-v1/lit-actions
dotenvx run -f .env -- node scripts/deploy-lit-action-full.mjs ...
```

---

## 🔐 Security Notes

### Environment Variables Required
- `PINATA_JWT` - Pinata API token for IPFS uploads
- `VOXTRAL_API_KEY` - Voxtral/Mistral API key for STT

### Encrypted Keys
- Keys are encrypted with Lit Protocol
- Access control: Only the specific CID can decrypt
- Old CIDs cannot decrypt new keys (security feature!)

### Never Commit
- ❌ `keys/voxtral_api_key.json` - Git ignored
- ❌ `.env` files - Contains secrets
- ✅ `deployments/*.json` - Safe to commit (no secrets)

---

## 📊 Deployment History

Check `deployments/` folder for deployment records:

```bash
ls -la deployments/
# Karaoke-Grader-v9-1730800000000.json
# Karaoke-Grader-v10-1730900000000.json
```

Each file contains:
- Deployment name and timestamp
- CID and gateway URL
- Encrypted key details
- Files updated

---

## 🎯 Best Practices

### 1. Test First
Always run with `--dry-run` before deploying:
```bash
dotenvx run -f .env -- node scripts/deploy-lit-action-full.mjs \
  study/sat-it-back-v1.js "Test" --dry-run
```

### 2. Descriptive Names
Use clear deployment names:
- ✅ "Karaoke Grader v10 - Line-level FSRS"
- ✅ "Bug fix: Decryption error"
- ❌ "Update"
- ❌ "Test"

### 3. Verify Changes
Check git diff before deploying:
```bash
git diff app/src/lib/contracts/addresses.ts
```

### 4. Test Thoroughly
After deployment:
- ✅ Test grading flow
- ✅ Check console logs
- ✅ Verify no errors
- ✅ Test line progression

### 5. Commit Deployment
After successful testing:
```bash
git add app/src/lib/contracts/addresses.ts
git add lit-actions/deployments/Karaoke-Grader-v10-*.json
git commit -m "deploy: Lit Action v10 - Line-level FSRS"
```

---

## 🆚 Old vs New Workflow

### Old Workflow (Manual - Error Prone)
```bash
# 1. Upload to IPFS
node scripts/upload-lit-action.mjs study/sat-it-back-v1.js "Name"
# Get CID: QmNew...

# 2. Encrypt key manually
node scripts/encrypt-voxtral-key.mjs QmNew... "$VOXTRAL_API_KEY"
# Copy ciphertext, hash...

# 3. Manually edit addresses.ts
# - Update LIT_ACTION_IPFS_CID
# - Update ciphertext
# - Update dataToEncryptHash
# - Update accessControlConditions CID
# Easy to miss steps!

# 4. Test and pray it works
```

### New Workflow (Automated - Robust)
```bash
# ONE COMMAND!
dotenvx run -f .env -- node scripts/deploy-lit-action-full.mjs \
  study/sat-it-back-v1.js "Karaoke Grader v10"

# Everything updated automatically!
```

---

## 🎉 Success!

You now have a **single-command deployment pipeline** that handles everything automatically!

No more:
- ❌ Forgetting to re-encrypt keys
- ❌ Mismatched CIDs
- ❌ Manual file editing
- ❌ Decryption errors

Just:
- ✅ One command
- ✅ Automatic validation
- ✅ Automatic encryption
- ✅ Automatic updates
- ✅ Works first time!

---

**Questions?** Check the script source: `scripts/deploy-lit-action-full.mjs`
