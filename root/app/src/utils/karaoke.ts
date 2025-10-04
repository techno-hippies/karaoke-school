// Format seconds to MM:SS display
export function formatTime(seconds: number): string {
  if (!isFinite(seconds)) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// Check if text is a structural marker like (Chorus), [Verse], etc.
export function isStructuralMarker(text: string): boolean {
  if (!text) return true
  return /^\s*[\(\[].*[\)\]]\s*$/.test(text) || text.trim().length === 0
}

// Normalize timing with optional offset
export function normalizeTime(currentTime: number, offset?: number): number {
  return offset !== undefined ? currentTime + offset : currentTime
}
