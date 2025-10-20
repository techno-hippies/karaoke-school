"""
Optimized Demucs v4 API on Modal.com
====================================
Scalable HTTP API for vocal/instrumental separation using Demucs MDX Extra model.

Features:
- Pre-cached MDX Extra model in container image (fast cold starts)
- GPU acceleration (H100 - 50% cheaper than B200)
- Two-stems mode (vocals + instrumental) for karaoke
- Song-based processing: $0.20/song vs $1.00 (5 segments × $0.20)
- fal.ai Stable Audio 2.5 enhancement
- MP3 output for faster Grove uploads
"""

import io
import zipfile
import tempfile
import os
import time as time_module
from typing import Optional, List
import modal

# Define the image with Demucs v4 pre-installed and models cached
demucs_image = (
    modal.Image.debian_slim(python_version="3.10")
    .apt_install("ffmpeg", "libsndfile1")  # FFmpeg for audio + libsndfile
    .uv_pip_install(
        "numpy<2",  # Pin numpy<2 for PyTorch compatibility
        "demucs==4.0.1",  # Demucs v4 with Hybrid Transformer models
        "fastapi",
        "python-multipart",
        "requests",
        "soundfile",  # For audio file I/O
    )
    # Pre-download mdx_extra model (2nd place MDX challenge, best quality)
    .run_commands(
        "python -c 'from demucs.pretrained import get_model; get_model(\"mdx_extra\")'"
    )
    .run_commands("ffmpeg -version")
)

app = modal.App("demucs-karaoke")

# In-memory job storage (for async job tracking)
job_storage = modal.Dict.from_name("demucs-job-storage", create_if_missing=True)

