# E2E Testing

End-to-end tests for Karaoke School using [Playwright](https://playwright.dev/) and [Synpress](https://synpress.io/) for MetaMask integration.

## Quick Start

```bash
# Run core UI tests (no MetaMask required)
bun run test:e2e

# Run with visible browser
HEADED=true bun run test:e2e

# Run ALL tests (including MetaMask - requires cache)
bun run test:e2e:all

# View HTML report after tests
bun run test:e2e:report
```

## Test Results Summary

- **39 passing tests** covering UI flows, navigation, auth dialogs, and page structures
- **10 skipped tests** requiring authenticated sessions (marked with `test.describe.skip`)
- **8 wallet tests** requiring Synpress cache (run `bun run test:cache` first)

## Directory Structure

```
test/
├── e2e/                  # E2E test files
│   ├── app-ui.spec.ts    # Main UI tests (18 tests)
│   ├── basic.spec.ts     # Basic app tests (4 tests)
│   ├── account.spec.ts   # Account UI flows (5 tests)
│   ├── study-session.spec.ts  # Study/exercise tests (5 + 6 skipped)
│   ├── karaoke.spec.ts   # Karaoke player tests (7 + 4 skipped)
│   ├── wallet-connection.spec.ts  # MetaMask tests (requires cache)
│   └── metamask-manual.spec.ts    # Manual extension loading
├── wallet-setup/         # Synpress wallet configs
│   ├── basic.setup.ts    # Basic MetaMask wallet
│   └── base-sepolia.setup.ts  # Base Sepolia network
├── fixtures/             # Custom test fixtures
│   └── index.ts          # Reusable test helpers
└── README.md             # This file
```

## Test Scripts

```bash
# Default: Run core UI tests (headless, 1 worker)
bun run test:e2e

# Run ALL tests including MetaMask-dependent ones
bun run test:e2e:all

# Run with visible browser
bun run test:e2e:headed

# Interactive UI mode
bun run test:e2e:ui

# Debug mode (step through tests)
bun run test:e2e:debug

# View test report
bun run test:e2e:report

# Build Synpress wallet cache (for MetaMask tests)
bun run test:cache
bun run test:cache:force
```

## Test Coverage

### Homepage & Navigation (22 tests)
- App shell loading
- Navigation elements visibility
- Route navigation (search, study, wallet)
- Responsive design (mobile/desktop)

### Auth Dialog (6 tests)
- Dialog open/close
- Auth method display (Passkey, Google, Discord, Wallet)
- Passkey flow navigation
- Username validation
- Google signup flow

### Account Flows (5 tests)
- Username validation rules
- Back navigation
- Profile page access

### Study Session (5 + 6 skipped)
- Sign up prompts
- Navigation to study section
- Exercise UI structure
- *Skipped: Authenticated flows*

### Karaoke (7 + 4 skipped)
- Search page loading
- Media player page structure
- Karaoke page structure
- *Skipped: Authenticated practice flows*

## Configuration

Tests are configured in `playwright.config.ts`:
- **Workers**: 1 (prevents resource conflicts)
- **Headless**: true by default (set `HEADED=true` for visible browser)
- **Timeout**: 120 seconds per test
- **Base URL**: http://localhost:5173

## Authentication Limitations

The app uses **Lit Protocol PKP** wallets for authentication:
- WebAuthn/Passkeys - Hard to automate
- Social Login - Requires OAuth flows
- External Wallets - Requires MetaMask extension

Current tests focus on **unauthenticated UI flows**. Authenticated tests are skipped and marked for future implementation with mocks.

## MetaMask Testing (Optional)

MetaMask tests require building a wallet cache:

```bash
# Build cache (requires xvfb on Linux)
xvfb-run --auto-servernum bun run test:cache

# Run MetaMask tests
bun run test:e2e:all
```

**Note**: MetaMask extension loading has issues on some Linux environments with xvfb. The UI tests work reliably without MetaMask.

## CI/CD

GitHub Actions workflow at `.github/workflows/e2e-tests.yml`:
1. Installs dependencies
2. Installs Playwright browsers
3. Runs tests with virtual display (xvfb)
4. Uploads test reports

## Troubleshooting

### Tests timing out
- Dev server may not be running
- Increase timeout in config
- Check network issues

### Multiple Chrome windows opening
- Config is set to 1 worker to prevent this
- Kill orphan processes: `pkill -f chromium`

### MetaMask not loading
- Known issue on some Linux systems with xvfb
- UI tests work without MetaMask
- May work in CI environment (GitHub Actions)
