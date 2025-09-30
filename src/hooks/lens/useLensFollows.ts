// Placeholder for disabled useLensFollows hook
// This functionality will be re-implemented with the new unified auth system

export function useLensFollows(profileAddress: string) {
  return {
    isFollowing: false,
    followerCount: 0,
    followingCount: 0,
    loading: false,
    isLoading: false,
    canFollow: false,
    error: null,
    handleFollow: () => Promise.resolve(false),
    handleUnfollow: () => Promise.resolve(false),
    toggleFollow: () => Promise.resolve(false)
  };
}