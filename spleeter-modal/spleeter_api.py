"""
Optimized Spleeter API on Modal.com
====================================
Scalable HTTP API for vocal/instrumental separation using Spleeter 2stems model.

Features:
- Pre-cached Spleeter model in container image (fast cold starts)
- GPU acceleration (B200)
- Model loaded once on container warmup
- 2x faster than Demucs for vocals/instrumental separation
- Accompaniment (instrumental) enhancement with Replicate Stable Audio 2.5
"""

import io
import zipfile
import tempfile
import os
import time as time_module
from typing import Optional, List
import modal

# Define the image with Spleeter pre-installed and models cached
spleeter_image = (
    modal.Image.debian_slim(python_version="3.10")  # Python 3.10 for TensorFlow 2.9 compatibility
    .apt_install("ffmpeg", "libsndfile1")  # FFmpeg for audio processing + libsndfile for soundfile
    .uv_pip_install(
        "numpy<2",  # Pin numpy<2 for TensorFlow 2.9 compatibility
        "spleeter==2.4.0",  # Spleeter (will install compatible TensorFlow <2.10)
        "soundfile",  # Python wrapper for libsndfile
        "fastapi",
        "python-multipart",
        "requests",  # For downloading audio from maid.zone
        gpu="B200"  # B200-aware installation
    )
    # Pre-download 2stems model to reduce cold start time
    .run_commands(
        "python -c 'from spleeter.separator import Separator; Separator(\"spleeter:2stems\")'"
    )
    # Verify ffmpeg is installed
    .run_commands(
        "ffmpeg -version && ffprobe -version"
    )
)

app = modal.App("spleeter-karaoke")

# Persistent job storage using Modal Dict
job_storage = modal.Dict.from_name("karaoke-jobs", create_if_missing=True)

