#!/usr/bin/env python3
"""
Test script for Spleeter Modal endpoint
"""
import requests
import json
import time

# Modal endpoint
ENDPOINT = "https://techno-hippies--spleeter-karaoke-fastapi-app.modal.run"

# Test with Sia - Chandelier (from SoundCloud via maid.zone)
# Note: maid.zone uses permalink format (not full URL)
audio_url = "https://sc.maid.zone/_/restream/siamusic/sia-chandelier"

print("🎤 Testing Spleeter Modal Endpoint")
print("=" * 80)
print(f"Endpoint: {ENDPOINT}")
print(f"Audio: Sia - Chandelier")
print(f"Segment: 10.0s - 15.0s (5 second test)")
print()

# Test health check first
print("1. Health Check...")
health_resp = requests.get(f"{ENDPOINT}/")
print(f"   Status: {health_resp.json()}")
print()

# Test karaoke processing
print("2. Process Karaoke (download + trim + spleeter)...")
start_time = time.time()

process_resp = requests.post(
    f"{ENDPOINT}/process-karaoke",
    data={
        "audio_url": audio_url,
        "start_time": 10.0,
        "duration": 5.0,
        "mp3": True,
        "mp3_bitrate": 192
    },
    timeout=120
)

elapsed = time.time() - start_time

if process_resp.status_code == 200:
    result = process_resp.json()
    print(f"   ✅ Success!")
    print(f"   Total time: {elapsed:.1f}s")
    print()
    print("   Timing breakdown:")
    for key, value in result.get('timing', {}).items():
        print(f"     {key}: {value:.2f}s")
    print()
    print("   Stems:")
    for stem, b64_data in result.get('stems', {}).items():
        size_kb = len(b64_data) * 3 / 4 / 1024  # Base64 is ~4/3 larger
        print(f"     {stem}: ~{size_kb:.1f} KB (base64-encoded ZIP)")
    print()
    print("   Metadata:")
    print(json.dumps(result.get('metadata'), indent=4))
else:
    print(f"   ❌ Error: {process_resp.status_code}")
    print(f"   Response: {process_resp.text}")

print()
print("=" * 80)
print("✅ Test complete!")
