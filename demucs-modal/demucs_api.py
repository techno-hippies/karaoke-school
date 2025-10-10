"""
Optimized Demucs v4 API on Modal.com
====================================
Scalable HTTP API for vocal/instrumental separation using htdemucs model.

Features:
- Pre-cached model in container image (fast cold starts)
- GPU acceleration (A100)
- Model loaded once on container warmup
- Two-stems mode for vocals/instrumental separation
- Configurable quality vs speed trade-offs
"""

import io
import zipfile
import tempfile
import os
from typing import Optional, List
import modal

# Import FastAPI only when needed (in Modal container, not locally)
# This allows local deployment without installing FastAPI locally

# Define the image with Demucs pre-installed and models cached
# Using Modal's built-in uv support for faster package installation
demucs_image = (
    modal.Image.debian_slim(python_version="3.10")
    .apt_install("ffmpeg")  # FFmpeg for audio processing and trimming
    .uv_pip_install(
        "numpy<2",  # numpy<2 required for torch compatibility
        "scipy",
        "torch==2.8.0",
        "torchaudio==2.8.0",
        "demucs==4.0.1",
        "fastapi",
        "python-multipart",
        "requests",  # For downloading audio from maid.zone
        "fal-client",  # For fal.ai drum enhancement
        "eth-account",  # For verifying PKP signatures
        gpu="B200"  # B200-aware installation
    )
    # Pre-download htdemucs model to reduce cold start time
    .run_commands(
        "python -c 'from demucs.pretrained import get_model; get_model(\"htdemucs\")'"
    )
    # Verify ffmpeg is installed
    .run_commands(
        "ffmpeg -version && ffprobe -version"
    )
)

app = modal.App("demucs-v4-b200")

