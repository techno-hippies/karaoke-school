#!/usr/bin/env python3
"""
TikTok Video Scraper - Reusable Library
Fetches creator profile and videos (both copyrighted and copyright-free)

Based on pkp-lens-flow/services/crawler/tiktok_crawler.py
Streamlined for master-pipeline reusability
"""

import json
import time
import re
import subprocess
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from urllib.parse import urlencode

import hrequests
from rich.console import Console

console = Console()


class TikTokVideoScraper:
    """Scrapes TikTok user video feeds"""

    BASE_URL = "https://www.tiktok.com"
    API_BASE = "https://www.tiktok.com/api"

    def __init__(self):
        """Initialize scraper"""
        self.session = hrequests.Session()

        # Base API parameters (from TikTok web app)
        self.base_params = {
            "aid": "1988",
            "app_language": "en",
            "app_name": "tiktok_web",
            "browser_language": "en-US",
            "browser_name": "Mozilla",
            "browser_online": "true",
            "browser_platform": "Linux x86_64",
            "browser_version": "5.0",
            "channel": "tiktok_web",
            "cookie_enabled": "true",
            "device_platform": "web_pc",
            "user_is_login": "false",
        }

    def get_user_info(self, username: str) -> Optional[Dict]:
        """
        Get TikTok user profile information

        Returns:
            {
                'username': str,
                'secUid': str,
                'userId': str,
                'nickname': str,
                'bio': str,
                'avatar': str (URL),
                'stats': {
                    'followerCount': int,
                    'followingCount': int,
                    'videoCount': int,
                }
            }
        """
        try:
            url = f"{self.BASE_URL}/@{username}"
            resp = self.session.get(url, timeout=10)

            if resp.status_code != 200:
                console.print(f"[red]HTTP {resp.status_code}[/red]")
                return None

            user_data = {}

            # Extract secUid (required for API calls)
            sec_uid_match = re.search(r'"secUid":"([^"]+)"', resp.text)
            if sec_uid_match:
                user_data['secUid'] = sec_uid_match.group(1)
            else:
                console.print("[red]secUid not found[/red]")
                return None

            # Extract user ID
            user_id_match = re.search(r'"id":"(\d+)"', resp.text)
            if user_id_match:
                user_data['userId'] = user_id_match.group(1)

            # Extract stats
            stats_match = re.search(r'"stats":\s*({[^}]+})', resp.text)
            if stats_match:
                try:
                    user_data['stats'] = json.loads(stats_match.group(1))
                except:
                    pass

            # Extract profile info
            nickname_match = re.search(r'"nickname":"([^"]+)"', resp.text)
            if nickname_match:
                user_data['nickname'] = nickname_match.group(1)

            bio_match = re.search(r'"signature":"([^"]+)"', resp.text)
            if bio_match:
                user_data['bio'] = bio_match.group(1)

            avatar_match = re.search(r'"avatarLarger":"([^"]+)"', resp.text)
            if avatar_match:
                # Decode Unicode escape sequences in URL
                raw_url = avatar_match.group(1)
                user_data['avatar'] = raw_url.encode().decode('unicode_escape')

            user_data['username'] = username
            return user_data

        except Exception as e:
            console.print(f"[red]Error getting user info:[/red] {e}")
            return None

    def fetch_user_posts(
        self,
        username: str,
        sec_uid: str,
        user_id: str,
        max_posts: int = 100
    ) -> List[Dict]:
        """
        Fetch user's TikTok posts using official API

        Returns list of post objects with full metadata
        """
        posts = []
        cursor = "0"

        params = {
            **self.base_params,
            "secUid": sec_uid,
            "id": user_id,
            "count": "30",
            "cursor": cursor,
        }

        while len(posts) < max_posts:
            try:
                url = f"{self.API_BASE}/post/item_list/?" + urlencode(params)
                resp = self.session.get(url, timeout=10)

                if resp.status_code != 200:
                    break

                data = resp.json()

                if data.get('statusCode') != 0:
                    break

                item_list = data.get('itemList', [])
                if not item_list:
                    break

                posts.extend(item_list)

                if not data.get('hasMore', False):
                    break

                new_cursor = data.get('cursor', '')
                if not new_cursor or new_cursor == cursor:
                    break

                params['cursor'] = new_cursor
                cursor = new_cursor

                time.sleep(1.0)  # Rate limiting

            except Exception as e:
                console.print(f"[red]Error fetching posts:[/red] {e}")
                break

        return posts

    def extract_spotify_url(self, post: Dict) -> Tuple[Optional[str], Optional[str]]:
        """
        Extract Spotify URL and track ID from post

        Returns:
            (spotify_url, track_id) or (None, None)
        """
        music = post.get('music', {})
        tt2dsp = music.get('tt2dsp', {})
        song_infos = tt2dsp.get('tt_to_dsp_song_infos', [])

        for info in song_infos:
            if info.get('platform') == 3:  # Platform 3 = Spotify
                track_id = info.get('song_id')
                if track_id:
                    return f"https://open.spotify.com/track/{track_id}", track_id

        return None, None

    def filter_copyrighted_songs(self, posts: List[Dict]) -> List[Dict]:
        """
        Filter posts with copyrighted songs and sort by views

        Copyrighted = Has isCopyrighted flag OR has Spotify link
        """
        copyrighted = []

        for post in posts:
            music = post.get('music', {})

            # Check isCopyrighted flag
            if music.get('isCopyrighted', False):
                copyrighted.append(post)
                continue

            # Also check for Spotify link (catches retroactive copyrights)
            spotify_url, _ = self.extract_spotify_url(post)
            if spotify_url:
                copyrighted.append(post)

        # Sort by play count (views) descending
        copyrighted.sort(key=lambda x: x.get('stats', {}).get('playCount', 0), reverse=True)

        return copyrighted

    def filter_copyright_free(self, posts: List[Dict]) -> List[Dict]:
        """
        Filter posts WITHOUT copyright and sort by views

        Copyright-free = No isCopyrighted flag AND no Spotify link
        """
        copyright_free = []

        for post in posts:
            music = post.get('music', {})

            # Must NOT be copyrighted
            if music.get('isCopyrighted', False):
                continue

            # Must NOT have Spotify track (catches retroactive copyrights)
            spotify_url, _ = self.extract_spotify_url(post)
            if spotify_url:
                continue

            copyright_free.append(post)

        # Sort by play count (views) descending
        copyright_free.sort(key=lambda x: x.get('stats', {}).get('playCount', 0), reverse=True)

        return copyright_free

    def filter_karaoke_videos(self, posts: List[Dict]) -> List[Dict]:
        """
        Filter for karaoke/cover videos (has copyrighted music)

        This is a convenience method - just calls filter_copyrighted_songs()
        """
        return self.filter_copyrighted_songs(posts)

    def download_video(self, post_id: str, output_path: Path) -> bool:
        """
        Download TikTok video using yt-dlp

        Args:
            post_id: TikTok video ID
            output_path: Path to save video file

        Returns:
            True if successful, False otherwise
        """
        try:
            video_url = f"https://www.tiktok.com/@x/video/{post_id}"

            output_path.parent.mkdir(parents=True, exist_ok=True)

            cmd = [
                'yt-dlp',
                '--no-warnings',
                '--quiet',
                '-o', str(output_path),
                video_url
            ]

            result = subprocess.run(cmd, capture_output=True, text=True)

            if result.returncode == 0 and output_path.exists():
                return True
            else:
                console.print(f"[yellow]yt-dlp error:[/yellow] {result.stderr}")
                return False

        except Exception as e:
            console.print(f"[red]Error downloading video:[/red] {e}")
            return False

    def scrape_user_videos(
        self,
        handle: str,
        limit: int = 50,
        include_copyright_free: bool = True
    ) -> Dict:
        """
        Main scraping function - get user profile and videos

        Args:
            handle: TikTok username (with or without @)
            limit: Max number of posts to fetch
            include_copyright_free: Whether to include copyright-free videos

        Returns:
            {
                'handle': str,
                'profile': {...},
                'copyrighted': [post, post, ...],
                'copyright_free': [post, post, ...],
            }
        """
        console.print("\n[bold cyan]🎬 TikTok Video Scraper[/bold cyan]")
        console.print("═" * 60)

        clean_handle = handle.replace('@', '')

        # 1. Get user profile
        console.print(f"\n🔍 Fetching profile for @{clean_handle}...")
        user_info = self.get_user_info(clean_handle)

        if not user_info:
            raise Exception(f"Failed to fetch profile for @{clean_handle}")

        console.print(f"   ✓ Nickname: {user_info.get('nickname', 'N/A')}")
        console.print(f"   ✓ Bio: {user_info.get('bio', 'N/A')[:50]}...")
        stats = user_info.get('stats', {})
        console.print(f"   ✓ Followers: {stats.get('followerCount', 0):,}")
        console.print(f"   ✓ Videos: {stats.get('videoCount', 0):,}")

        # 2. Fetch posts
        console.print(f"\n📝 Fetching up to {limit} posts...")
        posts = self.fetch_user_posts(
            clean_handle,
            user_info['secUid'],
            user_info['userId'],
            max_posts=limit
        )
        console.print(f"   ✓ Found {len(posts)} posts")

        # 3. Filter by copyright type
        console.print(f"\n🎵 Filtering videos...")
        copyrighted = self.filter_copyrighted_songs(posts)
        copyright_free = self.filter_copyright_free(posts) if include_copyright_free else []

        console.print(f"   ✓ Copyrighted: {len(copyrighted)}")
        console.print(f"   ✓ Copyright-free: {len(copyright_free)}")

        result = {
            'handle': f"@{clean_handle}",
            'profile': user_info,
            'copyrighted': copyrighted,
            'copyright_free': copyright_free,
        }

        console.print(f"\n[green]✨ Scraping complete![/green]")

        return result


