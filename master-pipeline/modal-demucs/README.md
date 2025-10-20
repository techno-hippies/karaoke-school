# Demucs Modal Deployment

GPU-accelerated vocal separation using Modal's H100 GPUs.

## Prerequisites

```bash
# Install Modal CLI (already installed)
pip install modal

# Authenticate with Modal
modal token new
```

## Deployment

```bash
cd modal-demucs

# Deploy to Modal (creates HTTP endpoint)
modal deploy demucs_service.py
```

After deployment, Modal will output the endpoint URL:
```
✓ Created web function separate_audio => https://your-username--demucs-karaoke-separate-audio.modal.run
```

## Configuration

Add the endpoint URL to your `.env`:

```bash
# In master-pipeline/.env
MODAL_DEMUCS_ENDPOINT=https://your-username--demucs-karaoke-separate-audio.modal.run
```

## Usage

### From TypeScript

```typescript
import { DemucsModalService } from './services/demucs-modal.js';

const demucs = new DemucsModalService({
  model: 'mdx_extra',
  outputFormat: 'mp3',
});

const result = await demucs.separate('/path/to/audio.mp3');

// Write to files
const { vocalsPath, instrumentalPath } = await demucs.writeToFiles(
  result,
  '/tmp/output'
);
```

### Test with Modal CLI

```bash
# Test with a public audio URL
modal run demucs_service.py --audio-url "https://example.com/song.mp3"
```

## Pricing

- **H100 GPU**: $4.23/hour (~$0.001 per second)
- **60-second segment**: ~30-45 seconds processing = ~$0.04
- **Free tier**: $30/month credit

## Models

- `mdx_extra` (default) - Best quality, MDX challenge 2nd place
- `htdemucs` - Faster, good quality
- `htdemucs_ft` - Fine-tuned variant

## API

**POST** `https://your-username--demucs-karaoke-separate-audio.modal.run`

**Request body:**
```json
{
  "audio_base64": "data:audio/mpeg;base64,...",
  "model": "mdx_extra",
  "output_format": "mp3",
  "mp3_bitrate": 192
}
```

**Response:**
```json
{
  "vocals_base64": "...",
  "instrumental_base64": "...",
  "vocals_size": 1234567,
  "instrumental_size": 1234567,
  "model": "mdx_extra",
  "format": "mp3"
}
```

## Switching Between Local and Modal

```typescript
// Local Demucs (requires installation)
import { DemucsService } from './services/demucs.js';
const demucs = new DemucsService();

// Modal Demucs (requires deployment + MODAL_DEMUCS_ENDPOINT)
import { DemucsModalService } from './services/demucs-modal.js';
const demucs = new DemucsModalService();

// Both have the same interface
const result = await demucs.separate('/path/to/audio.mp3');
```
