#!/usr/bin/env python3
"""
Test copyright filtering logic
"""

import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from tiktok_crawler import TikTokCrawler
from rich.console import Console
from rich.table import Table

console = Console()

def test_filters(username: str):
    """Test both filter methods on a user"""
    crawler = TikTokCrawler()

    console.print(f"\n[bold cyan]Testing filters for @{username}[/bold cyan]")
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

    # Analyze copyright status
    console.print(f"\n📊 Analyzing copyright status...")

    copyrighted_true = []
    copyrighted_false_with_spotify = []
    copyright_free = []

    for post in posts:
        music = post.get('music', {})
        is_copyrighted = music.get('isCopyrighted', False)
        spotify_url, track_id = crawler.extract_spotify_url(post)

        if is_copyrighted:
            copyrighted_true.append(post)
        elif spotify_url or track_id:
            copyrighted_false_with_spotify.append(post)
        else:
            copyright_free.append(post)

    # Create summary table
    table = Table(title="Copyright Analysis")
    table.add_column("Category", style="cyan")
    table.add_column("Count", justify="right", style="magenta")
    table.add_column("Description", style="white")

    table.add_row(
        "isCopyrighted=True",
        str(len(copyrighted_true)),
        "Copyrighted songs"
    )
    table.add_row(
        "isCopyrighted=False + Spotify",
        str(len(copyrighted_false_with_spotify)),
        "Songs that became copyrighted later"
    )
    table.add_row(
        "Copyright Free",
        str(len(copyright_free)),
        "No copyright, no Spotify track"
    )
    table.add_row(
        "Total",
        str(len(posts)),
        "",
        style="bold"
    )

    console.print(table)

    # Test filter_copyrighted_songs
    console.print(f"\n🎵 Testing filter_copyrighted_songs()...")
    copyrighted_filtered = crawler.filter_copyrighted_songs(posts)
    console.print(f"   Result: {len(copyrighted_filtered)} posts")

    # Show top 3 copyrighted
    if copyrighted_filtered:
        console.print(f"\n   Top 3 copyrighted by views:")
        for i, post in enumerate(copyrighted_filtered[:3]):
            music = post.get('music', {})
            stats = post.get('stats', {})
            spotify_url, _ = crawler.extract_spotify_url(post)
            console.print(f"      {i+1}. {music.get('title', 'N/A')[:40]} - {stats.get('playCount', 0):,} views")
            console.print(f"         isCopyrighted: {music.get('isCopyrighted')}, Spotify: {bool(spotify_url)}")

    # Test filter_copyright_free
    console.print(f"\n🆓 Testing filter_copyright_free()...")
    free_filtered = crawler.filter_copyright_free(posts)
    console.print(f"   Result: {len(free_filtered)} posts")

    # Show top 3 copyright-free
    if free_filtered:
        console.print(f"\n   Top 3 copyright-free by views:")
        for i, post in enumerate(free_filtered[:3]):
            music = post.get('music', {})
            stats = post.get('stats', {})
            console.print(f"      {i+1}. {music.get('title', 'N/A')[:40]} - {stats.get('playCount', 0):,} views")
            console.print(f"         isCopyrighted: {music.get('isCopyrighted')}, original: {music.get('original')}")
    else:
        console.print("   [yellow]No copyright-free videos found[/yellow]")

    console.print("\n✅ Test complete!")

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument('username', help='TikTok username (without @)')
    args = parser.parse_args()

    test_filters(args.username)
