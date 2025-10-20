import { promises as fs } from 'fs';
import path from 'path';
import type { Artist } from '../types';

export class FileManager {
  constructor(private outputDir: string) {}

  async ensureOutputDir(): Promise<void> {
    await fs.mkdir(this.outputDir, { recursive: true });
    await fs.mkdir(path.join(this.outputDir, 'artists'), { recursive: true });
    await fs.mkdir(path.join(this.outputDir, 'releases'), { recursive: true });
    await fs.mkdir(path.join(this.outputDir, 'recordings'), { recursive: true });
  }

  async readArtistsList(filePath: string): Promise<string[]> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return content
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#')); // Skip empty lines and comments
    } catch (error) {
      console.error(`Failed to read artists file: ${error}`);
      throw error;
    }
  }

  async saveArtist(artist: Artist): Promise<void> {
    const filename = `${artist.id.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
    const filepath = path.join(this.outputDir, 'artists', filename);
    await fs.writeFile(filepath, JSON.stringify(artist, null, 2));
    console.log(`✅ Saved artist: ${artist.name} to ${filename}`);
  }

  async saveRawHtml(html: string, artistId: string, type: 'artist' | 'releases' | 'recordings'): Promise<void> {
    if (!html) return;
    
    const filename = `${artistId.replace(/[^a-zA-Z0-9]/g, '_')}_${type}.html`;
    const filepath = path.join(this.outputDir, 'debug', filename);
    
    await fs.mkdir(path.join(this.outputDir, 'debug'), { recursive: true });
    await fs.writeFile(filepath, html);
  }

  async loadCookies(cookiesFile?: string): Promise<any[]> {
    if (!cookiesFile) return [];
    
    try {
      const content = await fs.readFile(cookiesFile, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.warn(`Could not load cookies from ${cookiesFile}:`, error);
      return [];
    }
  }

  async saveProgress(processed: string[], failed: string[]): Promise<void> {
    const progressFile = path.join(this.outputDir, 'progress.json');
    await fs.writeFile(progressFile, JSON.stringify({
      timestamp: new Date().toISOString(),
      processed,
      failed,
      stats: {
        total: processed.length + failed.length,
        success: processed.length,
        failed: failed.length
      }
    }, null, 2));
  }
}