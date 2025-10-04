import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useWalletClient } from 'wagmi';
import { ContentSource, pathToSource, type Segment, type Song } from '../../types/song';
import { getLitSearchService } from '../../services/LitSearchService';
import { convertReferentsToSegments, convertGeniusSongToSong } from '../../utils/content';
import { getContractSongById, getContractSongByIndex, resolveLensUri, fetchSongMetadata, type ClipMetadataV4, type SongMetadataV4 } from '../../services/SongRegistryService';
import { ClipPickerPage } from '../clips/ClipPickerPage';
import { generateGeniusExternalLinks, type GeniusSongMetadata } from '../../types/genius';
import { generateTriviaFromSong } from '../../services/TriviaCardGenerator';
import { getDueCards } from '../../services/database/tinybase';

/**
 * Segment Picker Page Route (URL-based)
 *
 * URL: /create/:source/:songId
 * - source: "native" | "genius"
 * - songId: song identifier (slug for native, numeric for genius)
 *
 * Fetches segments based on source and displays unified segment picker
 */
export const SegmentPickerPageRoute: React.FC = () => {
  const { source: sourceParam, songId } = useParams<{ source: string; songId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: walletClient } = useWalletClient();

  // Check for song data in navigation state (instant display)
  const initialSong = location.state?.song;

  const [loading, setLoading] = useState(!initialSong); // Only load if we don't have initial song data
  const [loadingSegments, setLoadingSegments] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [song, setSong] = useState<Song | null>(initialSong || null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [geniusMetadata, setGeniusMetadata] = useState<GeniusSongMetadata | null>(null);
  const [isGeneratingStudy, setIsGeneratingStudy] = useState(false);

  useEffect(() => {
    if (!sourceParam || !songId) {
      setError('Invalid URL parameters');
      setLoading(false);
      return;
    }

    loadSegments();
  }, [sourceParam, songId]);

  const loadSegments = async () => {
    if (!sourceParam || !songId) return;

    try {
      setLoadingSegments(true);
      setError(null);

      const source = pathToSource(sourceParam);
      console.log('[SegmentPickerPageRoute] Loading segments:', { source, songId });

      if (source === ContentSource.Native) {
        await loadNativeSegments(songId);
      } else if (source === ContentSource.Genius) {
        await loadGeniusSegments(songId);
      } else {
        throw new Error(`Unsupported source: ${sourceParam}`);
      }
    } catch (err) {
      console.error('[SegmentPickerPageRoute] Failed to load segments:', err);
      setError(err instanceof Error ? err.message : 'Failed to load segments');
    } finally {
      setLoading(false);
      setLoadingSegments(false);
    }
  };

  const loadNativeSegments = async (songId: string) => {
    console.log('[SegmentPickerPageRoute] Loading native segments for:', songId);

    // Fetch song from SongRegistryV4 contract
    // Try numeric index first (clean URLs), fallback to string ID
    let registrySong;
    const numericIndex = parseInt(songId);
    if (!isNaN(numericIndex)) {
      // It's a numeric index - use getSongByIndex
      registrySong = await getContractSongByIndex(numericIndex);
    } else {
      // It's a string ID - use getSongById
      registrySong = await getContractSongById(songId);
    }

    if (!registrySong) {
      throw new Error(`Song not found: ${songId}`);
    }

    console.log('[SegmentPickerPageRoute] Loaded registry song:', registrySong);

    // Convert to unified Song type
    const nativeSong: Song = {
      id: registrySong.id,
      source: ContentSource.Native,
      title: registrySong.title,
      artist: registrySong.artist,
      duration: registrySong.duration,
      thumbnailUrl: resolveLensUri(registrySong.thumbnailUri),
      audioUrl: resolveLensUri(registrySong.audioUri),
      _registryData: registrySong,
    };
    setSong(nativeSong);

    // Parse comma-separated clip URIs
    if (!registrySong.clipIds || registrySong.clipIds.trim() === '') {
      console.log('[SegmentPickerPageRoute] No clips found for song');
      setSegments([]);
      return;
    }

    const clipUris = registrySong.clipIds.split(',').map(uri => uri.trim()).filter(uri => uri);
    console.log(`[SegmentPickerPageRoute] Found ${clipUris.length} clip URIs`);

    // Fetch all clip metadata
    const clipPromises = clipUris.map(async (uri) => {
      try {
        const response = await fetch(resolveLensUri(uri));
        if (!response.ok) {
          console.error(`Failed to fetch clip from ${uri}`);
          return null;
        }
        return await response.json() as ClipMetadataV4;
      } catch (error) {
        console.error(`Error fetching clip from ${uri}:`, error);
        return null;
      }
    });

    const fetchedClips = (await Promise.all(clipPromises)).filter(c => c !== null) as ClipMetadataV4[];
    console.log(`[SegmentPickerPageRoute] Loaded ${fetchedClips.length} clips`);

    // Convert clips to Segment format
    const nativeSegments: Segment[] = fetchedClips.map(clip => ({
      id: clip.id,
      source: ContentSource.Native,
      title: clip.title,
      artist: clip.artist,
      sectionType: clip.sectionType,
      sectionIndex: clip.sectionIndex,
      duration: clip.duration,
      thumbnailUrl: resolveLensUri(clip.thumbnailUri),
      audioUrl: resolveLensUri(clip.audioUri),
      instrumentalUrl: resolveLensUri(clip.instrumentalUri),
      difficultyLevel: clip.difficultyLevel,
      wordsPerSecond: clip.wordsPerSecond,
      lyrics: {
        type: 'timestamped',
        lines: clip.lines.map(line => ({
          start: line.start,
          end: line.end,
          text: line.originalText,
          originalText: line.originalText,
          translatedText: line.translations?.cn,
          words: line.words,
        })),
      },
    }));

    console.log('[SegmentPickerPageRoute] Converted to native segments:', nativeSegments);
    setSegments(nativeSegments);
  };

  const loadGeniusSegments = async (songId: string) => {
    if (!walletClient) {
      throw new Error('Wallet connection required for Genius search');
    }

    console.log('[SegmentPickerPageRoute] Loading Genius segments for:', songId);

    const litSearch = getLitSearchService();

    // ALWAYS fetch full metadata for Genius songs (need URLs/paths for external links)
    // initialSong only has basic info (title, artist, thumbnail)
    const songResponse = await litSearch.getSongMetadata(songId, walletClient);
    if (!songResponse.success || !songResponse.song) {
      throw new Error(songResponse.error || 'Failed to fetch song metadata');
    }

    console.log('[SegmentPickerPageRoute] Received Genius metadata:', songResponse.song);

    // Store full Genius metadata for external links
    setGeniusMetadata(songResponse.song);
    console.log('[SegmentPickerPageRoute] Set geniusMetadata state');

    // Convert to unified Song type (update song even if we had initialSong)
    const geniusSong = convertGeniusSongToSong(songResponse.song);
    setSong(geniusSong);

    // Fetch referents (segments)
    const referentsResponse = await litSearch.getReferents(songId, walletClient);
    if (!referentsResponse.success) {
      throw new Error(referentsResponse.error || 'Failed to fetch referents');
    }

    // Convert to unified Segment type
    // Use song state (which is set either from initialSong or from fetch above)
    const currentSong = song || initialSong;
    const geniusSegments = convertReferentsToSegments(
      referentsResponse.referents,
      currentSong!.title,
      currentSong!.artist
    );

    console.log('[SegmentPickerPageRoute] Loaded Genius segments:', geniusSegments);
    setSegments(geniusSegments);
  };

  const handleSegmentSelect = (segment: Segment) => {
    console.log('[SegmentPickerPageRoute] Segment selected:', segment);

    // For Genius songs, skip mode selector (no audio modes)
    if (segment.source === ContentSource.Genius) {
      navigate(`/create/genius/${songId}/${segment.id}`);
    } else {
      // For Native songs, go to mode selector
      navigate('/create/mode-selector', {
        state: { segment }
      });
    }
  };

  const handleBack = () => {
    navigate('/create/song-picker');
  };

  const handlePlaySong = async () => {
    console.log('[SegmentPickerPageRoute] Play song clicked');

    if (!song) return;

    // For Native songs: Navigate to lyrics page with full metadata
    if (song.source === ContentSource.Native && song._registryData) {
      try {
        console.log('[SegmentPickerPageRoute] Fetching full song metadata...');
        const fullMetadata: SongMetadataV4 = await fetchSongMetadata(song._registryData.metadataUri);

        navigate('/create/lyrics', {
          state: {
            song,
            fullMetadata,
            clips: [], // Not needed when we have fullMetadata
          }
        });
      } catch (error) {
        console.error('[SegmentPickerPageRoute] Failed to load full metadata:', error);
      }
    }

    // For Genius songs: No audio, so maybe show lyrics only or do nothing
    // TODO: Decide what to do for Genius songs
  };

  const handleStudy = async () => {
    if (!song || !songId || !walletClient) return;

    setIsGeneratingStudy(true);

    try {
      console.log('[SegmentPickerPageRoute] Starting study session for song:', songId);

      // For Genius songs, generate trivia cards if not already created
      if (song.source === ContentSource.Genius) {
        const geniusSongId = parseInt(songId);

        console.log('[SegmentPickerPageRoute] Generating trivia cards for Genius song:', geniusSongId);
        await generateTriviaFromSong(
          geniusSongId,
          song.title,
          song.artist,
          walletClient
        );
        console.log('[SegmentPickerPageRoute] Trivia cards generated');
      }

      // Get FSRS-scheduled cards (max 10)
      const dueCards = getDueCards(10);
      console.log(`[SegmentPickerPageRoute] Found ${dueCards.length} due cards`);

      // Navigate to study page
      navigate('/study');

    } catch (error) {
      console.error('[SegmentPickerPageRoute] Failed to start study session:', error);
      setError(error instanceof Error ? error.message : 'Failed to start study session');
    } finally {
      setIsGeneratingStudy(false);
    }
  };

  // Only show error if we have no song data at all
  if (error && !song) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black text-white">
        <div className="text-center max-w-md px-4">
          <h2 className="text-xl font-bold mb-4">Failed to Load Segments</h2>
          <p className="text-gray-400 mb-6">{error}</p>
          <button
            onClick={handleBack}
            className="px-6 py-2 bg-white text-black rounded-lg hover:bg-gray-200"
          >
            Back to Songs
          </button>
        </div>
      </div>
    );
  }

  // If we don't have song yet and we're loading, show minimal skeleton
  if (!song && loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading song...</p>
        </div>
      </div>
    );
  }

  // Should never happen, but TypeScript needs this
  if (!song) {
    return null;
  }

  // Create skeleton clips while loading
  const SKELETON_CLIPS = Array(6).fill(null).map((_, i) => ({
    id: `skeleton-${i}`,
    title: '',  // Empty for skeleton appearance
    artist: '',
    sectionType: '',  // Empty for skeleton appearance
    sectionIndex: i,
    duration: 0,  // No duration for skeleton
    difficultyLevel: 3,
    wordsPerSecond: 2,
    lineTimestamps: [],
    totalLines: 0,
    languages: ['en'],
  }));

  // Convert segments to ClipMetadata format for ClipPickerPage
  // This is a temporary adapter - we'll refactor ClipPickerPage to use Segment type later
  const clips = loadingSegments ? SKELETON_CLIPS : segments.map(segment => ({
    id: segment.id,
    title: segment.title,
    artist: segment.artist,
    sectionType: segment.sectionType,
    sectionIndex: segment.sectionIndex ?? 0,
    duration: segment.duration ?? 0, // Genius segments have no audio/duration
    difficultyLevel: segment.difficultyLevel ?? 3,
    wordsPerSecond: segment.wordsPerSecond ?? 2,
    lineTimestamps: segment.lyrics.type === 'timestamped'
      ? segment.lyrics.lines
      : segment.lyrics.lines.map((line, i) => ({
          start: i * 3,
          end: (i + 1) * 3,
          text: line.text,
          originalText: line.originalText,
        })),
    totalLines: segment.lyrics.lines.length,
    languages: ['en'],
  }));

  // Generate external links for Genius songs
  console.log('[SegmentPickerPageRoute] geniusMetadata:', geniusMetadata);
  const externalLinks = geniusMetadata ? generateGeniusExternalLinks(geniusMetadata) : { songLinks: [], lyricsLinks: [] };
  console.log('[SegmentPickerPageRoute] Generated external links:', externalLinks);
  console.log('[SegmentPickerPageRoute] isExternal:', song.source === ContentSource.Genius);

  return (
    <ClipPickerPage
      clips={clips}
      onClipSelect={(clip) => {
        const segment = segments.find(s => s.id === clip.id);
        if (segment) {
          handleSegmentSelect(segment);
        }
      }}
      onBack={handleBack}
      songTitle={song.title}
      artist={song.artist}
      thumbnailUrl={song.thumbnailUrl}
      isExternal={song.source === ContentSource.Genius}
      audioUrl={song.audioUrl}
      onPlaySong={handlePlaySong}
      externalSongLinks={externalLinks.songLinks}
      externalLyricsLinks={externalLinks.lyricsLinks}
      geniusSongId={song.source === ContentSource.Genius ? parseInt(songId!) : undefined}
      onStudy={handleStudy}
      isGeneratingStudy={isGeneratingStudy}
    />
  );
};
