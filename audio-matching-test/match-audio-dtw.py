#!/usr/bin/env python3
"""
DTW-based audio matching - Find where a clip appears in a full song
Uses Dynamic Time Warping for robust matching against tempo/speed variations

Usage:
    python3 match-audio-dtw.py <clip.mp4|mp3> <full_song.mp3>

Example:
    python3 match-audio-dtw.py tiktok_video.mp4 beyonce-levii-jeans-full.mp3
"""
import sys
import json
import librosa
import numpy as np
from pathlib import Path

def extract_audio_if_video(input_file):
    """Extract audio from video file if needed"""
    input_path = Path(input_file)

    # If already audio, return as-is
    if input_path.suffix.lower() in ['.mp3', '.wav', '.flac', '.ogg']:
        return input_file

    # Extract audio from video
    output_audio = input_path.with_suffix('.mp3')
    print(f"📹 Extracting audio from video: {input_file}")

    import subprocess
    subprocess.run([
        'ffmpeg', '-i', input_file,
        '-vn', '-acodec', 'libmp3lame',
        '-y', str(output_audio)
    ], capture_output=True, check=True)

    print(f"✓ Extracted to: {output_audio}\n")
    return str(output_audio)

def find_audio_offset_dtw(clip_file, full_file, use_chroma=False):
    """
    Find where clip_file appears in full_file using DTW alignment

    Args:
        clip_file: Path to clip audio
        full_file: Path to full song audio
        use_chroma: If True, use chroma features; if False, use MFCC (default)

    Returns:
        dict: {start, end, confidence, duration, dtw_cost}
    """
    print(f"🎵 Loading audio files...")
    print(f"   Clip: {clip_file}")
    print(f"   Full: {full_file}\n")

    # Load audio (downsampled to 22050 Hz for speed)
    y_clip, sr = librosa.load(clip_file, sr=22050, mono=True)
    y_full, sr = librosa.load(full_file, sr=22050, mono=True)

    clip_duration = librosa.get_duration(y=y_clip, sr=sr)
    full_duration = librosa.get_duration(y=y_full, sr=sr)

    print(f"📊 Audio loaded:")
    print(f"   Clip duration: {clip_duration:.1f}s")
    print(f"   Full duration: {full_duration:.1f}s")
    print(f"   Sample rate: {sr} Hz\n")

    # Extract features
    hop_length = 512

    if use_chroma:
        print(f"🔍 Extracting Chroma CQT features...")
        features_clip = librosa.feature.chroma_cqt(y=y_clip, sr=sr, hop_length=hop_length)
        features_full = librosa.feature.chroma_cqt(y=y_full, sr=sr, hop_length=hop_length)
        feature_name = "Chroma"
    else:
        print(f"🔍 Extracting MFCC features...")
        features_clip = librosa.feature.mfcc(y=y_clip, sr=sr, n_mfcc=13, hop_length=hop_length)
        features_full = librosa.feature.mfcc(y=y_full, sr=sr, n_mfcc=13, hop_length=hop_length)
        feature_name = "MFCC"

    print(f"   Clip {feature_name} shape: {features_clip.shape}")
    print(f"   Full {feature_name} shape: {features_full.shape}\n")

    # Normalize features
    features_clip = librosa.util.normalize(features_clip, axis=0)
    features_full = librosa.util.normalize(features_full, axis=0)

    # For long songs, we'll use a sliding window approach to avoid memory issues
    # and speed up computation
    print(f"⚙️  Computing DTW alignment with sliding windows...")

    clip_frames = features_clip.shape[1]
    full_frames = features_full.shape[1]

    # Window size: clip length + 50% buffer for tempo variations
    window_size = int(clip_frames * 1.5)
    hop_size = max(1, clip_frames // 4)  # 25% overlap

    best_cost = float('inf')
    best_position = 0
    best_path = None

    num_windows = (full_frames - window_size) // hop_size + 1
    print(f"   Analyzing {num_windows} windows (size={window_size} frames, hop={hop_size})\n")

    costs = []
    positions = []

    for i in range(0, full_frames - window_size + 1, hop_size):
        # Extract window from full song
        window = features_full[:, i:i+window_size]

        # Compute DTW between clip and this window
        # librosa.sequence.dtw expects shape (n_features, n_frames)
        D, wp = librosa.sequence.dtw(
            X=features_clip,
            Y=window,
            metric='euclidean',
            backtrack=True
        )

        # Normalized cost (account for path length)
        cost = D[-1, -1] / len(wp)
        costs.append(cost)
        positions.append(i)

        if cost < best_cost:
            best_cost = cost
            best_position = i
            best_path = wp

    print(f"✓ Found best alignment:")
    print(f"   DTW cost: {best_cost:.4f}")
    print(f"   Position: frame {best_position}\n")

    # Get actual start frame from the DTW path
    # The path tells us where in the window the clip starts
    if best_path is not None:
        # First alignment point in the window
        window_start_frame = best_path[0, 1]
        actual_start_frame = best_position + window_start_frame
    else:
        actual_start_frame = best_position

    # Convert to time
    start_time = librosa.frames_to_time(actual_start_frame, sr=sr, hop_length=hop_length)
    end_time = start_time + clip_duration

    # Calculate confidence (inverse of normalized cost)
    # Lower cost = better match
    # Empirically, good matches have cost < 2.0, bad matches > 5.0
    confidence = max(0, min(1, 1 - (best_cost / 5.0)))

    return {
        'start': float(start_time),
        'end': float(end_time),
        'confidence': float(confidence),
        'duration': float(clip_duration),
        'dtw_cost': float(best_cost),
        'feature_type': feature_name,
        'num_windows_analyzed': num_windows
    }

def format_time(seconds):
    """Format seconds as MM:SS"""
    mins = int(seconds // 60)
    secs = int(seconds % 60)
    return f"{mins}:{secs:02d}"

def main():
    if len(sys.argv) < 3:
        print("Usage: python3 match-audio-dtw.py <tiktok_clip.mp4|mp3> <full_song.mp3> [--chroma]")
        print("\nExample:")
        print("  python3 match-audio-dtw.py tiktok_video.mp4 song.mp3")
        print("\nOptions:")
        print("  --chroma    Use chroma features instead of MFCC (better for harmonic content)")
        sys.exit(1)

    clip_file = sys.argv[1]
    full_file = sys.argv[2]
    use_chroma = '--chroma' in sys.argv

    # Check files exist
    if not Path(clip_file).exists():
        print(f"❌ Error: Clip file not found: {clip_file}")
        sys.exit(1)

    if not Path(full_file).exists():
        print(f"❌ Error: Full song file not found: {full_file}")
        sys.exit(1)

    print("=" * 60)
    print("🎯 DTW-BASED AUDIO MATCHING TEST")
    print("=" * 60)
    print()

    # Extract audio if video
    clip_file = extract_audio_if_video(clip_file)

    try:
        # Run matching
        result = find_audio_offset_dtw(clip_file, full_file, use_chroma=use_chroma)

        # Display results
        print("=" * 60)
        print("📍 MATCH RESULTS")
        print("=" * 60)
        print()
        print(f"✅ Match found using {result['feature_type']} + DTW!")
        print(f"   Time range: {format_time(result['start'])} - {format_time(result['end'])}")
        print(f"   Start time: {result['start']:.2f}s")
        print(f"   End time: {result['end']:.2f}s")
        print(f"   Duration: {result['duration']:.1f}s")
        print(f"   Confidence: {result['confidence']:.1%}")
        print(f"   DTW Cost: {result['dtw_cost']:.4f}")
        print()

        # Interpretation
        if result['confidence'] > 0.7:
            print("✅ HIGH CONFIDENCE - Very likely accurate match")
        elif result['confidence'] > 0.5:
            print("⚠️  MEDIUM CONFIDENCE - Probably correct but verify")
        else:
            print("❌ LOW CONFIDENCE - Match uncertain, may be incorrect")

        print()
        print("💡 TIP: Try --chroma flag for harmonic/melodic content")
        print("        or MFCC (default) for vocal/timbre matching")
        print()
        print("=" * 60)
        print()

        # Also output JSON for programmatic use
        print("JSON OUTPUT:")
        print(json.dumps(result, indent=2))

    except Exception as e:
        print(f"\n❌ Error during matching: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    main()