@app.cls(
    gpu="H200",  # H200 GPU for faster processing
    image=demucs_image,
    scaledown_window=60,  # 1 min idle before scale-down
    timeout=90,  # 90s max - anything longer means something is broken
    secrets=[
        modal.Secret.from_name("replicate-api-token"),  # Replicate API token (legacy)
        modal.Secret.from_name("fal-api-key")  # fal.ai API key
    ]
    # Uncomment for production with always-warm container:
    # allow_concurrent_inputs=10,
    # keep_warm=1,  # Always 1 warm container (adds idle cost but eliminates cold starts)
)
class DemucsSeparator:
    """
    Demucs v4 separator with song-based processing pipeline.
    Uses MDX Extra model for state-of-the-art quality.
    """

    @modal.enter()
    def warmup(self):
        """Container warmup - verify model is cached"""
        print("Demucs container warming up...")
        print("✓ mdx_extra model cached during image build")

    @modal.method()
    def process_song_with_segments(
        self,
        genius_id: int,
        audio_url: str,
        full_duration: float,
        segments: List[dict],  # [{id: "chorus-1", startTime: 45.2, endTime: 75.8}, ...]
        chain_id: int = 37111,
        mp3_bitrate: int = 192,
        fal_strength: float = 0.3
    ) -> dict:
        """
        Complete song-based karaoke pipeline (OPTIMIZED):

        1. Download full audio from maid.zone
        2. Trim to 190s if needed (fal.ai limit)
        3. Demucs separation (full song, mdx_extra model)
        4. fal.ai enhancement (full instrumental) - $0.20 ONCE
        5. FFmpeg: Cut stems into segments using provided timestamps
        6. Grove: Upload each segment (MP3)
        7. Return all segment URIs

        Args:
            genius_id: Genius song ID
            audio_url: SoundCloud URL via maid.zone
            full_duration: Total song duration in seconds
            segments: List of segment timestamps
            chain_id: Chain ID for Grove (37111=testnet, 7579=mainnet, 84532=base-sepolia)
            mp3_bitrate: MP3 bitrate in kbps (default: 192)
            fal_strength: fal.ai transformation strength (0.3 recommended)

        Returns:
            {
                "success": True,
                "geniusId": int,
                "segments": [
                    {
                        "segmentId": "chorus-1",
                        "vocalsUri": "lens://...",
                        "instrumentalUri": "lens://...",
                        "startTime": 45.2,
                        "endTime": 75.8,
                        "duration": 30.6,
                        "vocalsGatewayUrl": "https://...",
                        "instrumentalGatewayUrl": "https://..."
                    },
                    ...
                ],
                "timing": {...},
                "cost": {"fal_api": 0.20, "savings_vs_segment_based": 0.80}
            }
        """
        import requests
        import subprocess
        import numpy as np
        import soundfile as sf

        print(f"[SONG-BASED] Processing genius_id: {genius_id}")
        print(f"[SONG-BASED] Full duration: {full_duration}s, Segments: {len(segments)}")

        pipeline_start = time_module.time()

        with tempfile.TemporaryDirectory() as tmp_dir:
            # Step 1: Download full audio
            print("[1/6] Downloading full audio from maid.zone...")
            download_start = time_module.time()

            audio_resp = requests.get(audio_url, timeout=120)
            audio_resp.raise_for_status()

            full_audio_path = os.path.join(tmp_dir, "full_audio.mp3")
            with open(full_audio_path, 'wb') as f:
                f.write(audio_resp.content)

            download_time = time_module.time() - download_start
            file_size_mb = len(audio_resp.content) / (1024 * 1024)
            print(f"✓ Downloaded {file_size_mb:.2f}MB in {download_time:.1f}s")

            # Step 2: Trim to 190s if needed (fal.ai limit)
            process_duration = min(full_duration, 190.0)
            trimmed_audio = os.path.join(tmp_dir, "trimmed.mp3")

            if full_duration > 190:
                print(f"[2/6] Trimming to 190s (fal.ai limit)...")
                trim_start = time_module.time()

                subprocess.run([
                    'ffmpeg', '-i', full_audio_path,
                    '-t', str(process_duration),
                    '-c', 'copy', '-y', trimmed_audio
                ], check=True, capture_output=True)

                trim_time = time_module.time() - trim_start
                print(f"✓ Trimmed to 190s in {trim_time:.1f}s")
            else:
                print(f"[2/6] Song <190s, no trimming needed")
                trimmed_audio = full_audio_path
                trim_time = 0.0

            # Step 3: Demucs separation (full song, mdx_extra, MP3 output)
            print("[3/6] Demucs separation (full song, mdx_extra)...")
            demucs_start = time_module.time()

            stems_dir = os.path.join(tmp_dir, "stems")
            os.makedirs(stems_dir, exist_ok=True)

            # Run Demucs CLI with two-stems mode for vocals + instrumental (no_vocals)
            # Output will be: separated/mdx_extra/trimmed/vocals.mp3 and no_vocals.mp3
            subprocess.run([
                'python', '-m', 'demucs',
                '--two-stems=vocals',  # Karaoke mode: vocals + instrumental
                '-n', 'mdx_extra',     # Best quality model (MDX challenge 2nd place)
                '--mp3',               # Output as MP3 (faster Grove uploads)
                '--mp3-bitrate', str(mp3_bitrate),
                '--mp3-preset', '2',   # Highest quality MP3 encoding
                '-o', stems_dir,       # Output directory
                trimmed_audio
            ], check=True, capture_output=True)

            demucs_time = time_module.time() - demucs_start
            print(f"✓ Demucs complete in {demucs_time:.1f}s")

            # Locate output files (Demucs outputs to: {output_dir}/{model}/{track}/)
            track_name = os.path.splitext(os.path.basename(trimmed_audio))[0]
            demucs_output_dir = os.path.join(stems_dir, "mdx_extra", track_name)

            vocals_full_mp3 = os.path.join(demucs_output_dir, "vocals.mp3")
            instrumental_full_mp3 = os.path.join(demucs_output_dir, "no_vocals.mp3")

            if not os.path.exists(vocals_full_mp3) or not os.path.exists(instrumental_full_mp3):
                raise FileNotFoundError(f"Demucs output not found in {demucs_output_dir}")

            # Step 4: Upload full instrumental to Grove for fal.ai
            print("[4/6] Uploading instrumental to Grove for fal.ai...")
            upload_start = time_module.time()

            # Upload to Grove (MP3 format for fal.ai)
            with open(instrumental_full_mp3, 'rb') as f:
                inst_grove_resp = requests.post(
                    f"https://api.grove.storage/?chain_id={chain_id}",
                    data=f.read(),
                    headers={'Content-Type': 'audio/mp3'}
                )
            inst_grove_resp.raise_for_status()
            inst_grove = inst_grove_resp.json()[0]
            inst_url = inst_grove['gateway_url']  # Use gateway URL for fal.ai
            inst_cid = inst_grove['uri'].replace('lens://', '')  # Extract CID from URI

            upload_time = time_module.time() - upload_start
            print(f"✓ Uploaded to Grove: {inst_cid} in {upload_time:.1f}s")

            # Step 5: fal.ai enhancement (FULL 190s instrumental) - $0.20 ONCE
            print(f"[5/6] fal.ai instrumental enhancement (strength={fal_strength}, {process_duration:.0f}s)...")
            fal_start = time_module.time()

            # Call fal.ai API (Modal secret exposes as FAL_KEY)
            fal_key = os.environ.get('FAL_KEY')
            print(f"✓ fal.ai key loaded: {fal_key[:10]}..." if fal_key else "❌ FAL_KEY not found")
            if not fal_key:
                raise ValueError("FAL_KEY environment variable not set")

            # Submit request to fal.ai
            fal_submit_resp = requests.post(
                'https://queue.fal.run/fal-ai/stable-audio-25/audio-to-audio',
                headers={
                    'Authorization': f'Key {fal_key}',
                    'Content-Type': 'application/json'
                },
                json={
                    'prompt': 'instrumental',  # User specified: must be "instrumental", not empty
                    'audio_url': inst_url,
                    'strength': fal_strength,  # 0.3 default
                    'num_inference_steps': 8,
                    'guidance_scale': 1
                }
            )
            fal_submit_resp.raise_for_status()
            request_id = fal_submit_resp.json()['request_id']

            # Poll for completion
            import time as time_module2
            max_attempts = 60
            for attempt in range(max_attempts):
                time_module2.sleep(2)
                status_resp = requests.get(
                    f'https://queue.fal.run/fal-ai/stable-audio-25/requests/{request_id}/status',
                    headers={'Authorization': f'Key {fal_key}'}
                )
                status_resp.raise_for_status()
                status = status_resp.json()['status']

                if status == 'COMPLETED':
                    result_resp = requests.get(
                        f'https://queue.fal.run/fal-ai/stable-audio-25/requests/{request_id}',
                        headers={'Authorization': f'Key {fal_key}'}
                    )
                    result_resp.raise_for_status()
                    enhanced_url = result_resp.json()['audio']['url']

                    # Download enhanced audio
                    enhanced_resp = requests.get(enhanced_url)
                    enhanced_resp.raise_for_status()

                    enhanced_inst_path = os.path.join(stems_dir, "instrumental_enhanced.mp3")
                    with open(enhanced_inst_path, 'wb') as f:
                        f.write(enhanced_resp.content)
                    break
                elif status == 'FAILED':
                    raise Exception(f"fal.ai processing failed")
            else:
                raise Exception(f"fal.ai processing timeout after {max_attempts * 2}s")

            fal_time = time_module.time() - fal_start
            print(f"✓ fal.ai complete in {fal_time:.1f}s")

            # Step 6: Filter and extract segments (skip incomplete ones past 190s)
            print(f"[6/6] Extracting segments...")
            extract_start = time_module.time()

            # Filter to only complete segments AFTER fal.ai processing
            valid_segments = [s for s in segments if s['endTime'] <= process_duration]
            skipped_count = len(segments) - len(valid_segments)

            if skipped_count > 0:
                print(f"⚠️  Skipping {skipped_count} incomplete segment(s) past {process_duration:.0f}s cutoff:")
                for s in segments:
                    if s['endTime'] > process_duration:
                        print(f"   - {s['id']}: {s['startTime']:.1f}s - {s['endTime']:.1f}s")

            print(f"Processing {len(valid_segments)}/{len(segments)} complete segments...")

            segment_results = []
            for seg in valid_segments:
                seg_id = seg['id']
                start_time = seg['startTime']
                end_time = seg['endTime']
                seg_duration = end_time - start_time

                print(f"  Extracting {seg_id}: {start_time:.1f}s - {end_time:.1f}s ({seg_duration:.1f}s)")

                # Extract segment from vocals (original Demucs output)
                seg_vocals_mp3 = os.path.join(tmp_dir, f"{seg_id}_vocals.mp3")
                subprocess.run([
                    'ffmpeg', '-i', vocals_full_mp3,
                    '-ss', str(start_time),
                    '-t', str(seg_duration),
                    '-b:a', f'{mp3_bitrate}k',
                    '-y', seg_vocals_mp3
                ], check=True, capture_output=True)

                # Extract segment from enhanced instrumental (fal.ai output)
                seg_inst_mp3 = os.path.join(tmp_dir, f"{seg_id}_instrumental.mp3")
                subprocess.run([
                    'ffmpeg', '-i', enhanced_inst_path,
                    '-ss', str(start_time),
                    '-t', str(seg_duration),
                    '-b:a', f'{mp3_bitrate}k',
                    '-y', seg_inst_mp3
                ], check=True, capture_output=True)

                # Upload to Grove
                with open(seg_vocals_mp3, 'rb') as f:
                    vocals_grove_resp = requests.post(
                        f"https://api.grove.storage/?chain_id={chain_id}",
                        data=f.read(),
                        headers={'Content-Type': 'audio/mp3'}
                    )
                vocals_grove_resp.raise_for_status()
                vocals_grove = vocals_grove_resp.json()[0]

                with open(seg_inst_mp3, 'rb') as f:
                    inst_grove_resp = requests.post(
                        f"https://api.grove.storage/?chain_id={chain_id}",
                        data=f.read(),
                        headers={'Content-Type': 'audio/mp3'}
                    )
                inst_grove_resp.raise_for_status()
                inst_grove = inst_grove_resp.json()[0]

                segment_results.append({
                    'segmentId': seg_id,
                    'vocalsUri': vocals_grove['uri'],
                    'instrumentalUri': inst_grove['uri'],
                    'startTime': start_time,
                    'endTime': end_time,
                    'duration': seg_duration,
                    'vocalsGatewayUrl': vocals_grove['gateway_url'],
                    'instrumentalGatewayUrl': inst_grove['gateway_url']
                })

            extract_time = time_module.time() - extract_start
            total_time = time_module.time() - pipeline_start

            print(f"✓ All segments extracted and uploaded in {extract_time:.1f}s")
            print(f"✓ Total pipeline: {total_time:.1f}s")

            return {
                "success": True,
                "geniusId": genius_id,
                "segments": segment_results,
                "timing": {
                    "download": download_time,
                    "trim": trim_time,
                    "demucs": demucs_time,
                    "grove_upload": upload_time,
                    "fal_enhancement": fal_time,
                    "segment_extraction": extract_time,
                    "total": total_time
                },
                "metadata": {
                    "audio_url": audio_url,
                    "full_duration": full_duration,
                    "processed_duration": process_duration,
                    "segment_count": len(segments),
                    "valid_segment_count": len(valid_segments),
                    "chain_id": chain_id,
                    "model": "mdx_extra"
                },
                "cost": {
                    "fal_api": 0.20,
                    "savings_vs_segment_based": 0.20 * (len(segments) - 1)
                }
            }

    @modal.method()
    def process_song_and_webhook(
        self,
        job_id: str,
        user_address: str,
        genius_id: int,
        audio_url: str,
        full_duration: float,
        segments: List[dict],
        chain_id: int,
        mp3_bitrate: int,
        fal_strength: float,
        webhook_url: str
    ) -> dict:
        """
        Process song and call webhook - designed for .spawn() async execution.
        """
        import requests
        import sys

        try:
            print(f"[Job {job_id}] 🚀 Starting async song processing (Demucs mdx_extra)...", flush=True)
            sys.stdout.flush()

            # Call the main processing function (.local() for same container execution)
            result = self.process_song_with_segments.local(
                genius_id=genius_id,
                audio_url=audio_url,
                full_duration=full_duration,
                segments=segments,
                chain_id=chain_id,
                mp3_bitrate=mp3_bitrate,
                fal_strength=fal_strength
            )

            print(f"[Job {job_id}] ✅ Processing complete! {len(result['segments'])} segments", flush=True)
            sys.stdout.flush()

            # Call webhook
            print(f"[Job {job_id}] 📞 Calling webhook: {webhook_url}", flush=True)
            sys.stdout.flush()

            webhook_payload = {
                "job_id": job_id,
                "user_address": user_address,
                "genius_id": genius_id,
                "segments": result["segments"],
                "status": "complete",
                "timing": result["timing"],
                "cost": result["cost"]
            }

            webhook_resp = requests.post(webhook_url, json=webhook_payload, timeout=120)
            webhook_resp.raise_for_status()

            print(f"[Job {job_id}] ✅ Webhook called: HTTP {webhook_resp.status_code}", flush=True)
            sys.stdout.flush()

            return {"success": True, "segments": len(result["segments"])}

        except Exception as e:
            import traceback
            error_details = traceback.format_exc()
            print(f"[Job {job_id}] ❌ Failed: {str(e)}", flush=True)
            print(f"[Job {job_id}] Traceback:\n{error_details}", flush=True)
            sys.stdout.flush()

            # Try to notify webhook of failure
            try:
                requests.post(webhook_url, json={"job_id": job_id, "status": "failed", "error": str(e)}, timeout=30)
            except:
                pass

            raise

    @modal.method()
    def separate_simple(
        self,
        audio_base64: str,
        model: str = "mdx_extra",
        output_format: str = "mp3",
        mp3_bitrate: int = 192
    ) -> dict:
        """
        Simple Demucs separation (sync) - for testing/simple use cases

        Args:
            audio_base64: Base64-encoded audio (supports data URI)
            model: Demucs model
            output_format: mp3, wav, or flac
            mp3_bitrate: MP3 bitrate in kbps

        Returns:
            {vocals_base64, instrumental_base64, duration}
        """
        import base64
        import subprocess
        import tempfile
        import os
        import time as time_module
        import sys

        print(f"[SimpleDemucs] ===== METHOD ENTRY ===== {time_module.time()}", flush=True)
        sys.stdout.flush()
        print(f"[SimpleDemucs] Starting separation (model: {model}, GPU: H200)", flush=True)
        print(f"[SimpleDemucs] Input base64 length: {len(audio_base64)}", flush=True)
        sys.stdout.flush()
        start_time = time_module.time()

        with tempfile.TemporaryDirectory() as tmp_dir:
            # Decode base64
            print(f"[SimpleDemucs] Decoding base64...", flush=True)
            sys.stdout.flush()
            decode_start = time_module.time()

            if audio_base64.startswith('data:'):
                audio_base64 = audio_base64.split(',')[1]
            audio_data = base64.b64decode(audio_base64)

            print(f"[SimpleDemucs] Decode took {time_module.time() - decode_start:.2f}s", flush=True)
            sys.stdout.flush()

            input_path = os.path.join(tmp_dir, "input.mp3")
            with open(input_path, 'wb') as f:
                f.write(audio_data)

            print(f"[SimpleDemucs] Input: {len(audio_data) / 1024 / 1024:.2f}MB, saved to {input_path}", flush=True)
            sys.stdout.flush()

            # Run Demucs
            stems_dir = os.path.join(tmp_dir, "stems")
            os.makedirs(stems_dir, exist_ok=True)

            cmd = [
                'python', '-m', 'demucs',
                '--two-stems=vocals',
                '-n', model,
                '--device', 'cuda',
            ]

            if output_format == 'mp3':
                cmd.extend(['--mp3', '--mp3-bitrate', str(mp3_bitrate), '--mp3-preset', '2'])
            elif output_format == 'flac':
                cmd.append('--flac')

            cmd.extend(['-o', stems_dir, input_path])

            print(f"[SimpleDemucs] Running Demucs command: {' '.join(cmd[:10])}...", flush=True)
            sys.stdout.flush()
            demucs_start = time_module.time()

            subprocess.run(cmd, check=True, capture_output=True)

            demucs_duration = time_module.time() - demucs_start
            print(f"[SimpleDemucs] Demucs completed in {demucs_duration:.2f}s", flush=True)
            sys.stdout.flush()

            # Read outputs
            track_name = "input"
            output_dir = os.path.join(stems_dir, model, track_name)
            ext = output_format

            vocals_path = os.path.join(output_dir, f"vocals.{ext}")
            instrumental_path = os.path.join(output_dir, f"no_vocals.{ext}")

            with open(vocals_path, 'rb') as f:
                vocals_b64 = base64.b64encode(f.read()).decode('utf-8')

            with open(instrumental_path, 'rb') as f:
                instrumental_b64 = base64.b64encode(f.read()).decode('utf-8')

            duration = time_module.time() - start_time
            print(f"[SimpleDemucs] ✓ Complete in {duration:.1f}s", flush=True)
            print(f"[SimpleDemucs] Returning result (vocals: {len(vocals_b64)} chars, instrumental: {len(instrumental_b64)} chars)", flush=True)
            sys.stdout.flush()

            result = {
                "vocals_base64": vocals_b64,
                "instrumental_base64": instrumental_b64,
                "model": model,
                "format": output_format,
                "duration": duration
            }

            print(f"[SimpleDemucs] ===== METHOD EXIT ===== {time_module.time()}", flush=True)
            sys.stdout.flush()
            return result

