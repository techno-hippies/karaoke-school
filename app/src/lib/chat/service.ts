/**
 * Chat Service - Calls AI chat Lit Actions
 *
 * Modes:
 * - CHAT: Text message → AI response
 * - TRANSLATE: English → target language translation
 * - TTS: Text → speech with word timestamps
 */

import { getLitClient } from '@/lib/lit/client'
import {
  LIT_CHAT_ACTION_CID,
  LIT_CHAT_OPENROUTER_KEY,
  LIT_CHAT_DEEPINFRA_KEY,
  LIT_TTS_ACTION_CID,
  LIT_TTS_DEEPINFRA_KEY,
} from '@/lib/contracts/addresses'
import type {
  PersonalityId,
  ChatRequest,
  ChatResponse,
  TranslateRequest,
  TranslateResponse,
  TTSRequest,
  TTSResponse,
} from './types'
import type { PKPAuthContext } from '@/lib/lit/types'

// Map personality IDs to Lens usernames expected by Lit Action
const PERSONALITY_USERNAMES: Record<PersonalityId, string> = {
  scarlett: 'scarlett-ks',
  violet: 'violet-ks',
}

/**
 * Send a chat message to the AI personality
 *
 * Supports both text and audio input:
 * - Text: Pass `message` string
 * - Audio: Pass `audioBase64` (will be transcribed via STT)
 */
export async function sendChatMessage(
  request: ChatRequest,
  authContext: PKPAuthContext
): Promise<ChatResponse> {
  const {
    personalityId,
    message,
    audioBase64,
    conversationHistory = [],
    returnAudio = false,
    userContext,
    scenarioId,
  } = request

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

    const jsParams = {
      mode: 'CHAT',
      username: PERSONALITY_USERNAMES[personalityId],
      scenarioId: scenarioId || undefined,
      userMessage: message || undefined,
      audioDataBase64: audioBase64 || undefined,
      conversationHistory: conversationHistory.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      userContext: userContext || undefined,
      openrouterEncryptedKey: LIT_CHAT_OPENROUTER_KEY,
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
 * Translate text to user's language
 */
export async function translateText(
  request: TranslateRequest,
  authContext: PKPAuthContext
): Promise<TranslateResponse> {
  const { text, targetLanguage = 'zh' } = request

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
      openrouterEncryptedKey: LIT_CHAT_OPENROUTER_KEY,
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

/**
 * Convert text to speech on-demand
 * Called when user clicks "Play" button on a chat message
 */
export async function synthesizeSpeech(
  request: TTSRequest,
  authContext: PKPAuthContext
): Promise<TTSResponse> {
  const { text, voice = 'af_heart' } = request

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
