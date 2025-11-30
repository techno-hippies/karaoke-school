# Subscription Plan - Premium AI Chat

## Overview

Premium subscribers (Unlock NFT holders) get:
- **Better AI model** - Larger/smarter model instead of qwen3-4b
- **Better TTS** - ElevenLabs instead of Kokoro

## Architecture: Same Lit Action, Different Keys

We don't need a separate Lit Action. Instead, we use **Lit Protocol's Access Control Conditions (ACCs)** to gate premium API keys.

### How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│  Encrypted Keys (stored in app)                                 │
│                                                                 │
│  FREE TIER (ACC: anyone can decrypt)                            │
│  ├── venice_free.json     → qwen3-4b                            │
│  └── deepinfra_free.json  → Kokoro TTS                          │
│                                                                 │
│  PREMIUM TIER (ACC: must hold Unlock NFT)                       │
│  ├── venice_premium.json  → llama-3.3-70b or better             │
│  └── elevenlabs.json      → ElevenLabs TTS                      │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  Lit Action (same code for all users)                           │
│                                                                 │
│  1. Try to decrypt premium keys                                 │
│     ├── Success → User has NFT, use premium model/TTS           │
│     └── Failure → User doesn't have NFT, fall back to free      │
│                                                                 │
│  2. Make API calls with whichever keys decrypted                │
│                                                                 │
│  3. Return response (same format either way)                    │
└─────────────────────────────────────────────────────────────────┘
```

### Why This Approach?

1. **Secure** - User can't spoof premium status. ACCs are evaluated by Lit nodes.
2. **Simple** - One Lit Action to maintain, not two.
3. **Lit-native** - This is exactly what ACCs are designed for.
4. **No runtime chain check** - ACC evaluation happens during decryption, no extra latency.

### Access Control Condition for Premium

```javascript
// ACC: Must hold Unlock NFT on Base Sepolia
const PREMIUM_ACC = [
  {
    contractAddress: "0x...", // Unlock Lock contract
    standardContractType: "ERC721",
    chain: "baseSepolia",
    method: "balanceOf",
    parameters: [":userAddress"],
    returnValueTest: {
      comparator: ">",
      value: "0"
    }
  }
];
```

### Implementation Steps

1. **Encrypt premium keys with ACC**
   ```bash
   # New script: encrypt-premium-key.ts
   bun scripts/encrypt-premium-key.ts --key=VENICE_PREMIUM --acc=unlock
   bun scripts/encrypt-premium-key.ts --key=ELEVENLABS --acc=unlock
   ```

2. **Update Lit Action to try premium first**
   ```javascript
   // In scarlett-chat-v1.js
   let veniceApiKey, ttsApiKey, isPremium = false;

   // Try premium keys first
   try {
     veniceApiKey = await Lit.Actions.decryptAndCombine({
       accessControlConditions: premiumVeniceKey.acc,
       ciphertext: premiumVeniceKey.ciphertext,
       // ...
     });
     isPremium = true;
     model = 'llama-3.3-70b'; // or better
   } catch {
     // Fall back to free tier
     veniceApiKey = await Lit.Actions.decryptAndCombine({
       accessControlConditions: freeVeniceKey.acc,
       // ...
     });
     model = 'qwen3-4b';
   }
   ```

3. **Pass both key sets from frontend**
   ```typescript
   // service.ts
   const jsParams = {
     // ... existing params
     freeVeniceKey: LIT_CHAT_VENICE_KEY,
     premiumVeniceKey: LIT_CHAT_VENICE_PREMIUM_KEY, // new
     freeTtsKey: LIT_CHAT_DEEPINFRA_KEY,
     premiumTtsKey: LIT_CHAT_ELEVENLABS_KEY, // new
   };
   ```

4. **Update addresses.ts with new keys**
   ```typescript
   // New key imports
   import venusPremiumKey from './keys/chat/venice_premium.json'
   import elevenlabsKey from './keys/chat/elevenlabs.json'

   export const LIT_CHAT_VENICE_PREMIUM_KEY = venusPremiumKey
   export const LIT_CHAT_ELEVENLABS_KEY = elevenlabsKey
   ```

## Model Options for Premium

| Provider | Model | Cost | Quality |
|----------|-------|------|---------|
| Venice | qwen3-4b | Free tier | Good |
| Venice | llama-3.3-70b | Premium | Better |
| Venice | deepseek-r1-671b | Premium | Best (reasoning) |
| OpenRouter | claude-3.5-sonnet | Premium | Best (conversation) |

## TTS Options

| Provider | Voice | Cost | Quality |
|----------|-------|------|---------|
| DeepInfra Kokoro | af_heart | ~$0.001/req | Good |
| ElevenLabs | Various | ~$0.01/req | Premium, more natural |

## Questions to Decide

1. **Which premium model?** Venice has llama-3.3-70b, or we could use OpenRouter for Claude
2. **Which ElevenLabs voice?** Need to pick one that fits Scarlett/Violet personalities
3. **Same voice for all AIs or different?** Could have Scarlett = warm, Violet = edgy

## Files to Create/Modify

```
lit-actions/
├── scripts/
│   └── encrypt-premium-key.ts    # NEW
├── actions/chat/
│   └── scarlett-chat-v1.js       # MODIFY (try premium first)
└── keys/
    └── chat/
        ├── venice_premium.json   # NEW
        └── elevenlabs.json       # NEW

app/src/lib/contracts/
├── addresses.ts                  # MODIFY (add premium exports)
└── keys/chat/
    ├── venice_premium.json       # NEW (copy from lit-actions)
    └── elevenlabs.json           # NEW (copy from lit-actions)
```

## Cost Estimate

| Tier | Chat Cost | TTS Cost | Total/msg |
|------|-----------|----------|-----------|
| Free | ~$0.001 | ~$0.001 | ~$0.002 |
| Premium | ~$0.01 | ~$0.01 | ~$0.02 |

Premium is ~10x more expensive per message, but still very cheap.