@app.cls(
    gpu="B200",  # B200 GPU - faster and cheaper ($0.001736/sec vs $0.003/sec A100)
    image=demucs_image,
    scaledown_window=60,  # 1 min idle before scale-down (shorter for testing)
    timeout=600,  # 10 min max per request (for very long tracks)
    secrets=[modal.Secret.from_name("fal-api-key")],  # Inject fal.ai API key
    # Uncomment for production with always-warm container:
    # allow_concurrent_inputs=10,
    # keep_warm=1,  # Always 1 warm container (adds idle cost but eliminates cold starts)
)
class DemucsSeparator:
    """
    Stateful Demucs model wrapper that loads the model once on container warmup.
    """

    @modal.enter()
    def load_model(self):
        """Load model during container warmup (runs once per container)"""
        import torch
        from demucs.pretrained import get_model

        print("Loading htdemucs model...")
        self.model = get_model("htdemucs")

        # Move to GPU if available
        if torch.cuda.is_available():
            self.model.cuda()
            print(f"Model loaded on GPU: {torch.cuda.get_device_name(0)}")
        else:
            print("Warning: GPU not available, using CPU")

        self.model.eval()
        print("Model ready for inference")

    @modal.method()
    def separate_audio(
        self,
        audio_data: bytes,
        filename: str,
        two_stems: Optional[str] = None,
        shifts: int = 1,
        overlap: float = 0.25,
        segment: Optional[int] = None,
        mp3: bool = True,
        mp3_bitrate: int = 192,
        mp3_preset: int = 2,
    ) -> bytes:
        """
        Separate audio into stems.

        Args:
            audio_data: Raw audio file bytes
            filename: Original filename
            two_stems: If set (e.g., "vocals"), returns only that stem + accompaniment
            shifts: Number of random shifts for better quality (1=fast, 5+=slower but better)
            overlap: Overlap between prediction windows
            segment: Segment length in seconds (for large files to avoid OOM)
            mp3: Save as MP3 instead of WAV (default: True for smaller files)
            mp3_bitrate: MP3 bitrate in kbps (default: 192, range: 128-320)
            mp3_preset: MP3 encoder preset (2=best quality, 7=fastest, default: 2)

        Returns:
            ZIP file bytes containing separated stems
        """
        import torch
        import torchaudio
        from demucs.apply import apply_model
        from demucs.audio import AudioFile, save_audio

        with tempfile.TemporaryDirectory() as tmp_dir:
            # Save uploaded audio to temp file
            input_path = os.path.join(tmp_dir, filename)
            with open(input_path, "wb") as f:
                f.write(audio_data)

            try:
                # Load audio
                print(f"Loading audio: {filename}")
                wav = AudioFile(input_path).read(
                    streams=0,
                    samplerate=self.model.samplerate,
                    channels=self.model.audio_channels
                )

                # Convert to torch tensor
                ref = wav.mean(0)
                wav = (wav - ref.mean()) / ref.std()

                # Apply model
                print(f"Separating stems (shifts={shifts}, overlap={overlap})...")
                with torch.no_grad():
                    sources = apply_model(
                        self.model,
                        wav[None],
                        device="cuda" if torch.cuda.is_available() else "cpu",
                        shifts=shifts,
                        split=True,
                        overlap=overlap,
                        progress=False,
                    )[0]

                # Denormalize
                sources = sources * ref.std() + ref.mean()

                # Save stems
                output_dir = os.path.join(tmp_dir, "separated")
                os.makedirs(output_dir, exist_ok=True)

                stem_names = self.model.sources

                # Save stems (WAV first, then convert to MP3 if needed)
                import subprocess

                if two_stems:
                    # Two-stems mode: separate specified stem from the rest
                    print(f"Two-stems mode: {two_stems} vs accompaniment")
                    if two_stems not in stem_names:
                        raise ValueError(f"Invalid stem: {two_stems}. Available: {stem_names}")

                    stem_idx = stem_names.index(two_stems)

                    # Save as WAV first
                    stem_wav = os.path.join(output_dir, f"{two_stems}.wav")
                    save_audio(sources[stem_idx], stem_wav, self.model.samplerate)

                    # Mix all other stems for accompaniment
                    other_indices = [i for i in range(len(stem_names)) if i != stem_idx]
                    accompaniment = sum(sources[i] for i in other_indices)
                    acc_name = "no_vocals" if two_stems == "vocals" else "accompaniment"
                    acc_wav = os.path.join(output_dir, f"{acc_name}.wav")
                    save_audio(accompaniment, acc_wav, self.model.samplerate)

                    # Convert to MP3 if requested
                    if mp3:
                        print(f"Converting to MP3 at {mp3_bitrate}kbps...")
                        for wav_file in [stem_wav, acc_wav]:
                            mp3_file = wav_file.replace('.wav', '.mp3')
                            subprocess.run([
                                'ffmpeg', '-i', wav_file, '-b:a', f'{mp3_bitrate}k',
                                '-compression_level', str(mp3_preset), '-y', mp3_file
                            ], check=True, capture_output=True)
                            os.remove(wav_file)  # Remove WAV after conversion
                else:
                    # Save all stems
                    print(f"Saving all stems: {stem_names}")
                    for source, name in zip(sources, stem_names):
                        stem_wav = os.path.join(output_dir, f"{name}.wav")
                        save_audio(source, stem_wav, self.model.samplerate)

                        # Convert to MP3 if requested
                        if mp3:
                            mp3_file = stem_wav.replace('.wav', '.mp3')
                            subprocess.run([
                                'ffmpeg', '-i', stem_wav, '-b:a', f'{mp3_bitrate}k',
                                '-compression_level', str(mp3_preset), '-y', mp3_file
                            ], check=True, capture_output=True)
                            os.remove(stem_wav)

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
        stems: List[str] = ["vocals", "drums"],
        shifts: int = 1,
        overlap: float = 0.25,
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
            stems: List of stems to separate (e.g., ["vocals", "drums"])
            shifts: Number of random shifts for quality (1=fast, 5+=better)
            overlap: Overlap between prediction windows
            mp3: Output as MP3 (True) or WAV (False)
            mp3_bitrate: MP3 bitrate in kbps

        Returns:
            dict with keys for each stem (e.g., {"vocals": bytes, "drums": bytes})
            Each value is a ZIP file containing stem.mp3 + no_stem.mp3
        """
        import requests
        import subprocess

        print(f"[KARAOKE] Processing: {audio_url}")
        print(f"[KARAOKE] Trim: {start_time}s → {start_time + duration}s ({duration}s)")
        print(f"[KARAOKE] Stems: {stems}")

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

            # Step 3: Separate stems with Demucs
            print(f"[3/3] Separating stems with Demucs...")
            sep_start = __import__("time").time()

            import torch
            import torchaudio
            from demucs.apply import apply_model
            from demucs.audio import AudioFile, save_audio
            import subprocess
            import zipfile

            # Load trimmed audio
            wav = AudioFile(trimmed_path).read(
                streams=0,
                samplerate=self.model.samplerate,
                channels=self.model.audio_channels
            )

            # Normalize
            ref = wav.mean(0)
            wav = (wav - ref.mean()) / ref.std()

            # Apply Demucs model once to get all sources
            print("Running Demucs separation...")
            with torch.no_grad():
                sources = apply_model(
                    self.model,
                    wav[None],
                    device="cuda" if torch.cuda.is_available() else "cpu",
                    shifts=shifts,
                    split=True,
                    overlap=overlap,
                    progress=False,
                )[0]

            # Denormalize
            sources = sources * ref.std() + ref.mean()

            # Save each requested stem as a ZIP
            stem_names = self.model.sources
            results = {}

            for stem in stems:
                if stem not in stem_names:
                    raise ValueError(f"Invalid stem: {stem}. Available: {stem_names}")

                stem_idx = stem_names.index(stem)

                # Create temp dir for this stem's output
                stem_output_dir = os.path.join(tmp_dir, f"{stem}_output")
                os.makedirs(stem_output_dir, exist_ok=True)

                # Save stem as WAV
                stem_wav = os.path.join(stem_output_dir, f"{stem}.wav")
                save_audio(sources[stem_idx], stem_wav, self.model.samplerate)

                # Mix all other stems for accompaniment
                other_indices = [i for i in range(len(stem_names)) if i != stem_idx]
                accompaniment = sum(sources[i] for i in other_indices)
                acc_name = "no_vocals" if stem == "vocals" else f"no_{stem}"
                acc_wav = os.path.join(stem_output_dir, f"{acc_name}.wav")
                save_audio(accompaniment, acc_wav, self.model.samplerate)

                # Convert to MP3 if requested
                if mp3:
                    for wav_file in [stem_wav, acc_wav]:
                        mp3_file = wav_file.replace('.wav', '.mp3')
                        subprocess.run([
                            'ffmpeg', '-i', wav_file, '-b:a', f'{mp3_bitrate}k',
                            '-y', mp3_file
                        ], check=True, capture_output=True)
                        os.remove(wav_file)

                # Create ZIP for this stem
                zip_buffer = io.BytesIO()
                with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
                    for output_file in os.listdir(stem_output_dir):
                        file_path = os.path.join(stem_output_dir, output_file)
                        zip_file.write(file_path, output_file)

                results[stem] = zip_buffer.getvalue()
                print(f"✓ {stem}: {len(results[stem]) / 1024 / 1024:.2f}MB")

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
                    "duration": duration,
                    "stems": stems
                }
            }

    @modal.method()
    def process_karaoke_with_grove(
        self,
        audio_url: str,
        start_time: float,
        duration: float,
        chain_id: int = 37111,  # Lens testnet
        shifts: int = 1,
        overlap: float = 0.25,
        mp3_bitrate: int = 192,
        strength: float = 0.4,  # fal.ai strength: 0=identical, 0.4=light transform, 1=full transform
    ) -> dict:
        """
        Complete karaoke processing pipeline with fal.ai enhancement and Grove upload.

        Flow:
        1. Download audio from maid.zone
        2. Trim to segment
        3. Demucs stem separation (vocals + drums)
        4. fal.ai drum enhancement
        5. Upload to Grove (vocals + enhanced-drums)
        6. Return Grove URIs

        Args:
            audio_url: URL to audio file
            start_time: Start time in seconds
            duration: Duration in seconds
            fal_api_key: fal.ai API key for drum enhancement
            chain_id: Chain ID for Grove (37111=testnet, 7579=mainnet)
            shifts: Demucs quality param (1=fast)
            overlap: Demucs overlap param
            mp3_bitrate: MP3 bitrate in kbps

        Returns:
            dict with Grove URIs and timing data
        """
        import requests
        import subprocess
        import zipfile
        import time as time_module

        print(f"[KARAOKE-GROVE] Processing: {audio_url}")
        print(f"[KARAOKE-GROVE] Trim: {start_time}s → {start_time + duration}s ({duration}s)")

        with tempfile.TemporaryDirectory() as tmp_dir:
            # Step 1: Download + Trim + Demucs (reuse existing logic)
            print("[1/5] Download + Trim + Demucs...")
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

            # Demucs separation
            import torch
            from demucs.apply import apply_model
            from demucs.audio import AudioFile, save_audio

            wav = AudioFile(trimmed_path).read(
                streams=0,
                samplerate=self.model.samplerate,
                channels=self.model.audio_channels
            )

            ref = wav.mean(0)
            wav = (wav - ref.mean()) / ref.std()

            with torch.no_grad():
                sources = apply_model(
                    self.model,
                    wav[None],
                    device="cuda" if torch.cuda.is_available() else "cpu",
                    shifts=shifts,
                    split=True,
                    overlap=overlap,
                    progress=False,
                )[0]

            sources = sources * ref.std() + ref.mean()

            stem_names = self.model.sources
            vocals_idx = stem_names.index("vocals")
            drums_idx = stem_names.index("drums")

            # Save vocals + drums as MP3
            output_dir = os.path.join(tmp_dir, "stems")
            os.makedirs(output_dir, exist_ok=True)

            vocals_wav = os.path.join(output_dir, "vocals.wav")
            drums_wav = os.path.join(output_dir, "drums.wav")

            save_audio(sources[vocals_idx], vocals_wav, self.model.samplerate)
            save_audio(sources[drums_idx], drums_wav, self.model.samplerate)

            # Convert to MP3
            vocals_mp3 = os.path.join(output_dir, "vocals.mp3")
            drums_mp3 = os.path.join(output_dir, "drums.mp3")

            for wav_file, mp3_file in [(vocals_wav, vocals_mp3), (drums_wav, drums_mp3)]:
                subprocess.run([
                    'ffmpeg', '-i', wav_file, '-b:a', f'{mp3_bitrate}k',
                    '-y', mp3_file
                ], check=True, capture_output=True)

            demucs_time = time_module.time() - pipeline_start
            print(f"✓ Demucs complete in {demucs_time:.1f}s")

            # Step 2: fal.ai drum enhancement
            print("[2/5] fal.ai drum enhancement...")
            fal_start = time_module.time()

            # Get fal.ai API key from environment (injected by Modal Secret)
            fal_api_key = os.environ.get("FAL_KEY")
            if not fal_api_key:
                raise Exception("FAL_KEY not found in environment. Create Modal secret: modal secret create fal-api-key FAL_KEY=your_key")

            # Read drums MP3
            with open(drums_mp3, 'rb') as f:
                drums_bytes = f.read()

            # Convert to base64 for fal.ai
            import base64
            drums_base64 = base64.b64encode(drums_bytes).decode('utf-8')

            # Call fal.ai with specified strength
            fal_resp = requests.post(
                'https://fal.run/fal-ai/stable-audio-25/audio-to-audio',
                headers={
                    'Authorization': f'Key {fal_api_key}',
                    'Content-Type': 'application/json'
                },
                json={
                    'audio_url': f'data:audio/mp3;base64,{drums_base64}',
                    'prompt': 'high quality drums, enhanced clarity, professional mixing',
                    'strength': strength,  # 0=identical to input, 1=ignore input completely
                    'total_seconds': int(duration),
                    'guidance_scale': 7
                },
                timeout=120
            )

            if not fal_resp.ok:
                raise Exception(f"fal.ai error ({fal_resp.status_code}): {fal_resp.text}")

            fal_result = fal_resp.json()
            enhanced_drums_url = fal_result.get('audio', {}).get('url')
            if not enhanced_drums_url:
                raise Exception("fal.ai did not return enhanced drums URL")

            # Download enhanced drums
            enhanced_resp = requests.get(enhanced_drums_url)
            enhanced_resp.raise_for_status()

            enhanced_drums_path = os.path.join(output_dir, "drums-enhanced.mp3")
            with open(enhanced_drums_path, 'wb') as f:
                f.write(enhanced_resp.content)

            fal_time = time_module.time() - fal_start
            print(f"✓ fal.ai complete in {fal_time:.1f}s")

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

            # Upload enhanced drums
            with open(enhanced_drums_path, 'rb') as f:
                drums_grove_resp = requests.post(
                    f"{GROVE_API}?chain_id={chain_id}",
                    data=f.read(),
                    headers={'Content-Type': 'audio/mp3'}
                )
            drums_grove_resp.raise_for_status()
            drums_grove = drums_grove_resp.json()[0]

            grove_time = time_module.time() - grove_start
            total_time = time_module.time() - pipeline_start

            print(f"✓ Grove upload complete in {grove_time:.1f}s")
            print(f"✓ Total pipeline: {total_time:.1f}s")

            return {
                "success": True,
                "grove_uris": {
                    "vocals": vocals_grove['uri'],
                    "drums": drums_grove['uri']
                },
                "gateway_urls": {
                    "vocals": vocals_grove['gateway_url'],
                    "drums": drums_grove['gateway_url']
                },
                "storage_keys": {
                    "vocals": vocals_grove['storage_key'],
                    "drums": drums_grove['storage_key']
                },
                "timing": {
                    "demucs": demucs_time,
                    "fal_ai": fal_time,
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
@app.function(image=demucs_image)
@modal.asgi_app()
def fastapi_app():
    """Create FastAPI app with HTTP endpoints"""
    from fastapi import FastAPI, File, Form, UploadFile, HTTPException
    from fastapi.responses import StreamingResponse

    web_app = FastAPI(
        title="Demucs v4 Separation API",
        description="Separate vocals and instrumentals using Demucs htdemucs model",
        version="1.0.0"
    )

    @web_app.get("/")
    def health_check():
        """Health check endpoint"""
        return {
            "status": "healthy",
            "model": "htdemucs",
            "version": "4.0.1",
            "gpu": "A100"
        }

    @web_app.post("/separate")
    async def separate_endpoint(
        audio_file: UploadFile = File(..., description="Audio file to separate"),
        two_stems: Optional[str] = Form(None, description="Stem to isolate (e.g., 'vocals') vs rest"),
        shifts: int = Form(1, description="Quality param: 1=fast, 5+=slower but better", ge=1, le=10),
        overlap: float = Form(0.25, description="Overlap between prediction windows", ge=0.0, le=1.0),
        segment: Optional[int] = Form(None, description="Segment length in seconds (for large files)", ge=1),
        mp3: bool = Form(True, description="Output as MP3 (True) or WAV (False)"),
        mp3_bitrate: int = Form(192, description="MP3 bitrate in kbps", ge=128, le=320),
        mp3_preset: int = Form(2, description="MP3 encoder preset: 2=best quality, 7=fastest", ge=2, le=7)
    ):
        """
        Separate audio into stems.

        **Parameters:**
        - `audio_file`: Audio file (MP3, WAV, FLAC, etc.)
        - `two_stems`: Optional. If set to "vocals", returns vocals.mp3 + no_vocals.mp3
        - `shifts`: Quality vs speed (1=fast, 5+=better quality but slower)
        - `overlap`: Prediction window overlap (default 0.25)
        - `segment`: Split processing into segments (helps with large files)
        - `mp3`: Save as MP3 (True, default) or WAV (False)
        - `mp3_bitrate`: MP3 bitrate in kbps (default: 192, range: 128-320)
        - `mp3_preset`: MP3 quality preset (2=best, 7=fastest, default: 2)

        **Returns:**
        ZIP file containing separated stems
        """
        if not audio_file.filename:
            raise HTTPException(400, "No file provided")

        # Read file
        audio_data = await audio_file.read()

        # Validate two_stems
        valid_stems = ["vocals", "drums", "bass", "other"]
        if two_stems and two_stems not in valid_stems:
            raise HTTPException(400, f"Invalid two_stems value. Must be one of: {valid_stems}")

        # Call the separator
        separator = DemucsSeparator()
        try:
            zip_data = separator.separate_audio.remote(
                audio_data=audio_data,
                filename=audio_file.filename,
                two_stems=two_stems,
                shifts=shifts,
                overlap=overlap,
                segment=segment,
                mp3=mp3,
                mp3_bitrate=mp3_bitrate,
                mp3_preset=mp3_preset
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
        stems: str = Form("vocals,drums", description="Comma-separated stems to separate (e.g., 'vocals,drums')"),
        shifts: int = Form(1, description="Quality param: 1=fast, 5+=better", ge=1, le=10),
        overlap: float = Form(0.25, description="Overlap between prediction windows", ge=0.0, le=1.0),
        mp3: bool = Form(True, description="Output as MP3 (True) or WAV (False)"),
        mp3_bitrate: int = Form(192, description="MP3 bitrate in kbps", ge=128, le=320)
    ):
        """
        All-in-one karaoke processing endpoint.

        Downloads audio from URL (e.g., maid.zone), trims to section, separates stems.
        Eliminates network hops by doing everything in one Modal GPU session.

        **Parameters:**
        - `audio_url`: URL to audio file (e.g., https://sc.maid.zone/_/restream/siamusic/sia-chandelier)
        - `start_time`: Start time in seconds for trimming
        - `duration`: Duration in seconds to trim
        - `stems`: Comma-separated stems (e.g., "vocals,drums")
        - `shifts`: Quality vs speed (1=fast, 5+=better)
        - `overlap`: Prediction window overlap
        - `mp3`: Save as MP3 (True) or WAV (False)
        - `mp3_bitrate`: MP3 bitrate in kbps

        **Returns:**
        JSON with base64-encoded ZIP files for each stem + timing metadata
        """
        # Parse stems
        stems_list = [s.strip() for s in stems.split(",")]
        valid_stems = ["vocals", "drums", "bass", "other"]
        for stem in stems_list:
            if stem not in valid_stems:
                raise HTTPException(400, f"Invalid stem: {stem}. Must be one of: {valid_stems}")

        # Call the processor
        separator = DemucsSeparator()
        try:
            result = separator.process_karaoke_section.remote(
                audio_url=audio_url,
                start_time=start_time,
                duration=duration,
                stems=stems_list,
                shifts=shifts,
                overlap=overlap,
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
        shifts: int = Form(1, description="Quality param: 1=fast, 5+=better", ge=1, le=10),
        overlap: float = Form(0.25, description="Overlap between prediction windows", ge=0.0, le=1.0),
        mp3_bitrate: int = Form(192, description="MP3 bitrate in kbps", ge=128, le=320),
        strength: float = Form(0.4, description="fal.ai strength (0=keep original, 0.4=light transform, 1=full transform)", ge=0.0, le=1.0)
    ):
        """
        Complete karaoke processing with fal.ai enhancement and Grove upload.

        Flow:
        1. Download audio from URL
        2. Trim to segment
        3. Demucs stem separation
        4. fal.ai drum enhancement
        5. Upload to Grove
        6. Return Grove URIs

        **Parameters:**
        - `audio_url`: URL to audio file (e.g., https://sc.maid.zone/_/restream/...)
        - `start_time`: Start time in seconds
        - `duration`: Duration in seconds (max 60s)
        - `chain_id`: Grove chain ID (37111=testnet, 7579=mainnet)
        - `shifts`: Demucs quality (1=fast, 5+=better)
        - `overlap`: Demucs overlap
        - `mp3_bitrate`: MP3 bitrate in kbps
        - `strength`: fal.ai strength (0=keep drums identical, 1=transform completely, default 0.8)

        **Note:** fal.ai API key must be set as Modal secret `fal-api-key`

        **Returns:**
        JSON with Grove URIs (vocals + enhanced drums) and timing data
        """
        separator = DemucsSeparator()
        try:
            result = separator.process_karaoke_with_grove.remote(
                audio_url=audio_url,
                start_time=start_time,
                duration=duration,
                chain_id=chain_id,
                shifts=shifts,
                overlap=overlap,
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

    return web_app


# Local entrypoint for testing
@app.local_entrypoint()
def main():
    """Test the separator locally"""
    import sys

    if len(sys.argv) < 2:
        print("Usage: modal run demucs_api.py <audio_file> [--two-stems vocals]")
        sys.exit(1)

    audio_file = sys.argv[1]
    two_stems = sys.argv[3] if len(sys.argv) > 3 and sys.argv[2] == "--two-stems" else None

    if not os.path.exists(audio_file):
        print(f"Error: File not found: {audio_file}")
        sys.exit(1)

    print(f"Processing: {audio_file}")
    with open(audio_file, "rb") as f:
        audio_data = f.read()

    separator = DemucsSeparator()
    zip_data = separator.separate_audio.remote(
        audio_data=audio_data,
        filename=os.path.basename(audio_file),
        two_stems=two_stems,
        shifts=1
    )

    output_file = f"stems_{os.path.basename(audio_file)}.zip"
    with open(output_file, "wb") as f:
        f.write(zip_data)

    print(f"✓ Stems saved to: {output_file}")
