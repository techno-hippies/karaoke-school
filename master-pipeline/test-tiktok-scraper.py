#!/usr/bin/env python3
"""Test TikTok music scraper"""

import sys
from pathlib import Path

sys.path.insert(0, 'lib')
from tiktok_music_scraper import TikTokMusicScraper

scraper = TikTokMusicScraper()
result = scraper.scrape_music_page(
    'https://www.tiktok.com/music/TEXAS-HOLDEM-7334542274145454891',
    output_path=Path('/tmp/texas_holdem_segment.mp4')
)

if result:
    print('\n✅ Scraper works!')
    print(f"Segment: {result['local_path']}")
    print(f"Duration: {result['duration']}s")
    import json
    print(json.dumps(result, indent=2))
