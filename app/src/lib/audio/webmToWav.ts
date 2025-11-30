/**
 * Convert webm audio blob to wav format using Web Audio API
 *
 * Voxtral STT doesn't support webm format, so we need to convert
 * browser-recorded audio to wav before sending.
 */

/**
 * Convert a webm audio blob to wav format
 */
export async function webmToWav(webmBlob: Blob): Promise<Blob> {
  // Create audio context
  const audioContext = new AudioContext()

  try {
    // Decode the webm audio
    const arrayBuffer = await webmBlob.arrayBuffer()
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

    // Convert to wav
    const wavBlob = audioBufferToWav(audioBuffer)

    console.log('[webmToWav] Converted:', {
      inputSize: webmBlob.size,
      outputSize: wavBlob.size,
      duration: audioBuffer.duration,
      sampleRate: audioBuffer.sampleRate,
      channels: audioBuffer.numberOfChannels,
    })

    return wavBlob
  } finally {
    await audioContext.close()
  }
}

/**
 * Convert AudioBuffer to WAV blob
 */
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels
  const sampleRate = buffer.sampleRate
  const format = 1 // PCM
  const bitDepth = 16

  // Interleave channels
  const length = buffer.length * numChannels * (bitDepth / 8)
  const outputBuffer = new ArrayBuffer(44 + length)
  const view = new DataView(outputBuffer)

  // Write WAV header
  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + length, true)
  writeString(view, 8, 'WAVE')
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true) // fmt chunk size
  view.setUint16(20, format, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true) // byte rate
  view.setUint16(32, numChannels * (bitDepth / 8), true) // block align
  view.setUint16(34, bitDepth, true)
  writeString(view, 36, 'data')
  view.setUint32(40, length, true)

  // Write interleaved PCM samples
  const channels: Float32Array[] = []
  for (let i = 0; i < numChannels; i++) {
    channels.push(buffer.getChannelData(i))
  }

  let offset = 44
  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      // Convert float to 16-bit PCM
      const sample = Math.max(-1, Math.min(1, channels[channel][i]))
      const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7fff
      view.setInt16(offset, int16, true)
      offset += 2
    }
  }

  return new Blob([outputBuffer], { type: 'audio/wav' })
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i))
  }
}

/**
 * Convert blob to base64 string (wav format, no data URI prefix)
 */
export async function blobToBase64Raw(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result as string
      // Extract base64 after "data:...;base64,"
      const parts = result.split(',')
      if (parts.length < 2) {
        reject(new Error('Invalid data URL'))
        return
      }
      resolve(parts[1])
    }
    reader.onerror = () => reject(new Error('FileReader error'))
    reader.readAsDataURL(blob)
  })
}
