/**
 * File Loader Utilities
 * Load song files from the songs/ directory
 */

import { readdir, stat } from 'fs/promises'
import { join, extname } from 'path'
import { config } from '../config.js'
import type { SongConfig, SongFiles } from '../types.js'

/**
 * Get list of song folders in songs/ directory
 */
export async function getSongFolders(): Promise<string[]> {
  const songsDir = config.upload.songsDir

  try {
    const entries = await readdir(songsDir)
    const folders: string[] = []

    for (const entry of entries) {
      const fullPath = join(songsDir, entry)
      const stats = await stat(fullPath)

      if (stats.isDirectory() && !entry.startsWith('.')) {
        folders.push(entry)
      }
    }

    return folders
  } catch (error) {
    console.error('Error scanning songs directory:', error)
    return []
  }
}

/**
 * Load song configuration from metadata.json
 */
export async function loadSongConfig(songId: string): Promise<SongConfig> {
  const configPath = join(config.upload.songsDir, songId, 'metadata.json')
  const file = Bun.file(configPath)

  if (!(await file.exists())) {
    throw new Error(`metadata.json not found for song: ${songId}`)
  }

  const configData = await file.json()

  // Validate required fields
  if (!configData.title || !configData.artist) {
    throw new Error(`metadata.json missing required fields (title, artist) for song: ${songId}`)
  }

  return {
    id: songId,
    title: configData.title,
    artist: configData.artist,
    geniusId: configData.geniusId,
    soundcloudUrl: configData.soundcloudUrl,
    youtubeUrl: configData.youtubeUrl,
    spotifyUrl: configData.spotifyUrl,
    segmentIds: configData.segmentIds,
  }
}

/**
 * Load song files from directory
 */
export async function loadSongFiles(songId: string): Promise<SongFiles> {
  const songDir = join(config.upload.songsDir, songId)

  try {
    const files = await readdir(songDir)

    let fullAudio: File | undefined
    let vocalsOnly: File | undefined
    let lyrics: File | undefined
    let thumbnail: File | undefined
    const translations: Record<string, File> = {}

    for (const filename of files) {
      const filePath = join(songDir, filename)
      const ext = extname(filename).toLowerCase()

      // Audio files
      if (['.mp3', '.wav', '.m4a', '.flac'].includes(ext)) {
        if (filename.toLowerCase().includes('vocal')) {
          // Vocals-only file for ElevenLabs
          vocalsOnly = await loadFile(filePath, filename, `audio/${ext.slice(1)}`)
        } else if (!fullAudio) {
          // Full audio file
          fullAudio = await loadFile(filePath, filename, `audio/${ext.slice(1)}`)
        }
      }

      // Lyrics file
      if (filename === 'lyrics.txt') {
        lyrics = await loadFile(filePath, filename, 'text/plain')
      }

      // Thumbnail
      if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext) && !filename.includes('cover')) {
        thumbnail = await loadFile(filePath, filename, `image/${ext.slice(1)}`)
      }
    }

    // Load translations from translations/ subdirectory
    const translationsDir = join(songDir, 'translations')
    try {
      const translationFiles = await readdir(translationsDir)

      for (const filename of translationFiles) {
        if (filename.endsWith('.txt')) {
          const langCode = filename.replace('.txt', '') // "zh.txt" -> "zh"
          const filePath = join(translationsDir, filename)
          translations[langCode] = await loadFile(filePath, filename, 'text/plain')
        }
      }
    } catch (error) {
      // Translations folder is optional
    }

    // Validate required files
    if (!fullAudio) {
      throw new Error(`No audio file found for song: ${songId}`)
    }

    if (!lyrics) {
      throw new Error(`lyrics.txt not found for song: ${songId}`)
    }

    return {
      fullAudio,
      vocalsOnly,
      lyrics,
      thumbnail,
      translations,
    }
  } catch (error) {
    throw new Error(`Failed to load song files for ${songId}: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Load a file from disk as a File object
 */
async function loadFile(filePath: string, filename: string, mimeType: string): Promise<File> {
  const bunFile = Bun.file(filePath)
  const buffer = await bunFile.arrayBuffer()
  return new File([buffer], filename, { type: mimeType })
}

/**
 * Check if alignment cache exists for a song
 */
export async function checkAlignmentCache(songId: string): Promise<boolean> {
  const cachePath = join(config.upload.songsDir, songId, 'karaoke-alignment.json')
  const file = Bun.file(cachePath)
  return file.exists()
}

/**
 * Get alignment cache path for a song
 */
export function getAlignmentCachePath(songId: string): string {
  return join(config.upload.songsDir, songId, 'karaoke-alignment.json')
}
