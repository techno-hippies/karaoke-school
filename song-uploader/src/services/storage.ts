/**
 * Grove Storage Service
 * Upload files to Grove (Lens storage network)
 */

import type { GroveUploadResult } from '../types.js'

// Will be dynamically imported to avoid bundling issues
let StorageClient: any = null
let immutable: any = null

/**
 * Initialize storage client (lazy load)
 */
async function getStorageClient() {
  if (!StorageClient) {
    const module = await import('@lens-chain/storage-client')
    StorageClient = module.StorageClient
    immutable = module.immutable
  }
  return StorageClient.create()
}

/**
 * Upload a single file to Grove
 */
export async function uploadFile(file: File, filename: string): Promise<GroveUploadResult> {
  const storage = await getStorageClient()

  // Upload to Lens mainnet with immutable ACL
  const acl = immutable(1)

  console.log(`   Uploading ${filename} (${(file.size / 1024 / 1024).toFixed(2)} MB)...`)

  const response = await storage.uploadFile(file, { acl })

  console.log(`   ✓ ${filename} → ${response.uri}`)

  return {
    uri: response.uri,
    gatewayUrl: response.gatewayUrl,
    storageKey: response.storageKey,
  }
}

/**
 * Upload JSON data to Grove
 */
export async function uploadJSON(data: any, filename: string): Promise<GroveUploadResult> {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  })

  const file = new File([blob], filename, {
    type: 'application/json',
  })

  return uploadFile(file, filename)
}

/**
 * Upload multiple files as a folder to Grove
 */
export async function uploadFolder(
  files: File[],
  folderName: string
): Promise<{
  folderUri: string
  files: GroveUploadResult[]
}> {
  const storage = await getStorageClient()
  const acl = immutable(1)

  console.log(`📦 Uploading folder: ${folderName} (${files.length} files)`)

  // Create dynamic index for the folder
  const index = (resources: any[]) => ({
    type: 'karaoke-song-folder',
    name: folderName,
    files: resources.map((r) => ({
      name: r.name,
      uri: r.uri,
      gatewayUrl: r.gatewayUrl,
      storageKey: r.storageKey,
    })),
    uploadedAt: new Date().toISOString(),
  })

  const response = await storage.uploadFolder(files, { acl, index })

  console.log(`✅ Folder uploaded: ${response.folder.uri}`)

  return {
    folderUri: response.folder.uri,
    files: response.files.map((f: any) => ({
      uri: f.uri,
      gatewayUrl: f.gatewayUrl,
      storageKey: f.storageKey,
    })),
  }
}

/**
 * Create a 30-second audio snippet from a full audio file
 * @param audioFile - Full audio file
 * @param startTime - Start time in seconds
 * @param duration - Duration in seconds (default: 30)
 * @returns 30-second audio snippet
 */
export async function createAudioSnippet(
  audioFile: File,
  startTime: number,
  duration: number = 30
): Promise<File> {
  console.log(`   Creating ${duration}s snippet from ${startTime}s...`)

  // NOTE: This requires ffmpeg to be installed
  // For now, we'll just return the full file
  // TODO: Implement actual audio slicing using ffmpeg or Web Audio API

  // Simple implementation: Return full file for now
  // In production, use: ffmpeg -i input.mp3 -ss {startTime} -t {duration} output.mp3
  console.log(`   ⚠️  Audio slicing not yet implemented, using full audio`)

  return audioFile
}
