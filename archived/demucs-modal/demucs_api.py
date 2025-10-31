"""
Demucs v4 Separation API on Modal
==================================
Simple, scalable GPU-accelerated vocal/instrumental separation.

Features:
- Pre-cached MDX Extra model (fast cold starts)
- H200 GPU acceleration
- Two-stems mode (vocals + instrumental) for karaoke
- Async job queue with webhook notifications
- MP3 output for efficient transfers
"""

import io
import base64
import tempfile
import os
import time as time_module
from typing import Optional
import modal

# Define the image with Demucs v4 pre-installed and models cached
demucs_image = (
    modal.Image.debian_slim(python_version="3.10")
    .apt_install("ffmpeg", "libsndfile1")
    .uv_pip_install(
        "numpy<2",  # Pin numpy<2 for PyTorch compatibility
        "demucs==4.0.1",  # Demucs v4 with Hybrid Transformer models
        "fastapi",
        "python-multipart",
        "requests",
        "soundfile",
    )
    # Pre-download mdx_extra model (2nd place MDX challenge, best quality)
    .run_commands(
        "python -c 'from demucs.pretrained import get_model; get_model(\"mdx_extra\")'"
    )
    .run_commands("ffmpeg -version")
)

app = modal.App("demucs-karaoke")


@app.cls(
    gpu="H200",  # H200 GPU for faster processing
    image=demucs_image,
    timeout=120,  # 2 min timeout
    retries=1,  # Retry once on failure
    # Production settings (uncomment to keep warm containers):
    # allow_concurrent_inputs=10,
    # keep_warm=1,
)
class DemucsSeparator:
    """
    Demucs v4 separator with async webhook support.
    Uses MDX Extra model for state-of-the-art quality.
    """

    @modal.enter()
    def warmup(self):
        """Container warmup - verify model is cached"""
        print("Demucs container warming up...")
        print("✓ mdx_extra model cached during image build")

    @modal.method()
    def separate_from_url(
        self,
        audio_url: str,
        model: str = "mdx_extra",
        output_format: str = "mp3",
        mp3_bitrate: int = 192
    ) -> dict:
        """
        Download audio from URL and separate with Demucs.

        Args:
            audio_url: Public URL to audio file
            model: Demucs model to use (default: mdx_extra)
            output_format: Output format (mp3, wav, flac)
            mp3_bitrate: MP3 bitrate in kbps

        Returns:
            {vocals_base64, instrumental_base64, vocals_size, instrumental_size, duration}
        """
        import requests
        import subprocess

        start_time = time_module.time()
        print(f"[Demucs] Downloading audio from {audio_url}")

        with tempfile.TemporaryDirectory() as tmp_dir:
            # 1. Download audio
            audio_resp = requests.get(audio_url, timeout=120)
            audio_resp.raise_for_status()

            input_path = os.path.join(tmp_dir, "input.mp3")
            with open(input_path, 'wb') as f:
                f.write(audio_resp.content)

            file_size_mb = len(audio_resp.content) / (1024 * 1024)
            print(f"[Demucs] Downloaded {file_size_mb:.2f}MB")

            # 2. Run Demucs
            stems_dir = os.path.join(tmp_dir, "stems")
            os.makedirs(stems_dir, exist_ok=True)

            cmd = [
                'python', '-m', 'demucs',
                '--two-stems=vocals',  # Karaoke mode
                '-n', model,
                '--device', 'cuda',
            ]

            if output_format == 'mp3':
                cmd.extend(['--mp3', '--mp3-bitrate', str(mp3_bitrate), '--mp3-preset', '2'])
            elif output_format == 'flac':
                cmd.append('--flac')

            cmd.extend(['-o', stems_dir, input_path])

            print(f"[Demucs] Running separation (model: {model}, GPU: H200)...")
            demucs_start = time_module.time()

            subprocess.run(cmd, check=True, capture_output=True)

            demucs_time = time_module.time() - demucs_start
            print(f"[Demucs] Separation complete in {demucs_time:.1f}s")

            # 3. Read outputs and encode as base64
            output_dir = os.path.join(stems_dir, model, "input")
            vocals_path = os.path.join(output_dir, f"vocals.{output_format}")
            inst_path = os.path.join(output_dir, f"no_vocals.{output_format}")

            with open(vocals_path, 'rb') as f:
                vocals_data = f.read()
                vocals_b64 = base64.b64encode(vocals_data).decode('utf-8')

            with open(inst_path, 'rb') as f:
                inst_data = f.read()
                inst_b64 = base64.b64encode(inst_data).decode('utf-8')

            total_time = time_module.time() - start_time
            print(f"[Demucs] ✓ Complete in {total_time:.1f}s")
            print(f"[Demucs] Vocals: {len(vocals_data) / 1024 / 1024:.2f}MB")
            print(f"[Demucs] Instrumental: {len(inst_data) / 1024 / 1024:.2f}MB")

            return {
                "vocals_base64": vocals_b64,
                "instrumental_base64": inst_b64,
                "vocals_size": len(vocals_data),
                "instrumental_size": len(inst_data),
                "model": model,
                "format": output_format,
                "duration": total_time
            }

    @modal.method()
    def separate_from_base64(
        self,
        audio_base64: str,
        model: str = "mdx_extra",
        output_format: str = "mp3",
        mp3_bitrate: int = 192
    ) -> dict:
        """
        Separate audio from base64-encoded input.

        Args:
            audio_base64: Base64-encoded audio (supports data URI)
            model: Demucs model to use
            output_format: Output format (mp3, wav, flac)
            mp3_bitrate: MP3 bitrate in kbps

        Returns:
            {vocals_base64, instrumental_base64, vocals_size, instrumental_size, duration}
        """
        import subprocess

        start_time = time_module.time()
        print(f"[Demucs] Starting separation from base64 input")

        with tempfile.TemporaryDirectory() as tmp_dir:
            # 1. Decode base64
            if audio_base64.startswith('data:'):
                audio_base64 = audio_base64.split(',')[1]
            audio_data = base64.b64decode(audio_base64)

            input_path = os.path.join(tmp_dir, "input.mp3")
            with open(input_path, 'wb') as f:
                f.write(audio_data)

            file_size_mb = len(audio_data) / (1024 * 1024)
            print(f"[Demucs] Input: {file_size_mb:.2f}MB")

            # 2. Run Demucs
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

            print(f"[Demucs] Running separation (model: {model}, GPU: H200)...")
            demucs_start = time_module.time()

            subprocess.run(cmd, check=True, capture_output=True)

            demucs_time = time_module.time() - demucs_start
            print(f"[Demucs] Separation complete in {demucs_time:.1f}s")

            # 3. Read outputs and encode as base64
            output_dir = os.path.join(stems_dir, model, "input")
            vocals_path = os.path.join(output_dir, f"vocals.{output_format}")
            inst_path = os.path.join(output_dir, f"no_vocals.{output_format}")

            with open(vocals_path, 'rb') as f:
                vocals_data = f.read()
                vocals_b64 = base64.b64encode(vocals_data).decode('utf-8')

            with open(inst_path, 'rb') as f:
                inst_data = f.read()
                inst_b64 = base64.b64encode(inst_data).decode('utf-8')

            total_time = time_module.time() - start_time
            print(f"[Demucs] ✓ Complete in {total_time:.1f}s")
            print(f"[Demucs] Vocals: {len(vocals_data) / 1024 / 1024:.2f}MB")
            print(f"[Demucs] Instrumental: {len(inst_data) / 1024 / 1024:.2f}MB")

            return {
                "vocals_base64": vocals_b64,
                "instrumental_base64": inst_b64,
                "vocals_size": len(vocals_data),
                "instrumental_size": len(inst_data),
                "model": model,
                "format": output_format,
                "duration": total_time
            }

    @modal.method()
    def separate_and_webhook(
        self,
        job_id: str,
        audio_url: str,
        webhook_url: str,
        model: str = "mdx_extra",
        output_format: str = "mp3",
        mp3_bitrate: int = 192
    ) -> dict:
        """
        Separate audio and POST result to webhook.
        Designed for async execution via .spawn()

        Args:
            job_id: Unique job identifier
            audio_url: Public URL to audio file
            webhook_url: URL to POST results when complete
            model: Demucs model to use
            output_format: Output format
            mp3_bitrate: MP3 bitrate

        Returns:
            {success: true}
        """
        import requests
        import sys

        try:
            print(f"[Job {job_id}] 🚀 Starting async Demucs separation...", flush=True)
            sys.stdout.flush()

            # Run separation
            result = self.separate_from_url.local(
                audio_url=audio_url,
                model=model,
                output_format=output_format,
                mp3_bitrate=mp3_bitrate
            )

            print(f"[Job {job_id}] ✅ Separation complete!", flush=True)
            sys.stdout.flush()

            # POST to webhook
            print(f"[Job {job_id}] 📞 Calling webhook: {webhook_url}", flush=True)
            sys.stdout.flush()

            webhook_payload = {
                "job_id": job_id,
                "status": "completed",
                "vocals_base64": result["vocals_base64"],
                "instrumental_base64": result["instrumental_base64"],
                "vocals_size": result["vocals_size"],
                "instrumental_size": result["instrumental_size"],
                "model": result["model"],
                "format": result["format"],
                "duration": result["duration"]
            }

            webhook_resp = requests.post(webhook_url, json=webhook_payload, timeout=120)
            webhook_resp.raise_for_status()

            print(f"[Job {job_id}] ✅ Webhook called: HTTP {webhook_resp.status_code}", flush=True)
            sys.stdout.flush()

            return {"success": True}

        except Exception as e:
            import traceback
            error_details = traceback.format_exc()
            print(f"[Job {job_id}] ❌ Failed: {str(e)}", flush=True)
            print(f"[Job {job_id}] Traceback:\n{error_details}", flush=True)
            sys.stdout.flush()

            # Notify webhook of failure
            try:
                requests.post(webhook_url, json={
                    "job_id": job_id,
                    "status": "failed",
                    "error": str(e)
                }, timeout=30)
            except:
                pass

            raise


