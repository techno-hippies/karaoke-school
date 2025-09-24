import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { formatCount } from '../../lib/utils';

interface ActionButtonProps {
  icon: LucideIcon;
  count?: number;
  onClick?: () => void;
  className?: string;
}

export const ActionButton: React.FC<ActionButtonProps> = ({
  icon: Icon,
  count,
  onClick,
  className = ''
}) => {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center cursor-pointer ${className}`}
      onMouseEnter={(e) => {
        const div = e.currentTarget.querySelector('div');
        if (div) div.style.backgroundColor = 'rgba(55, 65, 81, 0.5)'; // neutral-700/50
      }}
      onMouseLeave={(e) => {
        const div = e.currentTarget.querySelector('div');
        if (div) div.style.backgroundColor = 'rgba(31, 41, 55, 0.5)'; // neutral-800/50
      }}
    >
      <div className="rounded-full p-3 transition-colors backdrop-blur-sm" style={{ backgroundColor: 'rgba(31, 41, 55, 0.5)' }}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      {count !== undefined && (
        <span className="text-white text-xs mt-1">{formatCount(count)}</span>
      )}
    </button>
  );
};