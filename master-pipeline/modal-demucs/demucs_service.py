"""
Demucs v4 Service on Modal
===========================
Simplified GPU-accelerated vocal/instrumental separation

Deployment:
  modal deploy demucs_service.py

Usage:
  modal run demucs_service.py --audio-url "https://example.com/song.mp3"
"""

import io
import base64
import tempfile
import os
from typing import Optional
import modal

# Define image with Demucs v4 pre-installed and models cached
demucs_image = (
    modal.Image.debian_slim(python_version="3.10")
    .apt_install("ffmpeg", "libsndfile1")
    .uv_pip_install(
        "numpy<2",
        "demucs==4.0.1",
        "soundfile",
        "fastapi",
        "requests",
    )
    # Pre-download mdx_extra model (best quality)
    .run_commands(
        "python -c 'from demucs.pretrained import get_model; get_model(\"mdx_extra\")'"
    )
)

app = modal.App("demucs-karaoke")


@app.cls(
    gpu="H100",  # H100 GPU for fast processing
    image=demucs_image,
    timeout=600,  # 10 min max
)
class DemucsSeparator:
    """
    Demucs v4 separator for karaoke vocal/instrumental separation.
    Uses MDX Extra model for best quality.
    """

    @modal.enter()
    def warmup(self):
        """Container warmup - verify model is cached"""
        print("Demucs container warming up...")
        print("✓ mdx_extra model cached during image build")

    @modal.method()
    def separate_audio(
        self,
        audio_url: Optional[str] = None,
        audio_base64: Optional[str] = None,
        model: str = "mdx_extra",
        output_format: str = "mp3",
        mp3_bitrate: int = 192,
    ) -> dict:
        """
        Separate audio into vocals and instrumental using Demucs v4

        Args:
            audio_url: Public URL to audio file (or use audio_base64)
            audio_base64: Base64-encoded audio data (or use audio_url)
            model: Demucs model (default: mdx_extra)
            output_format: Output format (mp3, wav, flac)
            mp3_bitrate: MP3 bitrate in kbps

        Returns:
            {
                "vocals_base64": "...",
                "instrumental_base64": "...",
                "vocals_size": 1234567,
                "instrumental_size": 1234567,
                "model": "mdx_extra",
                "format": "mp3"
            }
        """
        import subprocess
        import requests
        import time as time_module

        print(f"[Demucs] Starting separation (model: {model}, GPU: H100)")
        start_time = time_module.time()

        with tempfile.TemporaryDirectory() as tmp_dir:
            # Step 1: Get audio file
            if audio_url:
                print(f"[Demucs] Downloading from URL: {audio_url}")
                resp = requests.get(audio_url, timeout=120)
                resp.raise_for_status()
                audio_data = resp.content
            elif audio_base64:
                print(f"[Demucs] Decoding base64 audio...")
                # Handle data URI format: data:audio/mpeg;base64,xxxxx
                if audio_base64.startswith('data:'):
                    audio_base64 = audio_base64.split(',')[1]
                audio_data = base64.b64decode(audio_base64)
            else:
                raise ValueError("Either audio_url or audio_base64 must be provided")

            # Save to temp file
            input_path = os.path.join(tmp_dir, "input.mp3")
            with open(input_path, 'wb') as f:
                f.write(audio_data)

            print(f"[Demucs] Input file: {len(audio_data) / 1024 / 1024:.2f}MB")

            # Step 2: Run Demucs separation
            stems_dir = os.path.join(tmp_dir, "stems")
            os.makedirs(stems_dir, exist_ok=True)

            cmd = [
                'python', '-m', 'demucs',
                '--two-stems=vocals',
                '-n', model,
                '--device', 'cuda',  # Use GPU
            ]

            if output_format == 'mp3':
                cmd.extend(['--mp3', '--mp3-bitrate', str(mp3_bitrate), '--mp3-preset', '2'])
            elif output_format == 'flac':
                cmd.append('--flac')
            elif output_format == 'wav':
                pass  # WAV is default

            cmd.extend(['-o', stems_dir, input_path])

            print(f"[Demucs] Running separation on GPU...")
            result = subprocess.run(cmd, check=True, capture_output=True, text=True)

            # Print Demucs output for debugging
            if result.stdout:
                print(f"[Demucs] stdout: {result.stdout}")
            if result.stderr:
                print(f"[Demucs] stderr: {result.stderr}")

            # Step 3: Locate output files
            track_name = "input"
            output_dir = os.path.join(stems_dir, model, track_name)

            ext = output_format
            vocals_path = os.path.join(output_dir, f"vocals.{ext}")
            instrumental_path = os.path.join(output_dir, f"no_vocals.{ext}")

            if not os.path.exists(vocals_path) or not os.path.exists(instrumental_path):
                raise FileNotFoundError(f"Demucs output not found in {output_dir}")

            # Step 4: Read output files and encode as base64
            with open(vocals_path, 'rb') as f:
                vocals_data = f.read()

            with open(instrumental_path, 'rb') as f:
                instrumental_data = f.read()

            vocals_b64 = base64.b64encode(vocals_data).decode('utf-8')
            instrumental_b64 = base64.b64encode(instrumental_data).decode('utf-8')

            duration = time_module.time() - start_time

            print(f"[Demucs] ✓ Separation complete in {duration:.1f}s")
            print(f"  Vocals: {len(vocals_data) / 1024 / 1024:.2f}MB")
            print(f"  Instrumental: {len(instrumental_data) / 1024 / 1024:.2f}MB")

            return {
                "vocals_base64": vocals_b64,
                "instrumental_base64": instrumental_b64,
                "model": model,
                "format": output_format,
                "vocals_size": len(vocals_data),
                "instrumental_size": len(instrumental_data),
                "duration": duration,
            }


