import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, CaretLeft, ArrowRight } from '@phosphor-icons/react';
import { generateSegmentRecommendations } from '../../lib/segment-recommendations';

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
}

interface SongWithTimestamps {
  title: string;
  artist: string;
  audioUrl: string;
  lineTimestamps: LineTimestamp[];
  totalLines: number;
  exportedAt: string;
  format: string;
}

interface SelectedSegment {
  start: number;
  end: number;
  lyrics: LineTimestamp[];
}

interface SegmentPickerProps {
  song: SongWithTimestamps;
  onBack?: () => void;
  onNext?: (segment: SelectedSegment) => void;
  maxSegmentLength?: number;
  minSegmentLength?: number;
  className?: string;
}

export const SegmentPicker: React.FC<SegmentPickerProps> = ({
  song,
  onBack,
  onNext,
  maxSegmentLength = 30,
  minSegmentLength = 10,
  className = ''
}) => {
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedSegment, setSelectedSegment] = useState<SelectedSegment | null>(null);
  const [currentRegion, setCurrentRegion] = useState<any>(null);

  // Get lyrics for a time range
  const getLyricsForTimeRange = (start: number, end: number): LineTimestamp[] => {
    return song.lineTimestamps.filter(line => {
      // Include lines that overlap with the selected time range
      return (line.start <= end && line.end >= start);
    });
  };

  // Initialize WaveSurfer
  useEffect(() => {
    if (!waveformRef.current || typeof window === 'undefined') return;

    const loadWaveSurfer = async () => {
      // Dynamic import to avoid SSR issues
      const WaveSurfer = (await import('wavesurfer.js')).default;
      const RegionsPlugin = (await import('wavesurfer.js/dist/plugins/regions.js')).default;

      const regions = RegionsPlugin.create();

      wavesurferRef.current = WaveSurfer.create({
        container: waveformRef.current!,
        waveColor: '#4f46e5',
        progressColor: '#6366f1',
        backgroundColor: '#1f2937',
        barWidth: 2,
        barGap: 1,
        height: 80,
        plugins: [regions]
      });

      // Load audio
      wavesurferRef.current.load(song.audioUrl);

      // Handle play/pause
      wavesurferRef.current.on('play', () => setIsPlaying(true));
      wavesurferRef.current.on('pause', () => setIsPlaying(false));

      // Add recommended segment as default
      wavesurferRef.current.on('ready', () => {
        // Generate smart recommendations
        const recommendations = generateSegmentRecommendations(
          { lineTimestamps: song.lineTimestamps, totalLines: song.totalLines },
          minSegmentLength,
          maxSegmentLength
        );

        const defaultSegment = recommendations[0] || {
          start: 30,
          end: 45,
          reason: 'Auto-selected',
          title: 'Suggested segment'
        };

        const region = regions.addRegion({
          start: defaultSegment.start,
          end: defaultSegment.end,
          color: 'rgba(99, 102, 241, 0.3)',
          resize: true,
          drag: true
        });

        setCurrentRegion(region);
        updateSelectedSegment(region);
      });

      // Handle region updates
      regions.on('region-updated', (region: any) => {
        setCurrentRegion(region);
        updateSelectedSegment(region);
      });

      regions.on('region-created', (region: any) => {
        // Remove previous regions to allow only one selection
        regions.getRegions().forEach((r: any) => {
          if (r !== region) r.remove();
        });
        setCurrentRegion(region);
        updateSelectedSegment(region);
      });

      // Handle region click/drag updates
      regions.on('region-click', (region: any) => {
        setCurrentRegion(region);
        updateSelectedSegment(region);
      });

      // Enable drag selection
      regions.enableDragSelection({
        color: 'rgba(99, 102, 241, 0.2)'
      });
    };

    loadWaveSurfer();

    return () => {
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy();
      }
    };
  }, [song.audioUrl]);

  const updateSelectedSegment = (region: any) => {
    if (!region) return;

    const start = region.start;
    const end = region.end;

    // Always update lyrics even if duration is outside limits
    // This gives immediate feedback to the user
    const lyrics = getLyricsForTimeRange(start, end);
    setSelectedSegment({ start, end, lyrics });

    // Optional: Log duration warnings without blocking the update
    const duration = end - start;
    if (duration > maxSegmentLength || duration < minSegmentLength) {
      console.log(`Segment duration ${duration.toFixed(1)}s is outside recommended range (${minSegmentLength}-${maxSegmentLength}s)`);
    }
  };

  const togglePlayPause = () => {
    if (wavesurferRef.current && selectedSegment) {
      if (isPlaying) {
        wavesurferRef.current.pause();
      } else {
        // Set playback position to segment start and play
        wavesurferRef.current.setTime(selectedSegment.start);
        wavesurferRef.current.play();

        // Stop playback at segment end
        const stopTimer = setTimeout(() => {
          if (wavesurferRef.current) {
            wavesurferRef.current.pause();
          }
        }, (selectedSegment.end - selectedSegment.start) * 1000);

        // Clear timer if user pauses manually
        wavesurferRef.current.once('pause', () => {
          clearTimeout(stopTimer);
        });
      }
    }
  };

  const handleNext = () => {
    if (selectedSegment && onNext) {
      onNext(selectedSegment);
    }
  };

  return (
    <div className={`relative w-full h-screen bg-neutral-900 overflow-hidden ${className}`}>
      {/* Safe area spacer */}
      <div className="h-16 w-full bg-transparent"></div>

      {/* Header */}
      <div className="absolute top-4 left-4 z-50">
        <button
          onClick={onBack}
          className="w-12 h-12 flex items-center justify-center hover:bg-neutral-800 transition-colors cursor-pointer rounded-full"
        >
          <CaretLeft className="w-6 h-6 text-white" />
        </button>
      </div>

      {/* Main content area */}
      <div className="absolute top-16 left-0 right-0 bottom-20 px-4 flex flex-col">

        {/* Selected lyrics display */}
        {selectedSegment && (
          <div className="flex-1 overflow-hidden mb-6 p-4">
            {selectedSegment.lyrics.length > 0 ? (
              <div className="space-y-3 h-full overflow-y-auto">
                {selectedSegment.lyrics.map((line, index) => (
                  <div key={line.lineIndex} className="text-center">
                    <p className="text-white text-lg font-medium leading-relaxed">
                      {line.originalText}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-neutral-400 text-center">
                  No lyrics found for this segment.<br />
                  Try selecting a different part of the song.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Waveform */}
        <div className="mb-6">
          <div
            ref={waveformRef}
            className="w-full rounded-lg overflow-hidden border border-neutral-700"
          />

          {/* Play controls */}
          <div className="flex items-center justify-center mt-4">
            <button
              onClick={togglePlayPause}
              className="w-12 h-12 flex items-center justify-center bg-red-500 hover:bg-red-600 transition-colors cursor-pointer rounded-full"
            >
              {isPlaying ? (
                <Pause className="w-6 h-6 text-white" weight="fill" />
              ) : (
                <Play className="w-6 h-6 text-white" weight="fill" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Sticky bottom next button */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-neutral-900">
        <button
          onClick={handleNext}
          disabled={!selectedSegment}
          className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-600 disabled:cursor-not-allowed transition-colors text-white font-semibold text-lg rounded-lg"
        >
          Next
        </button>
      </div>
    </div>
  );
};