#!/usr/bin/env python3
"""
Test Grove Upload

Simple test to upload an audio file to Grove using their HTTP API.
Uses a small vocal stem from music-pipeline output.

Usage:
    python test_grove_upload.py
"""

import requests
from pathlib import Path

# Grove API endpoint for immutable uploads
GROVE_API = "https://api.grove.storage/"

# Chain IDs
LENS_TESTNET = 37111  # temporary retention for testing
LENS_MAINNET = 7579    # permanent retention

def upload_to_grove(file_path: Path, chain_id: int = LENS_TESTNET) -> dict:
    """
    Upload a file to Grove using immutable ACL.

    Args:
        file_path: Path to the file to upload
        chain_id: Chain ID for retention policy (testnet or mainnet)

    Returns:
        dict with keys: uri, gatewayUrl, storageKey, statusUrl
    """
    print(f"📂 Reading file: {file_path}")
    print(f"   Size: {file_path.stat().st_size / 1024:.1f} KB")

    # Read file bytes
    with open(file_path, 'rb') as f:
        file_bytes = f.read()

    # Determine content type based on extension
    content_type_map = {
        '.mp3': 'audio/mp3',
        '.wav': 'audio/wav',
        '.m4a': 'audio/mp4',
        '.json': 'application/json'
    }
    content_type = content_type_map.get(file_path.suffix.lower(), 'application/octet-stream')

    print(f"📤 Uploading to Grove (chain_id={chain_id})...")
    print(f"   Content-Type: {content_type}")

    # Upload to Grove
    response = requests.post(
        f"{GROVE_API}?chain_id={chain_id}",
        data=file_bytes,
        headers={'Content-Type': content_type}
    )

    if response.status_code in [201, 202]:
        result = response.json()
        print(f"\n✅ Upload successful!")
        print(f"   Status: {response.status_code} ({'Created' if response.status_code == 201 else 'Accepted'})")
        print(f"   Raw response: {result}")
        print(f"   Type: {type(result)}")

        # Handle both dict and list responses
        if isinstance(result, list) and len(result) > 0:
            result = result[0]

        print(f"   URI: {result.get('uri', 'N/A')}")
        print(f"   Gateway URL: {result.get('gateway_url', 'N/A')}")
        print(f"   Storage Key: {result.get('storage_key', 'N/A')}")

        if 'status_url' in result:
            print(f"   Status URL: {result['status_url']}")

        return result
    else:
        print(f"\n❌ Upload failed!")
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.text}")
        response.raise_for_status()

def test_with_small_vocal():
    """Test with a small vocal file from music-pipeline output"""

    # Use the Sia - Chandelier vocals (should be small)
    test_file = Path("../music-pipeline/output/378195/04-stems/vocals.wav")

    if not test_file.exists():
        print(f"❌ Test file not found: {test_file}")
        print("   Looking for alternative files...")

        # Try to find any small audio file
        music_pipeline = Path("../music-pipeline/output")
        if music_pipeline.exists():
            stems = list(music_pipeline.glob("*/04-stems/*.wav"))
            if stems:
                test_file = stems[0]
                print(f"   Found: {test_file}")
            else:
                print("   No audio files found in music-pipeline/output")
                return
        else:
            print("   music-pipeline/output directory not found")
            return

    print("=" * 60)
    print("🧪 Testing Grove Upload")
    print("=" * 60)

    result = upload_to_grove(test_file, chain_id=LENS_TESTNET)

    print("\n" + "=" * 60)
    print("🔍 Verification")
    print("=" * 60)

    # Try to fetch the file back to verify it worked
    print(f"📥 Fetching from gateway URL...")
    verify_response = requests.head(result['gateway_url'])

    if verify_response.status_code == 200:
        print(f"✅ File is accessible!")
        print(f"   Content-Type: {verify_response.headers.get('Content-Type')}")
        print(f"   Content-Length: {int(verify_response.headers.get('Content-Length', 0)) / 1024:.1f} KB")
    else:
        print(f"⚠️  File not yet accessible (status: {verify_response.status_code})")
        print(f"   This is normal - Grove propagation takes ~5 seconds")

    return result

if __name__ == "__main__":
    try:
        result = test_with_small_vocal()
        print("\n✨ Test complete!")
    except Exception as e:
        print(f"\n💥 Error: {e}")
        import traceback
        traceback.print_exc()
