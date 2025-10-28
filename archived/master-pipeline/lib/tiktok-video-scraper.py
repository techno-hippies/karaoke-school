#!/usr/bin/env python3
"""
TikTok Video Scraper
Extracts video metadata including Spotify track ID from TikTok video URLs
Uses hrequests for browser rendering to bypass restrictions
"""

import json
import sys
import re
from typing import Optional, Dict

import hrequests

def extract_video_data(video_url: str) -> Optional[Dict]:
    """
    Extract video data from TikTok video URL
    Returns JSON with video metadata including music/Spotify data
    """
    try:
        # Fetch the page
        session = hrequests.Session()
        resp = session.get(video_url, timeout=15)

        if resp.status_code != 200:
            print(f"Error: HTTP {resp.status_code}", file=sys.stderr)
            return None

        html = resp.text

        # Extract JSON data from script tag
        script_match = re.search(
            r'<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>(.*?)</script>',
            html,
            re.DOTALL
        )

        if not script_match:
            print("Error: Could not find embedded JSON data", file=sys.stderr)
            return None

        data = json.loads(script_match.group(1))

        # Navigate to video detail
        video_detail = data.get('__DEFAULT_SCOPE__', {}).get('webapp.video-detail', {})

        if not video_detail.get('itemInfo', {}).get('itemStruct'):
            status_code = video_detail.get('statusCode')
            status_msg = video_detail.get('statusMsg')
            print(f"Error: TikTok returned error {status_code} - {status_msg}", file=sys.stderr)
            return None

        item = video_detail['itemInfo']['itemStruct']

        # Extract Spotify track ID
        music = item.get('music', {})
        tt2dsp = music.get('tt2dsp', {})
        song_infos = tt2dsp.get('tt_to_dsp_song_infos', [])

        spotify_track_id = None
        spotify_url = None

        for info in song_infos:
            # Note: Keys are capitalized in TikTok's response
            if info.get('Platform') == 3:  # Spotify
                spotify_track_id = info.get('SongId')
                if spotify_track_id:
                    spotify_url = f"https://open.spotify.com/track/{spotify_track_id}"
                break

        # Build response
        return {
            'videoId': item.get('id'),
            'videoUrl': video_url,
            'description': item.get('desc', ''),
            'createTime': item.get('createTime'),
            'stats': {
                'playCount': item.get('stats', {}).get('playCount', 0),
                'likeCount': item.get('stats', {}).get('diggCount', 0),
                'commentCount': item.get('stats', {}).get('commentCount', 0),
                'shareCount': item.get('stats', {}).get('shareCount', 0),
            },
            'music': {
                'id': music.get('id'),
                'title': music.get('title', ''),
                'authorName': music.get('authorName', ''),
                'isCopyrighted': music.get('original', True) == False and music.get('isCopyrighted', False),
                'spotifyTrackId': spotify_track_id,
                'spotifyUrl': spotify_url,
            }
        }

    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        return None

def main():
    if len(sys.argv) < 2:
        print("Usage: python tiktok-video-scraper.py <video_url>", file=sys.stderr)
        sys.exit(1)

    video_url = sys.argv[1]
    data = extract_video_data(video_url)

    if data:
        print(json.dumps(data, indent=2))
    else:
        sys.exit(1)

if __name__ == '__main__':
    main()
