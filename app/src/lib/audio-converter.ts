/**
 * Audio format conversion utilities.
 * Voxtral STT only accepts MP3 and WAV formats, but browsers record WebM/Opus.
 * This module converts WebM/Opus audio to WAV using Web Audio API.
 */

/**
 * Encode PCM samples as WAV format
 */
function encodePcmToWav(
  samples: Float32Array,
  sampleRate: number,
  numChannels: number = 1
): ArrayBuffer {
  const bitDepth = 16
  const bytesPerSample = bitDepth / 8
  const dataLength = samples.length * bytesPerSample
  const buffer = new ArrayBuffer(44 + dataLength)
  const view = new DataView(buffer)

  // RIFF header
  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataLength, true)
  writeString(view, 8, 'WAVE')

  // fmt chunk
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true)
  view.setUint16(32, numChannels * bytesPerSample, true)
  view.setUint16(34, bitDepth, true)

  // data chunk
  writeString(view, 36, 'data')
  view.setUint32(40, dataLength, true)

  // Write samples
  let offset = 44
  for (let i = 0; i < samples.length; i++) {
    const sample = Math.max(-1, Math.min(1, samples[i]))
    const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7fff
    view.setInt16(offset, int16, true)
    offset += 2
  }

  return buffer
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i))
  }
}

/**
 * Resample audio to target sample rate using linear interpolation
 */
function resampleAudio(
  samples: Float32Array,
  fromRate: number,
  toRate: number
): Float32Array {
  if (fromRate === toRate) {
    return samples
  }

  const ratio = toRate / fromRate
  const newLength = Math.floor(samples.length * ratio)
  const result = new Float32Array(newLength)

  for (let i = 0; i < newLength; i++) {
    const srcIndex = i / ratio
    const srcIndexFloor = Math.floor(srcIndex)
    const srcIndexCeil = Math.min(srcIndexFloor + 1, samples.length - 1)
    const t = srcIndex - srcIndexFloor
    result[i] = samples[srcIndexFloor] * (1 - t) + samples[srcIndexCeil] * t
  }

  return result
}

/**
 * Convert AudioBuffer to mono Float32Array
 */
function audioBufferToMono(audioBuffer: AudioBuffer): Float32Array {
  if (audioBuffer.numberOfChannels === 1) {
    return audioBuffer.getChannelData(0)
  }

  // Mix down to mono
  const length = audioBuffer.length
  const mono = new Float32Array(length)
  const numChannels = audioBuffer.numberOfChannels

  for (let ch = 0; ch < numChannels; ch++) {
    const channelData = audioBuffer.getChannelData(ch)
    for (let i = 0; i < length; i++) {
      mono[i] += channelData[i]
    }
  }

  // Average
  for (let i = 0; i < length; i++) {
    mono[i] /= numChannels
  }

  return mono
}

/**
 * Try to decode audio using Web Audio API (works in Chrome/Safari for WebM)
 */
async function decodeWithWebAudio(
  audioData: ArrayBuffer
): Promise<AudioBuffer | null> {
  try {
    const audioContext = new AudioContext()
    try {
      return await audioContext.decodeAudioData(audioData.slice(0))
    } finally {
      await audioContext.close()
    }
  } catch {
    return null
  }
}

/**
 * Converts audio Blob (WebM/Opus or MP4/AAC) to WAV format.
 * Uses Web Audio API which handles:
 * - WebM/Opus on Chrome/Android
 * - MP4/AAC on iOS Safari
 * Firefox may have limited codec support.
 */
export async function webmToWav(
  audioBlob: Blob,
  targetSampleRate = 16000
): Promise<Blob> {
  const audioData = await audioBlob.arrayBuffer()

  // Try Web Audio API (handles both WebM and MP4 depending on platform)
  const audioBuffer = await decodeWithWebAudio(audioData)

  if (audioBuffer) {
    // Convert to mono
    const monoSamples = audioBufferToMono(audioBuffer)

    // Resample to target rate
    const resampled = resampleAudio(
      monoSamples,
      audioBuffer.sampleRate,
      targetSampleRate
    )

    // Encode as WAV
    const wavBuffer = encodePcmToWav(resampled, targetSampleRate, 1)
    return new Blob([wavBuffer], { type: 'audio/wav' })
  }

  // Web Audio API failed - provide helpful error
  const format = audioBlob.type || 'unknown format'
  throw new Error(
    `Audio conversion failed (${format}). Please use Chrome, Safari, or a Chromium-based browser.`
  )
}

/**
 * Preload audio conversion (no-op, kept for compatibility)
 */
export async function preloadFFmpeg(): Promise<void> {
  // No preloading needed for Web Audio API approach
}
