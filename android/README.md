# Lit Protocol Android Test (Lit-Lite)

Minimal Android app to test Passkey authentication with Lit Protocol on Naga Dev network.

## What This Tests

1. **Passkey Registration** - Create a new passkey on Android, mint a PKP
2. **Passkey Authentication** - Authenticate with existing passkey (test if web passkeys sync)
3. **PKP Operations** - (TODO) Session signatures and signing

## Prerequisites

- Android Studio Hedgehog (2023.1.1) or later
- Android device running Android 9+ (API 28+)
- Google Play Services (for Credential Manager / Passkey sync)

## Setup

1. Open Android Studio
2. File → Open → Select `android/` folder
3. Let Gradle sync
4. Connect your Android device (USB debugging enabled)
5. Run the app

## Project Structure

```
android/
├── app/
│   ├── src/main/
│   │   ├── java/school/karaoke/litlite/
│   │   │   ├── MainActivity.kt      # Main UI
│   │   │   ├── LitLite.kt           # Lit Protocol client
│   │   │   └── PasskeyManager.kt    # Android Credential Manager wrapper
│   │   ├── res/layout/
│   │   │   └── activity_main.xml    # UI layout
│   │   └── AndroidManifest.xml
│   └── build.gradle.kts
├── build.gradle.kts
└── settings.gradle.kts
```

## Key Dependencies

- `androidx.credentials:credentials` - Android Credential Manager (Passkeys)
- `org.web3j:core` - Keccak256 hashing for auth method ID
- `com.squareup.okhttp3:okhttp` - HTTP client for Lit auth service

## Testing Flow

### Test 1: Register New Passkey
1. Tap "Register New Passkey + Mint PKP"
2. Android will prompt to create a passkey
3. Passkey gets saved to Google Password Manager
4. PKP is minted via Lit auth service (~30-60 seconds)

### Test 2: Authenticate with Web Passkey
1. First, create a passkey on your web app (karaoke.school)
2. Make sure you're signed into Google on both web browser and Android
3. Wait for passkey to sync (usually instant)
4. Tap "Authenticate with Existing Passkey"
5. Select the passkey created on web
6. If successful, the same auth method ID should appear

### Expected Results

| Scenario | Expected Outcome |
|----------|------------------|
| Register on Android | New PKP created, address displayed |
| Auth with Android passkey | Auth method ID matches |
| Auth with Web passkey | **KEY TEST** - Should see web passkey in list |

## Important Notes

### RP ID
The app uses RP ID `lit` to match the web SDK. This is critical for cross-platform passkey sync.

### Chinese Phones (Huawei, etc.)
Devices without Google Play Services won't have passkey sync. This test will help determine fallback needs.

### Digital Asset Links
For production, you'd need to host `/.well-known/assetlinks.json` on your domain to associate the Android app with web origin.

## TODO

- [ ] Implement session signature creation
- [ ] Implement executeJs for PKP signing
- [ ] Add PKP lookup by auth method ID
- [ ] Test on non-Google devices
