/**
 * Stem Separation Service
 *
 * NOTE: Stem separation requires external tools (Demucs, Spleeter)
 * For MVP, we'll use placeholder stems or skip segment processing
 *
 * Future implementation:
 * - Use Demucs via Python subprocess
 * - Or use pre-separated stems (user provides vocals.mp3, drums.mp3, etc.)
 */

import type { StemFiles } from '../types.js'

/**
 * Separate audio into stems (vocals, drums, bass, other)
 *
 * PLACEHOLDER: Returns dummy files for now
 * TODO: Implement actual stem separation using Demucs or Spleeter
 *
 * Installation:
 * ```bash
 * # Install Demucs (requires Python)
 * pip install demucs
 *
 * # Run separation
 * demucs --two-stems=vocals audio.mp3
 * ```
 */
export async function separateStems(audioFile: File): Promise<StemFiles> {
  console.log('🎵 Stem separation (PLACEHOLDER)')
  console.log('   ⚠️  Actual stem separation not implemented yet')
  console.log('   For production: install Demucs or provide pre-separated stems')

  // Return placeholder stems (empty files)
  const emptyBlob = new Blob([], { type: 'audio/mpeg' })

  return {
    vocals: new File([emptyBlob], 'vocals.mp3', { type: 'audio/mpeg' }),
    drums: new File([emptyBlob], 'drums.mp3', { type: 'audio/mpeg' }),
    bass: new File([emptyBlob], 'bass.mp3', { type: 'audio/mpeg' }),
    other: new File([emptyBlob], 'other.mp3', { type: 'audio/mpeg' }),
  }
}

/**
 * Load pre-separated stems from directory
 * Looks for: vocals.mp3, drums.mp3, bass.mp3, other.mp3
 */
export async function loadStemsFromDirectory(songDir: string): Promise<StemFiles | null> {
  const stemFiles = {
    vocals: `${songDir}/vocals.mp3`,
    drums: `${songDir}/drums.mp3`,
    bass: `${songDir}/bass.mp3`,
    other: `${songDir}/other.mp3`,
  }

  try {
    const vocals = Bun.file(stemFiles.vocals)
    const drums = Bun.file(stemFiles.drums)
    const bass = Bun.file(stemFiles.bass)
    const other = Bun.file(stemFiles.other)

    if (
      (await vocals.exists()) &&
      (await drums.exists()) &&
      (await bass.exists()) &&
      (await other.exists())
    ) {
      console.log('✓ Found pre-separated stems')
      return {
        vocals: new File([await vocals.arrayBuffer()], 'vocals.mp3', { type: 'audio/mpeg' }),
        drums: new File([await drums.arrayBuffer()], 'drums.mp3', { type: 'audio/mpeg' }),
        bass: new File([await bass.arrayBuffer()], 'bass.mp3', { type: 'audio/mpeg' }),
        other: new File([await other.arrayBuffer()], 'other.mp3', { type: 'audio/mpeg' }),
      }
    }

    return null
  } catch (error) {
    return null
  }
}

/**
 * Check if Demucs is installed and available
 */
export async function checkDemucsInstalled(): Promise<boolean> {
  try {
    const proc = Bun.spawn(['demucs', '--help'])
    await proc.exited
    return proc.exitCode === 0
  } catch (error) {
    return false
  }
}
