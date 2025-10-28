/**
 * Filesystem utilities for managing pipeline data
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import type { ArtistManifest, SongManifest, SegmentManifest } from './types';

/**
 * Ensure directory exists
 */
export function ensureDir(path: string): void {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true });
  }
}

/**
 * Read JSON file
 */
export function readJson<T>(path: string): T {
  if (!existsSync(path)) {
    throw new Error(`File not found: ${path}`);
  }
  const content = readFileSync(path, 'utf-8');
  return JSON.parse(content);
}

/**
 * Write JSON file
 */
export function writeJson(path: string, data: any): void {
  ensureDir(dirname(path));
  writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Check if file exists
 */
export function fileExists(path: string): boolean {
  return existsSync(path);
}

// ============================================================================
// Artist Manifest
// ============================================================================

export function readArtistManifest(path: string): ArtistManifest {
  return readJson<ArtistManifest>(path);
}

export function writeArtistManifest(path: string, manifest: ArtistManifest): void {
  manifest.updatedAt = new Date().toISOString();
  writeJson(path, manifest);
}

// ============================================================================
// Song Manifest
// ============================================================================

export function readSongManifest(path: string): SongManifest {
  return readJson<SongManifest>(path);
}

export function writeSongManifest(path: string, manifest: SongManifest): void {
  manifest.updatedAt = new Date().toISOString();
  writeJson(path, manifest);
}

// ============================================================================
// Segment Manifest
// ============================================================================

export function readSegmentManifest(path: string): SegmentManifest {
  return readJson<SegmentManifest>(path);
}

export function writeSegmentManifest(path: string, manifest: SegmentManifest): void {
  manifest.updatedAt = new Date().toISOString();
  writeJson(path, manifest);
}
