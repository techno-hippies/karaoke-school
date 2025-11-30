/**
 * Chat Service - Calls Scarlett/Violet chat lit actions
 *
 * Modes:
 * - CHAT: Text message → AI response
 * - TRANSLATE: English → Chinese translation
 * - STT: Audio → Transcript → AI response (future)
 */

import { getLitClient } from '@/lib/lit/client'
import { LIT_CHAT_ACTION_CID, LIT_CHAT_VENICE_KEY, LIT_CHAT_DEEPINFRA_KEY, LIT_TTS_ACTION_CID, LIT_TTS_DEEPINFRA_KEY } from '@/lib/contracts/addresses'
import type { PersonalityId, UserContext } from './types'
import type { PKPAuthContext } from '@/lib/lit/types'

// Map personality IDs to usernames expected by lit action
const PERSONALITY_USERNAMES: Record<PersonalityId, string> = {
  scarlett: 'scarlett-ks',
  violet: 'violet-ks',
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatRequest {
  personalityId: PersonalityId
  /** Text message (optional if audioBase64 provided) */
  message?: string
  /** Base64 encoded audio for STT (optional if message provided) */
  audioBase64?: string
  conversationHistory?: ChatMessage[]
  returnAudio?: boolean
  authContext: PKPAuthContext
  /** User context for personalization (survey responses, study stats, etc.) */
  userContext?: UserContext | null
}

/** Word timestamp from TTS for highlighting sync */
export interface TTSWord {
  id: number
  start: number  // seconds
  end: number    // seconds
  text: string
}

export interface ChatResponse {
  success: boolean
  reply: string
  replyAudio?: string // Base64 MP3 if returnAudio=true
  replyWords?: TTSWord[] // Word timestamps for highlighting (if returnAudio=true)
  transcript?: string // If STT mode
  error?: string
}

export interface TranslateRequest {
  text: string
  /** Target language code: 'zh' | 'vi' | 'id' (default: 'zh') */
  targetLanguage?: 'zh' | 'vi' | 'id'
  authContext: PKPAuthContext
}

export interface TranslateResponse {
  success: boolean
  original: string
  translation: string
  error?: string
}

/**
 * Send a chat message to the AI personality
 *
 * Supports both text and audio input:
 * - Text: Pass `message` string
 * - Audio: Pass `audioBase64` (will be transcribed via STT)
 */
export async function sendChatMessage(request: ChatRequest): Promise<ChatResponse> {
  const { personalityId, message, audioBase64, conversationHistory = [], returnAudio = false, authContext, userContext } = request

  if (!authContext) {
    return {
      success: false,
      reply: '',
      error: 'Not authenticated. Please sign in first.',
    }
  }

  if (!message && !audioBase64) {
    return {
      success: false,
      reply: '',
      error: 'Must provide either message or audioBase64',
    }
  }

  try {
    const litClient = await getLitClient()

    // Include DeepInfra key only when audio is involved (STT or TTS)
    const needsDeepinfra = !!audioBase64 || returnAudio

    // Build params for lit action
    const jsParams = {
      mode: 'CHAT',
      username: PERSONALITY_USERNAMES[personalityId], // e.g., 'scarlett-ks'
      userMessage: message || undefined,
      audioDataBase64: audioBase64 || undefined,
      conversationHistory: conversationHistory.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      // User context for personalization (survey responses, study stats, etc.)
      userContext: userContext || undefined,
      veniceEncryptedKey: LIT_CHAT_VENICE_KEY,
      deepinfraEncryptedKey: needsDeepinfra ? LIT_CHAT_DEEPINFRA_KEY : null,
      returnAudio,
      testMode: false,
    }

    console.log('[ChatService] Executing lit action:', {
      ipfsId: LIT_CHAT_ACTION_CID,
      username: jsParams.username,
      hasAudio: !!audioBase64,
      audioLength: audioBase64?.length,
      hasDeepinfraKey: !!jsParams.deepinfraEncryptedKey,
    })

    // Execute lit action
    const result = await litClient.executeJs({
      ipfsId: LIT_CHAT_ACTION_CID,
      authContext,
      jsParams,
    })

    console.log('[ChatService] Raw response:', result.response)

    const response = JSON.parse(result.response as string)

    console.log('[ChatService] Parsed response:', {
      success: response.success,
      hasReply: !!response.reply,
      replyLength: response.reply?.length,
      hasAudio: !!response.replyAudio,
      audioLength: response.replyAudio?.length,
      hasWords: !!response.replyWords,
      wordsCount: response.replyWords?.length,
      hasTranscript: !!response.transcript,
      transcript: response.transcript,
      error: response.error,
      executionTime: response.executionTime,
    })

    return {
      success: response.success,
      reply: response.reply || '',
      replyAudio: response.replyAudio,
      replyWords: response.replyWords,
      transcript: response.transcript,
      error: response.error,
    }
  } catch (error) {
    console.error('[ChatService] Error:', error)
    return {
      success: false,
      reply: '',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Translate text to user's language (zh/vi/id)
 */
export async function translateText(request: TranslateRequest): Promise<TranslateResponse> {
  const { text, targetLanguage = 'zh', authContext } = request

  if (!authContext) {
    return {
      success: false,
      original: text,
      translation: '',
      error: 'Not authenticated. Please sign in first.',
    }
  }

  try {
    const litClient = await getLitClient()

    const jsParams = {
      mode: 'TRANSLATE',
      textToTranslate: text,
      targetLanguage,
      veniceEncryptedKey: LIT_CHAT_VENICE_KEY,
      testMode: false,
    }

    const result = await litClient.executeJs({
      ipfsId: LIT_CHAT_ACTION_CID,
      authContext,
      jsParams,
    })

    const response = JSON.parse(result.response as string)

    return {
      success: response.success,
      original: response.original || text,
      translation: response.translation || '',
      error: response.error,
    }
  } catch (error) {
    console.error('[ChatService] Translate error:', error)
    return {
      success: false,
      original: text,
      translation: '',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// ============ TTS (on-demand text-to-speech) ============

export interface TTSRequest {
  text: string
  voice?: string  // default: 'af_heart'
  authContext: PKPAuthContext
}

export interface TTSResponse {
  success: boolean
  audio?: string  // Base64 MP3
  words?: TTSWord[]  // Word timestamps for highlighting
  error?: string
}

/**
 * Convert text to speech on-demand
 * Called when user clicks "Play" button on a chat message
 */
export async function synthesizeSpeech(request: TTSRequest): Promise<TTSResponse> {
  const { text, voice = 'af_heart', authContext } = request

  if (!authContext) {
    return {
      success: false,
      error: 'Not authenticated. Please sign in first.',
    }
  }

  if (!text?.trim()) {
    return {
      success: false,
      error: 'No text to synthesize',
    }
  }

  try {
    const litClient = await getLitClient()

    const jsParams = {
      text: text.trim(),
      voice,
      deepinfraEncryptedKey: LIT_TTS_DEEPINFRA_KEY,
      testMode: false,
    }

    console.log('[ChatService] Executing TTS action:', {
      ipfsId: LIT_TTS_ACTION_CID,
      textLength: text.length,
      keyHash: LIT_TTS_DEEPINFRA_KEY.dataToEncryptHash,
      keyCid: LIT_TTS_DEEPINFRA_KEY.cid,
    })

    const result = await litClient.executeJs({
      ipfsId: LIT_TTS_ACTION_CID,
      authContext,
      jsParams,
    })

    const response = JSON.parse(result.response as string)

    console.log('[ChatService] TTS response:', {
      success: response.success,
      hasAudio: !!response.audio,
      audioLength: response.audio?.length,
      wordsCount: response.words?.length,
      error: response.error,
      executionTime: response.executionTime,
    })

    return {
      success: response.success,
      audio: response.audio,
      words: response.words,
      error: response.error,
    }
  } catch (error) {
    console.error('[ChatService] TTS error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
