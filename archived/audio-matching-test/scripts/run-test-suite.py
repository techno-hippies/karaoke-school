#!/usr/bin/env python3
"""
Test Suite Runner - Batch test hybrid matcher on multiple songs

Usage:
    python3 scripts/run-test-suite.py [test-case-1] [test-case-2] ...

    # Run all tests
    python3 scripts/run-test-suite.py

    # Run specific test
    python3 scripts/run-test-suite.py beyonce-levis-jeans
"""
import sys
import json
import subprocess
from pathlib import Path
from datetime import datetime

def run_test_case(test_dir):
    """Run hybrid matcher on a single test case"""

    # Load metadata
    metadata_file = test_dir / "metadata.json"
    if not metadata_file.exists():
        print(f"⚠️  Skipping {test_dir.name} - no metadata.json")
        return None

    metadata = json.loads(metadata_file.read_text())

    # Check required files
    original = test_dir / metadata['files']['original']
    clip = test_dir / metadata['files']['clip']
    segments_file = metadata['files'].get('segments')
    segments = test_dir / segments_file if segments_file else None

    if not original.exists():
        print(f"⚠️  Skipping {test_dir.name} - original file not found: {original.name}")
        return None

    if not clip.exists():
        print(f"⚠️  Skipping {test_dir.name} - clip file not found: {clip.name}")
        return None

    print("=" * 70)
    print(f"🎵 TEST: {metadata['artist']} - {metadata['songTitle']}")
    print("=" * 70)
    print()

    # Run hybrid matcher
    script = Path(__file__).parent / "match-audio-hybrid.py"
    args = [
        'python3', str(script),
        str(clip),
        str(original)
    ]

    if segments and segments.exists():
        args.append(str(segments))

    try:
        result = subprocess.run(
            args,
            cwd=str(test_dir),
            capture_output=True,
            text=True,
            timeout=120
        )

        # Parse crop_instructions.json
        crop_file = test_dir / "crop_instructions.json"
        if crop_file.exists():
            crop_data = json.loads(crop_file.read_text())

            # Compare with expected match if available
            expected = metadata.get('expectedMatch', {})
            result_data = {
                'testId': metadata['testId'],
                'artist': metadata['artist'],
                'songTitle': metadata['songTitle'],
                'match': {
                    'start': crop_data['match_start'],
                    'end': crop_data['match_end'],
                    'confidence': crop_data['confidence'],
                    'method': crop_data['method']
                },
                'crop': {
                    'start': crop_data['crop_start'],
                    'end': crop_data['crop_end'],
                    'duration': crop_data['crop_duration']
                },
                'expected': expected,
                'status': 'pass' if crop_data['confidence'] > 0.65 else 'review',
                'timestamp': datetime.now().isoformat()
            }

            # Check if match is close to expected
            if expected.get('startTime'):
                start_diff = abs(crop_data['match_start'] - expected['startTime'])
                if start_diff < 5:
                    print(f"✅ Match within {start_diff:.1f}s of expected!")
                else:
                    print(f"⚠️  Match differs by {start_diff:.1f}s from expected")

            return result_data
        else:
            print("❌ No crop_instructions.json generated")
            return None

    except subprocess.TimeoutExpired:
        print("❌ Test timed out")
        return None
    except Exception as e:
        print(f"❌ Test failed: {e}")
        return None

def main():
    base_dir = Path(__file__).parent.parent
    test_cases_dir = base_dir / "test-cases"

    # Get test cases to run
    if len(sys.argv) > 1:
        # Run specific tests
        test_names = sys.argv[1:]
        test_dirs = [test_cases_dir / name for name in test_names]
    else:
        # Run all tests
        test_dirs = [d for d in test_cases_dir.iterdir() if d.is_dir()]

    print("🧪 HYBRID MATCHER TEST SUITE")
    print(f"   Running {len(test_dirs)} test(s)")
    print()

    results = []
    for test_dir in test_dirs:
        result = run_test_case(test_dir)
        if result:
            results.append(result)
        print()

    # Summary
    print("=" * 70)
    print("📊 TEST SUMMARY")
    print("=" * 70)
    print()

    if not results:
        print("❌ No tests completed successfully")
        return

    # Results table
    print(f"{'Song':<40} {'Confidence':<12} {'Time Range':<20} {'Status':<10}")
    print("-" * 82)

    for r in results:
        song = f"{r['artist']} - {r['songTitle']}"
        if len(song) > 38:
            song = song[:35] + "..."

        conf = f"{r['match']['confidence']:.1%}"
        time_range = f"{r['match']['start']:.1f}-{r['match']['end']:.1f}s"
        status = "✅ PASS" if r['status'] == 'pass' else "⚠️  REVIEW"

        print(f"{song:<40} {conf:<12} {time_range:<20} {status:<10}")

    print()

    # Statistics
    passed = sum(1 for r in results if r['status'] == 'pass')
    avg_confidence = sum(r['match']['confidence'] for r in results) / len(results)

    print(f"Total tests:      {len(results)}")
    print(f"Passed (>65%):    {passed}")
    print(f"Need review:      {len(results) - passed}")
    print(f"Avg confidence:   {avg_confidence:.1%}")
    print()

    # Save results
    results_file = base_dir / "results" / f"test-results-{datetime.now().strftime('%Y%m%d-%H%M%S')}.json"
    results_file.parent.mkdir(exist_ok=True)
    results_file.write_text(json.dumps(results, indent=2))

    print(f"💾 Results saved to: {results_file}")
    print()

if __name__ == '__main__':
    main()
