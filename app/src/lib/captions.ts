/**
 * Convert transcription segments to WebVTT format
 */
export function generateWebVTT(segments: Array<{ text: string; start: number; end: number }>): string {
  const vtt = ['WEBVTT', '']

  segments.forEach((segment, index) => {
    // Format timestamps as HH:MM:SS.mmm
    const startTime = formatVTTTimestamp(segment.start)
    const endTime = formatVTTTimestamp(segment.end)

    vtt.push(`${index + 1}`)
    vtt.push(`${startTime} --> ${endTime}`)
    vtt.push(segment.text)
    vtt.push('')
  })

  return vtt.join('\n')
}

/**
 * Format seconds to WebVTT timestamp (HH:MM:SS.mmm)
 */
function formatVTTTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 1000)

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`
}

/**
 * Create a data URL for WebVTT content
 */
export function createVTTDataURL(vttContent: string): string {
  const blob = new Blob([vttContent], { type: 'text/vtt' })
  return URL.createObjectURL(blob)
}
