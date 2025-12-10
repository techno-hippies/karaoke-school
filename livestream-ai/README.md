# Livestream AI

Autonomous AI streamer with karaoke TTS. Uses CDP (Chrome DevTools Protocol) for browser control.

## Status

**Working:**
- TTS sync with karaoke (LEAD_TIME_MS = 0)
- Browser mic input receives TTS audio
- Grading system transcribes TTS correctly

**TODO:**
- OBS not capturing browser audio (needs separate source config)
- Live2D avatar integration

## Architecture

```
┌─────────────────┐     ┌──────────────────┐
│  Chrome :9222   │     │  TTS Service     │
│  (CDP debug)    │     │  :3030           │
│                 │     │                  │
│  window.__      │     │  ElevenLabs      │
│  KARAOKE_       │◄────┤  Streaming       │
│  LYRICS__       │     │                  │
└────────┬────────┘     └────────┬─────────┘
         │ CDP WebSocket         │ HTTP/WS
         ▼                       ▼
┌─────────────────────────────────────────────┐
│  Audio Player (audio-player-v2.ts)          │
│  Receives TTS chunks → paplay → TTS_Output  │
└─────────────────────────────────────────────┘
         │
         ├──► TTS_Output.monitor → OBS (stream audio)
         │
         └──► TTSMic → TTSMicSource → Chrome mic input
                                      (for grading)
```

## Quick Start

```bash
# 1. Start Chrome with remote debugging
google-chrome --remote-debugging-port=9222 --user-data-dir="$HOME/.chrome-debug-profile"

# 2. Setup audio routing (see Audio Setup below)

# 3. Start TTS service
cd services/tts && ELEVENLABS_API_KEY=sk_... bun src/index.ts

# 4. Start audio player (routes TTS to PipeWire)
bun audio-player-v2.ts

# 5. Navigate to karaoke page in Chrome, then:
#    - Save lyrics: window.__KARAOKE_LYRICS__ → /tmp/karaoke-lyrics.json
#    - Run synchronized karaoke:
bun start-karaoke.ts /tmp/karaoke-lyrics.json
```

## Key Scripts

| Script | Purpose |
|--------|---------|
| `start-karaoke.ts` | Clicks Start button via CDP + schedules TTS for each line |
| `audio-player-v2.ts` | Routes TTS audio to PipeWire sink |
| `services/tts/` | ElevenLabs streaming TTS service |

## Audio Setup (PipeWire)

### Setup Virtual Audio Devices

```bash
# 1. Create TTS output sink (for audio player to write to)
pactl load-module module-null-sink sink_name=TTS_Output sink_properties=device.description=TTS_Output

# 2. Create virtual mic with pw-loopback (shows as "TTS Microphone" in Chrome)
pw-loopback \
  --capture-props='media.class=Audio/Sink node.name=TTSMic node.description="TTS Microphone"' \
  --playback-props='media.class=Audio/Source node.name=TTSMicSource node.description="TTS Microphone"' &

# 3. Set TTSMicSource as default (so Chrome "Default" uses it)
pactl set-default-source TTSMicSource

# 4. Link TTS output to the virtual mic (CRITICAL for grading to work!)
pw-link TTS_Output:monitor_FL TTSMic:playback_FL
pw-link TTS_Output:monitor_FR TTSMic:playback_FR
```

### Verify Setup

```bash
# List sources (should see TTSMicSource)
pactl list sources short

# List sinks (should see TTS_Output, TTSMic)
pactl list sinks short

# Check default source
pactl get-default-source  # Should be TTSMicSource

# Check links (MUST show TTS_Output → TTSMic)
pw-link -l | grep -E "TTS"
```

### Reset to Normal (After Streaming)

```bash
# 1. Kill pw-loopback (the TTSMic)
pkill -f pw-loopback

# 2. Unload virtual sinks
pactl unload-module module-null-sink

# 3. Reset default source to hardware mic
pactl set-default-source alsa_input.pci-0000_00_1f.3-platform-skl_hda_dsp_generic.HiFi__hw_sofhdadsp__source

# 4. Verify defaults are back to normal
pactl get-default-source
pactl get-default-sink
```

### What Each Device Does

| Device | Type | Purpose |
|--------|------|---------|
| `TTS_Output` | Sink | Audio player writes TTS audio here |
| `TTS_Output.monitor` | Source | OBS captures this for stream audio |
| `TTSMic` | Sink | Intermediate - receives TTS audio via pw-link |
| `TTSMicSource` | Source | Browser mic input (Chrome uses this for grading) |

### Audio Flow

```
TTS Service → audio-player-v2 → TTS_Output sink
                                      │
                    ┌─────────────────┴─────────────────┐
                    ▼                                   ▼
            TTS_Output.monitor                 pw-link to TTSMic
                    │                                   │
                    ▼                                   ▼
              OBS capture                        TTSMicSource
              (stream audio)                          │
                                                      ▼
                                              Chrome mic input
                                              (karaoke grading)
```

## Timing

- `LEAD_TIME_MS = 0` works well with ElevenLabs streaming
- TTS starts speaking exactly when the karaoke line begins
- No lead time needed because ElevenLabs streaming has minimal latency

## Environment

```bash
# .env.local
ELEVENLABS_API_KEY=sk_...
```

## Troubleshooting

### Grading shows 0% / transcript is "."
The TTS audio isn't reaching the browser mic. Check:
1. `pw-link -l | grep TTS` - must show TTS_Output linked to TTSMic
2. `pactl get-default-source` - must be TTSMicSource
3. Run: `pw-link TTS_Output:monitor_FL TTSMic:playback_FL && pw-link TTS_Output:monitor_FR TTSMic:playback_FR`

### OBS not getting audio
OBS needs to capture `TTS_Output.monitor` as an audio source, not the default output.

### Button click not working
The script handles both English "Start" and Japanese "スタート" buttons.
