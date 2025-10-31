import base64
import requests
import json

# Read the base64 audio data
with open('07 Gypsy_b64.txt', 'r') as f:
    base64_data = f.read().strip()

# Create the request payload
payload = {
    "audio_base64": f"data:audio/mpeg;base64,{base64_data}",
    "model": "mdx_q",
    "output_format": "mp3",
    "mp3_bitrate": 192
}

print("=== Sending separation request (2-5 minutes expected) ===")
try:
    response = requests.post(
        "http://localhost:8002/separate-sync",
        json=payload,
        timeout=600
    )
    response.raise_for_status()
    
    # Save the result
    with open('separation_result.json', 'w') as f:
        json.dump(response.json(), f, indent=2)
    
    print("=== Separation completed successfully! ===")
    print(f"Response saved to separation_result.json")
    
except requests.exceptions.RequestException as e:
    print(f"Error: {e}")
    if hasattr(e, 'response') and e.response is not None:
        print(f"Response: {e.response.text}")
