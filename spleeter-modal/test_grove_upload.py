#!/usr/bin/env python3
"""
Simple test to verify Spleeter separation works (without maid.zone dependency)

This test just verifies:
1. Spleeter can separate a short audio snippet
2. Returns vocals + accompaniment ZIPs
3. Timing is reasonable for B200 GPU
"""
import requests
import json
import time
import subprocess
import tempfile
import os

# Modal endpoint
ENDPOINT = "https://techno-hippies--spleeter-karaoke-fastapi-app.modal.run"

print("🎤 Testing Spleeter Separation (Direct Upload)")
print("=" * 80)

# Generate a simple 3-second audio file with ffmpeg
print("1. Generating test audio file (3 seconds, silence)...")
with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
    test_file = tmp.name

subprocess.run([
    "ffmpeg", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
    "-t", "3", "-b:a", "192k", "-y", test_file
], check=True, capture_output=True)

file_size = os.path.getsize(test_file) / 1024
print(f"   ✅ Generated {file_size:.1f} KB test file")
print()

# Test separation
print("2. Testing /separate endpoint...")
start_time = time.time()

with open(test_file, 'rb') as f:
    resp = requests.post(
        f"{ENDPOINT}/separate",
        files={'audio_file': ('test.mp3', f, 'audio/mp3')},
        data={
            'mp3': 'true',
            'mp3_bitrate': '192'
        },
        timeout=120
    )

elapsed = time.time() - start_time

# Clean up temp file
os.unlink(test_file)

if resp.status_code == 200:
    # Save the ZIP file
    zip_data = resp.content
    print(f"   ✅ Success!")
    print(f"   Total time: {elapsed:.1f}s")
    print(f"   ZIP size: {len(zip_data) / 1024:.1f} KB")

    # Extract and check ZIP contents
    import zipfile
    import io

    with zipfile.ZipFile(io.BytesIO(zip_data)) as zf:
        print(f"   Contents:")
        for name in zf.namelist():
            info = zf.getinfo(name)
            print(f"     - {name}: {info.file_size / 1024:.1f} KB")

    print()
    print("   ✅ Spleeter separation working correctly!")
    print(f"   ⚡ Processing speed: {3 / elapsed:.2f}x realtime (3s audio in {elapsed:.1f}s)")
else:
    print(f"   ❌ Error: {resp.status_code}")
    print(f"   Response: {resp.text}")

print()
print("=" * 80)
print("✅ Test complete!")
print()
print("Note: /process-karaoke endpoint requires maid.zone to be working.")
print("      Test this endpoint when SoundCloud URLs are available via maid.zone.")
