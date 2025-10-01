import type { ElevenLabsResponse } from '../types.js';
import { writeFile, readFile } from 'fs/promises';

export class ElevenLabsProcessor {
  private apiKey: string;
  private debugMode = true;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private log(...args: any[]) {
    if (this.debugMode) {
      console.log('[ELEVENLABS]', ...args);
    }
  }

  /**
   * Clean lyrics text by removing brackets and extra whitespace
   */
  private cleanLyrics(lyrics: string): string {
    return lyrics
      .replace(/\[.*?\]/g, '') // Remove [Chorus], [Verse], etc.
      .replace(/\n\s*\n/g, '\n') // Remove extra blank lines
      .trim();
  }

  /**
   * Load pre-existing alignment data from a JSON file
   */
  async loadAlignmentFromFile(filePath: string): Promise<ElevenLabsResponse> {
    try {
      const content = await readFile(filePath, 'utf-8');
      const data = JSON.parse(content);
      this.log('Loaded alignment from file:', filePath);
      this.log('Words in alignment:', data.words.length);
      return data as ElevenLabsResponse;
    } catch (error) {
      throw new Error(`Failed to load alignment from file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Save alignment data to a JSON file
   */
  async saveAlignmentToFile(filePath: string, data: ElevenLabsResponse): Promise<void> {
    try {
      await writeFile(filePath, JSON.stringify(data, null, 2));
      this.log('Saved alignment to file:', filePath);
    } catch (error) {
      throw new Error(`Failed to save alignment to file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Call ElevenLabs API to get word-level timestamps
   */
  async callElevenLabsAPI(audioFile: File, lyrics: string): Promise<ElevenLabsResponse> {
    const cleanLyrics = this.cleanLyrics(lyrics);

    this.log('Calling ElevenLabs API for:', audioFile.name);
    this.log('Lyrics length:', cleanLyrics.length);

    // Call ElevenLabs API
    const formData = new FormData();
    formData.append('file', audioFile);
    formData.append('text', cleanLyrics);

    const response = await fetch('https://api.elevenlabs.io/v1/forced-alignment', {
      method: 'POST',
      headers: {
        'xi-api-key': this.apiKey
      },
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
    }

    const alignmentData = await response.json();
    this.log('API call completed:', alignmentData.words.length, 'words received');

    return alignmentData;
  }

  /**
   * Filter out whitespace-only words from ElevenLabs response
   */
  filterActualWords(words: ElevenLabsResponse['words']) {
    return words.filter(word => {
      const text = word.text;
      return text.trim() !== '' && !/^\s+$/.test(text);
    });
  }

  /**
   * Set API key
   */
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  /**
   * Enable/disable debug logging
   */
  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
  }
}