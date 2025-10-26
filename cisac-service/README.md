# CISAC Service

CISAC ISWC scraper with proper 2captcha integration.

## Setup

```bash
bun install
```

## Configuration

Create a `.env` file with your 2captcha API key:

```
TWOCAPTCHA_API_KEY=your_api_key_here
```

## Usage

### Test Script

```bash
bun test
```

### In Code

```typescript
import { CISACService } from './src/cisac-service.js';

const cisac = new CISACService({
  apiKey: process.env.TWOCAPTCHA_API_KEY!,
  headless: false,
});

try {
  const results = await cisac.search({
    title: 'Yesterday',
    artist: 'The Beatles',
  });

  console.log(results);
} finally {
  await cisac.close();
}
```

## How It Works

This implementation uses the proper 2captcha integration approach:

1. Detects reCAPTCHA iframe and extracts sitekey
2. Sends request to 2captcha API with sitekey and page URL
3. Waits for 2captcha to solve the captcha (typically 30-120 seconds)
4. Injects the solution token using the proper grecaptcha callback mechanism
5. Submits the form once the captcha is verified

Unlike manual DOM manipulation, this approach properly triggers the reCAPTCHA callbacks, which should enable the submit button.

## Notes

- Success rate is typically 60-80% for basic reCAPTCHA v2
- Each captcha solve costs ~$0.001-0.003 USD
- Set `headless: true` in production to hide the browser window
- Screenshots are saved to the cisac-service directory for debugging
