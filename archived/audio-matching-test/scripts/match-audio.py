#!/usr/bin/env python3
"""
Test librosa audio matching - Find where a clip appears in a full song

Usage:
    python3 match-audio.py <clip.mp4|mp3> <full_song.mp3>

Example:
    python3 match-audio.py tiktok_video.mp4 beyonce-levii-jeans-full.mp3
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

def find_audio_offset(clip_file, full_file):
    """
    Find where clip_file appears in full_file using librosa cross-correlation

    Returns:
        dict: {start, end, confidence, duration}
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

    # Extract chroma features (pitch-based fingerprint)
    # This is robust to volume changes, effects, compression
    print(f"🔍 Extracting chroma features...")
    chroma_clip = librosa.feature.chroma_cqt(y=y_clip, sr=sr, hop_length=512)
    chroma_full = librosa.feature.chroma_cqt(y=y_full, sr=sr, hop_length=512)

    print(f"   Clip chroma shape: {chroma_clip.shape}")
    print(f"   Full chroma shape: {chroma_full.shape}\n")

    # Normalize chroma features
    chroma_clip = librosa.util.normalize(chroma_clip, axis=0)
    chroma_full = librosa.util.normalize(chroma_full, axis=0)

    # Cross-correlation to find best match
    print(f"⚙️  Computing cross-correlation...")

    # We'll slide the clip pattern across the full song
    clip_frames = chroma_clip.shape[1]
    full_frames = chroma_full.shape[1]

    # Compute correlation for each position
    correlations = []
    for i in range(full_frames - clip_frames + 1):
        window = chroma_full[:, i:i+clip_frames]
        correlation = np.sum(chroma_clip * window) / clip_frames
        correlations.append(correlation)

    correlations = np.array(correlations)

    # Find peak (best match)
    peak_idx = np.argmax(correlations)
    peak_value = correlations[peak_idx]

    # Normalize confidence score (0-1)
    confidence = peak_value / 12.0  # 12 chroma bins, normalized

    print(f"✓ Found peak correlation: {peak_value:.4f}")
    print(f"   Normalized confidence: {confidence:.4f}\n")

    # Convert frame index to time
    hop_length = 512
    start_time = librosa.frames_to_time(peak_idx, sr=sr, hop_length=hop_length)
    end_time = start_time + clip_duration

    return {
        'start': float(start_time),
        'end': float(end_time),
        'confidence': float(confidence),
        'duration': float(clip_duration),
        'peak_correlation': float(peak_value),
        'total_positions_checked': len(correlations)
    }

def format_time(seconds):
    """Format seconds as MM:SS"""
    mins = int(seconds // 60)
    secs = int(seconds % 60)
    return f"{mins}:{secs:02d}"

def main():
    if len(sys.argv) != 3:
        print("Usage: python3 match-audio.py <tiktok_clip.mp4|mp3> <full_song.mp3>")
        print("\nExample:")
        print("  python3 match-audio.py tiktok_video.mp4 song.mp3")
        sys.exit(1)

    clip_file = sys.argv[1]
    full_file = sys.argv[2]

    # Check files exist
    if not Path(clip_file).exists():
        print(f"❌ Error: Clip file not found: {clip_file}")
        sys.exit(1)

    if not Path(full_file).exists():
        print(f"❌ Error: Full song file not found: {full_file}")
        sys.exit(1)

    print("=" * 60)
    print("🎯 LIBROSA AUDIO MATCHING TEST")
    print("=" * 60)
    print()

    # Extract audio if video
    clip_file = extract_audio_if_video(clip_file)

    try:
        # Run matching
        result = find_audio_offset(clip_file, full_file)

        # Display results
        print("=" * 60)
        print("📍 MATCH RESULTS")
        print("=" * 60)
        print()
        print(f"✅ Match found!")
        print(f"   Time range: {format_time(result['start'])} - {format_time(result['end'])}")
        print(f"   Start time: {result['start']:.2f}s")
        print(f"   End time: {result['end']:.2f}s")
        print(f"   Duration: {result['duration']:.1f}s")
        print(f"   Confidence: {result['confidence']:.1%}")
        print()

        # Interpretation
        if result['confidence'] > 0.7:
            print("✅ HIGH CONFIDENCE - Very likely accurate match")
        elif result['confidence'] > 0.5:
            print("⚠️  MEDIUM CONFIDENCE - Probably correct but verify")
        else:
            print("❌ LOW CONFIDENCE - Match uncertain, may be incorrect")

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
