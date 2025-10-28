#!/usr/bin/env python3
"""
Test single creator scraping with better error handling
"""

import requests
import time
import json
from datetime import datetime

def test_scrape_creator(handle):
    """Test scraping a single creator with timeout and better error handling"""
    clean_handle = handle.replace('@', '')
    url = f"http://localhost:41055/scrape/{clean_handle}"
    
    print(f"🔍 Testing scraper for {handle}...")
    print(f"URL: {url}")
    
    try:
        # Add a reasonable timeout
        response = requests.get(url, timeout=30)  # 30 second timeout
        
        print(f"Response status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Success!")
            print(f"Creator: {data.get('creator', {}).get('name', 'N/A')}")
            print(f"Followers: {data.get('creator', {}).get('followers', 0):,}")
            print(f"Videos scraped: {data.get('scraped', {}).get('videos', 0)}")
            print(f"Videos inserted: {data.get('scraped', {}).get('inserted', 0)}")
            
            if 'stats' in data:
                stats = data['stats']
                print(f"Stats: Total videos: {stats.get('total_videos', 0)}, Copyrighted: {stats.get('copyrighted_videos', 0)}, Spotify tracks: {stats.get('spotify_tracks', 0)}")
            
            return True
        else:
            print(f"❌ Error: HTTP {response.status_code}")
            print(f"Response: {response.text[:500]}")
            return False
            
    except requests.exceptions.Timeout:
        print("❌ Timeout: Request took too long (>30s)")
        return False
    except requests.exceptions.ConnectionError:
        print("❌ Connection error: Could not connect to scraper service")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def main():
    """Test with a few different creators"""
    print("🧪 Testing TikTok scraper with different creators...")
    print("=" * 60)
    
    # Test with a few creators from the CSV
    test_creators = [
        "nicolacav_",  # Original one that was hanging
        "emxllouise2", # Try another one
        "catpisciotta",  # Try a third one
    ]
    
    for creator in test_creators:
        print(f"\n[{datetime.now().strftime('%H:%M:%S')}] Testing: {creator}")
        success = test_scrape_creator(creator)
        
        if success:
            print(f"✅ {creator} - SUCCESS")
        else:
            print(f"❌ {creator} - FAILED")
        
        # Wait between tests
        if creator != test_creators[-1]:
            print("⏳ Waiting 5 seconds before next test...")
            time.sleep(5)

if __name__ == "__main__":
    main()
