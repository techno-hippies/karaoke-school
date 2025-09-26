interface LineTimestamp {
  lineIndex: number;
  originalText: string;
  translatedText: string;
  start: number;
  end: number;
  wordCount: number;
}

interface RecommendedSegment {
  start: number;
  end: number;
  reason: string;
  title: string;
  score: number;
}

interface SongData {
  lineTimestamps: LineTimestamp[];
  totalLines: number;
}

export class SegmentRecommendationEngine {
  private song: SongData;
  private minSegmentLength: number;
  private maxSegmentLength: number;

  constructor(song: SongData, minLength = 10, maxLength = 30) {
    this.song = song;
    this.minSegmentLength = minLength;
    this.maxSegmentLength = maxLength;
  }

  generateRecommendations(): RecommendedSegment[] {
    const segments: RecommendedSegment[] = [];

    // 1. Find repeated lyrics patterns (chorus detection)
    const repeatedSegments = this.findRepeatedPatterns();
    segments.push(...repeatedSegments);

    // 2. Find high-density lyric sections
    const densitySegments = this.findHighDensitySections();
    segments.push(...densitySegments);

    // 3. Find segments with good rhythm (consistent timing)
    const rhythmSegments = this.findRhythmicSections();
    segments.push(...rhythmSegments);

    // 4. Remove overlapping segments and sort by score
    const uniqueSegments = this.deduplicateSegments(segments);

    // Return top 3 recommendations
    return uniqueSegments
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }

  private findRepeatedPatterns(): RecommendedSegment[] {
    const segments: RecommendedSegment[] = [];
    const lines = this.song.lineTimestamps;

    // Group similar lines by text similarity
    const textGroups = new Map<string, LineTimestamp[]>();

    lines.forEach(line => {
      const normalizedText = this.normalizeText(line.originalText);

      // Check for similar existing groups
      let foundGroup = false;
      for (const [groupKey, group] of textGroups) {
        if (this.calculateSimilarity(normalizedText, groupKey) > 0.7) {
          group.push(line);
          foundGroup = true;
          break;
        }
      }

      if (!foundGroup) {
        textGroups.set(normalizedText, [line]);
      }
    });

    // Find groups with multiple occurrences (likely chorus/repeated sections)
    textGroups.forEach((group, text) => {
      if (group.length >= 2) {
        // For each occurrence, try to build a segment around it
        group.forEach((centerLine, index) => {
          const segment = this.buildSegmentAroundLine(centerLine, `Repeated Section ${index + 1}`);
          if (segment) {
            segment.score += group.length * 10; // Bonus for repetition
            segment.reason = `Repeated lyrics (appears ${group.length} times)`;
            segments.push(segment);
          }
        });
      }
    });

    return segments;
  }

  private findHighDensitySections(): RecommendedSegment[] {
    const segments: RecommendedSegment[] = [];
    const lines = this.song.lineTimestamps;

    // Calculate lyric density in sliding windows
    for (let i = 0; i < lines.length - 1; i++) {
      const windowStart = lines[i].start;

      // Find all lines that could fit in max segment length
      const windowLines = lines.filter(line =>
        line.start >= windowStart &&
        line.start <= windowStart + this.maxSegmentLength
      );

      if (windowLines.length >= 2) {
        const windowEnd = Math.min(
          windowStart + this.maxSegmentLength,
          windowLines[windowLines.length - 1].end
        );

        const duration = windowEnd - windowStart;

        if (duration >= this.minSegmentLength && duration <= this.maxSegmentLength) {
          const totalWords = windowLines.reduce((sum, line) => sum + line.wordCount, 0);
          const density = totalWords / duration; // words per second

          segments.push({
            start: windowStart,
            end: windowEnd,
            reason: `High lyric density (${density.toFixed(1)} words/sec)`,
            title: `Dense Section (${windowLines.length} lines)`,
            score: density * 5 + windowLines.length * 2
          });
        }
      }
    }

    return segments;
  }

