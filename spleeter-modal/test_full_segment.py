#!/usr/bin/env python3
"""
Test Spleeter with full 23-second karaoke segment (realistic use case)
"""
import requests
import time

ENDPOINT = "https://techno-hippies--spleeter-karaoke-fastapi-app.modal.run"
audio_url = "https://sc.maid.zone/_/restream/siamusic/sia-chandelier"

print("🎤 Testing Spleeter Modal Endpoint (Full 23s Segment)")
print("=" * 80)
print("Testing realistic karaoke segment (Verse 1: 0s - 23s)")
print()

# Test with full verse 1 segment
print("Processing 23-second segment...")
start_time = time.time()

resp = requests.post(
    f"{ENDPOINT}/process-karaoke",
    data={
        "audio_url": audio_url,
        "start_time": 0.0,
        "duration": 23.0,  # Full verse 1
        "mp3": True,
        "mp3_bitrate": 192
    },
    timeout=120
)

elapsed = time.time() - start_time

if resp.status_code == 200:
    result = resp.json()
    print(f"✅ Success!")
    print(f"Total time: {elapsed:.1f}s")
    print()
    print("Timing breakdown:")
    for key, value in result.get('timing', {}).items():
        print(f"  {key}: {value:.2f}s")
    print()
    print("Stems:")
    for stem, b64_data in result.get('stems', {}).items():
        size_kb = len(b64_data) * 3 / 4 / 1024
        print(f"  {stem}: ~{size_kb:.1f} KB")
    print()
    print(f"⚡ Processing speed: {23.0 / result['timing']['total']:.2f}x realtime")
    print(f"   (23s audio in {result['timing']['total']:.1f}s)")

    # Check if it fits in 30s Lit Action timeout
    if result['timing']['total'] < 25:
        print(f"\n✅ Fits in 30s Lit Action timeout with {30 - result['timing']['total']:.1f}s margin!")
    else:
        print(f"\n⚠️  Too slow for 30s timeout (need <25s, got {result['timing']['total']:.1f}s)")
else:
    print(f"❌ Error: {resp.status_code}")
    print(f"Response: {resp.text}")

print()
print("=" * 80)
