#!/usr/bin/env python3
"""
Quick test script for VibeVoice TTS - generates audio and plays it.

Usage:
    python test_tts.py "Hello, this is a test"
    python test_tts.py  # Uses default text
"""

import sys
import os
import copy
import threading
import subprocess
import tempfile
import wave
from pathlib import Path

import torch
import numpy as np

# Add parent to path
sys.path.insert(0, str(Path(__file__).parent))

def main():
    text = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else "Hello! This is a test of the VibeVoice text to speech system."

    print(f"[Test] Text: {text}")
    print("[Test] Loading VibeVoice model...")

    from vibevoice.modular.modeling_vibevoice_streaming_inference import (
        VibeVoiceStreamingForConditionalGenerationInference,
    )
    from vibevoice.processor.vibevoice_streaming_processor import VibeVoiceStreamingProcessor
    from vibevoice.modular.streamer import AudioStreamer

    model_path = "microsoft/VibeVoice-Realtime-0.5B"
    device = "cuda"
    voices_dir = Path(__file__).parent / "voices"

    # Load processor
    processor = VibeVoiceStreamingProcessor.from_pretrained(model_path)

    # Load model
    model = VibeVoiceStreamingForConditionalGenerationInference.from_pretrained(
        model_path,
        torch_dtype=torch.bfloat16,
        device_map=device,
        attn_implementation="sdpa",
    )
    model.eval()

    # Configure scheduler
    model.model.noise_scheduler = model.model.noise_scheduler.from_config(
        model.model.noise_scheduler.config,
        algorithm_type="sde-dpmsolver++",
        beta_schedule="squaredcos_cap_v2",
    )
    model.set_ddpm_inference_steps(num_steps=5)

    # Load voice preset (prefer Emma if available)
    voice_files = list(voices_dir.glob("*.pt"))
    voice_file = next((v for v in voice_files if "Emma" in v.stem), voice_files[0])
    print(f"[Test] Using voice: {voice_file.stem}")
    prefilled_outputs = torch.load(voice_file, map_location=device, weights_only=False)

    # Prepare inputs
    processed = processor.process_input_with_cached_prompt(
        text=text.strip(),
        cached_prompt=prefilled_outputs,
        padding=True,
        return_tensors="pt",
        return_attention_mask=True,
    )
    inputs = {k: v.to(device) if hasattr(v, "to") else v for k, v in processed.items()}

    # Generate with streaming
    print("[Test] Generating speech...")
    audio_streamer = AudioStreamer(batch_size=1, stop_signal=None, timeout=None)
    errors = []
    stop_event = threading.Event()

    def run_generation():
        try:
            model.generate(
                **inputs,
                max_new_tokens=None,
                cfg_scale=1.5,
                tokenizer=processor.tokenizer,
                generation_config={"do_sample": False},
                audio_streamer=audio_streamer,
                stop_check_fn=stop_event.is_set,
                verbose=False,
                refresh_negative=True,
                all_prefilled_outputs=copy.deepcopy(prefilled_outputs),
                show_progress_bar=True,
            )
        except Exception as e:
            errors.append(e)
            audio_streamer.end()

    thread = threading.Thread(target=run_generation, daemon=True)
    thread.start()

    # Collect audio chunks
    audio_chunks = []
    for chunk in audio_streamer.get_stream(0):
        if torch.is_tensor(chunk):
            chunk = chunk.detach().cpu().to(torch.float32).numpy()
        else:
            chunk = np.asarray(chunk, dtype=np.float32)
        if chunk.ndim > 1:
            chunk = chunk.reshape(-1)
        audio_chunks.append(chunk)

    thread.join()

    if errors:
        print(f"[Test] Error: {errors[0]}")
        return

    # Concatenate audio
    audio = np.concatenate(audio_chunks)
    print(f"[Test] Generated {len(audio) / 24000:.2f}s of audio")

    # Save to temp file and play
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        temp_path = f.name

    # Write WAV file
    audio_int16 = (np.clip(audio, -1, 1) * 32767).astype(np.int16)
    with wave.open(temp_path, 'w') as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(24000)
        wav.writeframes(audio_int16.tobytes())

    print(f"[Test] Playing audio...")
    subprocess.run(["aplay", "-q", temp_path])

    # Cleanup
    os.unlink(temp_path)
    print("[Test] Done!")


if __name__ == "__main__":
    main()