@app.cls(
    gpu="B200",  # B200 GPU - faster than T4, needed for 30s Lit Action timeout
    image=spleeter_image,
    scaledown_window=60,  # 1 min idle before scale-down
    timeout=600,  # 10 min max per request
    secrets=[modal.Secret.from_name("replicate-api-token")],  # Inject Replicate API token
    # Uncomment for production with always-warm container:
    # allow_concurrent_inputs=10,
    # keep_warm=1,  # Always 1 warm container (adds idle cost but eliminates cold starts)
)
class SpleeterSeparator:
    """
    Stateful Spleeter model wrapper that loads the model once on container warmup.
    """

    @modal.enter()
    def load_model(self):
        """Load model during container warmup (runs once per container)"""
        from spleeter.separator import Separator

        print("Loading Spleeter 2stems model...")
        self.separator = Separator('spleeter:2stems')

        # Disable multi-channel Wiener filtering for faster processing
        self.separator._params['MWF'] = False

        print("Model ready for inference")

    @modal.method()
    def separate_audio(
        self,
        audio_data: bytes,
        filename: str,
        mp3: bool = True,
        mp3_bitrate: int = 192,
    ) -> bytes:
        """
        Separate audio into vocals and accompaniment (instrumental).

        Args:
            audio_data: Raw audio file bytes
            filename: Original filename
            mp3: Save as MP3 instead of WAV (default: True for smaller files)
            mp3_bitrate: MP3 bitrate in kbps (default: 192, range: 128-320)

        Returns:
            ZIP file bytes containing vocals.mp3 and accompaniment.mp3
        """
        import numpy as np
        import soundfile as sf
        import subprocess

        with tempfile.TemporaryDirectory() as tmp_dir:
            # Save uploaded audio to temp file
            input_path = os.path.join(tmp_dir, filename)
            with open(input_path, "wb") as f:
                f.write(audio_data)

            try:
                # Load audio
                print(f"Loading audio: {filename}")
                waveform, sample_rate = sf.read(input_path)

                # Ensure stereo if mono
                if waveform.ndim == 1:
                    waveform = np.stack([waveform, waveform], axis=1)

                # Run separation
                print("Separating vocals and accompaniment...")
                separation = self.separator.separate(waveform)

                # Extract stems
                vocals = separation['vocals']
                accompaniment = separation['accompaniment']

                # Save stems
                output_dir = os.path.join(tmp_dir, "separated")
                os.makedirs(output_dir, exist_ok=True)

                # Save as WAV first
                vocals_wav = os.path.join(output_dir, "vocals.wav")
                accompaniment_wav = os.path.join(output_dir, "accompaniment.wav")

                sf.write(vocals_wav, vocals, sample_rate)
                sf.write(accompaniment_wav, accompaniment, sample_rate)

                # Convert to MP3 if requested
                if mp3:
                    print(f"Converting to MP3 at {mp3_bitrate}kbps...")
                    for wav_file in [vocals_wav, accompaniment_wav]:
                        mp3_file = wav_file.replace('.wav', '.mp3')
                        subprocess.run([
                            'ffmpeg', '-i', wav_file, '-b:a', f'{mp3_bitrate}k',
                            '-y', mp3_file
                        ], check=True, capture_output=True)
                        os.remove(wav_file)  # Remove WAV after conversion

                # Create ZIP file
                print("Creating ZIP archive...")
                zip_buffer = io.BytesIO()
                with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
                    for stem_file in os.listdir(output_dir):
                        stem_path = os.path.join(output_dir, stem_file)
                        zip_file.write(stem_path, stem_file)

                print(f"Separation complete. ZIP size: {len(zip_buffer.getvalue()) / 1024 / 1024:.2f} MB")
                return zip_buffer.getvalue()

            except Exception as e:
                import traceback
                print(f"Error during separation: {e}")
                print(f"Full traceback:")
                traceback.print_exc()
                raise

    @modal.method()
    def process_karaoke_section(
        self,
        audio_url: str,
        start_time: float,
        duration: float,
        mp3: bool = True,
        mp3_bitrate: int = 192,
    ) -> dict:
        """
        All-in-one karaoke processing: download from maid.zone → trim → separate stems.

        Eliminates network hops by doing everything in one Modal GPU session.

        Args:
            audio_url: URL to audio file (e.g., https://sc.maid.zone/_/restream/...)
            start_time: Start time in seconds for trimming
            duration: Duration in seconds to trim
            mp3: Output as MP3 (True) or WAV (False)
            mp3_bitrate: MP3 bitrate in kbps

        Returns:
            dict with keys for each stem (e.g., {"vocals": bytes, "accompaniment": bytes})
            Each value is a ZIP file containing vocals.mp3 + accompaniment.mp3
        """
        import requests
        import subprocess
        import numpy as np
        import soundfile as sf

        print(f"[KARAOKE] Processing: {audio_url}")
        print(f"[KARAOKE] Trim: {start_time}s → {start_time + duration}s ({duration}s)")

        with tempfile.TemporaryDirectory() as tmp_dir:
            # Step 1: Download audio from maid.zone
            print("[1/3] Downloading audio from maid.zone...")
            download_start = __import__("time").time()

            resp = requests.get(audio_url, timeout=60)
            resp.raise_for_status()

            download_time = __import__("time").time() - download_start
            print(f"✓ Downloaded {len(resp.content) / 1024 / 1024:.2f}MB in {download_time:.1f}s")

            # Save to temp file
            input_path = os.path.join(tmp_dir, "input.mp3")
            with open(input_path, "wb") as f:
                f.write(resp.content)

            # Step 2: Trim with FFmpeg
            print(f"[2/3] Trimming audio (FFmpeg)...")
            trim_start = __import__("time").time()

            trimmed_path = os.path.join(tmp_dir, "trimmed.wav")
            subprocess.run([
                "ffmpeg", "-i", input_path,
                "-ss", str(start_time),
                "-t", str(duration),
                "-y",  # Overwrite output
                trimmed_path
            ], check=True, capture_output=True)

            trim_time = __import__("time").time() - trim_start
            trimmed_size = os.path.getsize(trimmed_path) / 1024 / 1024
            print(f"✓ Trimmed to {trimmed_size:.2f}MB in {trim_time:.1f}s")

            # Step 3: Separate stems with Spleeter
            print(f"[3/3] Separating stems with Spleeter...")
            sep_start = __import__("time").time()

            # Load trimmed audio
            waveform, sample_rate = sf.read(trimmed_path)

            # Ensure stereo
            if waveform.ndim == 1:
                waveform = np.stack([waveform, waveform], axis=1)

            # Run separation
            separation = self.separator.separate(waveform)

            # Save stems
            output_dir = os.path.join(tmp_dir, "stems")
            os.makedirs(output_dir, exist_ok=True)

            vocals_wav = os.path.join(output_dir, "vocals.wav")
            accompaniment_wav = os.path.join(output_dir, "accompaniment.wav")

            sf.write(vocals_wav, separation['vocals'], sample_rate)
            sf.write(accompaniment_wav, separation['accompaniment'], sample_rate)

            # Convert to MP3 if requested
            results = {}

            if mp3:
                vocals_mp3 = os.path.join(output_dir, "vocals.mp3")
                accompaniment_mp3 = os.path.join(output_dir, "accompaniment.mp3")

                for wav_file, mp3_file in [(vocals_wav, vocals_mp3), (accompaniment_wav, accompaniment_mp3)]:
                    subprocess.run([
                        'ffmpeg', '-i', wav_file, '-b:a', f'{mp3_bitrate}k',
                        '-y', mp3_file
                    ], check=True, capture_output=True)

                # Create separate ZIPs for vocals and accompaniment
                for stem_name, mp3_file in [("vocals", vocals_mp3), ("accompaniment", accompaniment_mp3)]:
                    zip_buffer = io.BytesIO()
                    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
                        zip_file.write(mp3_file, os.path.basename(mp3_file))
                    results[stem_name] = zip_buffer.getvalue()
                    print(f"✓ {stem_name}: {len(results[stem_name]) / 1024 / 1024:.2f}MB")

            sep_time = __import__("time").time() - sep_start
            total_time = download_time + trim_time + sep_time

            print(f"[KARAOKE] Complete in {total_time:.1f}s (download: {download_time:.1f}s, trim: {trim_time:.1f}s, stems: {sep_time:.1f}s)")

            return {
                "stems": results,
                "timing": {
                    "download": download_time,
                    "trim": trim_time,
                    "separation": sep_time,
                    "total": total_time
                },
                "metadata": {
                    "audio_url": audio_url,
                    "start_time": start_time,
                    "duration": duration
                }
            }

    @modal.method()
    def process_karaoke_with_grove(
        self,
        audio_url: str,
        start_time: float,
        duration: float,
        chain_id: int = 37111,  # Lens testnet
        mp3_bitrate: int = 192,
        strength: float = 0.4,  # Replicate strength: 0=identical, 0.4=light transform, 1=full transform
    ) -> dict:
        """
        Complete karaoke processing pipeline with Replicate enhancement and Grove upload.

        Flow:
        1. Download audio from maid.zone
        2. Trim to segment
        3. Spleeter stem separation (vocals + accompaniment)
        4. Replicate accompaniment (instrumental) enhancement (Stable Audio 2.5)
        5. Upload to Grove (vocals + enhanced-accompaniment)
        6. Return Grove URIs

        Args:
            audio_url: URL to audio file
            start_time: Start time in seconds
            duration: Duration in seconds
            chain_id: Chain ID for Grove (37111=testnet, 7579=mainnet)
            mp3_bitrate: MP3 bitrate in kbps
            strength: Replicate strength (0=keep original, 0.4=light transform, 1=full transform)

        Returns:
            dict with Grove URIs and timing data
        """
        import requests
        import subprocess
        import numpy as np
        import soundfile as sf
        import time as time_module

        print(f"[KARAOKE-GROVE] Processing: {audio_url}")
        print(f"[KARAOKE-GROVE] Trim: {start_time}s → {start_time + duration}s ({duration}s)")

        with tempfile.TemporaryDirectory() as tmp_dir:
            # Step 1: Download + Trim + Spleeter
            print("[1/5] Download + Trim + Spleeter...")
            pipeline_start = time_module.time()

            # Download
            resp = requests.get(audio_url, timeout=60)
            resp.raise_for_status()
            input_path = os.path.join(tmp_dir, "input.mp3")
            with open(input_path, "wb") as f:
                f.write(resp.content)

            # Trim
            trimmed_path = os.path.join(tmp_dir, "trimmed.wav")
            subprocess.run([
                "ffmpeg", "-i", input_path,
                "-ss", str(start_time),
                "-t", str(duration),
                "-y", trimmed_path
            ], check=True, capture_output=True)

            # Spleeter separation
            waveform, sample_rate = sf.read(trimmed_path)
            if waveform.ndim == 1:
                waveform = np.stack([waveform, waveform], axis=1)

            separation = self.separator.separate(waveform)

            vocals = separation['vocals']
            accompaniment = separation['accompaniment']

            # Save stems as MP3
            output_dir = os.path.join(tmp_dir, "stems")
            os.makedirs(output_dir, exist_ok=True)

            vocals_wav = os.path.join(output_dir, "vocals.wav")
            accompaniment_wav = os.path.join(output_dir, "accompaniment.wav")

            sf.write(vocals_wav, vocals, sample_rate)
            sf.write(accompaniment_wav, accompaniment, sample_rate)

            # Convert to MP3
            vocals_mp3 = os.path.join(output_dir, "vocals.mp3")
            accompaniment_mp3 = os.path.join(output_dir, "accompaniment.mp3")

            for wav_file, mp3_file in [(vocals_wav, vocals_mp3), (accompaniment_wav, accompaniment_mp3)]:
                subprocess.run([
                    'ffmpeg', '-i', wav_file, '-b:a', f'{mp3_bitrate}k',
                    '-y', mp3_file
                ], check=True, capture_output=True)

            spleeter_time = time_module.time() - pipeline_start
            print(f"✓ Spleeter complete in {spleeter_time:.1f}s")

            # Step 2: Replicate accompaniment (instrumental) enhancement
            print("[2/5] Replicate accompaniment enhancement...")
            replicate_start = time_module.time()

            # Get Replicate API token from environment (injected by Modal Secret)
            replicate_token = os.environ.get("REPLICATE_KEY")
            if not replicate_token:
                raise Exception("REPLICATE_KEY not found in environment. Create Modal secret: modal secret create replicate-api-token REPLICATE_KEY=your_token")

            # Read accompaniment MP3
            with open(accompaniment_mp3, 'rb') as f:
                accompaniment_bytes = f.read()

            # Convert to base64 data URI for Replicate
            import base64
            accompaniment_base64 = base64.b64encode(accompaniment_bytes).decode('utf-8')

            # Call Replicate Stable Audio 2.5 with synchronous response
            # Note: strength parameter controls how much to transform (0=keep original, 1=fully transform)
            # cfg_scale controls prompt adherence (guidance scale)
            replicate_resp = requests.post(
                'https://api.replicate.com/v1/models/stability-ai/stable-audio-2.5/predictions',
                headers={
                    'Authorization': f'Bearer {replicate_token}',
                    'Content-Type': 'application/json',
                    'Prefer': 'wait'  # Synchronous response (waits for completion)
                },
                json={
                    'input': {
                        'audio': f'data:audio/mp3;base64,{accompaniment_base64}',
                        'prompt': 'high quality instrumental, enhanced clarity, professional mixing, polished production',
                        'duration': int(duration),
                        'steps': 8,  # Quality steps (8 is good balance of speed/quality)
                        'cfg_scale': 3,  # Prompt adherence (fixed value, reasonable default)
                        'strength': strength  # Audio transformation amount (0=keep original, 0.4=light transform for karaoke)
                    }
                },
                timeout=120
            )

            if not replicate_resp.ok:
                raise Exception(f"Replicate error ({replicate_resp.status_code}): {replicate_resp.text}")

            replicate_result = replicate_resp.json()
            enhanced_accompaniment_url = replicate_result.get('output')
            if not enhanced_accompaniment_url:
                raise Exception("Replicate did not return enhanced accompaniment URL")

            # Download enhanced accompaniment
            enhanced_resp = requests.get(enhanced_accompaniment_url)
            enhanced_resp.raise_for_status()

            enhanced_accompaniment_path = os.path.join(output_dir, "accompaniment-enhanced.mp3")
            with open(enhanced_accompaniment_path, 'wb') as f:
                f.write(enhanced_resp.content)

            replicate_time = time_module.time() - replicate_start
            print(f"✓ Replicate complete in {replicate_time:.1f}s")

            # Step 3: Upload to Grove
            print("[3/5] Uploading to Grove...")
            grove_start = time_module.time()

            GROVE_API = "https://api.grove.storage/"

            # Upload vocals
            with open(vocals_mp3, 'rb') as f:
                vocals_grove_resp = requests.post(
                    f"{GROVE_API}?chain_id={chain_id}",
                    data=f.read(),
                    headers={'Content-Type': 'audio/mp3'}
                )
            vocals_grove_resp.raise_for_status()
            vocals_grove = vocals_grove_resp.json()[0]

            # Upload enhanced accompaniment
            with open(enhanced_accompaniment_path, 'rb') as f:
                accompaniment_grove_resp = requests.post(
                    f"{GROVE_API}?chain_id={chain_id}",
                    data=f.read(),
                    headers={'Content-Type': 'audio/mp3'}
                )
            accompaniment_grove_resp.raise_for_status()
            accompaniment_grove = accompaniment_grove_resp.json()[0]

            grove_time = time_module.time() - grove_start
            total_time = time_module.time() - pipeline_start

            print(f"✓ Grove upload complete in {grove_time:.1f}s")
            print(f"✓ Total pipeline: {total_time:.1f}s")

            return {
                "success": True,
                "grove_uris": {
                    "vocals": vocals_grove['uri'],
                    "accompaniment": accompaniment_grove['uri']
                },
                "gateway_urls": {
                    "vocals": vocals_grove['gateway_url'],
                    "accompaniment": accompaniment_grove['gateway_url']
                },
                "storage_keys": {
                    "vocals": vocals_grove['storage_key'],
                    "accompaniment": accompaniment_grove['storage_key']
                },
                "timing": {
                    "spleeter": spleeter_time,
                    "replicate": replicate_time,
                    "grove_upload": grove_time,
                    "total": total_time
                },
                "metadata": {
                    "audio_url": audio_url,
                    "start_time": start_time,
                    "duration": duration,
                    "chain_id": chain_id
                }
            }


