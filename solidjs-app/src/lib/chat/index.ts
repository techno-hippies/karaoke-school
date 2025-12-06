/**
 * Chat Module Exports
 */

// Types
export type {
  UserProfile,
  LearningPreferences,
  Thread,
  Message,
  MessageMetadata,
  ViewHistoryEntry,
  AIPersonality,
  PersonalityId,
  Scenario,
  UserContext,
  ChatMessage,
  TTSWord,
  ChatRequest,
  ChatResponse,
  TranslateRequest,
  TranslateResponse,
  TTSRequest,
  TTSResponse,
  Survey,
  SurveyOption,
  ChatWord,
  MessageContent,
} from './types'

export { AI_PERSONALITIES, SCENARIOS } from './types'

// Store
export {
  getProfile,
  saveProfile,
  getThreads,
  getThread,
  getOrCreateConversation,
  updateThread,
  deleteThread,
  markThreadRead,
  getMessages,
  addMessage,
  addMessagesBatch,
  needsSummary,
  getViewHistory,
  addViewHistoryEntry,
  getEngagementProfile,
  SUMMARY_INTERVAL,
} from './store'

// Service
export { sendChatMessage, translateText, synthesizeSpeech } from './service'

// Context
export { ChatProvider, useChatContext } from './context'

// Surveys
export {
  PERSONALITY_SURVEYS,
  getNextSurvey,
  areSurveysComplete,
  getWelcomeMessageKey,
  getSurveyCompleteKey,
  mapSurveyToProfile,
} from './surveys'

// Audio
export { createAudioPlayback, mergeQuoteTokens, formatDuration, buildHighlightedContent } from './audio'
