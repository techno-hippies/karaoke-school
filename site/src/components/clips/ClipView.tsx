import React from 'react';
import { X } from '@phosphor-icons/react';
import { Button } from '../ui/button';

export interface LeaderboardEntry {
  username?: string;
  walletAddress: string;
  score: number;
}

export interface ClipViewProps {
  songTitle: string;
  artist: string;
  difficulty: number;
  wordsPerSecond: number;
  leaderboard: LeaderboardEntry[];
  onClose: () => void;
  onCover: () => void;
}

/**
 * Truncates a wallet address to format like "0x1234...5678"
 */
const truncateWallet = (address: string): string => {
  if (address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

/**
 * ClipView component displays a karaoke clip's details with leaderboard
 */
export const ClipView: React.FC<ClipViewProps> = ({
  songTitle,
  artist,
  difficulty,
  wordsPerSecond,
  leaderboard,
  onClose,
  onCover
}) => {
  // Take top 10 entries
  const top10 = leaderboard.slice(0, 10);

  return (
    <div className="h-full bg-black text-white flex flex-col">
      {/* Header with X button and Song Info */}
      <div className="relative p-4 border-b border-neutral-800 flex items-center">
        <button
          onClick={onClose}
          className="w-10 h-10 bg-neutral-900 rounded-full flex items-center justify-center text-white hover:bg-neutral-800 transition-colors flex-shrink-0"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="flex-1 text-center px-4">
          <h1 className="text-lg font-bold text-white">
            {songTitle} - {artist}
          </h1>
        </div>
        <div className="w-10 flex-shrink-0"></div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Stats - Difficulty and Words Per Second */}
        <div className="flex gap-3">
          <div className="flex-1 bg-neutral-900 rounded-lg p-4 text-center border border-neutral-800">
            <div className="text-3xl font-bold text-white">
              {difficulty}
            </div>
            <div className="text-neutral-400 text-sm font-medium mt-1">
              Difficulty
            </div>
          </div>
          <div className="flex-1 bg-neutral-900 rounded-lg p-4 text-center border border-neutral-800">
            <div className="text-3xl font-bold text-white">
              {wordsPerSecond.toFixed(1)}
            </div>
            <div className="text-neutral-400 text-sm font-medium mt-1">
              Words/Second
            </div>
          </div>
        </div>

        {/* Leaderboard */}
        <div>
          <h3 className="text-lg font-semibold mb-3">Top 10 Leaderboard</h3>
          <div className="bg-neutral-900 rounded-lg border border-neutral-800 overflow-hidden">
            <table className="w-full table-fixed">
              <thead className="bg-neutral-800/50">
                <tr>
                  <th className="w-16 text-left py-3 px-3 text-sm font-semibold text-neutral-300 border-b border-neutral-700">Rank</th>
                  <th className="text-left py-3 px-3 text-sm font-semibold text-neutral-300 border-b border-neutral-700">User</th>
                  <th className="w-24 text-right py-3 px-3 text-sm font-semibold text-neutral-300 border-b border-neutral-700">Score</th>
                </tr>
              </thead>
              <tbody>
                {top10.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="text-center py-6 text-neutral-500 text-sm">
                      No scores yet. Be the first to cover this clip!
                    </td>
                  </tr>
                ) : (
                  top10.map((entry, index) => (
                    <tr
                      key={`${entry.walletAddress}-${index}`}
                      className="border-b border-neutral-800 last:border-b-0 hover:bg-neutral-800/50 transition-colors"
                    >
                      <td className="py-3 px-3 text-base font-medium">
                        {index + 1}
                      </td>
                      <td className="py-3 px-3 text-base">
                        {entry.username || truncateWallet(entry.walletAddress)}
                      </td>
                      <td className="py-3 px-3 text-right text-base font-semibold">
                        {entry.score}/100
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Cover Button */}
      <div className="p-4 border-t border-neutral-800">
        <Button
          onClick={onCover}
          size="xl"
          className="w-full bg-white text-black font-semibold hover:bg-neutral-200"
        >
          Cover
        </Button>
      </div>
    </div>
  );
};
