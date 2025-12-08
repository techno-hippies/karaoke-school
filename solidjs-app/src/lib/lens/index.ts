/**
 * Lens Protocol Public API
 * Centralized exports for all Lens functionality
 */

// Configuration
export {
  LENS_APP_ADDRESS,
  LENS_GRAPH_ADDRESS,
  LENS_CUSTOM_NAMESPACE,
} from './config'

// Client
export {
  lensClient,
  type LensClient,
} from './client'

// Auth
export {
  loginAsOnboardingUser,
  loginAsAccountOwner,
  getExistingAccounts,
  switchToAccountOwner,
  resumeLensSession,
} from './auth'

// Account Creation
export {
  createAccountInCustomNamespace,
  createAccountWithoutUsername,
  createUsernameForAccount,
  checkUsernameAvailability,
  validateUsernameFormat,
} from './account-creation'

// GraphQL (for advanced use)
export {
  createLensGraphQLClient,
  executeQuery,
} from './graphql-client'

// Utils
export {
  parseVideoMetadata,
  formatNumber,
  type VideoMetadata,
} from './utils'

// Transformers
export {
  transformLensPostToVideoData,
  transformLensPostsToVideoData,
} from './transformers'

// Hooks
export {
  useFeedPosts,
  type UseFeedPostsOptions,
  type UseFeedPostsResult,
} from './hooks'
