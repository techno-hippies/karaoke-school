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
from typing import Optional
import modal

# Import FastAPI only when needed (in Modal container, not locally)
# This allows local deployment without installing FastAPI locally

# Define the image with Demucs pre-installed and models cached
# Using uv for faster package installation (Rust-based, much faster than pip)
demucs_image = (
    modal.Image.debian_slim(python_version="3.10")
    .apt_install("curl", "ffmpeg")  # Need curl for uv installer, ffmpeg for audio processing
    .run_commands(
        # Install uv (fast Rust-based package installer)
        "curl -LsSf https://astral.sh/uv/install.sh | sh"
    )
    .run_commands(
        # Use uv to install dependencies (much faster than pip)
        # Note: numpy<2 required for torch 2.1.0 compatibility
        "/root/.local/bin/uv pip install --system 'numpy<2' scipy"
    )
    .run_commands(
        # Install torch 2.8.0 with B200 GPU kernel support
        "/root/.local/bin/uv pip install --system torch==2.8.0 torchaudio==2.8.0"
    )
    .run_commands(
        # Install demucs and other dependencies
        "/root/.local/bin/uv pip install --system demucs==4.0.1 fastapi python-multipart"
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
