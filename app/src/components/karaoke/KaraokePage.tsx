import { useNavigate } from 'react-router-dom'
import { PostFlowContainer } from '@/features/post-flow/PostFlowContainer'

/**
 * KaraokePage - Main karaoke search/selection page
 * Public page with search functionality (requires PKP for search)
 */
export function KaraokePage() {
  const navigate = useNavigate()

  // Public page - no auth checks here
  // Auth is checked when user selects a song in PostFlowContainer
  return <PostFlowContainer open={true} onClose={() => navigate('/')} />
}