# FastAPI web endpoint
@app.function(image=demucs_image)
@modal.asgi_app()
def web_app():
    """
    HTTP endpoint for Demucs separation

    POST /
    {
        "audio_url": "https://..." (or "audio_base64": "...")
        "model": "mdx_extra",
        "output_format": "mp3",
        "mp3_bitrate": 192
    }
    """
    from fastapi import FastAPI, Request
    from fastapi.responses import JSONResponse

    web = FastAPI(title="Demucs Separation API")

    @web.get("/")
    async def root():
        return {
            "service": "Demucs Separation API",
            "model": "mdx_extra",
            "gpu": "H100",
            "endpoint": "POST / with audio_url or audio_base64"
        }

    @web.post("/")
    async def separate(request: Request):
        body = await request.json()

        # Use .remote() to spawn on GPU container
        separator = DemucsSeparator()
        result = await separator.separate_audio.remote.aio(
            audio_url=body.get("audio_url"),
            audio_base64=body.get("audio_base64"),
            model=body.get("model", "mdx_extra"),
            output_format=body.get("output_format", "mp3"),
            mp3_bitrate=body.get("mp3_bitrate", 192),
        )

        return JSONResponse(content=result)

    return web


@app.local_entrypoint()
def main(
    audio_url: str = "https://example.com/song.mp3",
    model: str = "mdx_extra",
):
    """
    Test the Demucs service locally

    Usage:
      modal run demucs_service.py --audio-url "https://example.com/song.mp3"
    """
    print(f"Testing Demucs service with audio: {audio_url}")

    separator = DemucsSeparator()
    result = separator.separate_audio.remote(audio_url=audio_url, model=model)

    print("\n✅ Separation complete!")
    print(f"  Model: {result['model']}")
    print(f"  Format: {result['format']}")
    print(f"  Duration: {result.get('duration', 0):.1f}s")
    print(f"  Vocals: {result['vocals_size'] / 1024 / 1024:.2f}MB")
    print(f"  Instrumental: {result['instrumental_size'] / 1024 / 1024:.2f}MB")

    # Optionally save files
    import tempfile
    output_dir = tempfile.mkdtemp(prefix="demucs_output_")

    vocals_path = os.path.join(output_dir, f"vocals.{result['format']}")
    instrumental_path = os.path.join(output_dir, f"instrumental.{result['format']}")

    with open(vocals_path, 'wb') as f:
        f.write(base64.b64decode(result['vocals_base64']))

    with open(instrumental_path, 'wb') as f:
        f.write(base64.b64decode(result['instrumental_base64']))

    print(f"\n📁 Output files:")
    print(f"  {vocals_path}")
    print(f"  {instrumental_path}")
