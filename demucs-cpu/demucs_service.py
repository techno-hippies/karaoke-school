"""
Demucs v4 CPU Audio Separation Service
======================================
Cloud-optimized vocal/instrumental separation for Akash deployment.

This CPU version provides:
- Same API endpoints as GPU version
- MDX quantized models (mdx_q) for efficient CPU processing
- No GPU requirements - runs on any CPU instance
- Optimized for cloud deployment on Akash
- Sequential processing to avoid resource conflicts

Setup:
  python -c 'from demucs.pretrained import get_model; get_model("mdx_q")'

Run:
  uvicorn demucs_service:app --host 0.0.0.0 --port 8002
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
import asyncio
from asyncio import Queue
from fastapi import FastAPI, HTTPException, Form, Request, BackgroundTasks
from fastapi.responses import JSONResponse
import shutil

app = FastAPI(title="Demucs CPU Audio Separation Service")

# Sequential job queue - only one demucs process at a time
job_queue: Queue = None
processing_active = False


def separate_audio(
    audio_data: bytes,
    model: str = "mdx_q",
    output_format: str = "mp3",
    mp3_bitrate: int = 192
) -> dict:
    """
    Core separation logic - processes audio bytes and returns separated stems.

    Args:
        audio_data: Raw audio bytes
        model: Demucs model to use (default: mdx_q for CPU efficiency)
        output_format: Output format (mp3, wav)
        mp3_bitrate: MP3 bitrate in kbps (only used if output_format='mp3')

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

        # 2. Run Demucs (CPU-only, always output as WAV first)
        stems_dir = os.path.join(tmp_dir, "stems")
        os.makedirs(stems_dir, exist_ok=True)

        # Run demucs with default WAV output (--wav flag doesn't exist, WAV is default)
        cmd = [
            'python', '-m', 'demucs',
            '--two-stems=vocals',  # Karaoke mode
            '-n', model,
            # No format flag = outputs WAV by default (most compatible)
            '-o', stems_dir,
            input_path
        ]

        print(f"[Demucs] Running separation (model: {model}, CPU-only)...")
        print(f"[Demucs] Command: {' '.join(cmd)}")
        demucs_start = time_module.time()

        result = subprocess.run(cmd, capture_output=True, text=True)

        if result.returncode != 0:
            error_msg = f"Demucs process failed with return code {result.returncode}\nStdout:\n{result.stdout}\nStderr:\n{result.stderr}"
            print(f"[Demucs] Error: {error_msg}")
            raise Exception(error_msg)

        demucs_time = time_module.time() - demucs_start
        print(f"[Demucs] Separation complete in {demucs_time:.1f}s")

        # 3. Read outputs - demucs creates: stems_dir/model/input/
        output_dir = os.path.join(stems_dir, model, "input")

        # Debug: list what's in the directory
        if os.path.exists(output_dir):
            print(f"[Demucs] Output dir contents: {os.listdir(output_dir)}")
        else:
            print(f"[Demucs] ERROR: Output directory doesn't exist: {output_dir}")
            # List stems_dir to see what was created
            print(f"[Demucs] Stems dir contents: {os.listdir(stems_dir)}")
            if os.path.exists(os.path.join(stems_dir, model)):
                print(f"[Demucs] Model dir contents: {os.listdir(os.path.join(stems_dir, model))}")
            raise Exception(f"Output directory not found: {output_dir}")

        vocals_wav = os.path.join(output_dir, "vocals.wav")
        inst_wav = os.path.join(output_dir, "no_vocals.wav")

        if not os.path.exists(vocals_wav):
            raise Exception(f"Vocals file not found: {vocals_wav}")
        if not os.path.exists(inst_wav):
            raise Exception(f"Instrumental file not found: {inst_wav}")

        # If MP3 requested, convert WAV to MP3 using ffmpeg
        if output_format == 'mp3':
            print(f"[Demucs] Converting to MP3 ({mp3_bitrate}kbps)...")

            vocals_mp3 = os.path.join(output_dir, "vocals.mp3")
            inst_mp3 = os.path.join(output_dir, "instrumental.mp3")

            # Convert vocals to MP3
            cmd_vocals = [
                'ffmpeg', '-i', vocals_wav,
                '-q:a', '5',  # Quality 5 (~192kbps)
                '-y',  # Overwrite output file
                vocals_mp3
            ]
            result = subprocess.run(cmd_vocals, capture_output=True, text=True)
            if result.returncode != 0:
                print(f"[Demucs] Warning: ffmpeg conversion failed, using WAV instead")
                vocals_file = vocals_wav
            else:
                vocals_file = vocals_mp3

            # Convert instrumental to MP3
            cmd_inst = [
                'ffmpeg', '-i', inst_wav,
                '-q:a', '5',  # Quality 5 (~192kbps)
                '-y',  # Overwrite output file
                inst_mp3
            ]
            result = subprocess.run(cmd_inst, capture_output=True, text=True)
            if result.returncode != 0:
                print(f"[Demucs] Warning: ffmpeg conversion failed, using WAV instead")
                inst_file = inst_wav
            else:
                inst_file = inst_mp3
        else:
            vocals_file = vocals_wav
            inst_file = inst_wav

        # Read and encode as base64
        with open(vocals_file, 'rb') as f:
            vocals_data = f.read()
            vocals_b64 = base64.b64encode(vocals_data).decode('utf-8')

        with open(inst_file, 'rb') as f:
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


