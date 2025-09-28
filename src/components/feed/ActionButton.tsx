import React from 'react';
import type { Icon as PhosphorIcon } from '@phosphor-icons/react';
import { Heart } from '@phosphor-icons/react';
import { formatCount } from '../../lib/utils';

interface ActionButtonProps {
  icon: PhosphorIcon;
  count?: number;
  onClick?: () => void;
  className?: string;
  isActive?: boolean;
  isLoading?: boolean;
  disabled?: boolean;
}

export const ActionButton: React.FC<ActionButtonProps> = ({
  icon: Icon,
  count,
  onClick,
  className = '',
  isActive = false,
  isLoading = false,
  disabled = false
}) => {
  const isHeartButton = Icon === Heart;

  const getIconColor = () => {
    if (isHeartButton && isActive) return 'text-red-500';
    if (disabled) return 'text-gray-500';
    if (isHeartButton) return 'text-white'; // Heart button when not active stays white
    return 'text-neutral-300'; // Comment and share buttons use lighter neutral
  };

  const getBackgroundColor = () => {
    if (isHeartButton && isActive) return 'rgba(239, 68, 68, 0.2)'; // red-500/20
    return 'rgba(31, 41, 55, 0.5)'; // neutral-800/50
  };

  const getHoverColor = () => {
    if (isHeartButton && isActive) return 'rgba(239, 68, 68, 0.3)'; // red-500/30
    return 'rgba(55, 65, 81, 0.5)'; // neutral-700/50
  };

  return (
    <button
      onClick={() => {
        console.log('[ActionButton] Click detected - disabled:', disabled, 'isLoading:', isLoading, 'onClick available:', !!onClick);
        if (onClick) onClick();
      }}
      disabled={disabled || isLoading}
      className={`flex flex-col items-center cursor-pointer ${
        disabled ? 'opacity-50 cursor-not-allowed' : ''
      } ${className}`}
      onMouseEnter={(e) => {
        if (disabled || isLoading) return;
        const div = e.currentTarget.querySelector('div');
        if (div) div.style.backgroundColor = getHoverColor();
      }}
      onMouseLeave={(e) => {
        if (disabled || isLoading) return;
        const div = e.currentTarget.querySelector('div');
        if (div) div.style.backgroundColor = getBackgroundColor();
      }}
    >
      <div
        className="rounded-full p-3 transition-colors backdrop-blur-sm relative"
        style={{ backgroundColor: getBackgroundColor() }}
      >
        {isLoading ? (
          <div className="w-6 h-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
        ) : (
          <Icon
            className={`w-6 h-6 transition-colors ${getIconColor()}`}
            weight="fill"
          />
        )}
      </div>
      {count !== undefined && (
        <span className={`text-xs mt-1 transition-colors ${
          isHeartButton && isActive ? 'text-red-500' : 'text-white'
        }`}>
          {formatCount(count)}
        </span>
      )}
    </button>
  );
};