  private findRhythmicSections(): RecommendedSegment[] {
    const segments: RecommendedSegment[] = [];
    const lines = this.song.lineTimestamps;

    // Look for sections with consistent line timing
    for (let i = 0; i < lines.length - 2; i++) {
      const consecutiveLines = [];
      let currentIndex = i;

      // Collect consecutive lines that fit in segment length
      while (currentIndex < lines.length &&
             lines[currentIndex].start - lines[i].start <= this.maxSegmentLength) {
        consecutiveLines.push(lines[currentIndex]);
        currentIndex++;
      }

      if (consecutiveLines.length >= 3) {
        const durations = consecutiveLines.map(line => line.end - line.start);
        const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;

        // Calculate rhythm consistency (lower variance = more consistent)
        const variance = durations.reduce((sum, dur) =>
          sum + Math.pow(dur - avgDuration, 2), 0) / durations.length;

        const consistency = 1 / (1 + variance); // Higher = more consistent

        if (consistency > 0.5) {
          const segmentEnd = Math.min(
            lines[i].start + this.maxSegmentLength,
            consecutiveLines[consecutiveLines.length - 1].end
          );

          const duration = segmentEnd - lines[i].start;

          if (duration >= this.minSegmentLength) {
            segments.push({
              start: lines[i].start,
              end: segmentEnd,
              reason: `Good rhythm (consistent ${avgDuration.toFixed(1)}s lines)`,
              title: `Rhythmic Section (${consecutiveLines.length} lines)`,
              score: consistency * 10 + consecutiveLines.length
            });
          }
        }
      }
    }

    return segments;
  }

  private buildSegmentAroundLine(centerLine: LineTimestamp, title: string): RecommendedSegment | null {
    const lines = this.song.lineTimestamps;
    const centerIndex = lines.findIndex(l => l.lineIndex === centerLine.lineIndex);

    if (centerIndex === -1) return null;

    // Try to build optimal segment around this line
    let start = centerLine.start;
    let end = centerLine.end;
    let includedLines = [centerLine];

    // Expand backwards
    for (let i = centerIndex - 1; i >= 0; i--) {
      const candidateStart = lines[i].start;
      if (end - candidateStart <= this.maxSegmentLength) {
        start = candidateStart;
        includedLines.unshift(lines[i]);
      } else {
        break;
      }
    }

    // Expand forwards
    for (let i = centerIndex + 1; i < lines.length; i++) {
      const candidateEnd = lines[i].end;
      if (candidateEnd - start <= this.maxSegmentLength) {
        end = candidateEnd;
        includedLines.push(lines[i]);
      } else {
        break;
      }
    }

    const duration = end - start;
    if (duration < this.minSegmentLength || duration > this.maxSegmentLength) {
      return null;
    }

    return {
      start,
      end,
      reason: `Built around key line`,
      title,
      score: includedLines.length * 3 // Base score
    };
  }

  private normalizeText(text: string): string {
    return text.toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' ')    // Normalize whitespace
      .trim();
  }

  private calculateSimilarity(text1: string, text2: string): number {
    const words1 = text1.split(' ');
    const words2 = text2.split(' ');

    const commonWords = words1.filter(word => words2.includes(word));
    const totalWords = new Set([...words1, ...words2]).size;

    return commonWords.length / totalWords;
  }

  private deduplicateSegments(segments: RecommendedSegment[]): RecommendedSegment[] {
    const unique: RecommendedSegment[] = [];

    segments.forEach(segment => {
      const overlapping = unique.find(existing =>
        this.segmentsOverlap(segment, existing, 0.5) // 50% overlap threshold
      );

      if (overlapping) {
        // Keep the higher scoring segment
        if (segment.score > overlapping.score) {
          const index = unique.indexOf(overlapping);
          unique[index] = segment;
        }
      } else {
        unique.push(segment);
      }
    });

    return unique;
  }

  private segmentsOverlap(seg1: RecommendedSegment, seg2: RecommendedSegment, threshold: number): boolean {
    const overlapStart = Math.max(seg1.start, seg2.start);
    const overlapEnd = Math.min(seg1.end, seg2.end);
    const overlapDuration = Math.max(0, overlapEnd - overlapStart);

    const seg1Duration = seg1.end - seg1.start;
    const seg2Duration = seg2.end - seg2.start;

    const overlapRatio1 = overlapDuration / seg1Duration;
    const overlapRatio2 = overlapDuration / seg2Duration;

    return Math.max(overlapRatio1, overlapRatio2) > threshold;
  }
}

// Convenience function to generate recommendations for a song
export function generateSegmentRecommendations(
  song: SongData,
  minLength = 10,
  maxLength = 30
): RecommendedSegment[] {
  const engine = new SegmentRecommendationEngine(song, minLength, maxLength);
  return engine.generateRecommendations();
}