def main():
    """CLI entry point"""
    import sys
    import argparse

    parser = argparse.ArgumentParser(description='TikTok Video Scraper')
    parser.add_argument('handle', help='TikTok username (e.g., @karaokeking99)')
    parser.add_argument('--limit', type=int, default=50, help='Max posts to fetch (default: 50)')
    parser.add_argument('--no-copyright-free', action='store_true', help='Skip copyright-free videos')
    parser.add_argument('--output', '-o', help='Output JSON file (optional)')

    args = parser.parse_args()

    try:
        scraper = TikTokVideoScraper()
        result = scraper.scrape_user_videos(
            args.handle,
            limit=args.limit,
            include_copyright_free=not args.no_copyright_free
        )

        # Print JSON output
        output_data = {
            'handle': result['handle'],
            'profile': result['profile'],
            'copyrighted_count': len(result['copyrighted']),
            'copyright_free_count': len(result['copyright_free']),
            'videos': {
                'copyrighted': result['copyrighted'],
                'copyright_free': result['copyright_free'],
            }
        }

        json_output = json.dumps(output_data, indent=2)

        if args.output:
            Path(args.output).write_text(json_output)
            console.print(f"\n💾 Saved to: {args.output}")
        else:
            print(json_output)

    except Exception as e:
        console.print(f"\n[bold red]❌ Error:[/bold red] {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
