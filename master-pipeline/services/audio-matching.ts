/**
 * Audio Matching Service
 *
 * Matches TikTok audio clips to full songs using:
 * 1. Voxtral STT on clip
 * 2. ElevenLabs forced alignment on full song + lyrics
 * 3. Gemini Flash 2.5 Lite for intelligent matching
 *
 * Based on audio-matching-test/scripts/match-audio-alignment.mjs
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { VoxtralService } from './voxtral.js';
import { ElevenLabsService } from './elevenlabs.js';
import { OpenRouterService } from './openrouter.js';
import { LRCLibService } from './lrclib.js';

const execAsync = promisify(exec);

export interface MatchResult {
  startTime: number;
  endTime: number;
  duration: number;
  confidence: number;
  startIdx: number;
  endIdx: number;
  clipVocalDuration: number;
  clipVocalStart: number;
  clipVocalEnd: number;
  clipTranscript: string;
  method: string;
  lrcMatch?: {
    id: number;
    trackName: string;
    artistName: string;
    albumName: string;
  };
  fullAlignment?: Array<{ start: number; text: string }>; // Full song alignment for cropping
}

export class AudioMatchingService {
  private voxtral: VoxtralService;
  private elevenlabs: ElevenLabsService;
  private openrouter: OpenRouterService;
  private lrclib: LRCLibService;

  constructor(config?: {
    voxtralApiKey?: string;
    elevenLabsApiKey?: string;
    openRouterApiKey?: string;
  }) {
    this.voxtral = new VoxtralService({
      apiKey: config?.voxtralApiKey,
    });

    this.elevenlabs = new ElevenLabsService({
      apiKey: config?.elevenLabsApiKey,
    });

    this.openrouter = new OpenRouterService({
      apiKey: config?.openRouterApiKey,
    });

    this.lrclib = new LRCLibService();
  }

  /**
   * Extract audio from video file using ffmpeg
   */
  private async extractAudio(videoFile: string): Promise<string> {
    const audioFile = videoFile.replace(/\.(mp4|mov|avi)$/i, '_extracted.mp3');

    console.log('📹 Extracting audio from video...');

    await execAsync(
      `ffmpeg -i "${videoFile}" -vn -acodec libmp3lame -q:a 2 -y "${audioFile}"`
    );

    console.log(`✓ Extracted to: ${audioFile}\n`);
    return audioFile;
  }

  /**
   * Format seconds as MM:SS
   */
  private formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(2);
    return `${mins}:${secs.padStart(5, '0')}`;
  }

  /**
   * Match TikTok clip to full song using forced alignment + Gemini
   * Automatically fetches lyrics from LRCLib
   *
   * @param clipPath Path to TikTok clip (mp4 or mp3)
   * @param fullSongPath Path to full song audio
   * @param trackName Song title
   * @param artistName Artist name
   * @param albumName Optional album name
   * @returns Match result with timestamps
   */
  async matchClipToSong(
    clipPath: string,
    fullSongPath: string,
    trackName: string,
    artistName: string,
    albumName?: string
  ): Promise<MatchResult> {
    console.log('🎵 Forced Alignment Audio Matching Pipeline\n');
    console.log(`Clip: ${clipPath}`);
    console.log(`Full Song: ${fullSongPath}`);
    console.log(`Track: ${trackName} by ${artistName}`);
    if (albumName) console.log(`Album: ${albumName}`);
    console.log();

    // Step 1: Fetch lyrics from LRCLib
    console.log('Step 1: Fetching lyrics from LRCLib...');
    const lrcMatch = await this.lrclib.getBestMatch(trackName, artistName, albumName);

    if (!lrcMatch) {
      throw new Error('No lyrics found in LRCLib');
    }

    if (!lrcMatch.syncedLyrics) {
      throw new Error('No synced lyrics available in LRCLib');
    }

    console.log(`  ✓ Found: ${lrcMatch.trackName} by ${lrcMatch.artistName}`);
    console.log(`  LRCLib ID: ${lrcMatch.id}`);
    console.log(`  Synced lines: ${lrcMatch.syncedLyrics.split('\n').length}`);
    console.log();

    // Convert synced lyrics to plain text for forced alignment
    const plainLyrics = this.lrclib.getPlainLyrics(lrcMatch.syncedLyrics);
    const lineCount = plainLyrics.split('\n').length;
    console.log(`  ✓ Extracted ${lineCount} lines of plain text\n`);

    // Step 2: Transcribe TikTok clip with Voxtral STT
    console.log('Step 2: Transcribe TikTok clip with Voxtral STT...');

    // Extract audio if video
    let clipAudio = clipPath;
    if (/\.(mp4|mov|avi)$/i.test(clipPath)) {
      clipAudio = await this.extractAudio(clipPath);
    }

    const { text: clipText } = await this.voxtral.transcribe(clipAudio);
    console.log(`  ✓ Transcribed clip\n`);

    // Get vocal timing from clip (we'll use ElevenLabs to get word timestamps)
    console.log('  Getting vocal timing from clip...');
    const clipAlignment = await this.elevenlabs.transcribe(clipAudio);
    const clipWords = clipAlignment.words || [];

    const clipVocalStart = clipWords.length > 0 ? clipWords[0].start : 0;
    const clipVocalEnd = clipWords.length > 0 ? clipWords[clipWords.length - 1].end : 0;
    const clipVocalDuration = clipVocalEnd - clipVocalStart;

    console.log(
      `  Vocal timing in clip: ${clipVocalStart.toFixed(2)}s - ${clipVocalEnd.toFixed(2)}s (${clipVocalDuration.toFixed(2)}s)\n`
    );

    // Step 3: Run forced alignment on full song
    console.log('Step 3: Run ElevenLabs forced alignment on full song...');
    const alignment = await this.elevenlabs.forcedAlignment(fullSongPath, plainLyrics);
    const fullWords = alignment.words || [];
    console.log(`  ✓ Aligned ${fullWords.length} words with perfect timestamps\n`);

    // Step 4: Use Gemini Flash 2.5 to find the match
    console.log('Step 4: Using Gemini Flash 2.5 to find match...');
    const match = await this.openrouter.findSegmentMatch(clipText, fullWords);

    const startIdx = match.startIdx;
    const endIdx = match.endIdx;

    // Use vocal-only duration (excludes intro/outro effects)
    console.log(`  Using vocal duration: ${clipVocalDuration.toFixed(2)}s (excludes intro/outro)\n`);

    // If match starts at the beginning (index 0), use 0 as start time to include intro
    // Otherwise use the first word's timestamp
    const startTime = startIdx === 0 ? 0 : fullWords[startIdx].start;
    const endTime = startTime + clipVocalDuration;

    const bestMatch = {
      startTime,
      endTime,
      confidence: 1.0,
      geminiEndIdx: endIdx,
      clipVocalDuration: clipVocalDuration,
      clipVocalStart: clipVocalStart,
      clipVocalEnd: clipVocalEnd,
    };

    const mins = Math.floor(bestMatch.startTime / 60);
    const secs = (bestMatch.startTime % 60).toFixed(2);
    const endMins = Math.floor(bestMatch.endTime / 60);
    const endSecs = (bestMatch.endTime % 60).toFixed(2);
    const duration = (bestMatch.endTime - bestMatch.startTime).toFixed(2);

    console.log('\n✅ Match found!');
    console.log(`  Start: ${mins}:${secs.padStart(5, '0')} (${bestMatch.startTime.toFixed(2)}s)`);
    console.log(`  End: ${endMins}:${endSecs.padStart(5, '0')} (${bestMatch.endTime.toFixed(2)}s)`);
    console.log(`  Duration: ${duration}s`);
    console.log(`  Confidence: ${(bestMatch.confidence * 100).toFixed(1)}%\n`);

    return {
      startTime: bestMatch.startTime,
      endTime: bestMatch.endTime,
      duration: bestMatch.endTime - bestMatch.startTime,
      confidence: bestMatch.confidence,
      startIdx,
      endIdx,
      clipVocalDuration: clipVocalDuration,
      clipVocalStart: clipVocalStart,
      clipVocalEnd: clipVocalEnd,
      clipTranscript: clipText,
      method: 'forced_alignment_with_gemini',
      lrcMatch: {
        id: lrcMatch.id,
        trackName: lrcMatch.trackName,
        artistName: lrcMatch.artistName,
        albumName: lrcMatch.albumName,
      },
      fullAlignment: fullWords, // Save for segment metadata cropping
    };
  }
}
