#!/usr/bin/env python3
"""
VibeVoice TTS Server

A FastAPI server that provides text-to-speech using Microsoft's VibeVoice-Realtime-0.5B model.

Endpoints:
- POST /speak       - Generate speech from text (streams via WebSocket)
- GET  /status      - Server status
- WS   /ws/audio    - WebSocket for streaming audio

Usage:
    python vibevoice_server.py --port 3030

Environment:
    VIBEVOICE_MODEL: Model path (default: microsoft/VibeVoice-Realtime-0.5B)
    VIBEVOICE_DEVICE: Device to use (default: cuda)
"""

import os
import io
import copy
import asyncio
import argparse
import threading
from pathlib import Path
from typing import Optional, Dict, Any, Iterator
from queue import Queue, Empty

import torch
import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
import uvicorn

# VibeVoice imports
from vibevoice.modular.modeling_vibevoice_streaming_inference import (
    VibeVoiceStreamingForConditionalGenerationInference,
)
from vibevoice.processor.vibevoice_streaming_processor import VibeVoiceStreamingProcessor
from vibevoice.modular.streamer import AudioStreamer

app = FastAPI(title="VibeVoice TTS Server")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Constants
SAMPLE_RATE = 24_000
BASE = Path(__file__).parent


class SpeakRequest(BaseModel):
    text: str


class StatusResponse(BaseModel):
    ok: bool
    engine: str
    model: str
    device: str
    voice: str