# FastAPI web server for async endpoints
@app.function(
    image=demucs_image,
    gpu="H200",  # GPU-enabled FastAPI endpoint
    timeout=90,
)
@modal.asgi_app()
def fastapi_app():
    from fastapi import FastAPI, HTTPException, Form, Request
    from fastapi.responses import JSONResponse

    web_app = FastAPI(title="Demucs Karaoke API")

    @web_app.get("/")
    async def root():
        return {
            "service": "Demucs Karaoke API",
            "model": "mdx_extra (Hybrid Transformer Demucs)",
            "gpu": "H100",
            "endpoints": {
                "/separate": "POST - Simple Demucs separation (sync)",
                "/process-song-async": "POST - Song-based karaoke processing ($0.20/song)",
                "/job/{job_id}": "GET - Check job status",
                "/health": "GET - Health check"
            }
        }

    @web_app.get("/health")
    async def health():
        return {"status": "healthy", "model": "mdx_extra", "gpu": "H100"}

    @web_app.post("/separate")
    async def separate_endpoint(request: Request):
        """
        Simple synchronous Demucs separation endpoint (runs directly on GPU)

        Request body (JSON):
            {
                "audio_base64": "...",
                "model": "mdx_extra",
                "output_format": "mp3",
                "mp3_bitrate": 192
            }

        Returns:
            {vocals_base64, instrumental_base64, duration}
        """
        import base64
        import subprocess
        import tempfile
        import os
        import time as time_module
        import sys

        try:
            req_start = time_module.time()
            print(f"[/separate] Request received at {time_module.time()}", flush=True)
            sys.stdout.flush()

            body = await request.json()
            print(f"[/separate] JSON parsed in {time_module.time() - req_start:.2f}s", flush=True)
            sys.stdout.flush()

            audio_base64 = body.get("audio_base64")
            model = body.get("model", "mdx_extra")
            output_format = body.get("output_format", "mp3")
            mp3_bitrate = body.get("mp3_bitrate", 192)

            print(f"[/separate] Starting Demucs separation (GPU: H200)...", flush=True)
            sys.stdout.flush()

            with tempfile.TemporaryDirectory() as tmp_dir:
                # Decode base64
                if audio_base64.startswith('data:'):
                    audio_base64 = audio_base64.split(',')[1]
                audio_data = base64.b64decode(audio_base64)

                input_path = os.path.join(tmp_dir, "input.mp3")
                with open(input_path, 'wb') as f:
                    f.write(audio_data)

                print(f"[/separate] Input: {len(audio_data) / 1024 / 1024:.2f}MB", flush=True)
                sys.stdout.flush()

                # Run Demucs
                stems_dir = os.path.join(tmp_dir, "stems")
                os.makedirs(stems_dir, exist_ok=True)

                cmd = [
                    'python', '-m', 'demucs',
                    '--two-stems=vocals',
                    '-n', model,
                    '--device', 'cuda',
                ]

                if output_format == 'mp3':
                    cmd.extend(['--mp3', '--mp3-bitrate', str(mp3_bitrate), '--mp3-preset', '2'])
                elif output_format == 'flac':
                    cmd.append('--flac')

                cmd.extend(['-o', stems_dir, input_path])

                print(f"[/separate] Running Demucs...", flush=True)
                sys.stdout.flush()
                demucs_start = time_module.time()

                subprocess.run(cmd, check=True, capture_output=True)

                demucs_duration = time_module.time() - demucs_start
                print(f"[/separate] Demucs completed in {demucs_duration:.2f}s", flush=True)
                sys.stdout.flush()

                # Read outputs
                track_name = "input"
                output_dir = os.path.join(stems_dir, model, track_name)
                ext = output_format

                vocals_path = os.path.join(output_dir, f"vocals.{ext}")
                instrumental_path = os.path.join(output_dir, f"no_vocals.{ext}")

                with open(vocals_path, 'rb') as f:
                    vocals_data = f.read()
                    vocals_b64 = base64.b64encode(vocals_data).decode('utf-8')
                    vocals_size = len(vocals_data)

                with open(instrumental_path, 'rb') as f:
                    instrumental_data = f.read()
                    instrumental_b64 = base64.b64encode(instrumental_data).decode('utf-8')
                    instrumental_size = len(instrumental_data)

                duration = time_module.time() - req_start
                print(f"[/separate] ✓ Complete in {duration:.1f}s", flush=True)
                print(f"[/separate] Vocals: {vocals_size / 1024 / 1024:.2f}MB, Instrumental: {instrumental_size / 1024 / 1024:.2f}MB", flush=True)
                sys.stdout.flush()

                return {
                    "vocals_base64": vocals_b64,
                    "instrumental_base64": instrumental_b64,
                    "vocals_size": vocals_size,
                    "instrumental_size": instrumental_size,
                    "model": model,
                    "format": output_format,
                    "duration": duration
                }

        except Exception as e:
            import traceback
            print(f"[/separate] Error: {str(e)}", flush=True)
            print(traceback.format_exc(), flush=True)
            sys.stdout.flush()
            raise HTTPException(500, f"Separation failed: {str(e)}")

    @web_app.post("/process-song-async")
    async def process_song_async_endpoint(
        job_id: str = Form(...),
        user_address: str = Form(...),
        genius_id: int = Form(...),
        audio_url: str = Form(...),
        full_duration: float = Form(...),
        segments_json: str = Form(...),
        chain_id: int = Form(37111),
        mp3_bitrate: int = Form(192),
        fal_strength: float = Form(0.3),
        webhook_url: str = Form(...)
    ):
        """
        Start async SONG-BASED processing (OPTIMIZED). Returns immediately with jobId.

        Flow:
        1. Create job entry (status: processing)
        2. Process ENTIRE SONG in background (single fal.ai call)
        3. Cut stems into segments using FFmpeg
        4. Upload all segments to Grove
        5. Call webhook with ALL segment URIs
        6. Webhook triggers Lit Action 2 → batch contract update

        **Parameters:**
        - `job_id`: Unique job identifier
        - `user_address`: User's wallet address
        - `genius_id`: Genius song ID
        - `audio_url`: SoundCloud URL
        - `full_duration`: Total song duration in seconds
        - `segments_json`: JSON array of segments [{id, startTime, endTime}, ...]
        - `chain_id`: Grove chain ID
        - `mp3_bitrate`: MP3 bitrate
        - `fal_strength`: fal.ai transformation strength (0.3 recommended)
        - `webhook_url`: Webhook server URL to call when complete

        **Returns:**
        - job_id
        - status: "processing"
        - segment_count: Number of segments being processed

        **Cost:** $0.20 (single fal.ai call) vs $1.00 (5 segments × $0.20)
        """
        try:
            import time as time_module
            import json

            # Parse segments
            segments = json.loads(segments_json)

            # Create job entry
            job_data = {
                "job_id": job_id,
                "user_address": user_address,
                "genius_id": genius_id,
                "audio_url": audio_url,
                "full_duration": full_duration,
                "segments": segments,
                "status": "processing",
                "segment_count": len(segments),
                "created_at": str(time_module.time())
            }
            job_storage[job_id] = job_data

            # Spawn async processing using Modal's .spawn() (returns immediately)
            separator = DemucsSeparator()
            separator.process_song_and_webhook.spawn(
                job_id=job_id,
                user_address=user_address,
                genius_id=genius_id,
                audio_url=audio_url,
                full_duration=full_duration,
                segments=segments,
                chain_id=chain_id,
                mp3_bitrate=mp3_bitrate,
                fal_strength=fal_strength,
                webhook_url=webhook_url
            )

            print(f"[API] Spawned async job {job_id} for genius_id={genius_id} (Demucs mdx_extra)")

            return {
                "success": True,
                "job_id": job_id,
                "status": "processing",
                "segment_count": len(segments),
                "message": f"Processing full song with {len(segments)} segments. Single fal.ai call (Demucs mdx_extra)."
            }

        except Exception as e:
            import traceback
            error_details = traceback.format_exc()
            print(f"API Error: {str(e)}")
            print(f"Full traceback:\n{error_details}")
            raise HTTPException(500, f"Song processing failed: {str(e)}")

    @web_app.get("/job/{job_id}")
    async def get_job_status(job_id: str):
        """
        Get job status and results.

        Returns job data including Grove URIs when complete.
        """
        try:
            job_data = job_storage.get(job_id)
            if not job_data:
                raise HTTPException(404, f"Job {job_id} not found")

            return job_data

        except HTTPException:
            raise
        except Exception as e:
            print(f"Error fetching job {job_id}: {str(e)}")
            raise HTTPException(500, f"Failed to fetch job: {str(e)}")

    return web_app
