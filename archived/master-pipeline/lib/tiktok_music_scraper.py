#!/usr/bin/env python3
"""
TikTok Music Page Scraper
Extracts canonical segment URLs from TikTok music pages

Reusable across karaoke-school pipelines
"""

import json
import re
import subprocess
import sys
from pathlib import Path
from typing import Optional, Dict
from urllib.parse import urlparse

import hrequests
from rich.console import Console

console = Console()


class TikTokMusicScraper:
    """Scrapes TikTok music pages to extract canonical segment URLs"""

    BASE_URL = "https://www.tiktok.com"

    def __init__(self):
        """Initialize scraper"""
        self.session = hrequests.Session()

    def parse_music_url(self, url: str) -> Dict[str, str]:
        """
        Parse TikTok music URL to extract song name and music ID

        Example: https://www.tiktok.com/music/TEXAS-HOLDEM-7334542274145454891
        Returns: {'song_name': 'TEXAS HOLDEM', 'music_id': '7334542274145454891'}
        """
        match = re.search(r'/music/(.+?)-(\d+)', url)
        if not match:
            raise ValueError(f"Invalid TikTok music URL: {url}")

        song_name = match.group(1).replace('-', ' ').replace('%20', ' ')
        music_id = match.group(2)

        return {
            'song_name': song_name,
            'music_id': music_id,
        }

    def extract_segment_url(self, url: str) -> Optional[str]:
        """
        Extract video/audio segment URL from TikTok music page

        Uses hrequests' JavaScript rendering to execute page scripts
        and extract the video element's src attribute
        """
        try:
            console.print(f"🔍 Fetching & rendering page: {url}")

            # Render the page with JavaScript execution
            resp = self.session.get(url, timeout=15)

            if resp.status_code != 200:
                console.print(f"[red]HTTP {resp.status_code}[/red]")
                return None

            # Render JavaScript
            console.print("🎬 Executing JavaScript...")
            with resp.render(headless=True) as page:
                # Wait for video element to load
                try:
                    page.awaitSelector('video', timeout=10000)
                except:
                    console.print("[yellow]Video element not found[/yellow]")
                    return None

                # Extract ALL video URLs and find the music preview (longest duration)
                # TikTok music pages have multiple videos: user clips + 60s music preview
                video_info = page.evaluate('''() => {
                    const videos = Array.from(document.querySelectorAll('video'));
                    return videos.map(v => ({
                        src: v.src,
                        duration: v.duration || 0,
                        className: v.className,
                        id: v.id
                    }));
                }''')

                if not video_info or len(video_info) == 0:
                    console.print("[yellow]No video elements found[/yellow]")
                    return None

                console.print(f"   Found {len(video_info)} video element(s)")

                # Find the video with longest duration (should be the 60s preview)
                # Filter out videos with no src or 0 duration
                valid_videos = [v for v in video_info if v.get('src') and v.get('duration', 0) > 0]

                if not valid_videos:
                    # Fall back to first video with src if no duration info
                    valid_videos = [v for v in video_info if v.get('src')]

                if not valid_videos:
                    console.print("[yellow]No valid video sources found[/yellow]")
                    return None

                # Sort by duration descending and take longest
                longest_video = max(valid_videos, key=lambda v: v.get('duration', 0))
                segment_url = longest_video['src']

                console.print(f"   Selected video: {longest_video.get('duration', 0):.1f}s")
                console.print(f"✅ Found segment URL")
                return segment_url

        except Exception as e:
            console.print(f"[red]Error rendering page:[/red] {e}")
            return None

    def download_segment(self, segment_url: str, output_path: Path) -> bool:
        """
        Download segment from TikTok CDN

        Uses curl for simple HTTP download
        """
        try:
            console.print(f"📥 Downloading segment...")
            console.print(f"   URL: {segment_url}")
            console.print(f"   Output: {output_path}")

            # Ensure parent directory exists
            output_path.parent.mkdir(parents=True, exist_ok=True)

            # Use curl to download
            cmd = [
                'curl',
                '-s',
                '-o', str(output_path),
                segment_url
            ]

            result = subprocess.run(cmd, capture_output=True, text=True)

            if result.returncode == 0 and output_path.exists():
                # Verify it's a valid media file
                probe_cmd = [
                    'ffprobe',
                    '-v', 'error',
                    '-show_entries', 'format=duration',
                    '-of', 'default=noprint_wrappers=1:nokey=1',
                    str(output_path)
                ]

                probe_result = subprocess.run(probe_cmd, capture_output=True, text=True)

                if probe_result.returncode == 0:
                    duration = float(probe_result.stdout.strip())
                    console.print(f"✅ Downloaded ({duration:.1f}s)")
                    return True
                else:
                    console.print(f"[red]Invalid media file[/red]")
                    return False
            else:
                console.print(f"[red]Download failed[/red]")
                return False

        except Exception as e:
            console.print(f"[red]Error downloading segment:[/red] {e}")
            return False

    def scrape_music_page(self, url: str, output_path: Optional[Path] = None) -> Optional[Dict]:
        """
        Main scraping function

        Args:
            url: TikTok music page URL
            output_path: Optional path to save segment (default: /tmp/{song_name}_segment.mp4)

        Returns:
            Dict with segment info: {
                'song_name': str,
                'music_id': str,
                'segment_url': str,
                'local_path': str,
                'duration': float
            }
        """
        console.print("\n[bold cyan]🎵 TikTok Music Page Scraper[/bold cyan]")
        console.print("═" * 60)

        # Parse URL
        parsed = self.parse_music_url(url)
        song_name = parsed['song_name']
        music_id = parsed['music_id']

        console.print(f"\n📋 Music Info:")
        console.print(f"   Song: {song_name}")
        console.print(f"   Music ID: {music_id}\n")

        # Extract segment URL
        segment_url = self.extract_segment_url(url)

        if not segment_url:
            console.print("[red]❌ Failed to extract segment URL[/red]")
            return None

        console.print(f"   Segment URL: {segment_url}\n")

        # Download segment
        if output_path is None:
            output_path = Path(f"/tmp/{song_name.replace(' ', '_')}_segment.mp4")

        success = self.download_segment(segment_url, output_path)

        if not success:
            console.print("[red]❌ Download failed[/red]")
            return None

        # Get duration
        probe_cmd = [
            'ffprobe',
            '-v', 'error',
            '-show_entries', 'format=duration',
            '-of', 'default=noprint_wrappers=1:nokey=1',
            str(output_path)
        ]

        probe_result = subprocess.run(probe_cmd, capture_output=True, text=True)
        duration = float(probe_result.stdout.strip()) if probe_result.returncode == 0 else 0

        result = {
            'song_name': song_name,
            'music_id': music_id,
            'segment_url': segment_url,
            'local_path': str(output_path),
            'duration': duration,
        }

        console.print("\n[green]✨ Success![/green]")
        console.print(f"   Segment saved to: {output_path}")
        console.print(f"   Duration: {duration:.1f}s\n")

        return result


def main():
    """CLI entry point"""
    if len(sys.argv) < 2:
        console.print("\n[bold]Usage:[/bold]")
        console.print("  python tiktok_music_scraper.py <tiktok_music_url> [output_path]\n")
        console.print("[bold]Example:[/bold]")
        console.print("  python tiktok_music_scraper.py https://www.tiktok.com/music/TEXAS-HOLDEM-7334542274145454891\n")
        sys.exit(1)

    url = sys.argv[1]
    output_path = Path(sys.argv[2]) if len(sys.argv) > 2 else None

    scraper = TikTokMusicScraper()
    result = scraper.scrape_music_page(url, output_path)

    if result:
        # Print JSON for easy parsing by other scripts
        print(json.dumps(result, indent=2))
        sys.exit(0)
    else:
        sys.exit(1)


if __name__ == '__main__':
    main()