class StreamingTTSService:
    """VibeVoice TTS Service with streaming support."""

    def __init__(self, model_path: str, device: str = "cuda", inference_steps: int = 5):
        self.model_path = model_path
        self.inference_steps = inference_steps
        self.sample_rate = SAMPLE_RATE

        self.processor: Optional[VibeVoiceStreamingProcessor] = None
        self.model: Optional[VibeVoiceStreamingForConditionalGenerationInference] = None
        self.voice_presets: Dict[str, Path] = {}
        self.default_voice_key: Optional[str] = None
        self._voice_cache: Dict[str, Any] = {}

        if device == "mps" and not torch.backends.mps.is_available():
            print("[VibeVoice] Warning: MPS not available. Falling back to CPU.")
            device = "cpu"
        self.device = device
        self._torch_device = torch.device(device)

    def load(self) -> None:
        """Load model and voice presets."""
        print(f"[VibeVoice] Loading processor from {self.model_path}")
        self.processor = VibeVoiceStreamingProcessor.from_pretrained(self.model_path)

        # Decide dtype & attention based on device
        if self.device == "mps":
            load_dtype = torch.float32
            device_map = None
            attn_impl = "sdpa"
        elif self.device == "cuda":
            load_dtype = torch.bfloat16
            device_map = "cuda"
            attn_impl = "sdpa"  # Use SDPA for compatibility (flash_attention_2 requires separate install)
        else:
            load_dtype = torch.float32
            device_map = "cpu"
            attn_impl = "sdpa"

        print(f"[VibeVoice] Loading model on {device_map}, dtype={load_dtype}, attn={attn_impl}")

        self.model = VibeVoiceStreamingForConditionalGenerationInference.from_pretrained(
            self.model_path,
            torch_dtype=load_dtype,
            device_map=device_map,
            attn_implementation=attn_impl,
        )

        if self.device == "mps":
            self.model.to("mps")

        self.model.eval()

        # Configure noise scheduler
        self.model.model.noise_scheduler = self.model.model.noise_scheduler.from_config(
            self.model.model.noise_scheduler.config,
            algorithm_type="sde-dpmsolver++",
            beta_schedule="squaredcos_cap_v2",
        )
        self.model.set_ddpm_inference_steps(num_steps=self.inference_steps)

        # Load voice presets
        self.voice_presets = self._load_voice_presets()
        self.default_voice_key = self._determine_voice_key(os.environ.get("VOICE_PRESET"))
        self._ensure_voice_cached(self.default_voice_key)

        print(f"[VibeVoice] Model loaded. Default voice: {self.default_voice_key}")

    def _load_voice_presets(self) -> Dict[str, Path]:
        """Load voice preset files from voices directory."""
        voices_dir = BASE / "voices"
        if not voices_dir.exists():
            raise RuntimeError(f"Voices directory not found: {voices_dir}")

        presets: Dict[str, Path] = {}
        for pt_path in voices_dir.glob("*.pt"):
            presets[pt_path.stem] = pt_path

        if not presets:
            raise RuntimeError(f"No voice preset (.pt) files found in {voices_dir}")

        print(f"[VibeVoice] Found {len(presets)} voice presets: {list(presets.keys())}")
        return dict(sorted(presets.items()))

    def _determine_voice_key(self, name: Optional[str]) -> str:
        """Determine which voice to use."""
        if name and name in self.voice_presets:
            return name

        # Try defaults
        for default in ["en-Carter_man", "en-WHTest_man"]:
            if default in self.voice_presets:
                return default

        # Fallback to first available
        return next(iter(self.voice_presets))

    def _ensure_voice_cached(self, key: str) -> Any:
        """Load and cache voice preset."""
        if key not in self.voice_presets:
            raise RuntimeError(f"Voice preset {key!r} not found")

        if key not in self._voice_cache:
            preset_path = self.voice_presets[key]
            print(f"[VibeVoice] Loading voice preset: {key}")
            prefilled_outputs = torch.load(
                preset_path,
                map_location=self._torch_device,
                weights_only=False,
            )
            self._voice_cache[key] = prefilled_outputs

        return self._voice_cache[key]

    def _prepare_inputs(self, text: str, prefilled_outputs: Any):
        """Prepare model inputs from text and voice preset."""
        processed = self.processor.process_input_with_cached_prompt(
            text=text.strip(),
            cached_prompt=prefilled_outputs,
            padding=True,
            return_tensors="pt",
            return_attention_mask=True,
        )

        return {
            key: value.to(self._torch_device) if hasattr(value, "to") else value
            for key, value in processed.items()
        }

    def _run_generation(
        self,
        inputs,
        audio_streamer: AudioStreamer,
        errors: list,
        cfg_scale: float,
        prefilled_outputs,
        stop_event: threading.Event,
    ) -> None:
        """Run generation in background thread."""
        try:
            self.model.generate(
                **inputs,
                max_new_tokens=None,
                cfg_scale=cfg_scale,
                tokenizer=self.processor.tokenizer,
                generation_config={"do_sample": False},
                audio_streamer=audio_streamer,
                stop_check_fn=stop_event.is_set,
                verbose=False,
                refresh_negative=True,
                all_prefilled_outputs=copy.deepcopy(prefilled_outputs),
            )
        except Exception as exc:
            import traceback
            errors.append(exc)
            traceback.print_exc()
            audio_streamer.end()

    def stream(
        self,
        text: str,
        cfg_scale: float = 1.5,
        voice_key: Optional[str] = None,
        stop_event: Optional[threading.Event] = None,
    ) -> Iterator[np.ndarray]:
        """Generate speech and stream audio chunks."""
        if not text.strip():
            return

        text = text.replace("'", "'")

        # Get voice resources
        key = voice_key if voice_key and voice_key in self.voice_presets else self.default_voice_key
        prefilled_outputs = self._ensure_voice_cached(key)

        # Prepare inputs
        inputs = self._prepare_inputs(text, prefilled_outputs)
        audio_streamer = AudioStreamer(batch_size=1, stop_signal=None, timeout=None)
        errors: list = []
        stop_signal = stop_event or threading.Event()

        # Start generation in background
        thread = threading.Thread(
            target=self._run_generation,
            kwargs={
                "inputs": inputs,
                "audio_streamer": audio_streamer,
                "errors": errors,
                "cfg_scale": cfg_scale,
                "prefilled_outputs": prefilled_outputs,
                "stop_event": stop_signal,
            },
            daemon=True,
        )
        thread.start()

        try:
            stream = audio_streamer.get_stream(0)
            for audio_chunk in stream:
                if torch.is_tensor(audio_chunk):
                    audio_chunk = audio_chunk.detach().cpu().to(torch.float32).numpy()
                else:
                    audio_chunk = np.asarray(audio_chunk, dtype=np.float32)

                if audio_chunk.ndim > 1:
                    audio_chunk = audio_chunk.reshape(-1)

                # Normalize to prevent clipping
                peak = np.max(np.abs(audio_chunk)) if audio_chunk.size else 0.0
                if peak > 1.0:
                    audio_chunk = audio_chunk / peak

                yield audio_chunk.astype(np.float32, copy=False)
        finally:
            stop_signal.set()
            audio_streamer.end()
            thread.join()
            if errors:
                raise errors[0]

    def chunk_to_pcm16(self, chunk: np.ndarray) -> bytes:
        """Convert float32 audio chunk to PCM16 bytes."""
        chunk = np.clip(chunk, -1.0, 1.0)
        pcm = (chunk * 32767.0).astype(np.int16)
        return pcm.tobytes()


