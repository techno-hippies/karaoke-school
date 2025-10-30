"""
Demucs v4 Local Separation Service
===================================
GPU-accelerated vocal/instrumental separation running on local RTX 3080.

This is a local alternative to the Modal deployment, providing:
- Same API endpoints as Modal version
- CUDA acceleration on local GPU
- No rate limits or cloud costs
- Faster for continuous processing

Setup:
  uv venv
  source .venv/bin/activate
  uv pip install demucs==4.0.1 fastapi uvicorn python-multipart requests
  python -c 'from demucs.pretrained import get_model; get_model("mdx_extra")'

Run:
  uvicorn demucs_local:app --host 0.0.0.0 --port 8000
"""

import io
import base64
import tempfile
import os
import time as time_module
from typing import Optional
import subprocess
import requests
import traceback
from fastapi import FastAPI, HTTPException, Form, Request, BackgroundTasks
from fastapi.responses import JSONResponse

app = FastAPI(title="Demucs Local API")


def separate_audio(
    audio_data: bytes,
    model: str = "mdx_extra",
    output_format: str = "mp3",
    mp3_bitrate: int = 192
) -> dict:
    """
    Core separation logic - processes audio bytes and returns separated stems.

    Args:
        audio_data: Raw audio bytes
        model: Demucs model to use
        output_format: Output format (mp3, wav, flac)
        mp3_bitrate: MP3 bitrate in kbps

    Returns:
        {vocals_base64, instrumental_base64, vocals_size, instrumental_size, duration}
    """
    start_time = time_module.time()

    with tempfile.TemporaryDirectory() as tmp_dir:
        # 1. Write input audio
        input_path = os.path.join(tmp_dir, "input.mp3")
        with open(input_path, 'wb') as f:
            f.write(audio_data)

        file_size_mb = len(audio_data) / (1024 * 1024)
        print(f"[Demucs] Processing {file_size_mb:.2f}MB audio file")

        # 2. Run Demucs
        stems_dir = os.path.join(tmp_dir, "stems")
        os.makedirs(stems_dir, exist_ok=True)

        cmd = [
            'python', '-m', 'demucs',
            '--two-stems=vocals',  # Karaoke mode
            '-n', model,
            '--device', 'cuda',  # Use RTX 3080
        ]

        if output_format == 'mp3':
            cmd.extend(['--mp3', '--mp3-bitrate', str(mp3_bitrate), '--mp3-preset', '2'])
        elif output_format == 'flac':
            cmd.append('--flac')

        cmd.extend(['-o', stems_dir, input_path])

        print(f"[Demucs] Running separation (model: {model}, GPU: CUDA)...")
        demucs_start = time_module.time()

        result = subprocess.run(cmd, capture_output=True, text=True)

        if result.returncode != 0:
            print(f"[Demucs] Error: {result.stderr}")
            raise Exception(f"Demucs failed: {result.stderr}")

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


def process_async_job(
    job_id: str,
    audio_url: str,
    webhook_url: str,
    model: str,
    output_format: str,
    mp3_bitrate: int
):
    """Background task to process separation and call webhook."""
    try:
        print(f"[Job {job_id}] 🚀 Starting async separation...")

        # Download audio
        print(f"[Job {job_id}] Downloading from {audio_url}")
        audio_resp = requests.get(audio_url, timeout=120)
        audio_resp.raise_for_status()
        audio_data = audio_resp.content

        # Separate
        result = separate_audio(audio_data, model, output_format, mp3_bitrate)

        print(f"[Job {job_id}] ✅ Separation complete!")

        # POST to webhook
        print(f"[Job {job_id}] 📞 Calling webhook: {webhook_url}")

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

        print(f"[Job {job_id}] ✅ Webhook called: HTTP {webhook_resp.status_code}")

    except Exception as e:
        error_details = traceback.format_exc()
        print(f"[Job {job_id}] ❌ Failed: {str(e)}")
        print(f"[Job {job_id}] Traceback:\n{error_details}")

        # Notify webhook of failure
        try:
            requests.post(webhook_url, json={
                "job_id": job_id,
                "status": "failed",
                "error": str(e)
            }, timeout=30)
        except:
            pass


@app.get("/")
async def root():
    return {
        "service": "Demucs Local API",
        "model": "mdx_extra (Hybrid Transformer Demucs)",
        "gpu": "CUDA (RTX 3080)",
        "endpoints": {
            "/separate-sync": "POST - Synchronous separation (base64 input)",
            "/separate-async": "POST - Async separation with webhook (URL input)",
            "/health": "GET - Health check"
        }
    }


@app.get("/health")
async def health():
    """Health check - verify CUDA is available."""
    try:
        import torch
        cuda_available = torch.cuda.is_available()
        device_name = torch.cuda.get_device_name(0) if cuda_available else "N/A"

        return {
            "status": "healthy",
            "model": "mdx_extra",
            "gpu": "CUDA",
            "cuda_available": cuda_available,
            "device": device_name
        }
    except ImportError:
        return {
            "status": "healthy",
            "model": "mdx_extra",
            "gpu": "CUDA",
            "cuda_available": "unknown (torch not imported)"
        }


@app.post("/separate-sync")
async def separate_sync_endpoint(request: Request):
    """
    Synchronous Demucs separation from base64 input.
    BLOCKS until processing completes (20-30s on RTX 3080).

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

        audio_base64 = body.get("audio_base64")
        if not audio_base64:
            raise HTTPException(400, "audio_base64 required")

        # Decode base64
        if audio_base64.startswith('data:'):
            audio_base64 = audio_base64.split(',')[1]
        audio_data = base64.b64decode(audio_base64)

        # Separate
        result = separate_audio(
            audio_data=audio_data,
            model=body.get("model", "mdx_extra"),
            output_format=body.get("output_format", "mp3"),
            mp3_bitrate=body.get("mp3_bitrate", 192)
        )

        return result

    except Exception as e:
        print(f"[/separate-sync] Error: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(500, f"Separation failed: {str(e)}")


@app.post("/separate-async")
async def separate_async_endpoint(
    background_tasks: BackgroundTasks,
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
        # Add to background tasks
        background_tasks.add_task(
            process_async_job,
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
        error_details = traceback.format_exc()
        print(f"API Error: {str(e)}")
        print(f"Full traceback:\n{error_details}")
        raise HTTPException(500, f"Failed to start separation: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
