import React from 'react';
import { Gear, Key, DotsThree, Link, SealCheck } from '@phosphor-icons/react';
import { Button } from '../ui/button';
import { FollowButton } from 'ethereum-identity-kit';

interface ProfileHeaderProps {
  username: string;
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  link?: string;
  following: number;
  followers: number;
  isOwnProfile?: boolean;
  isFollowing?: boolean;
  isFollowLoading?: boolean;
  isUnclaimed?: boolean;
  isVerified?: boolean;
  claimableAmount?: number;
  connectedAddress?: string; // For EIK follow button
  profileAddress?: string; // Address of profile being viewed
  onFollowClick?: () => void;
  onMessageClick?: () => void;
  onEditClick?: () => void;
  onSettingsClick?: () => void;
  onClaimClick?: () => void;
  onMoreClick?: () => void;
}

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({
  username,
  displayName,
  avatarUrl = 'https://api.dicebear.com/7.x/avataaars/svg?seed=default',
  bio = 'No bio yet.',
  link,
  following = 0,
  followers = 0,
  isOwnProfile = false,
  isFollowing = false,
  isFollowLoading = false,
  isUnclaimed = false,
  isVerified = false,
  claimableAmount = 0,
  connectedAddress,
  profileAddress,
  onFollowClick,
  onMessageClick,
  onEditClick,
  onSettingsClick,
  onClaimClick,
  onMoreClick,
}) => {
  // Format numbers with K/M suffixes
  const formatNumber = (num: number): string => {
    if (!num && num !== 0) return '0';
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  return (
    <div className="w-full bg-black text-white pb-6">
      {/* Desktop Header */}
      <div className="max-md:hidden px-6 py-6">
        <div className="flex gap-8">
            {/* Avatar */}
            <div className="flex-shrink-0">
              {/* Always use the original avatar for now */}
              <div className="w-32 h-32 rounded-full overflow-hidden bg-neutral-800">
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            </div>

            {/* Info Section */}
            <div className="flex-1">
              {/* Show display name if exists, otherwise show username */}
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-3xl font-bold">{displayName || username}</h1>
                {isVerified && (
                  <SealCheck className="w-7 h-7 text-blue-500" weight="duotone" />
                )}
              </div>
              {/* Only show username as secondary if we have a different display name */}
              {displayName && displayName !== username && (
                <h2 className="text-xl text-neutral-400 mb-4">{username}</h2>
              )}
              
              {/* Stats - Always use original stats for consistent UI */}
              <div className="flex gap-6 mb-4 text-lg">
                {isUnclaimed ? (
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-green-400">${claimableAmount}</span>
                    <span className="text-neutral-400">Claimable</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{formatNumber(following)}</span>
                    <span className="text-neutral-400">Following</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className="font-bold">{formatNumber(followers)}</span>
                  <span className="text-neutral-400">Followers</span>
                </div>
              </div>

              {/* Bio */}
              <p className="text-xl text-neutral-300 mb-4">{bio}</p>

              {/* Link */}
              {link && (
                <a
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 mt-2 text-blue-400 hover:underline text-lg"
                >
                  <Link className="w-4 h-4" />
                  <span>{link.replace(/^https?:\/\//, '')}</span>
                </a>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 mt-4">
                {isOwnProfile ? (
                  <>
                    <Button
                      onClick={onEditClick}
                      size="xl"
                      className="bg-[#FE2C55] hover:bg-[#FE2C55]/90 text-white"
                    >
                      Edit profile
                    </Button>
                  </>
                ) : (
                  <>
                    {/* Follow/Following button always first, Message always second */}
                    <Button
                      onClick={onFollowClick}
                      size="xl"
                      className={isFollowing 
                        ? "!bg-neutral-800 hover:!bg-neutral-700 !text-white !border-0"
                        : "bg-[#FE2C55] hover:bg-[#FE2C55]/90 text-white"
                      }
                      isLoading={isFollowLoading}
                      loadingText={isFollowing ? "Unfollowing..." : "Following..."}
                    >
                      {isFollowing ? "Unfollow" : "Follow"}
                    </Button>
                    <Button
                      onClick={onMessageClick}
                      variant="secondary"
                      size="xl"
                      className="!bg-neutral-800 hover:!bg-neutral-700 !text-white !border-0 hover:!opacity-100"
                    >
                      Message
                    </Button>
                    <Button
                      onClick={onMoreClick}
                      variant="secondary"
                      size="icon"
                      className="!bg-neutral-800 hover:!bg-neutral-700 !text-white !border-0 hover:!opacity-100 h-14 w-14"
                    >
                      <DotsThree className="w-6 h-6" weight="bold" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
      </div>

      {/* Mobile Header */}
      <div className="md:hidden px-4 py-4">
        {/* Avatar centered */}
        <div className="flex justify-center mb-4">
          <div className="w-24 h-24 rounded-full overflow-hidden bg-neutral-800">
            <img
              src={avatarUrl}
              alt={displayName}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
        </div>
        
        {/* Name and username */}
        <div className="text-center mb-4">
          <h1 className="text-xl font-bold">{displayName || username}</h1>
          {displayName && displayName !== username && (
            <p className="text-neutral-400 text-sm">@{username}</p>
          )}
        </div>
        
        {/* Stats */}
        <div className="flex justify-center mb-4">
          <div className="text-center flex-1">
            <div className="font-bold">{formatNumber(following)}</div>
            <div className="text-sm text-neutral-400">Following</div>
          </div>
          <div className="text-center flex-1">
            <div className="font-bold">{formatNumber(followers)}</div>
            <div className="text-sm text-neutral-400">Followers</div>
          </div>
        </div>
        
        {/* Bio */}
        {bio && <p className="text-sm text-center mb-4">{bio}</p>}
        
        {/* Action Buttons */}
        <div className="flex gap-2">
          {isOwnProfile ? (
            <Button
              onClick={onEditClick}
              className="flex-1 bg-[#FE2C55] hover:bg-[#FE2C55]/90 text-white"
            >
              Edit profile
            </Button>
          ) : (
            <>
              {/* Follow/Following button always first, Message always second */}
              <Button
                onClick={onFollowClick}
                className={isFollowing 
                  ? "flex-1 !bg-neutral-800 hover:!bg-neutral-700 !text-white !border-0"
                  : "flex-1 bg-[#FE2C55] hover:bg-[#FE2C55]/90 text-white"
                }
                isLoading={isFollowLoading}
                loadingText={isFollowing ? "Unfollowing..." : "Following..."}
              >
                {isFollowing ? "Unfollow" : "Follow"}
              </Button>
              <Button
                onClick={onMessageClick}
                variant="secondary"
                className="flex-1 !bg-neutral-800 hover:!bg-neutral-700 !text-white !border-0 hover:!opacity-100"
              >
                Message
              </Button>
              <Button
                onClick={onMoreClick}
                variant="secondary"
                size="icon"
                className="!bg-neutral-800 hover:!bg-neutral-700 !text-white !border-0 hover:!opacity-100"
              >
                <DotsThree className="w-5 h-5" weight="bold" />
              </Button>
            </>
          )}
        </div>
      </div>

    </div>
  );
};