#!/usr/bin/env python3
"""
Quick test of dual filtering (copyrighted + copyright-free)
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from tiktok_crawler import TikTokCrawler
from rich.console import Console

console = Console()

def test_dual_filter(username: str, num_copyrighted: int = 2, num_copyright_free: int = 2):
    """Test fetching both types without downloading"""
    crawler = TikTokCrawler()

    console.print(f"\n[bold cyan]Testing dual filter for @{username}[/bold cyan]")
    console.print(f"Requesting: {num_copyrighted} copyrighted + {num_copyright_free} copyright-free")
    console.print("=" * 60)

    # Get user info
    console.print(f"\n🔍 Fetching profile...")
    user_info = crawler.get_user_info(username)
    if not user_info:
        console.print("[red]Failed to fetch profile[/red]")
        return

    # Fetch posts
    console.print(f"\n📝 Fetching posts...")
    posts = crawler.fetch_user_posts(
        username,
        user_info['secUid'],
        user_info['userId'],
        max_posts=100
    )
    console.print(f"   Found {len(posts)} total posts")

    # Filter both types
    console.print(f"\n🎵 Filtering...")
    copyrighted_posts = crawler.filter_copyrighted_songs(posts)
    copyright_free_posts = crawler.filter_copyright_free(posts)

    console.print(f"   Copyrighted available: {len(copyrighted_posts)}")
    console.print(f"   Copyright-free available: {len(copyright_free_posts)}")

    # Select top N
    selected_copyrighted = copyrighted_posts[:num_copyrighted]
    selected_copyright_free = copyright_free_posts[:num_copyright_free]

    console.print(f"\n✅ Selected:")
    console.print(f"   {len(selected_copyrighted)} copyrighted")
    console.print(f"   {len(selected_copyright_free)} copyright-free")

    # Show what was selected
    console.print(f"\n📊 Copyrighted videos:")
    for i, post in enumerate(selected_copyrighted):
        music = post.get('music', {})
        stats = post.get('stats', {})
        spotify_url, _ = crawler.extract_spotify_url(post)
        console.print(f"   {i+1}. {music.get('title', 'N/A')[:40]} - {stats.get('playCount', 0):,} views")
        console.print(f"      Spotify: {bool(spotify_url)}")

    console.print(f"\n📊 Copyright-free videos:")
    for i, post in enumerate(selected_copyright_free):
        music = post.get('music', {})
        stats = post.get('stats', {})
        console.print(f"   {i+1}. {music.get('title', 'N/A')[:40]} - {stats.get('playCount', 0):,} views")

    console.print("\n✅ Test complete!")

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument('username', help='TikTok username (without @)')
    parser.add_argument('--copyrighted', type=int, default=2)
    parser.add_argument('--copyright-free', type=int, default=2)
    args = parser.parse_args()

    test_dual_filter(args.username, args.copyrighted, args.copyright_free)
