// Placeholder for disabled useLensComments hook
// This functionality will be re-implemented with the new unified auth system

export function useLensComments(postId: string) {
  return {
    comments: [],
    commentCount: 0,
    canComment: false,
    loading: false,
    isLoading: false,
    isSubmitting: false,
    error: null,
    addComment: () => Promise.resolve(false),
    submitComment: (content: string) => Promise.resolve(false)
  };
}