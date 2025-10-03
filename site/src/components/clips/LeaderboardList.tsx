import React from 'react';
import { cn } from '@/lib/utils';

export interface LeaderboardEntry {
  rank: number;
  user: string; // address or ENS
  score: number;
  isCurrentUser?: boolean;
}

interface LeaderboardListProps {
  entries: LeaderboardEntry[];
  className?: string;
}

export const LeaderboardList: React.FC<LeaderboardListProps> = ({
  entries,
  className = ''
}) => {
  return (
    <div className={cn("w-full space-y-1", className)}>
      {entries.map((entry) => (
        <div
          key={entry.rank}
          className={cn(
            "flex items-center justify-between px-4 py-3 rounded-lg border",
            entry.isCurrentUser
              ? "bg-blue-600/10 border-blue-600/50"
              : "bg-neutral-900 border-neutral-800"
          )}
        >
          <div className="flex items-center gap-3">
            <span className={cn(
              "text-base font-semibold w-6",
              entry.rank <= 3 ? "text-yellow-400" : "text-neutral-400"
            )}>
              #{entry.rank}
            </span>
            <span className="text-white text-base font-medium">
              {entry.user}
            </span>
          </div>
          <span className="text-white text-base font-bold">
            {entry.score}
          </span>
        </div>
      ))}
    </div>
  );
};
