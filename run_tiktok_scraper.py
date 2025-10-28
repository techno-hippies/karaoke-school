#!/usr/bin/env python3
"""
Batch TikTok Creator/Video Scraper
Runs the TikTok scraper on all creators listed in tiktoks_to_scrape.csv
"""

import csv
import sys
import time
import subprocess
import requests
from pathlib import Path
from typing import List, Optional
from datetime import datetime

# Configuration
CSV_FILE = Path("tiktoks_to_scrape.csv")
SCRAPER_SERVICE_URL = "http://localhost:41055"  # Cloudflare Worker dev server
LOG_FILE = Path(f"scraper_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log")
RESULTS_FILE = Path(f"scraper_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv")

def read_creators_from_csv(csv_path: Path) -> List[str]:
    """Read TikTok creator handles from CSV file"""
    creators = []
    try:
        with open(csv_path, 'r', newline='', encoding='utf-8') as file:
            reader = csv.reader(file)
            for row in reader:
                if row and row[0].strip():
                    creator = row[0].strip()
                    # Remove @ prefix if present and add it back consistently
                    if not creator.startswith('@'):
                        creator = f'@{creator}'
                    creators.append(creator)
    except Exception as e:
        print(f"Error reading CSV file: {e}")
        sys.exit(1)
    
    return creators

def log_message(message: str):
    """Log message to both console and log file"""
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    log_entry = f"[{timestamp}] {message}"
    print(log_entry)
    with open(LOG_FILE, 'a', encoding='utf-8') as f:
        f.write(log_entry + '\n')

def scrape_creator(handle: str, max_videos: int = None) -> dict:
    """
    Scrape a single creator using the Cloudflare Worker scraper service
    """
    clean_handle = handle.replace('@', '')
    url = f"{SCRAPER_SERVICE_URL}/scrape/{clean_handle}"
    
    try:
        log_message(f"🔍 Scraping {handle}...")
        
        # Make request to scraper service
        response = requests.get(url, timeout=300)  # 5 minutes for full scrapes
        
        if response.status_code == 200:
            data = response.json()
            log_message(f"✅ Successfully scraped {handle}: {data.get('scraped', {}).get('videos', 0)} videos")
            return {
                'handle': handle,
                'status': 'success',
                'scraped_videos': data.get('scraped', {}).get('videos', 0),
                'inserted_videos': data.get('scraped', {}).get('inserted', 0),
                'creator_name': data.get('creator', {}).get('name', ''),
                'followers': data.get('creator', {}).get('followers', 0),
                'total_videos': data.get('stats', {}).get('total_videos', 0),
                'copyrighted_videos': data.get('stats', {}).get('copyrighted_videos', 0),
                'spotify_tracks': data.get('stats', {}).get('spotify_tracks', 0),
                'error': None
            }
        else:
            error_msg = f"HTTP {response.status_code}: {response.text}"
            log_message(f"❌ Failed to scrape {handle}: {error_msg}")
            return {
                'handle': handle,
                'status': 'error',
                'error': error_msg,
                'scraped_videos': 0,
                'inserted_videos': 0
            }
            
    except requests.exceptions.Timeout:
        error_msg = "Request timeout (5 minutes)"
        log_message(f"❌ Timeout scraping {handle}: {error_msg}")
        return {
            'handle': handle,
            'status': 'timeout',
            'error': error_msg,
            'scraped_videos': 0,
            'inserted_videos': 0
        }
    except Exception as e:
        error_msg = str(e)
        log_message(f"❌ Error scraping {handle}: {error_msg}")
        return {
            'handle': handle,
            'status': 'error',
            'error': error_msg,
            'scraped_videos': 0,
            'inserted_videos': 0
        }

def save_results_csv(results: List[dict], output_file: Path):
    """Save results to CSV file"""
    fieldnames = [
        'handle', 'status', 'creator_name', 'followers', 'scraped_videos', 
        'inserted_videos', 'total_videos', 'copyrighted_videos', 'spotify_tracks', 'error'
    ]
    
    with open(output_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(results)
    
    log_message(f"📄 Results saved to {output_file}")

def main():
    """Main function"""
    print("🚀 Starting TikTok Creator/Video Scraper Batch Job")
    print("=" * 60)
    
    # Read creators from CSV
    if not CSV_FILE.exists():
        print(f"❌ Error: CSV file not found: {CSV_FILE}")
        sys.exit(1)
    
    creators = read_creators_from_csv(CSV_FILE)
    log_message(f"📋 Found {len(creators)} creators to scrape")
    
    # Check if scraper service is running
    try:
        response = requests.get(f"{SCRAPER_SERVICE_URL}/", timeout=5)
        if response.status_code != 200:
            print(f"❌ Error: Scraper service is not responding correctly at {SCRAPER_SERVICE_URL}")
            sys.exit(1)
    except requests.exceptions.ConnectionError:
        print(f"❌ Error: Cannot connect to scraper service at {SCRAPER_SERVICE_URL}")
        print("Make sure the Cloudflare Worker dev server is running with 'bun run dev'")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error checking scraper service: {e}")
        sys.exit(1)
    
    log_message(f"✅ Connected to scraper service at {SCRAPER_SERVICE_URL}")
    
    # Process each creator
    results = []
    success_count = 0
    error_count = 0
    
    for i, creator in enumerate(creators, 1):
        log_message(f"\n📊 Progress: {i}/{len(creators)} creators")
        
        result = scrape_creator(creator)
        results.append(result)
        
        if result['status'] == 'success':
            success_count += 1
        else:
            error_count += 1
        
        # Rate limiting - wait between requests
        if i < len(creators):
            wait_time = 5  # 5 seconds between requests for full scrapes
            log_message(f"⏳ Waiting {wait_time}s before next creator...")
            time.sleep(wait_time)
    
    # Save results
    save_results_csv(results, RESULTS_FILE)
    
    # Print summary
    log_message(f"\n🎉 Batch job completed!")
    log_message(f"📈 Summary: {success_count} successful, {error_count} failed")
    log_message(f"📊 Total videos scraped: {sum(r['scraped_videos'] for r in results)}")
    log_message(f"🎵 Total Spotify tracks found: {sum(r.get('spotify_tracks', 0) for r in results)}")
    log_message(f"📁 Log file: {LOG_FILE}")
    log_message(f"📄 Results CSV: {RESULTS_FILE}")

if __name__ == "__main__":
    main()
