#!/usr/bin/env python3
"""
Hybrid Audio Matcher - Combines DTW + STT for robust matching
Outputs crop boundaries for demucs/audio2audio pipeline

Usage:
    python3 match-audio-hybrid.py <clip.mp4> <full_song.mp3> <segments.json>

Output:
    JSON with crop boundaries for pipeline:
    {
        "crop_start": 43.0,
        "crop_end": 77.5,
        "buffer_start": 2.0,
        "buffer_end": 2.5,
        "confidence": 0.89,
        "methods": {
            "dtw": {...},
            "stt": {...}
        }
    }
"""
import sys
import json
import subprocess
import os
from pathlib import Path
import librosa
import numpy as np

def run_dtw_matching(clip_file, full_file, use_chroma=False):
    """
    Run DTW-based audio matching
    Returns: dict with start, end, confidence
    """
    print("🔍 [DTW] Running audio-based matching...")

    # Load audio
    y_clip, sr = librosa.load(clip_file, sr=22050, mono=True)
    y_full, sr = librosa.load(full_file, sr=22050, mono=True)

    clip_duration = librosa.get_duration(y=y_clip, sr=sr)

    # Extract features
    hop_length = 512

    if use_chroma:
        features_clip = librosa.feature.chroma_cqt(y=y_clip, sr=sr, hop_length=hop_length)
        features_full = librosa.feature.chroma_cqt(y=y_full, sr=sr, hop_length=hop_length)
    else:
        features_clip = librosa.feature.mfcc(y=y_clip, sr=sr, n_mfcc=13, hop_length=hop_length)
        features_full = librosa.feature.mfcc(y=y_full, sr=sr, n_mfcc=13, hop_length=hop_length)

    # Normalize
    features_clip = librosa.util.normalize(features_clip, axis=0)
    features_full = librosa.util.normalize(features_full, axis=0)

    # Sliding window DTW
    clip_frames = features_clip.shape[1]
    full_frames = features_full.shape[1]
    window_size = int(clip_frames * 1.5)
    hop_size = max(1, clip_frames // 4)

    best_cost = float('inf')
    best_position = 0
    best_path = None

    for i in range(0, full_frames - window_size + 1, hop_size):
        window = features_full[:, i:i+window_size]
        D, wp = librosa.sequence.dtw(X=features_clip, Y=window, metric='euclidean', backtrack=True)
        cost = D[-1, -1] / len(wp)

        if cost < best_cost:
            best_cost = cost
            best_position = i
            best_path = wp

    # Get start frame from DTW path
    if best_path is not None:
        window_start_frame = best_path[0, 1]
        actual_start_frame = best_position + window_start_frame
    else:
        actual_start_frame = best_position

    # Convert to time
    start_time = librosa.frames_to_time(actual_start_frame, sr=sr, hop_length=hop_length)
    end_time = start_time + clip_duration

    # Confidence (inverse of normalized cost)
    confidence = max(0, min(1, 1 - (best_cost / 5.0)))

    print(f"   ✓ DTW match: {start_time:.1f}s - {end_time:.1f}s (confidence: {confidence:.1%})")

    return {
        'start': float(start_time),
        'end': float(end_time),
        'confidence': float(confidence),
        'dtw_cost': float(best_cost)
    }

def run_stt_matching(clip_file, segments_file):
    """
    Run STT-based matching using the Node.js script
    Returns: dict with segment match info
    """
    print("🎤 [STT] Running transcript-based matching...")

    # Check if the Node.js script exists
    script_path = Path(__file__).parent / "match-audio-stt.mjs"
    if not script_path.exists():
        print("   ⚠️  STT script not found, skipping STT matching")
        return None

    try:
        # Run the Node.js STT matcher (pass MP3 file to avoid re-extraction)
        # Pass current environment to preserve API keys
        result = subprocess.run(
            ['node', str(script_path), clip_file, segments_file],
            capture_output=True,
            text=True,
            timeout=60,
            cwd=str(Path(__file__).parent),  # Run in same directory
            env=os.environ.copy()  # Pass environment variables
        )

        if result.returncode != 0:
            print(f"   ⚠️  STT matching failed:")
            print(f"   STDOUT: {result.stdout[:500]}")
            print(f"   STDERR: {result.stderr[:500]}")
            return None

        # Parse JSON output from the script
        # The script outputs "JSON OUTPUT:" followed by the JSON
        output_lines = result.stdout.split('\n')
        json_start = -1
        for i, line in enumerate(output_lines):
            if 'JSON OUTPUT:' in line:
                json_start = i + 1
                break

        if json_start == -1:
            print("   ⚠️  Could not find JSON output from STT script")
            return None

        json_text = '\n'.join(output_lines[json_start:])
        stt_result = json.loads(json_text)

        print(f"   ✓ STT match: segment '{stt_result['segmentId']}' at {stt_result['startTime']:.1f}s - {stt_result['endTime']:.1f}s")
        print(f"     Confidence: {stt_result['confidence']:.1%}")

        return stt_result

    except subprocess.TimeoutExpired:
        print("   ⚠️  STT matching timed out")
        return None
    except json.JSONDecodeError as e:
        print(f"   ⚠️  Failed to parse STT JSON output: {e}")
        return None
    except Exception as e:
        print(f"   ⚠️  STT matching error: {e}")
        return None

def calculate_smart_buffer(start_time, end_time, full_duration):
    """
    Calculate smart buffer time for musical phrases

    Args:
        start_time: Match start in seconds
        end_time: Match end in seconds
        full_duration: Total song duration

    Returns:
        (buffer_start, buffer_end) in seconds
    """
    # Default buffer: 2 seconds before, 2.5 seconds after
    # This accounts for:
    # - Musical pickup/intro notes before the phrase
    # - Sustain/reverb tail after the phrase
    buffer_start = 2.0
    buffer_end = 2.5

    # Adjust if we're near the song boundaries
    if start_time < buffer_start:
        buffer_start = start_time

    if end_time + buffer_end > full_duration:
        buffer_end = full_duration - end_time

    return buffer_start, buffer_end

def combine_results(dtw_result, stt_result, full_duration):
    """
    Combine DTW and STT results to get final crop boundaries

    Strategy:
    1. If both agree (within 5s tolerance), use average with high confidence
    2. If they disagree, prefer DTW (more accurate for timing)
    3. If only one method worked, use that result
    """

    if dtw_result and stt_result:
        # Both methods succeeded
        dtw_start = dtw_result['start']
        dtw_end = dtw_result['end']
        stt_start = stt_result['startTime']
        stt_end = stt_result['endTime']

        # Check if they agree (within 5 second tolerance)
        start_diff = abs(dtw_start - stt_start)
        end_diff = abs(dtw_end - stt_end)

        if start_diff < 5 and end_diff < 5:
            # Both agree - use average and boost confidence
            crop_start = (dtw_start + stt_start) / 2
            crop_end = (dtw_end + stt_end) / 2
            confidence = min(1.0, (dtw_result['confidence'] + stt_result['confidence']) / 2 * 1.1)
            method = 'hybrid_validated'

            print(f"\n✅ [HYBRID] Both methods agree!")
            print(f"   DTW:  {dtw_start:.1f}s - {dtw_end:.1f}s")
            print(f"   STT:  {stt_start:.1f}s - {stt_end:.1f}s")
            print(f"   Diff: {start_diff:.1f}s / {end_diff:.1f}s")

        else:
            # Methods disagree - prefer DTW for timing accuracy
            crop_start = dtw_start
            crop_end = dtw_end
            confidence = dtw_result['confidence']
            method = 'hybrid_dtw_preferred'

            print(f"\n⚠️  [HYBRID] Methods disagree, using DTW")
            print(f"   DTW:  {dtw_start:.1f}s - {dtw_end:.1f}s (confidence: {dtw_result['confidence']:.1%})")
            print(f"   STT:  {stt_start:.1f}s - {stt_end:.1f}s (confidence: {stt_result['confidence']:.1%})")
            print(f"   Diff: {start_diff:.1f}s / {end_diff:.1f}s")

    elif dtw_result:
        # Only DTW worked
        crop_start = dtw_result['start']
        crop_end = dtw_result['end']
        confidence = dtw_result['confidence']
        method = 'dtw_only'

        print(f"\n📊 [HYBRID] Using DTW result only")

    elif stt_result:
        # Only STT worked
        crop_start = stt_result['startTime']
        crop_end = stt_result['endTime']
        confidence = stt_result['confidence']
        method = 'stt_only'

        print(f"\n📊 [HYBRID] Using STT result only")

    else:
        # Neither method worked
        raise Exception("Both DTW and STT matching failed")

    # Calculate smart buffer
    buffer_start, buffer_end = calculate_smart_buffer(crop_start, crop_end, full_duration)

    return {
        'method': method,
        'crop_start': crop_start,
        'crop_end': crop_end,
        'buffer_start': buffer_start,
        'buffer_end': buffer_end,
        'confidence': confidence
    }

def extract_audio_if_video(input_file):
    """Extract audio from video file if needed"""
    input_path = Path(input_file)

    if input_path.suffix.lower() in ['.mp3', '.wav', '.flac', '.ogg']:
        return input_file

    output_audio = input_path.with_suffix('.mp3')

    if not output_audio.exists():
        print(f"📹 Extracting audio from video: {input_file}")
        subprocess.run([
            'ffmpeg', '-i', input_file,
            '-vn', '-acodec', 'libmp3lame',
            '-y', str(output_audio)
        ], capture_output=True, check=True)
        print(f"   ✓ Extracted to: {output_audio}\n")

    return str(output_audio)

def format_time(seconds):
    """Format seconds as MM:SS.ms"""
    mins = int(seconds // 60)
    secs = seconds % 60
    return f"{mins}:{secs:06.3f}"

def main():
    if len(sys.argv) < 3:
        print("Usage: python3 match-audio-hybrid.py <clip.mp4> <full_song.mp3> [segments.json]")
        print("\nExample:")
        print("  python3 match-audio-hybrid.py tiktok_clip.mp4 song.flac segments.json")
        print("\nNote: segments.json is optional (for STT matching)")
        sys.exit(1)

    clip_file = sys.argv[1]
    full_file = sys.argv[2]
    segments_file = sys.argv[3] if len(sys.argv) > 3 else None

    # Validate inputs
    if not Path(clip_file).exists():
        print(f"❌ Error: Clip file not found: {clip_file}")
        sys.exit(1)

    if not Path(full_file).exists():
        print(f"❌ Error: Full song file not found: {full_file}")
        sys.exit(1)

    if segments_file and not Path(segments_file).exists():
        print(f"⚠️  Warning: Segments file not found: {segments_file}")
        print("   Continuing with DTW-only matching\n")
        segments_file = None

    print("=" * 70)
    print("🎯 HYBRID AUDIO MATCHER (DTW + STT)")
    print("   Output: Crop boundaries for demucs/audio2audio pipeline")
    print("=" * 70)
    print()

    # Extract audio if needed
    clip_file = extract_audio_if_video(clip_file)

    # Get full song duration
    y_full, sr = librosa.load(full_file, sr=22050, mono=True)
    full_duration = librosa.get_duration(y=y_full, sr=sr)
    print(f"📊 Full song duration: {full_duration:.1f}s ({format_time(full_duration)})\n")

    try:
        # Run both matching methods
        dtw_result = run_dtw_matching(clip_file, full_file)
        stt_result = run_stt_matching(clip_file, segments_file) if segments_file else None

        # Combine results
        combined = combine_results(dtw_result, stt_result, full_duration)

        # Calculate actual crop boundaries (with buffer)
        actual_start = max(0, combined['crop_start'] - combined['buffer_start'])
        actual_end = min(full_duration, combined['crop_end'] + combined['buffer_end'])
        crop_duration = actual_end - actual_start

        # Build final output
        output = {
            'source_file': str(Path(full_file).absolute()),
            'clip_file': str(Path(clip_file).absolute()),
            'crop_start': float(actual_start),
            'crop_end': float(actual_end),
            'crop_duration': float(crop_duration),
            'match_start': float(combined['crop_start']),
            'match_end': float(combined['crop_end']),
            'buffer_start': float(combined['buffer_start']),
            'buffer_end': float(combined['buffer_end']),
            'confidence': float(combined['confidence']),
            'method': combined['method'],
            'methods': {
                'dtw': dtw_result,
                'stt': stt_result
            }
        }

        # Display results
        print()
        print("=" * 70)
        print("✂️  CROP INSTRUCTIONS FOR PIPELINE")
        print("=" * 70)
        print()
        print(f"Source file:    {output['source_file']}")
        print(f"Crop start:     {format_time(actual_start)} ({actual_start:.2f}s)")
        print(f"Crop end:       {format_time(actual_end)} ({actual_end:.2f}s)")
        print(f"Crop duration:  {crop_duration:.1f}s")
        print()
        print(f"Match region:   {format_time(combined['crop_start'])} - {format_time(combined['crop_end'])}")
        print(f"Buffer added:   -{combined['buffer_start']:.1f}s / +{combined['buffer_end']:.1f}s")
        print()
        print(f"Confidence:     {combined['confidence']:.1%}")
        print(f"Method:         {combined['method']}")
        print()

        # Interpretation
        if combined['confidence'] > 0.85:
            print("✅ HIGH CONFIDENCE - Ready for demucs/audio2audio pipeline")
        elif combined['confidence'] > 0.65:
            print("⚠️  MEDIUM CONFIDENCE - Review before processing")
        else:
            print("❌ LOW CONFIDENCE - Manual verification recommended")

        print()
        print("=" * 70)
        print()

        # FFmpeg command for reference
        print("🔧 FFMPEG CROP COMMAND:")
        print()
        print(f'ffmpeg -i "{output["source_file"]}" \\')
        print(f'  -ss {actual_start:.3f} -to {actual_end:.3f} \\')
        print(f'  -acodec libmp3lame -q:a 2 \\')
        print(f'  output_segment.mp3')
        print()
        print("=" * 70)
        print()

        # Output JSON for pipeline
        print("📋 JSON OUTPUT (for pipeline):")
        print(json.dumps(output, indent=2))

        # Also save to file
        output_file = Path('crop_instructions.json')
        output_file.write_text(json.dumps(output, indent=2))
        print()
        print(f"💾 Saved to: {output_file.absolute()}")

    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    main()
