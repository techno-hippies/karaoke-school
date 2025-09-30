/**
 * Lit Protocol v8 Service for Speech-to-Text
 * Uses existing Lit Action at IPFS CID for secure STT via Voxstral API
 */

import { createLitClient } from '@lit-protocol/lit-client'
import { nagaDev } from '@lit-protocol/networks'
import { createAuthManager, storagePlugins, WalletClientAuthenticator } from '@lit-protocol/auth'
import type { WalletClient } from 'wagmi'

// Lit Action IPFS CID for STT v8 (uses jsParams pattern)
const STT_LIT_ACTION_CID = 'QmdN4nKcuYYQtNwDhMQA8v1QaiT9WzxMj8wuR6e6MdDgoM'

// Simple test action for debugging
const TEST_LIT_ACTION_CID = 'QmUSTaTAdpWtRS5jXatjEncvBACgYA3Ld19cMyduEFsGtc'

// Import encrypted keys
import { voxstralKeyData, dbUrlKeyData, dbTokenKeyData } from './config'

// Create Auth Manager with localStorage persistence (v8 pattern)
const authManager = createAuthManager({
  storage: storagePlugins.localStorage({
    appName: 'karaoke-school',
    networkName: 'naga-dev'
  })
})

export interface STTResult {
  success: boolean
  transcript: string
  error: string | null
  version?: string
}

class LitProtocolService {
  private litClient: any = null
  private authContext: any = null

  /**
   * Connect to Lit Network (v8 nagaDev)
   */
  async connect() {
    if (this.litClient) {
      console.log('[Lit] Already connected')
      return
    }

    try {
      console.log('[Lit] Connecting to nagaDev network...')
      this.litClient = await createLitClient({ network: nagaDev })
      console.log('[Lit] ✅ Connected to Lit Network (v8 nagaDev)')
    } catch (error: any) {
      console.error('[Lit] Failed to connect:', error)
      throw new Error(`Lit connection failed: ${error.message}`)
    }
  }

  /**
   * Create EOA auth context for Lit Action execution (no PKP needed for STT)
   * Per Lit docs: PKP auth only needed for signing operations, not for execute-only actions
   */
  async createAuthContext(walletClient: WalletClient) {
    if (!this.litClient) {
      throw new Error('Lit client not connected. Call connect() first.')
    }

    if (this.authContext) {
      console.log('[Lit] Using existing authContext')
      return this.authContext
    }

    try {
      console.log('[Lit] Creating EOA authContext (no PKP needed for STT)...')

      // Create EOA auth context (for execute-only, no signing)
      this.authContext = await authManager.createEoaAuthContext({
        authConfig: {
          resources: [
            ['lit-action-execution', '*']
          ],
          expiration: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(), // 24 hours
          statement: 'Execute Speech-to-Text Lit Action for Say It Back exercises',
          domain: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173'
        },
        config: {
          account: walletClient
        },
        litClient: this.litClient
      })

      console.log('[Lit] ✅ EOA AuthContext created')
      return this.authContext
    } catch (error: any) {
      console.error('[Lit] Failed to create authContext:', error)
      throw new Error(`AuthContext creation failed: ${error.message}`)
    }
  }

  /**
   * Transcribe audio using Lit Action (v8 executeJs)
   */
  async transcribeAudio(
    audioBlob: Blob,
    userAddress: string,
    authContext: any
  ): Promise<STTResult> {
    if (!this.litClient) {
      throw new Error('Lit client not connected')
    }

    if (!authContext) {
      throw new Error('AuthContext required. Call createAuthContext() first.')
    }

    try {
      console.log('[Lit] Starting STT transcription...')

      // Convert audio blob to base64
      const audioBuffer = await audioBlob.arrayBuffer()
      const audioArray = new Uint8Array(audioBuffer)
      const audioBase64 = btoa(String.fromCharCode(...audioArray))

      console.log('[Lit] Audio encoded, size:', audioBase64.length, 'characters')

      // Prepare parameters for Lit Action (matches free.js params)
      const jsParams = {
        // STT parameters
        audioDataBase64: audioBase64,
        language: 'en', // English-only for learning app

        // Analytics parameters (optional)
        userAddress: userAddress,
        userLanguage: typeof navigator !== 'undefined' ? navigator.language : 'en-US',
        userIpCountry: 'XX', // Could integrate GeoIP service later
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
        sessionId: `study-${Date.now()}`,

        // Encrypted Voxstral API key (required)
        accessControlConditions: voxstralKeyData.accessControlConditions,
        ciphertext: voxstralKeyData.ciphertext,
        dataToEncryptHash: voxstralKeyData.dataToEncryptHash,

        // Optional: Analytics DB credentials
        dbUrlCiphertext: dbUrlKeyData.ciphertext,
        dbUrlDataToEncryptHash: dbUrlKeyData.dataToEncryptHash,
        dbUrlAccessControlConditions: dbUrlKeyData.accessControlConditions,
        dbTokenCiphertext: dbTokenKeyData.ciphertext,
        dbTokenDataToEncryptHash: dbTokenKeyData.dataToEncryptHash,
        dbTokenAccessControlConditions: dbTokenKeyData.accessControlConditions
      }

      console.log('[Lit] Executing STT Lit Action (v8):', STT_LIT_ACTION_CID)
      console.log('[Lit] Audio size:', audioBase64.length, 'chars')

      // Execute Lit Action (v8 executeJs API with jsParams pattern)
      const result = await this.litClient.executeJs({
        ipfsId: STT_LIT_ACTION_CID,
        authContext: authContext,
        jsParams: jsParams
      })

      console.log('[Lit] Raw result:', result)

      // Parse response
      if (result.logs) {
        console.log('[Lit] Logs:', result.logs)
      }

      if (!result.response) {
        throw new Error('No response from Lit Action')
      }

      const response: STTResult = JSON.parse(result.response)
      console.log('[Lit] ✅ STT Result:', response)

      return response
    } catch (error: any) {
      console.error('[Lit] Transcription error:', error)

      // Return error in expected format
      return {
        success: false,
        transcript: '',
        error: error.message || 'Transcription failed'
      }
    }
  }

  /**
   * Disconnect from Lit Network
   */
  async disconnect() {
    if (this.litClient) {
      try {
        await this.litClient.disconnect()
        this.litClient = null
        this.authContext = null
        console.log('[Lit] Disconnected')
      } catch (error) {
        console.error('[Lit] Error disconnecting:', error)
      }
    }
  }

  /**
   * Clear auth context (force re-auth)
   */
  clearAuthContext() {
    this.authContext = null
    console.log('[Lit] Auth context cleared')
  }
}

// Singleton instance
export const litProtocolService = new LitProtocolService()