# Global service instance
tts_service: Optional[StreamingTTSService] = None
audio_clients: set[WebSocket] = set()


async def broadcast_audio(audio_bytes: bytes, is_final: bool = False):
    """Broadcast audio to all connected WebSocket clients."""
    import base64

    if not audio_clients:
        return

    audio_b64 = base64.b64encode(audio_bytes).decode("utf-8") if audio_bytes else ""
    message = {"type": "audio", "audio": audio_b64, "isFinal": is_final}

    disconnected = set()
    for client in audio_clients:
        try:
            await client.send_json(message)
        except:
            disconnected.add(client)

    audio_clients.difference_update(disconnected)


@app.get("/status")
async def status() -> StatusResponse:
    return StatusResponse(
        ok=tts_service is not None and tts_service.model is not None,
        engine="vibevoice",
        model=os.environ.get("VIBEVOICE_MODEL", "microsoft/VibeVoice-Realtime-0.5B"),
        device=tts_service.device if tts_service else "unknown",
        voice=tts_service.default_voice_key if tts_service else "unknown",
    )


@app.post("/speak")
async def speak(request: SpeakRequest):
    """Generate speech from text and broadcast via WebSocket."""
    if tts_service is None:
        return Response(content="Model not loaded", status_code=503)

    print(f'[VibeVoice] Speaking: "{request.text}"')

    loop = asyncio.get_event_loop()
    stop_event = threading.Event()

    def generate_and_stream():
        try:
            for chunk in tts_service.stream(request.text, stop_event=stop_event):
                pcm_bytes = tts_service.chunk_to_pcm16(chunk)
                # Schedule broadcast on event loop
                asyncio.run_coroutine_threadsafe(broadcast_audio(pcm_bytes, is_final=False), loop)
        except Exception as e:
            print(f"[VibeVoice] Generation error: {e}")
        finally:
            asyncio.run_coroutine_threadsafe(broadcast_audio(b"", is_final=True), loop)

    # Run generation in thread pool
    await loop.run_in_executor(None, generate_and_stream)

    return {"ok": True}


@app.websocket("/ws/audio")
async def websocket_audio(websocket: WebSocket):
    """WebSocket endpoint for streaming audio."""
    await websocket.accept()
    audio_clients.add(websocket)
    print("[VibeVoice] Audio client connected")

    try:
        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=30)
            except asyncio.TimeoutError:
                await websocket.send_json({"type": "ping"})
    except WebSocketDisconnect:
        pass
    finally:
        audio_clients.discard(websocket)
        print("[VibeVoice] Audio client disconnected")


def main():
    global tts_service

    parser = argparse.ArgumentParser(description="VibeVoice TTS Server")
    parser.add_argument("--port", type=int, default=3030, help="Server port")
    parser.add_argument(
        "--model",
        type=str,
        default=os.environ.get("VIBEVOICE_MODEL", "microsoft/VibeVoice-Realtime-0.5B"),
        help="Model path",
    )
    parser.add_argument(
        "--device",
        type=str,
        default=os.environ.get("VIBEVOICE_DEVICE", "cuda"),
        choices=["cuda", "cpu", "mps"],
        help="Device to use",
    )
    args = parser.parse_args()

    # Initialize service
    tts_service = StreamingTTSService(model_path=args.model, device=args.device)
    tts_service.load()

    # Run server
    print(f"[VibeVoice] HTTP server on http://localhost:{args.port}")
    print(f"[VibeVoice] WebSocket on ws://localhost:{args.port}/ws/audio")
    uvicorn.run(app, host="0.0.0.0", port=args.port, log_level="warning")


if __name__ == "__main__":
    main()
