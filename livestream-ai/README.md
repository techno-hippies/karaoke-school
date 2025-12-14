# Livestream AI

Autonomous AI streamer with karaoke TTS. Uses CDP (Chrome DevTools Protocol) for browser control.

## Quick Start

```bash
# 1. Start Chrome with remote debugging
google-chrome --remote-debugging-port=9222 --user-data-dir="$HOME/.chrome-debug-profile"

# 2. Navigate to http://localhost:5173 in Chrome (karaoke app)

# 3. Run everything (sets up audio, starts services, plays karaoke)
bun run stream
```

That's it. The `stream` script handles audio setup automatically.

## What `bun run stream` Does

1. Kills any existing services on ports 3030-3033, 8080
2. Creates virtual audio devices (TTS_Output, TTS_Mic)
3. Starts all services concurrently:
   - TTS service (ElevenLabs) on :3030/:3031
   - Browser service (CDP) on :3032
   - Orchestrator on :3033
   - Web server (pngtuber) on :8080
   - Audio player (routes TTS → PipeWire)
4. Runs the karaoke playlist
5. Resets audio to hardware defaults when done

## Audio Routing

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  TTS Service ──► Audio Player ──► TTS_Output ──► TTS_Mic ──┬──► Chrome  │
│  (ElevenLabs)    (paplay)         (virtual      (virtual   │   (mic in) │
│                                    sink)         source)   │            │
│                                                            └──► OBS     │
│                                                                (capture)│
│                                                                         │
│  Chrome ──────────────────────────────────────────────────────► OBS     │
│  (playback)                        (hardware sink)             (capture)│
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### PipeWire Node Names

| Node | Type | Purpose |
|------|------|---------|
| `livestream-ai-tts` | Output | Audio player sending TTS audio |
| `TTS_Output` | Sink | Virtual sink receiving TTS |
| `TTS_Mic` | Source | Virtual source Chrome uses as mic |
| `Google Chrome input` | Input | Chrome's mic recording stream |
| `Google Chrome [Playback]` | Output | Chrome playing karaoke music |

## OBS Setup

Add two audio sources:

1. **Audio Input Capture** → `TTS_Mic` (TTS voice for stream)
2. **Audio Output Capture** → Default audio (browser music)

Or simpler: just capture Chrome window with "Capture Audio" if your OBS supports it.

## Chrome Microphone Setup

Chrome must use `TTS_Mic` as its microphone for grading to work:

1. Go to `chrome://settings/content/microphone`
2. Set default to **TTS_Mic**
3. Or: on the karaoke page, click lock icon → Site settings → Microphone → TTS_Mic

## Manual Audio Setup

If `bun run stream` doesn't set up audio (or you want manual control):

```bash
# Create virtual devices
pactl load-module module-null-sink sink_name=TTS_Output sink_properties=device.description=TTS_Output
pactl load-module module-remap-source source_name=TTS_Mic master=TTS_Output.monitor source_properties=device.description=TTS_Mic

# Set Chrome's default mic
pactl set-default-source TTS_Mic

# Verify
pactl list sinks short | grep TTS
pactl list sources short | grep TTS
pactl get-default-source  # Should be TTS_Mic
```

### Reset Audio (After Streaming)

```bash
bun run audio:reset
```

Or manually:
```bash
pactl set-default-sink alsa_output.pci-0000_00_1f.3-platform-skl_hda_dsp_generic.HiFi__hw_sofhdadsp__sink
pactl set-default-source alsa_input.pci-0000_00_1f.3-platform-skl_hda_dsp_generic.HiFi__hw_sofhdadsp__source
pactl unload-module module-remap-source
pactl unload-module module-null-sink
```

## npm Scripts

| Script | Purpose |
|--------|---------|
| `bun run stream` | Full streaming setup + karaoke playlist |
| `bun run dev` | Start all services without karaoke |
| `bun run audio:setup` | Create virtual audio devices |
| `bun run audio:reset` | Reset audio to hardware defaults |
| `bun run play` | Run karaoke playlist (services must be running) |
| `bun run cleanup` | Kill services on ports 3030-3033, 8080 |

## Services

| Service | Port | Purpose |
|---------|------|---------|
| TTS HTTP | 3030 | `/speak`, `/schedule`, `/status` |
| TTS WebSocket | 3031 | Audio streaming (`?mode=audio`) |
| Browser | 3032 | CDP browser control |
| Orchestrator | 3033 | Coordinates karaoke flow |
| Web | 8080 | Pngtuber overlay |

## Environment

```bash
# .env.local
ELEVENLABS_API_KEY=sk_...
ELEVENLABS_VOICE_ID=USMKuKI6F4jqsrCpgOAE  # optional, has default
```

## Troubleshooting

### No TTS audio reaching Chrome

1. Check audio player shows: `[TTS] audio client connected` (not "events")
2. Check audio player shows: `[Player] Output Sink: TTS_Output`
3. Verify routing: `pw-link -l | grep TTS`

### Grading shows 0%

Chrome mic isn't receiving TTS. Check:
1. `pactl get-default-source` → should be `TTS_Mic`
2. Chrome site settings → Microphone → `TTS_Mic`

### OBS has doubled/echo audio

1. OBS Settings → Audio → Disable Desktop Audio and Mic/Aux
2. Advanced Audio Properties → Monitor Off for capture sources
3. Only use ONE capture method per audio source

### Services won't start (port in use)

```bash
bun run cleanup
```