# FastAPI web endpoint
@app.function(image=spleeter_image)
@modal.asgi_app()
def fastapi_app():
    """Create FastAPI app with HTTP endpoints"""
    from fastapi import FastAPI, File, Form, UploadFile, HTTPException, BackgroundTasks
    from fastapi.responses import StreamingResponse

    web_app = FastAPI(
        title="Spleeter Karaoke API",
        description="Separate vocals and instrumental using Spleeter 2stems model",
        version="1.0.0"
    )

    @web_app.get("/")
    def health_check():
        """Health check endpoint"""
        return {
            "status": "healthy",
            "model": "spleeter:2stems",
            "version": "2.4.0",
            "gpu": "B200"
        }

    @web_app.post("/separate")
    async def separate_endpoint(
        audio_file: UploadFile = File(..., description="Audio file to separate"),
        mp3: bool = Form(True, description="Output as MP3 (True) or WAV (False)"),
        mp3_bitrate: int = Form(192, description="MP3 bitrate in kbps", ge=128, le=320)
    ):
        """
        Separate audio into vocals and accompaniment (instrumental).

        **Parameters:**
        - `audio_file`: Audio file (MP3, WAV, FLAC, etc.)
        - `mp3`: Save as MP3 (True, default) or WAV (False)
        - `mp3_bitrate`: MP3 bitrate in kbps (default: 192, range: 128-320)

        **Returns:**
        ZIP file containing vocals.mp3 and accompaniment.mp3
        """
        if not audio_file.filename:
            raise HTTPException(400, "No file provided")

        # Read file
        audio_data = await audio_file.read()

        # Call the separator
        separator = SpleeterSeparator()
        try:
            zip_data = separator.separate_audio.remote(
                audio_data=audio_data,
                filename=audio_file.filename,
                mp3=mp3,
                mp3_bitrate=mp3_bitrate
            )

            return StreamingResponse(
                io.BytesIO(zip_data),
                media_type="application/zip",
                headers={
                    "Content-Disposition": f'attachment; filename="stems_{audio_file.filename}.zip"'
                }
            )
        except Exception as e:
            import traceback
            error_details = traceback.format_exc()
            print(f"API Error: {str(e)}")
            print(f"Full traceback:\n{error_details}")
            raise HTTPException(500, f"Separation failed: {str(e)}")

    @web_app.post("/process-karaoke")
    async def process_karaoke_endpoint(
        audio_url: str = Form(..., description="Audio URL (e.g., https://sc.maid.zone/_/restream/...)"),
        start_time: float = Form(..., description="Start time in seconds", ge=0),
        duration: float = Form(..., description="Duration in seconds", ge=0.1),
        mp3: bool = Form(True, description="Output as MP3 (True) or WAV (False)"),
        mp3_bitrate: int = Form(192, description="MP3 bitrate in kbps", ge=128, le=320)
    ):
        """
        All-in-one karaoke processing endpoint.

        Downloads audio from URL (e.g., maid.zone), trims to section, separates vocals/accompaniment.

        **Parameters:**
        - `audio_url`: URL to audio file
        - `start_time`: Start time in seconds for trimming
        - `duration`: Duration in seconds to trim
        - `mp3`: Save as MP3 (True) or WAV (False)
        - `mp3_bitrate`: MP3 bitrate in kbps

        **Returns:**
        JSON with base64-encoded ZIP files for vocals + accompaniment
        """
        separator = SpleeterSeparator()
        try:
            result = separator.process_karaoke_section.remote(
                audio_url=audio_url,
                start_time=start_time,
                duration=duration,
                mp3=mp3,
                mp3_bitrate=mp3_bitrate
            )

            # Encode ZIPs as base64 for JSON transport
            import base64
            stems_data = {}
            for stem, zip_bytes in result["stems"].items():
                stems_data[stem] = base64.b64encode(zip_bytes).decode("utf-8")

            return {
                "success": True,
                "stems": stems_data,
                "timing": result["timing"],
                "metadata": result["metadata"]
            }

        except Exception as e:
            import traceback
            error_details = traceback.format_exc()
            print(f"API Error: {str(e)}")
            print(f"Full traceback:\n{error_details}")
            raise HTTPException(500, f"Karaoke processing failed: {str(e)}")

    @web_app.post("/process-karaoke-grove")
    async def process_karaoke_grove_endpoint(
        audio_url: str = Form(..., description="Audio URL (e.g., https://sc.maid.zone/_/restream/...)"),
        start_time: float = Form(..., description="Start time in seconds", ge=0),
        duration: float = Form(..., description="Duration in seconds", ge=0.1, le=60),
        chain_id: int = Form(37111, description="Chain ID for Grove (37111=testnet, 7579=mainnet)"),
        mp3_bitrate: int = Form(192, description="MP3 bitrate in kbps", ge=128, le=320),
        strength: float = Form(0.4, description="Replicate strength (0=keep original, 0.4=light, 1=full transform)", ge=0.0, le=1.0)
    ):
        """
        Complete karaoke processing with Replicate enhancement and Grove upload.

        Flow:
        1. Download audio from URL
        2. Trim to segment
        3. Spleeter stem separation (vocals + accompaniment)
        4. Replicate accompaniment (instrumental) enhancement (Stable Audio 2.5)
        5. Upload to Grove
        6. Return Grove URIs

        **Parameters:**
        - `audio_url`: URL to audio file
        - `start_time`: Start time in seconds
        - `duration`: Duration in seconds (max 60s)
        - `chain_id`: Grove chain ID (37111=testnet, 7579=mainnet)
        - `mp3_bitrate`: MP3 bitrate in kbps
        - `strength`: Replicate strength (0=keep identical, 1=transform completely)

        **Note:** Replicate API token must be set as Modal secret `replicate-api-token` with key `REPLICATE_KEY`

        **Returns:**
        JSON with Grove URIs (vocals + enhanced accompaniment) and timing data
        """
        separator = SpleeterSeparator()
        try:
            result = separator.process_karaoke_with_grove.remote(
                audio_url=audio_url,
                start_time=start_time,
                duration=duration,
                chain_id=chain_id,
                mp3_bitrate=mp3_bitrate,
                strength=strength
            )

            return result

        except Exception as e:
            import traceback
            error_details = traceback.format_exc()
            print(f"API Error: {str(e)}")
            print(f"Full traceback:\n{error_details}")
            raise HTTPException(500, f"Karaoke Grove processing failed: {str(e)}")

    @web_app.post("/process-karaoke-async")
    async def process_karaoke_async_endpoint(
        background_tasks: BackgroundTasks,
        job_id: str = Form(...),
        user_address: str = Form(...),
        genius_id: int = Form(...),
        segment_id: str = Form(...),
        audio_url: str = Form(...),
        start_time: float = Form(...),
        duration: float = Form(...),
        chain_id: int = Form(37111),
        mp3_bitrate: int = Form(192),
        strength: float = Form(0.4),
        webhook_url: str = Form(...)
    ):
        """
        Start async karaoke processing. Returns immediately with jobId.

        Flow:
        1. Create job entry (status: processing)
        2. Start processing in background
        3. When complete, update job and call webhook_url
        4. Webhook triggers Lit Action 2 → contract update

        **Parameters:**
        - `job_id`: Unique job identifier (from frontend/Lit Action 1)
        - `user_address`: User's wallet address
        - `genius_id`: Genius song ID
        - `segment_id`: Segment identifier (e.g., "verse-1")
        - `audio_url`: SoundCloud URL
        - `start_time`: Start time in seconds
        - `duration`: Duration in seconds
        - `chain_id`: Grove chain ID
        - `mp3_bitrate`: MP3 bitrate
        - `strength`: Replicate strength (0.4 recommended for karaoke)
        - `webhook_url`: Vercel webhook URL to call when complete

        **Returns:**
        - job_id
        - status: "processing"
        """
        try:
            import time as time_module

            # Create job entry
            job_data = {
                "job_id": job_id,
                "user_address": user_address,
                "genius_id": genius_id,
                "segment_id": segment_id,
                "status": "processing",
                "created_at": str(time_module.time())
            }
            job_storage[job_id] = job_data

            # Start processing in background using FastAPI BackgroundTasks
            background_tasks.add_task(
                _process_karaoke_sync,
                job_id=job_id,
                user_address=user_address,
                genius_id=genius_id,
                segment_id=segment_id,
                audio_url=audio_url,
                start_time=start_time,
                duration=duration,
                chain_id=chain_id,
                mp3_bitrate=mp3_bitrate,
                strength=strength,
                webhook_url=webhook_url
            )

            return {
                "success": True,
                "job_id": job_id,
                "status": "processing",
                "message": "Processing started. Job will complete asynchronously."
            }

        except Exception as e:
            import traceback
            error_details = traceback.format_exc()
            print(f"Async start error: {str(e)}")
            print(f"Full traceback:\n{error_details}")
            raise HTTPException(500, f"Failed to start processing: {str(e)}")

    def _process_karaoke_sync(
        job_id: str,
        user_address: str,
        genius_id: int,
        segment_id: str,
        audio_url: str,
        start_time: float,
        duration: float,
        chain_id: int,
        mp3_bitrate: int,
        strength: float,
        webhook_url: str
    ):
        """
        Background task: process karaoke and notify webhook.

        This runs in background (no timeout) and calls webhook_url when complete.
        """
        import requests as sync_requests  # Use synchronous requests for background task
        import time as time_module

        try:
            print(f"[Job {job_id}] Starting background processing...")

            # Call the processing function
            separator = SpleeterSeparator()
            result = separator.process_karaoke_with_grove.remote(
                audio_url=audio_url,
                start_time=start_time,
                duration=duration,
                chain_id=chain_id,
                mp3_bitrate=mp3_bitrate,
                strength=strength
            )

            print(f"[Job {job_id}] Processing complete!")

            # Update job with results
            job_data = job_storage.get(job_id)
            job_data.update({
                "status": "complete",
                "grove_vocals_uri": result["grove_uris"]["vocals"],
                "grove_accompaniment_uri": result["grove_uris"]["accompaniment"],
                "timing": result["timing"],
                "updated_at": str(time_module.time())
            })
            job_storage[job_id] = job_data

            # Call webhook
            print(f"[Job {job_id}] Calling webhook: {webhook_url}")
            webhook_payload = {
                "job_id": job_id,
                "user_address": user_address,
                "genius_id": genius_id,
                "segment_id": segment_id,
                "grove_vocals_uri": result["grove_uris"]["vocals"],
                "grove_accompaniment_uri": result["grove_uris"]["accompaniment"],
                "status": "complete",
                "timing": result["timing"]
            }

            webhook_resp = sync_requests.post(
                webhook_url,
                json=webhook_payload,
                timeout=30
            )
            webhook_resp.raise_for_status()
            print(f"[Job {job_id}] Webhook called successfully: {webhook_resp.status_code}")

        except Exception as e:
            import traceback
            error_details = traceback.format_exc()
            print(f"[Job {job_id}] Processing failed: {str(e)}")
            print(f"[Job {job_id}] Traceback:\n{error_details}")

            # Update job with error
            job_data = job_storage.get(job_id)
            if job_data:
                job_data.update({
                    "status": "failed",
                    "error": str(e),
                    "updated_at": str(time_module.time())
                })
                job_storage[job_id] = job_data

            # Notify webhook of failure
            try:
                sync_requests.post(
                    webhook_url,
                    json={
                        "job_id": job_id,
                        "status": "failed",
                        "error": str(e)
                    },
                    timeout=30
                )
            except Exception as webhook_error:
                print(f"[Job {job_id}] Webhook notification failed: {webhook_error}")

    @web_app.get("/job/{job_id}")
    async def get_job_status(job_id: str):
        """
        Get job status and results.

        Returns job data including Grove URIs when complete.
        Used by Lit Action 2 to fetch job results.
        """
        try:
            job_data = job_storage.get(job_id)

            if job_data is None:
                raise HTTPException(404, f"Job not found: {job_id}")

            return job_data

        except HTTPException:
            raise
        except Exception as e:
            import traceback
            print(f"Get job error: {str(e)}")
            print(traceback.format_exc())
            raise HTTPException(500, f"Failed to get job: {str(e)}")

    @web_app.post("/job")
    async def create_job(
        job_id: str = Form(...),
        user_address: str = Form(...),
        genius_id: int = Form(...),
        segment_id: str = Form(...)
    ):
        """
        Create a new job entry.

        Called when processing starts.
        """
        try:
            import time as time_module

            job_data = {
                "job_id": job_id,
                "user_address": user_address,
                "genius_id": genius_id,
                "segment_id": segment_id,
                "status": "processing",
                "created_at": str(time_module.time())
            }

            job_storage[job_id] = job_data

            return {
                "success": True,
                "job_id": job_id
            }

        except Exception as e:
            import traceback
            print(f"Create job error: {str(e)}")
            print(traceback.format_exc())
            raise HTTPException(500, f"Failed to create job: {str(e)}")

    @web_app.put("/job/{job_id}")
    async def update_job(
        job_id: str,
        status: str = Form(...),
        grove_vocals_uri: str = Form(None),
        grove_accompaniment_uri: str = Form(None),
        error: str = Form(None)
    ):
        """
        Update job with results.

        Called when processing completes (success or failure).
        """
        try:
            import time as time_module

            job_data = job_storage.get(job_id)

            if job_data is None:
                raise HTTPException(404, f"Job not found: {job_id}")

            # Update job data
            job_data["status"] = status
            job_data["updated_at"] = str(time_module.time())

            if grove_vocals_uri:
                job_data["grove_vocals_uri"] = grove_vocals_uri
            if grove_accompaniment_uri:
                job_data["grove_accompaniment_uri"] = grove_accompaniment_uri
            if error:
                job_data["error"] = error

            job_storage[job_id] = job_data

            return {
                "success": True,
                "job_id": job_id
            }

        except HTTPException:
            raise
        except Exception as e:
            import traceback
            print(f"Update job error: {str(e)}")
            print(traceback.format_exc())
            raise HTTPException(500, f"Failed to update job: {str(e)}")

    return web_app


# Local entrypoint for testing
@app.local_entrypoint()
def main():
    """Test the separator locally"""
    import sys

    if len(sys.argv) < 2:
        print("Usage: modal run spleeter_api.py <audio_file>")
        sys.exit(1)

    audio_file = sys.argv[1]

    if not os.path.exists(audio_file):
        print(f"Error: File not found: {audio_file}")
        sys.exit(1)

    print(f"Processing: {audio_file}")
    with open(audio_file, "rb") as f:
        audio_data = f.read()

    separator = SpleeterSeparator()
    zip_data = separator.separate_audio.remote(
        audio_data=audio_data,
        filename=os.path.basename(audio_file)
    )

    output_file = f"stems_{os.path.basename(audio_file)}.zip"
    with open(output_file, "wb") as f:
        f.write(zip_data)

    print(f"✓ Stems saved to: {output_file}")
