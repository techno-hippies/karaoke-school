import React, { useState, useEffect, useRef } from 'react';
import { CaretLeft } from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';
import { useWalletClient } from 'wagmi';
import { SongListItem } from '../ui/SongListItem';
import { SearchInput } from '../ui/SearchInput';
import type { Song, Clip, ClipMetadata } from '../../types/song';
import { getContractSongs, fetchSongMetadata, resolveLensUri, type RegistrySong, type SongMetadataV4 } from '../../services/SongRegistryService';
import { getLitSearchService, type GeniusSearchResult } from '../../services/LitSearchService';

interface SongPickerPageProps {
  onBack?: () => void;
  onSongSelect?: (song: Song) => void;
  className?: string;
}

export const SongPickerPage: React.FC<SongPickerPageProps> = ({
  onBack,
  onSongSelect,
  className = ''
}) => {
  const navigate = useNavigate();
  const { data: walletClient } = useWalletClient();
  const [songs, setSongs] = useState<Song[]>([]);
  const [registrySongs, setRegistrySongs] = useState<RegistrySong[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [selectedMetadata, setSelectedMetadata] = useState<SongMetadataV4 | null>(null);
  const [playingSongId, setPlayingSongId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [geniusResults, setGeniusResults] = useState<GeniusSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Load songs from contract on mount
  useEffect(() => {
    loadSongs();
  }, []);

  const loadSongs = async () => {
    try {
      setLoading(true);
      console.log('[SongPickerPage] Loading songs from SongRegistryV4...');
      const contractSongs = await getContractSongs();
      console.log('[SongPickerPage] Loaded contract songs:', contractSongs);

      // Store registry songs for later metadata fetching
      setRegistrySongs(contractSongs);

      // Convert to Song format for display
      const displaySongs: Song[] = contractSongs.map(song => ({
        id: song.id,
        title: song.title,
        artist: song.artist,
        duration: song.duration,
        thumbnailUrl: resolveLensUri(song.thumbnailUri),
        audioUrl: resolveLensUri(song.audioUri),
        // Store additional metadata for later use
        _registryData: song
      }));

      setSongs(displaySongs);
      console.log('[SongPickerPage] Converted to display songs:', displaySongs);
    } catch (error) {
      console.error('Failed to load songs:', error);
    } finally {
      setLoading(false);
    }
  };



  // Handle song selection - fetch clips and full metadata, navigate to clip picker page
  const handleSongSelect = async (song: Song) => {
    console.log('[SongPickerPage] Song selected:', song);
    setSelectedSong(song);

    // Get clip URIs and metadata URI from registry data
    const registryData = (song as any)._registryData as RegistrySong;
    console.log('[SongPickerPage] Registry data clipIds:', registryData?.clipIds);
    console.log('[SongPickerPage] Registry data metadataUri:', registryData?.metadataUri);

    let clips: ClipMetadata[] = [];
    let fullMetadata: SongMetadataV4 | null = null;

    if (registryData?.clipIds && registryData.clipIds.trim() !== '') {
      try {
        // Parse comma-separated clip URIs
        const clipUris = registryData.clipIds.split(',').map(uri => uri.trim()).filter(uri => uri);
        console.log(`[SongPickerPage] Found ${clipUris.length} clip URIs:`, clipUris);

        // Fetch all clip metadata
        const clipPromises = clipUris.map(async (uri) => {
          try {
            const response = await fetch(resolveLensUri(uri));
            if (!response.ok) {
              console.error(`Failed to fetch clip from ${uri}`);
              return null;
            }
            return await response.json();
          } catch (error) {
            console.error(`Error fetching clip from ${uri}:`, error);
            return null;
          }
        });

        const fetchedClips = (await Promise.all(clipPromises)).filter(c => c !== null);
        console.log(`[SongPickerPage] Loaded ${fetchedClips.length} clips`);

        // Convert to ClipMetadata format
        clips = fetchedClips.map(clip => {
          const lineTimestamps = clip.lines.map(line => ({
            start: line.start,
            end: line.end,
            text: line.originalText,
            originalText: line.originalText,
            translatedText: line.translations?.cn || line.originalText,
            lineIndex: line.lineIndex,
            wordCount: line.words?.length || 0,
            words: line.words?.map(word => ({
              text: word.text,
              start: word.start,
              end: word.end
            })) || []
          }));

          return {
            id: clip.id,
            title: clip.title,
            artist: clip.artist,
            sectionType: clip.sectionType,
            sectionIndex: clip.sectionIndex,
            duration: clip.duration,
            audioUrl: clip.audioUri ? resolveLensUri(clip.audioUri) : '',
            instrumentalUrl: clip.instrumentalUri ? resolveLensUri(clip.instrumentalUri) : '',
            thumbnailUrl: clip.thumbnailUri ? resolveLensUri(clip.thumbnailUri) : '',
            difficultyLevel: clip.difficultyLevel,
            wordsPerSecond: clip.wordsPerSecond,
            lineTimestamps,
            totalLines: clip.lines.length,
            languages: clip.languages
          };
        });
      } catch (error) {
        console.error('[SongPickerPage] Failed to load clips:', error);
      }
    } else {
      console.log('[SongPickerPage] No clipIds in registry data');
    }

    // Fetch full song metadata with complete lyrics
    if (registryData?.metadataUri && registryData.metadataUri.trim() !== '') {
      try {
        console.log('[SongPickerPage] Fetching full song metadata...');
        fullMetadata = await fetchSongMetadata(registryData.metadataUri);
        console.log('[SongPickerPage] Loaded full metadata with', fullMetadata.lineCount, 'lines');
      } catch (error) {
        console.error('[SongPickerPage] Failed to load full metadata:', error);
      }
    }

    // Navigate to clip picker page
    navigate('/create/clip-picker', {
      state: { song, clips, fullMetadata }
    });

    onSongSelect?.(song);
  };

  // Handle song preview playback
  const handleSongPlay = (song: Song) => {
    if (playingSongId === song.id) {
      // Stop current playback
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setPlayingSongId(null);
    } else {
      // Start new playback
      if (audioRef.current && song.audioUrl) {
        audioRef.current.src = song.audioUrl;
        audioRef.current.currentTime = 0;
        audioRef.current.play();
        setPlayingSongId(song.id);
      }
    }
  };

  // Handle audio end
  const handleAudioEnd = () => {
    setPlayingSongId(null);
  };

  // Handle search - calls Lit Action for Genius API search
  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    setSearchError(null);

    if (!query.trim()) {
      setGeniusResults([]);
      return;
    }

    if (!walletClient) {
      setSearchError('Please connect your wallet to search');
      return;
    }

    try {
      setIsSearching(true);
      console.log('[SongPickerPage] Searching Genius via Lit Action:', query);

      const litSearchService = getLitSearchService();
      const response = await litSearchService.searchSongs(query, walletClient, {
        limit: 20,
        userAddress: walletClient.account?.address || 'anonymous',
      });

      console.log('[SongPickerPage] Search response:', response);

      if (response.success) {
        setGeniusResults(response.results);
        console.log(`[SongPickerPage] Found ${response.count} results from Genius`);
      } else {
        setSearchError(response.error || 'Search failed');
        setGeniusResults([]);
      }
    } catch (error) {
      console.error('[SongPickerPage] Search error:', error);
      setSearchError(error instanceof Error ? error.message : 'Unknown error');
      setGeniusResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Filter local songs based on search query
  const filteredSongs = songs.filter(song => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      song.title.toLowerCase().includes(query) ||
      song.artist.toLowerCase().includes(query)
    );
  });

  return (
    <div className={`relative w-full h-screen bg-neutral-900 overflow-hidden ${className}`}>
      {/* Hidden audio element for previews */}
      <audio
        ref={audioRef}
        onEnded={handleAudioEnd}
        preload="none"
      />

      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-50 bg-neutral-900 border-b border-neutral-800">
        <div className="flex items-center h-16 px-4">
          <button
            onClick={() => onBack ? onBack() : navigate('/')}
            className="w-12 h-12 flex items-center justify-center hover:bg-neutral-800 transition-colors cursor-pointer rounded-full"
          >
            <CaretLeft className="w-6 h-6 text-white" />
          </button>

          <div className="flex-1 mx-4 text-center">
            <h1 className="text-white text-lg font-semibold">Choose Song</h1>
          </div>
          <div className="w-12" /> {/* Spacer for centering */}
        </div>
      </div>

      {/* Main content */}
      <div className="absolute top-16 left-0 right-0 bottom-0 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full" />
        ) : songs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-4">
            <div className="text-neutral-400 text-lg mb-2">
              No songs available
            </div>
          </div>
        ) : (
          <div className="px-4 pb-4">
            {/* Search Input */}
            <div className="pt-4 pb-4 sticky top-0 bg-neutral-900 z-10">
              <SearchInput
                placeholder="Search Genius or browse local songs..."
                onSearch={handleSearch}
                isLoading={isSearching}
                isConnected={!!walletClient}
              />
              {searchError && (
                <div className="mt-2 text-sm text-red-400">
                  {searchError}
                </div>
              )}
            </div>

            {/* Genius Search Results (if searching) */}
            {searchQuery.trim() && geniusResults.length > 0 && (
              <div className="mb-6">
                <h3 className="text-white text-sm font-semibold mb-3 px-1">
                  Genius Search Results ({geniusResults.length})
                </h3>
                <div className="space-y-2 bg-neutral-800/30 rounded-lg p-2">
                  {geniusResults.map((result) => (
                    <div
                      key={result.genius_id}
                      className="p-3 bg-neutral-800 rounded-lg hover:bg-neutral-700 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        {result.artwork_thumbnail ? (
                          <img
                            src={result.artwork_thumbnail}
                            alt={result.title}
                            className="w-12 h-12 rounded object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded bg-neutral-700 flex items-center justify-center flex-shrink-0">
                            <span className="text-neutral-500">🎵</span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h4 className="text-white font-medium text-sm truncate">
                            {result.title_with_featured || result.title}
                          </h4>
                          <p className="text-neutral-400 text-xs truncate">
                            {result.artist}
                          </p>
                          <p className="text-neutral-600 text-xs mt-1">
                            {result.lyrics_state} • From Genius
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Local Songs List */}
            {filteredSongs.length === 0 && !searchQuery.trim() ? null : (
              <div>
                {searchQuery.trim() && (
                  <h3 className="text-white text-sm font-semibold mb-3 px-1">
                    Local Songs ({filteredSongs.length})
                  </h3>
                )}
                {filteredSongs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 px-4">
                    <div className="text-neutral-400 text-lg mb-2">
                      No local songs found
                    </div>
                    <div className="text-neutral-500 text-sm">
                      Try searching for something else
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredSongs.map((song) => (
                      <SongListItem
                        key={song.id}
                        song={song}
                        isPlaying={playingSongId === song.id}
                        showSelectButton={true}
                        onClick={() => handleSongSelect(song)}
                        onPlay={() => handleSongPlay(song)}
                        onSelect={() => handleSongSelect(song)}
                        className="rounded-lg"
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
};