# FastAPI web server
@app.function(
    image=demucs_image,
    timeout=120,
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
            "gpu": "H200",
            "endpoints": {
                "/separate-sync": "POST - Synchronous separation (base64 input)",
                "/separate-async": "POST - Async separation with webhook (URL input)",
                "/health": "GET - Health check"
            }
        }

    @web_app.get("/health")
    async def health():
        return {"status": "healthy", "model": "mdx_extra", "gpu": "H200"}

    @web_app.post("/separate-sync")
    async def separate_sync_endpoint(request: Request):
        """
        Synchronous Demucs separation from base64 input.
        BLOCKS until processing completes (10-30s).

        Request body (JSON):
        {
            "audio_base64": "data:audio/mpeg;base64,...",
            "model": "mdx_extra",
            "output_format": "mp3",
            "mp3_bitrate": 192
        }

        Returns:
        {
            "vocals_base64": "...",
            "instrumental_base64": "...",
            "vocals_size": 123456,
            "instrumental_size": 123456,
            "model": "mdx_extra",
            "format": "mp3",
            "duration": 15.3
        }
        """
        try:
            body = await request.json()

            separator = DemucsSeparator()
            result = separator.separate_from_base64.remote(
                audio_base64=body.get("audio_base64"),
                model=body.get("model", "mdx_extra"),
                output_format=body.get("output_format", "mp3"),
                mp3_bitrate=body.get("mp3_bitrate", 192)
            )

            return result

        except Exception as e:
            import traceback
            print(f"[/separate-sync] Error: {str(e)}")
            print(traceback.format_exc())
            raise HTTPException(500, f"Separation failed: {str(e)}")

    @web_app.post("/separate-async")
    async def separate_async_endpoint(
        job_id: str = Form(...),
        audio_url: str = Form(...),
        webhook_url: str = Form(...),
        model: str = Form("mdx_extra"),
        output_format: str = Form("mp3"),
        mp3_bitrate: int = Form(192)
    ):
        """
        Asynchronous Demucs separation with webhook notification.
        Returns immediately, POSTs result to webhook when done.

        Form Parameters:
        - job_id: Unique job identifier
        - audio_url: Public URL to audio file (e.g., Grove IPFS URL)
        - webhook_url: URL to POST results when complete
        - model: Demucs model (default: mdx_extra)
        - output_format: mp3, wav, or flac (default: mp3)
        - mp3_bitrate: MP3 bitrate in kbps (default: 192)

        Returns immediately:
        {
            "success": true,
            "job_id": "...",
            "status": "processing"
        }

        Webhook will receive on completion:
        {
            "job_id": "...",
            "status": "completed" | "failed",
            "vocals_base64": "...",  (if completed)
            "instrumental_base64": "...",  (if completed)
            "error": "..."  (if failed)
        }
        """
        try:
            separator = DemucsSeparator()
            separator.separate_and_webhook.spawn(
                job_id=job_id,
                audio_url=audio_url,
                webhook_url=webhook_url,
                model=model,
                output_format=output_format,
                mp3_bitrate=mp3_bitrate
            )

            print(f"[API] Spawned async job {job_id}")

            return {
                "success": True,
                "job_id": job_id,
                "status": "processing",
                "message": "Demucs separation started. Webhook will be called when complete."
            }

        except Exception as e:
            import traceback
            error_details = traceback.format_exc()
            print(f"API Error: {str(e)}")
            print(f"Full traceback:\n{error_details}")
            raise HTTPException(500, f"Failed to start separation: {str(e)}")

    return web_app
