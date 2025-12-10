# Livestream AI

Autonomous AI streamer with karaoke TTS. Uses MCP Chrome DevTools for browser control.

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
         │ MCP                   │ WebSocket
         ▼                       ▼
┌─────────────────────────────────────────────┐
│  Audio Player (audio-player-v2.ts)          │
│  ffmpeg -> paplay -> TTS_Output sink        │
└─────────────────────────────────────────────┘
         │
         ├──► OBS (captures TTS_Output.monitor)
         │
         └──► TTSMic -> TTSMicSource (browser mic)
```

## Quick Start

```bash
# 1. Start Chrome with remote debugging
google-chrome --remote-debugging-port=9222 --user-data-dir="$HOME/.chrome-debug-profile"

# 2. Setup audio routing (see Audio Setup below)

# 3. Start TTS service
cd services/tts && ELEVENLABS_API_KEY=sk_... bun src/index.ts

# 4. Start audio player
bun audio-player-v2.ts

# 5. Via MCP Chrome DevTools:
#    - Navigate to karaoke page
#    - Read window.__KARAOKE_LYRICS__
#    - Save to /tmp/karaoke-lyrics.json
#    - Click Start button
#    - Run TTS scheduler:
bun run-karaoke-tts.ts /tmp/karaoke-lyrics.json
```

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

# 4. Link TTS output to the virtual mic
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

# Check links
pw-link -l | grep TTS
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
| `TTSMic` | Sink | Receives TTS audio (via pw-link) |
| `TTSMicSource` | Source | Browser mic input (select "TTS Microphone") |

## Files

| File | Purpose |
|------|---------|
| `audio-player-v2.ts` | Routes TTS audio to PipeWire sink |
| `run-karaoke-tts.ts` | Schedules TTS calls for lyrics |
| `services/tts/` | ElevenLabs streaming TTS |
| `vibe-voice/` | Alternative TTS (not integrated) |

## Environment

```bash
# .env.local
ELEVENLABS_API_KEY=sk_...
```

## Known Issues

1. **Timing** - TTS ~800ms lead time may need adjustment
2. **OBS capture** - Ensure OBS captures TTS_Output.monitor

## TODO

- [x] Virtual mic loopback (TTS -> browser mic input)
- [ ] Timing calibration
- [ ] vibe-voice integration
- [ ] Live2D avatar