async def process_job_worker():
    """
    Sequential worker that processes jobs from the queue one at a time.
    This ensures only ONE demucs process runs on the CPU at any time.
    """
    global processing_active
    print("[Worker] 🚀 Sequential job worker started (CPU mode)")

    while True:
        try:
            # Wait for next job
            job = await job_queue.get()

            if job is None:  # Shutdown signal
                break

            job_id = job["job_id"]
            audio_url = job["audio_url"]
            webhook_url = job["webhook_url"]
            model = job["model"]
            output_format = job["output_format"]
            mp3_bitrate = job["mp3_bitrate"]

            processing_active = True
            print(f"[Worker] Processing job {job_id} (queue size: {job_queue.qsize()})")

            try:
                # Download audio
                print(f"[Job {job_id}] Downloading from {audio_url}")
                audio_resp = requests.get(audio_url, timeout=120)
                audio_resp.raise_for_status()
                audio_data = audio_resp.content

                # Separate (BLOCKING - only one at a time)
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

            finally:
                processing_active = False
                job_queue.task_done()

        except Exception as e:
            print(f"[Worker] Error in worker loop: {e}")
            traceback.print_exc()


@app.on_event("startup")
async def startup_event():
    """Initialize job queue and start worker on startup."""
    global job_queue
    job_queue = Queue()
    # Start the sequential worker
    asyncio.create_task(process_job_worker())
    print("[Startup] Sequential job queue initialized (CPU mode)")


@app.get("/")
async def root():
    return {
        "service": "Demucs CPU Audio Separation Service",
        "model": "mdx_q (MDX Quantized - CPU Optimized)",
        "hardware": "CPU-only (no GPU required)",
        "endpoints": {
            "/separate-sync": "POST - Synchronous separation (base64 input)",
            "/separate-async": "POST - Async separation with webhook (URL input)",
            "/health": "GET - Health check"
        },
        "note": "Using MDX quantized models for efficient CPU processing"
    }


@app.get("/health")
async def health():
    """Health check - verify service is running."""
    try:
        import torch

        return {
            "status": "healthy",
            "model": "mdx_q",
            "hardware": "CPU",
            "torch_version": torch.__version__,
            "cuda_available": False,  # CPU version
            "device": "CPU"
        }
    except ImportError:
        return {
            "status": "healthy",
            "model": "mdx_q",
            "hardware": "CPU",
            "cuda_available": False,
            "device": "CPU",
            "note": "Torch import pending"
        }


@app.post("/separate-sync")
async def separate_sync_endpoint(request: Request):
    """
    Synchronous Demucs separation from base64 input.
    BLOCKS until processing completes (slower on CPU, 2-5 minutes typical).

    Request body (JSON):
    {
        "audio_base64": "data:audio/mpeg;base64,...",
        "model": "mdx_q",
        "output_format": "mp3",
        "mp3_bitrate": 192
    }

    Returns:
    {
        "vocals_base64": "...",
        "instrumental_base64": "...",
        "vocals_size": 123456,
        "instrumental_size": 123456,
        "model": "mdx_q",
        "format": "mp3",
        "duration": 120.5
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
            model=body.get("model", "mdx_q"),  # Default to CPU-optimized model
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
    job_id: str = Form(...),
    audio_url: str = Form(...),
    webhook_url: str = Form(...),
    model: str = Form("mdx_q"),
    output_format: str = Form("mp3"),
    mp3_bitrate: int = Form(192)
):
    """
    Asynchronous Demucs separation with webhook notification.
    Jobs are processed SEQUENTIALLY (one CPU process at a time).
    Returns immediately, POSTs result to webhook when done.

    Form Parameters:
    - job_id: Unique job identifier
    - audio_url: Public URL to audio file (e.g., Grove IPFS URL)
    - webhook_url: URL to POST results when complete
    - model: Demucs model (default: mdx_q for CPU efficiency)
    - output_format: mp3, wav, or flac (default: mp3)
    - mp3_bitrate: MP3 bitrate in kbps (default: 192)

    Returns immediately:
    {
        "success": true,
        "job_id": "...",
        "status": "queued",
        "queue_position": 3
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
        # Add job to sequential queue
        job = {
            "job_id": job_id,
            "audio_url": audio_url,
            "webhook_url": webhook_url,
            "model": model,
            "output_format": output_format,
            "mp3_bitrate": mp3_bitrate
        }

        await job_queue.put(job)

        queue_size = job_queue.qsize()
        print(f"[API] Job {job_id} added to queue (position: {queue_size})")

        return {
            "success": True,
            "job_id": job_id,
            "status": "queued",
            "queue_position": queue_size,
            "message": f"Job queued. Will process sequentially on CPU (queue size: {queue_size})."
        }

    except Exception as e:
        error_details = traceback.format_exc()
        print(f"API Error: {str(e)}")
        print(f"Full traceback:\n{error_details}")
        raise HTTPException(500, f"Failed to queue separation: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
