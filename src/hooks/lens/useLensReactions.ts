// Placeholder for disabled useLensReactions hook
// This functionality will be re-implemented with the new unified auth system

export function useLensReactions(postId: string) {
  return {
    hasLiked: false,
    isLiked: false,
    likeCount: 0,
    loading: false,
    isLoading: false,
    canLike: false,
    error: null,
    handleLike: () => Promise.resolve(false),
    handleUnlike: () => Promise.resolve(false),
    toggleLike: () => Promise.resolve(false)
  };
}