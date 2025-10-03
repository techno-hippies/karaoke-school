import React, { useState, useEffect, useRef } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '../ui/sheet';
import { SongListItem } from '../ui/SongListItem';
import type { Song, ClipMetadata } from '../../types/song';

interface ClipPickerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clips: ClipMetadata[];
  onClipSelect: (clip: ClipMetadata) => void;
}

export const ClipPickerSheet: React.FC<ClipPickerSheetProps> = ({
  open,
  onOpenChange,
  clips,
  onClipSelect
}) => {
  const [playingClipId, setPlayingClipId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Handle clip preview playback
  const handlePlay = (clip: ClipMetadata) => {
    if (playingClipId === clip.id) {
      // Stop current playback
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setPlayingClipId(null);
    } else {
      // Start new playback (clips are short, play from start)
      if (audioRef.current && clip.audioUrl) {
        audioRef.current.src = clip.audioUrl;
        audioRef.current.currentTime = 0; // Clips are short, start from beginning
        audioRef.current.play();
        setPlayingClipId(clip.id);
      }
    }
  };

  // Handle clip selection
  const handleClipSelect = (clip: ClipMetadata) => {
    // Stop any playing audio
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setPlayingClipId(null);

    console.log('[ClipPickerSheet] Clip selected:', clip);
    onClipSelect(clip);
    onOpenChange(false);
  };

  // Stop audio when sheet closes
  useEffect(() => {
    if (!open && audioRef.current) {
      audioRef.current.pause();
      setPlayingClipId(null);
    }
  }, [open]);

  // Handle audio end
  const handleAudioEnd = () => {
    setPlayingClipId(null);
  };

  return (
    <>
      {/* Hidden audio element for previews */}
      <audio
        ref={audioRef}
        onEnded={handleAudioEnd}
        preload="none"
      />

      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="h-[60vh] bg-neutral-900 border-neutral-800 p-0 flex flex-col"
        >
          <SheetHeader className="flex-none border-b border-neutral-800 p-4">
            <SheetTitle className="text-white text-center">Choose a Clip</SheetTitle>
          </SheetHeader>

          {/* Scrollable clip list */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-4 space-y-1">
              {clips.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <p className="text-gray-400 text-center">
                    No clips available for this song
                  </p>
                </div>
              ) : (
                clips.map((clip) => {
                  // Convert clip to song format for SongListItem
                  const clipAsSong: Song = {
                    id: clip.id,
                    title: clip.sectionType,
                    artist: `${Math.floor(clip.duration)}s`,
                    duration: clip.duration,
                    audioUrl: clip.audioUrl,
                    thumbnailUrl: clip.thumbnailUrl
                  };

                  return (
                    <SongListItem
                      key={clip.id}
                      song={clipAsSong}
                      isPlaying={playingClipId === clip.id}
                      showSelectButton={true}
                      showThumbnail={false}
                      onClick={() => handleClipSelect(clip)}
                      onPlay={() => handlePlay(clip)}
                      onSelect={() => handleClipSelect(clip)}
                      className="rounded-lg"
                    />
                  );
                })
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};
