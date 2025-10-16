#!/usr/bin/env python3
"""
TikTok Crawler for PKP-Lens Flow
Fetches creator profile + top N copyrighted videos + top N copyright-free videos
Both counts are configurable via --copyrighted and --copyright-free flags
Uploads everything to Grove storage with lensAccountOnly ACL
"""

import json
import time
import re
import subprocess
import sys
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from urllib.parse import urlencode
import argparse

import hrequests
from rich.console import Console
from rich.progress import track

console = Console()

class TikTokCrawler:
    """Crawls TikTok profiles and uploads to Grove storage"""

    BASE_URL = "https://www.tiktok.com"
    API_BASE = "https://www.tiktok.com/api"

    def __init__(self, data_dir: str = "../../data"):
        """Initialize crawler"""
        self.data_dir = Path(data_dir)
        self.session = hrequests.Session()

        # Base API parameters (from existing implementation)
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

    def load_lens_account(self, handle: str) -> Dict:
        """Load Lens account data"""
        clean_handle = handle.replace('@', '')
        lens_file = self.data_dir / 'lens' / f'{clean_handle}.json'

        if not lens_file.exists():
            raise FileNotFoundError(f"Lens account not found: {lens_file}")

        with open(lens_file, 'r') as f:
            return json.load(f)

    def load_pkp_data(self, handle: str) -> Dict:
        """Load PKP data"""
        clean_handle = handle.replace('@', '')
        pkp_file = self.data_dir / 'pkps' / f'{clean_handle}.json'

        if not pkp_file.exists():
            raise FileNotFoundError(f"PKP not found: {pkp_file}")

        with open(pkp_file, 'r') as f:
            return json.load(f)

    def get_user_info(self, username: str) -> Optional[Dict]:
        """Get TikTok user info (reused from profile_downloader.py)"""
        try:
            url = f"{self.BASE_URL}/@{username}"
            resp = self.session.get(url, timeout=10)

            user_data = {}

            # Extract secUid
            sec_uid_match = re.search(r'"secUid":"([^"]+)"', resp.text)
            if sec_uid_match:
                user_data['secUid'] = sec_uid_match.group(1)

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

            if 'secUid' in user_data:
                user_data['username'] = username
                return user_data

        except Exception as e:
            console.print(f"[red]Error getting user info:[/red] {e}")

        return None

    def fetch_user_posts(self, username: str, sec_uid: str, user_id: str, max_posts: int = 100) -> List[Dict]:
        """Fetch user's posts (reused from profile_downloader.py)"""
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

                time.sleep(1.0)

            except Exception as e:
                console.print(f"[red]Error fetching posts:[/red] {e}")
                break

        return posts

    def filter_copyrighted_songs(self, posts: List[Dict]) -> List[Dict]:
        """Filter posts with copyrighted songs and sort by views"""
        copyrighted = []

        for post in posts:
            music = post.get('music', {})

            # Check if it's a copyrighted song (not original audio)
            if music.get('original', True) == False and music.get('isCopyrighted', False):
                copyrighted.append(post)

        # Sort by play count (views) descending
        copyrighted.sort(key=lambda x: x.get('stats', {}).get('playCount', 0), reverse=True)

        return copyrighted

    def filter_copyright_free(self, posts: List[Dict]) -> List[Dict]:
        """Filter posts WITHOUT copyright and sort by views"""
        copyright_free = []

        for post in posts:
            music = post.get('music', {})

            # Must NOT be copyrighted
            if music.get('isCopyrighted', False) == True:
                continue

            # Must NOT have Spotify track (even if isCopyrighted is False)
            # This catches songs that became copyrighted after posting
            spotify_url, track_id = self.extract_spotify_url(post)
            if spotify_url or track_id:
                continue

            copyright_free.append(post)

        # Sort by play count (views) descending
        copyright_free.sort(key=lambda x: x.get('stats', {}).get('playCount', 0), reverse=True)

        return copyright_free

    def extract_spotify_url(self, post: Dict) -> Optional[Tuple[str, str]]:
        """Extract Spotify URL and track ID from post"""
        music = post.get('music', {})
        tt2dsp = music.get('tt2dsp', {})
        song_infos = tt2dsp.get('tt_to_dsp_song_infos', [])

        for info in song_infos:
            if info.get('platform') == 3:  # Spotify
                track_id = info.get('song_id')
                if track_id:
                    return f"https://open.spotify.com/track/{track_id}", track_id

        return None, None

    def download_image(self, url: str, output_path: Path) -> bool:
        """Download an image from URL"""
        try:
            resp = self.session.get(url, timeout=10)
            if resp.status_code == 200:
                output_path.parent.mkdir(parents=True, exist_ok=True)
                with open(output_path, 'wb') as f:
                    f.write(resp.content)
                return True
        except Exception as e:
            console.print(f"[red]Error downloading image:[/red] {e}")
        return False

    def download_video(self, post_id: str, output_path: Path) -> bool:
        """Download video using yt-dlp"""
        try:
            video_url = f"https://www.tiktok.com/@x/video/{post_id}"

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

    def crawl_creator(self, tiktok_handle: str, lens_handle: str, num_copyrighted: int = 3, num_copyright_free: int = 3) -> Dict:
        """Main crawl function"""
        console.print("\n[bold cyan]🎬 TikTok Crawler - PKP-Lens Flow[/bold cyan]")
        console.print("═" * 60)

        clean_handle = tiktok_handle.replace('@', '')

        # 1. Load PKP data (Lens account created later in pipeline)
        console.print(f"\n📂 Loading PKP data for {tiktok_handle}...")
        pkp_data = self.load_pkp_data(tiktok_handle)

        console.print(f"   PKP Address: {pkp_data['pkpEthAddress']}")

        # Use provided Lens handle
        lens_handle_clean = lens_handle.replace('@', '')
        lens_handle_formatted = f"@{lens_handle_clean}"
        console.print(f"   Lens Handle (to be created): {lens_handle_formatted}")

        # 2. Fetch TikTok profile
        console.print(f"\n🔍 Fetching TikTok profile...")
        user_info = self.get_user_info(clean_handle)
        if not user_info:
            raise Exception(f"Failed to fetch profile for {tiktok_handle}")

        console.print(f"   Nickname: {user_info.get('nickname', 'N/A')}")
        console.print(f"   Bio: {user_info.get('bio', 'N/A')[:50]}...")
        console.print(f"   Stats: {user_info.get('stats', {})}")

        # 3. Create output directory
        output_dir = self.data_dir / 'videos' / clean_handle
        output_dir.mkdir(parents=True, exist_ok=True)

        # 4. Download profile picture
        console.print(f"\n📸 Downloading profile picture...")
        avatar_url = user_info.get('avatar')
        avatar_path = output_dir / 'avatar.jpg'

        if avatar_url:
            if self.download_image(avatar_url, avatar_path):
                console.print(f"   ✅ Saved: {avatar_path}")
            else:
                console.print(f"   ⚠️  Failed to download avatar")

        # 5. Fetch posts
        console.print(f"\n📝 Fetching posts...")
        posts = self.fetch_user_posts(
            clean_handle,
            user_info['secUid'],
            user_info['userId'],
            max_posts=100
        )
        console.print(f"   Found {len(posts)} posts")

        # 6. Filter for both types
        console.print(f"\n🎵 Filtering videos...")
        copyrighted_posts = self.filter_copyrighted_songs(posts)
        copyright_free_posts = self.filter_copyright_free(posts)

        console.print(f"   Copyrighted songs: {len(copyrighted_posts)} found")
        console.print(f"   Copyright-free: {len(copyright_free_posts)} found")

        # Select top N of each
        selected_copyrighted = copyrighted_posts[:num_copyrighted]
        selected_copyright_free = copyright_free_posts[:num_copyright_free]

        console.print(f"   Selected {len(selected_copyrighted)} copyrighted + {len(selected_copyright_free)} copyright-free by views")

        # Combine for downloading
        all_selected = selected_copyrighted + selected_copyright_free
        total_videos = len(all_selected)

        # 7. Download videos
        videos_data = []

        for i, post in enumerate(track(all_selected, description="Downloading videos...")):
            post_id = post.get('id')
            music = post.get('music', {})
            stats = post.get('stats', {})

            spotify_url, track_id = self.extract_spotify_url(post)

            # Determine if this is copyrighted or copyright-free
            is_copyrighted = i < len(selected_copyrighted)
            video_type = "Copyrighted" if is_copyrighted else "Copyright-Free"

            console.print(f"\n   Video {i+1}/{total_videos} [{video_type}]:")
            console.print(f"   • Post ID: {post_id}")
            console.print(f"   • Song: {music.get('title', 'N/A')}")
            console.print(f"   • Views: {stats.get('playCount', 0):,}")
            if is_copyrighted:
                console.print(f"   • Spotify: {spotify_url or 'N/A'}")

            # Download video
            video_path = output_dir / f"video_{i+1}_{post_id}.mp4"
            video_downloaded = self.download_video(post_id, video_path)

            # Get thumbnail (from TikTok API response)
            cover_url = post.get('video', {}).get('cover')
            thumbnail_path = output_dir / f"thumbnail_{i+1}_{post_id}.jpg"
            thumbnail_downloaded = False

            if cover_url:
                thumbnail_downloaded = self.download_image(cover_url, thumbnail_path)

            video_data = {
                'postId': post_id,
                'postUrl': f"https://www.tiktok.com/@{clean_handle}/video/{post_id}",
                'description': post.get('desc', ''),
                'copyrightType': 'copyrighted' if is_copyrighted else 'copyright-free',
                'stats': {
                    'views': stats.get('playCount', 0),
                    'likes': stats.get('diggCount', 0),
                    'comments': stats.get('commentCount', 0),
                    'shares': stats.get('shareCount', 0),
                },
                'music': {
                    'title': music.get('title', ''),
                    'spotifyUrl': spotify_url,
                    'spotifyTrackId': track_id,
                },
                'localFiles': {
                    'video': str(video_path) if video_downloaded else None,
                    'thumbnail': str(thumbnail_path) if thumbnail_downloaded else None,
                },
                'groveUris': {
                    'video': None,  # Will be filled after upload
                    'thumbnail': None,
                    'metadata': None,
                }
            }

            videos_data.append(video_data)

        # 8. Create manifest
        manifest = {
            'tiktokHandle': tiktok_handle,
            'lensHandle': lens_handle_formatted,
            'lensAccountAddress': pkp_data['pkpEthAddress'],
            'scrapedAt': datetime.now().isoformat(),
            'profile': {
                'nickname': user_info.get('nickname', ''),
                'bio': user_info.get('bio', ''),
                'stats': user_info.get('stats', {}),
                'localFiles': {
                    'avatar': str(avatar_path) if avatar_path.exists() else None,
                },
                'groveUris': {
                    'metadata': None,  # Will be filled after upload
                    'avatar': None,
                }
            },
            'videos': videos_data
        }

        # 9. Save manifest locally
        manifest_path = output_dir / 'manifest.json'
        with open(manifest_path, 'w') as f:
            json.dump(manifest, f, indent=2)

        # Count by type
        copyrighted_count = len([v for v in videos_data if v['copyrightType'] == 'copyrighted'])
        copyright_free_count = len([v for v in videos_data if v['copyrightType'] == 'copyright-free'])

        console.print(f"\n✅ Manifest saved: {manifest_path}")
        console.print(f"\n[bold green]✨ Crawl complete![/bold green]")
        console.print(f"   Profile: {user_info.get('nickname')}")
        console.print(f"   Videos: {len(videos_data)} downloaded ({copyrighted_count} copyrighted + {copyright_free_count} copyright-free)")
        console.print(f"\n⚠️  Next: Upload to Grove storage")
        console.print(f"   Run: bun run upload-grove --creator {tiktok_handle}")

        return manifest


def main():
    parser = argparse.ArgumentParser(description='TikTok Crawler for PKP-Lens Flow')
    parser.add_argument('--creator', '-c', required=True, help='TikTok handle (e.g., @charlidamelio)')
    parser.add_argument('--lens-handle', required=False, help='Desired Lens handle (e.g., charli). Defaults to TikTok handle without @ prefix.')
    parser.add_argument('--data-dir', default='../../data', help='Data directory')
    parser.add_argument('--copyrighted', type=int, default=3, help='Number of copyrighted videos to fetch (default: 3)')
    parser.add_argument('--copyright-free', type=int, default=3, help='Number of copyright-free videos to fetch (default: 3)')

    args = parser.parse_args()

    # Default lens handle to TikTok handle (without @ prefix) if not provided
    lens_handle = args.lens_handle if args.lens_handle else args.creator.replace('@', '')

    try:
        crawler = TikTokCrawler(data_dir=args.data_dir)
        crawler.crawl_creator(
            args.creator,
            lens_handle=lens_handle,
            num_copyrighted=args.copyrighted,
            num_copyright_free=args.copyright_free
        )
    except Exception as e:
        console.print(f"\n[bold red]❌ Error:[/bold red] {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
