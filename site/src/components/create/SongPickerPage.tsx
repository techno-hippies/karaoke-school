import React, { useState, useEffect, useRef } from 'react';
import { CaretLeft } from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';
import { useWalletClient } from 'wagmi';
import { SongListItem } from '../ui/SongListItem';
import { SearchInput } from '../ui/SearchInput';
import type { Song } from '../../types/song';
import { ContentSource } from '../../types/song';
import { getContractSongs, resolveLensUri } from '../../services/SongRegistryService';
import { getLitSearchService } from '../../services/LitSearchService';
import type { GeniusSearchResult } from '../../types/genius';
import { TrendingSection } from '../trending';
import { TrendingService, type TrendingSong } from '../../services/TrendingService';
import { TimeWindow } from '../../services/TrendingQueueService';
import { ethers } from 'ethers';
import { LIT_ACTIONS } from '../../config/lit-actions';

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
  const [loading, setLoading] = useState(true);
  const [playingSongId, setPlayingSongId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [geniusResults, setGeniusResults] = useState<GeniusSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Trending state
  const [trendingHourly, setTrendingHourly] = useState<TrendingSong[]>([]);
  const [trendingDaily, setTrendingDaily] = useState<TrendingSong[]>([]);
  const [trendingWeekly, setTrendingWeekly] = useState<TrendingSong[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(false);

  // Load songs and trending from contract on mount
  useEffect(() => {
    loadSongs();
    loadTrending();
  }, []);

  const loadSongs = async () => {
    try {
      setLoading(true);
      console.log('[SongPickerPage] Loading songs from SongRegistryV4...');
      const contractSongs = await getContractSongs();
      console.log('[SongPickerPage] Loaded contract songs:', contractSongs);

      // Convert to Song format for display (with index for clean URLs)
      const displaySongs: Song[] = contractSongs.map((song, index) => ({
        id: song.id,
        index: index,  // Add numeric index for URL routing
        title: song.title,
        artist: song.artist,
        duration: song.duration,
        thumbnailUrl: resolveLensUri(song.thumbnailUri),
        audioUrl: resolveLensUri(song.audioUri),
      }));

      setSongs(displaySongs);
      console.log('[SongPickerPage] Converted to display songs:', displaySongs);
    } catch (error) {
      console.error('Failed to load songs:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTrending = async () => {
    try {
      setTrendingLoading(true);
      console.log('[SongPickerPage] Loading trending from TrendingTrackerV1...');

      // Get trending contract config
      const trendingConfig = LIT_ACTIONS.trending.tracker;
      const provider = new ethers.providers.JsonRpcProvider('https://rpc.testnet.lens.xyz');
      const trendingService = new TrendingService(provider, trendingConfig.contracts.trendingTracker);

      // Load all three time windows
      const [hourly, daily, weekly] = await Promise.all([
        trendingService.getTrendingSongs(TimeWindow.Hourly, 10),
        trendingService.getTrendingSongs(TimeWindow.Daily, 10),
        trendingService.getTrendingSongs(TimeWindow.Weekly, 10),
      ]);

      setTrendingHourly(hourly);
      setTrendingDaily(daily);
      setTrendingWeekly(weekly);

      console.log('[SongPickerPage] Loaded trending:', {
        hourly: hourly.length,
        daily: daily.length,
        weekly: weekly.length
      });
    } catch (error) {
      console.error('Failed to load trending:', error);
    } finally {
      setTrendingLoading(false);
    }
  };

  // Handle song selection - navigate to segment picker with URL-based routing
  const handleSongSelect = async (song: Song) => {
    console.log('[SongPickerPage] Native song selected:', song);

    // Navigate to URL-based segment picker route with song data in state
    // Use numeric index if available (clean URLs), fallback to ID
    const identifier = song.index !== undefined ? song.index.toString() : song.id;
    navigate(`/create/native/${identifier}`, {
      state: {
        song: {
          ...song,
          source: ContentSource.Native,
        }
      }
    });

    onSongSelect?.(song);
  };

  // Handle Genius song selection
  const handleGeniusSongSelect = (result: GeniusSearchResult) => {
    console.log('[SongPickerPage] Genius song selected:', result);

    // Navigate to URL-based segment picker route with song data in state
    // Format: /create/genius/{geniusId}
    navigate(`/create/genius/${result.genius_id}`, {
      state: {
        song: {
          id: result.genius_id.toString(),
          title: result.title_with_featured || result.title,
          artist: result.artist,
          thumbnailUrl: result.artwork_thumbnail,
          source: ContentSource.Genius,
        }
      }
    });
  };

  // Handle trending song click
  const handleTrendingClick = (trendingSong: TrendingSong) => {
    console.log('[SongPickerPage] Trending song clicked:', trendingSong);

    // Navigate based on source
    if (trendingSong.source === ContentSource.Genius) {
      navigate(`/create/genius/${trendingSong.songId}`);
    } else {
      // Native song - find it in our songs list to get the identifier
      const song = songs.find(s => s.id === trendingSong.songId);
      const identifier = song?.index !== undefined ? song.index.toString() : trendingSong.songId;
      navigate(`/create/native/${identifier}`);
    }
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
            {isSearching && searchQuery.trim() && (
              <div className="mb-6">
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-center gap-4 p-3 rounded-lg animate-pulse">
                      <div className="w-20 h-20 rounded-md bg-neutral-800 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="h-5 bg-neutral-800 rounded w-3/4 mb-2" />
                        <div className="h-4 bg-neutral-800 rounded w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {!isSearching && searchQuery.trim() && geniusResults.length > 0 && (
              <div className="mb-6">
                <div className="space-y-2">
                  {geniusResults.map((result) => (
                    <SongListItem
                      key={result.genius_id}
                      song={{
                        id: result.genius_id.toString(),
                        title: result.title_with_featured || result.title,
                        artist: result.artist,
                        duration: 0,
                        thumbnailUrl: result.artwork_thumbnail || undefined,
                      }}
                      showPlayButton={false}
                      onClick={() => handleGeniusSongSelect(result)}
                      className="rounded-lg"
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Trending Section (shown when not searching) */}
            {!searchQuery.trim() && (trendingHourly.length > 0 || trendingDaily.length > 0 || trendingWeekly.length > 0) && (
              <div className="mb-8">
                <h2 className="text-white text-xl font-bold mb-4 px-1">🔥 Trending</h2>
                <TrendingSection
                  hourly={trendingHourly}
                  daily={trendingDaily}
                  weekly={trendingWeekly}
                  onSongClick={handleTrendingClick}
                  loading={trendingLoading}
                />
              </div>
            )}

            {/* Local Songs List */}
            {filteredSongs.length > 0 && (
              <div>
                {searchQuery.trim() && (
                  <h3 className="text-white text-sm font-semibold mb-3 px-1">
                    Local Songs ({filteredSongs.length})
                  </h3>
                )}
                <div className="space-y-2">
                  {filteredSongs.map((song) => (
                    <SongListItem
                      key={song.id}
                      song={song}
                      isPlaying={playingSongId === song.id}
                      showSelectButton={false}
                      onClick={() => handleSongSelect(song)}
                      onPlay={() => handleSongPlay(song)}
                      onSelect={() => handleSongSelect(song)}
                      className="rounded-lg"
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};