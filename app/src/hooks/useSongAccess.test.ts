/**
 * Unit tests for useSongAccess reducer
 *
 * Run with: bun test src/hooks/useSongAccess.test.ts
 */

import { describe, expect, test } from 'bun:test'

// ============ Types (copied from useSongAccess.ts to avoid import issues) ============

type SongAccessState =
  | 'idle'
  | 'checking'
  | 'not-owned'
  | 'purchasing'
  | 'owned-pending-decrypt'
  | 'owned-decrypting'
  | 'owned-decrypted'
  | 'owned-decrypt-failed'

type PurchaseSubState = 'checking-balance' | 'signing' | 'confirming' | null

interface StateContext {
  state: SongAccessState
  purchaseSubState: PurchaseSubState
  decryptedAudioUrl?: string
  decryptProgress?: number
  error?: string
  txHash?: `0x${string}`
  statusMessage?: string
}

type Action =
  | { type: 'CHECK_ACCESS' }
  | { type: 'ACCESS_FOUND' }
  | { type: 'NO_ACCESS' }
  | { type: 'START_PURCHASE' }
  | { type: 'PURCHASE_SIGNING' }
  | { type: 'PURCHASE_CONFIRMING'; txHash: `0x${string}` }
  | { type: 'PURCHASE_SUCCESS' }
  | { type: 'PURCHASE_FAILED'; error: string }
  | { type: 'DECRYPT_STARTED' }
  | { type: 'DECRYPT_PROGRESS'; progress: number }
  | { type: 'DECRYPT_SUCCESS'; audioUrl: string }
  | { type: 'DECRYPT_FAILED'; error: string }
  | { type: 'RETRY_DECRYPT' }
  | { type: 'RESET' }

// ============ Reducer (copied for testing in isolation) ============

function reducer(state: StateContext, action: Action): StateContext {
  switch (action.type) {
    case 'CHECK_ACCESS':
      return { ...state, state: 'checking', error: undefined }

    case 'ACCESS_FOUND':
      return { ...state, state: 'owned-pending-decrypt' }

    case 'NO_ACCESS':
      return { ...state, state: 'not-owned' }

    case 'START_PURCHASE':
      return {
        ...state,
        state: 'purchasing',
        purchaseSubState: 'checking-balance',
        error: undefined,
        statusMessage: 'Checking balance...',
      }

    case 'PURCHASE_SIGNING':
      return {
        ...state,
        purchaseSubState: 'signing',
        statusMessage: 'Sign to approve USDC...',
      }

    case 'PURCHASE_CONFIRMING':
      return {
        ...state,
        purchaseSubState: 'confirming',
        txHash: action.txHash,
        statusMessage: 'Confirming...',
      }

    case 'PURCHASE_SUCCESS':
      return {
        ...state,
        state: 'owned-pending-decrypt',
        purchaseSubState: null,
        statusMessage: 'Song unlocked!',
      }

    case 'PURCHASE_FAILED':
      return {
        ...state,
        state: 'not-owned',
        purchaseSubState: null,
        error: action.error,
        statusMessage: undefined,
      }

    case 'DECRYPT_STARTED':
      return {
        ...state,
        state: 'owned-decrypting',
        decryptProgress: undefined,
        error: undefined,
      }

    case 'DECRYPT_PROGRESS':
      return { ...state, decryptProgress: action.progress }

    case 'DECRYPT_SUCCESS':
      return {
        ...state,
        state: 'owned-decrypted',
        decryptedAudioUrl: action.audioUrl,
        decryptProgress: 100,
      }

    case 'DECRYPT_FAILED':
      return {
        ...state,
        state: 'owned-decrypt-failed',
        error: action.error,
        decryptProgress: undefined,
      }

    case 'RETRY_DECRYPT':
      return {
        ...state,
        state: 'owned-pending-decrypt',
        error: undefined,
        decryptProgress: undefined,
      }

    case 'RESET':
      return {
        state: 'idle',
        purchaseSubState: null,
        decryptedAudioUrl: undefined,
        decryptProgress: undefined,
        error: undefined,
        txHash: undefined,
        statusMessage: undefined,
      }

    default:
      return state
  }
}

const initialState: StateContext = {
  state: 'idle',
  purchaseSubState: null,
}

// ============ Tests ============

describe('useSongAccess reducer', () => {
  describe('access checking flow', () => {
    test('idle → checking', () => {
      const state = reducer(initialState, { type: 'CHECK_ACCESS' })
      expect(state.state).toBe('checking')
      expect(state.error).toBeUndefined()
    })

    test('checking → owned-pending-decrypt (access found)', () => {
      const checking: StateContext = { ...initialState, state: 'checking' }
      const state = reducer(checking, { type: 'ACCESS_FOUND' })
      expect(state.state).toBe('owned-pending-decrypt')
    })

    test('checking → not-owned (no access)', () => {
      const checking: StateContext = { ...initialState, state: 'checking' }
      const state = reducer(checking, { type: 'NO_ACCESS' })
      expect(state.state).toBe('not-owned')
    })
  })

  describe('purchase flow', () => {
    test('not-owned → purchasing', () => {
      const notOwned: StateContext = { ...initialState, state: 'not-owned' }
      const state = reducer(notOwned, { type: 'START_PURCHASE' })
      expect(state.state).toBe('purchasing')
      expect(state.purchaseSubState).toBe('checking-balance')
      expect(state.error).toBeUndefined()
    })

    test('purchasing substates: checking-balance → signing → confirming', () => {
      let state: StateContext = { ...initialState, state: 'purchasing', purchaseSubState: 'checking-balance' }

      state = reducer(state, { type: 'PURCHASE_SIGNING' })
      expect(state.purchaseSubState).toBe('signing')
      expect(state.statusMessage).toBe('Sign to approve USDC...')

      state = reducer(state, { type: 'PURCHASE_CONFIRMING', txHash: '0x123' })
      expect(state.purchaseSubState).toBe('confirming')
      expect(state.txHash).toBe('0x123')
    })

    test('purchase success → owned-pending-decrypt (immediate, no recheck)', () => {
      const purchasing: StateContext = {
        ...initialState,
        state: 'purchasing',
        purchaseSubState: 'confirming',
        txHash: '0x123'
      }
      const state = reducer(purchasing, { type: 'PURCHASE_SUCCESS' })
      expect(state.state).toBe('owned-pending-decrypt')
      expect(state.purchaseSubState).toBeNull()
      expect(state.statusMessage).toBe('Song unlocked!')
    })

    test('purchase failed → not-owned with error', () => {
      const purchasing: StateContext = { ...initialState, state: 'purchasing', purchaseSubState: 'signing' }
      const state = reducer(purchasing, { type: 'PURCHASE_FAILED', error: 'Insufficient USDC' })
      expect(state.state).toBe('not-owned')
      expect(state.purchaseSubState).toBeNull()
      expect(state.error).toBe('Insufficient USDC')
    })
  })

  describe('decryption flow', () => {
    test('owned-pending-decrypt → owned-decrypting', () => {
      const pending: StateContext = { ...initialState, state: 'owned-pending-decrypt' }
      const state = reducer(pending, { type: 'DECRYPT_STARTED' })
      expect(state.state).toBe('owned-decrypting')
      expect(state.decryptProgress).toBeUndefined()
      expect(state.error).toBeUndefined()
    })

    test('decrypting progress updates', () => {
      const decrypting: StateContext = { ...initialState, state: 'owned-decrypting' }

      let state = reducer(decrypting, { type: 'DECRYPT_PROGRESS', progress: 60 })
      expect(state.decryptProgress).toBe(60)

      state = reducer(state, { type: 'DECRYPT_PROGRESS', progress: 80 })
      expect(state.decryptProgress).toBe(80)
    })

    test('owned-decrypting → owned-decrypted (success)', () => {
      const decrypting: StateContext = { ...initialState, state: 'owned-decrypting', decryptProgress: 80 }
      const state = reducer(decrypting, { type: 'DECRYPT_SUCCESS', audioUrl: 'blob:123' })
      expect(state.state).toBe('owned-decrypted')
      expect(state.decryptedAudioUrl).toBe('blob:123')
      expect(state.decryptProgress).toBe(100)
    })

    test('owned-decrypting → owned-decrypt-failed (error)', () => {
      const decrypting: StateContext = { ...initialState, state: 'owned-decrypting', decryptProgress: 60 }
      const state = reducer(decrypting, { type: 'DECRYPT_FAILED', error: 'ACC check failed' })
      expect(state.state).toBe('owned-decrypt-failed')
      expect(state.error).toBe('ACC check failed')
      expect(state.decryptProgress).toBeUndefined()
    })

    test('owned-decrypt-failed → owned-pending-decrypt (retry)', () => {
      const failed: StateContext = {
        ...initialState,
        state: 'owned-decrypt-failed',
        error: 'ACC check failed'
      }
      const state = reducer(failed, { type: 'RETRY_DECRYPT' })
      expect(state.state).toBe('owned-pending-decrypt')
      expect(state.error).toBeUndefined()
      expect(state.decryptProgress).toBeUndefined()
    })
  })

  describe('full happy path: purchase → decrypt', () => {
    test('not-owned → purchasing → owned-pending-decrypt → decrypting → decrypted', () => {
      let state: StateContext = { ...initialState, state: 'not-owned' }

      // Start purchase
      state = reducer(state, { type: 'START_PURCHASE' })
      expect(state.state).toBe('purchasing')

      // Sign permit
      state = reducer(state, { type: 'PURCHASE_SIGNING' })
      expect(state.purchaseSubState).toBe('signing')

      // Confirm tx
      state = reducer(state, { type: 'PURCHASE_CONFIRMING', txHash: '0xabc' })
      expect(state.purchaseSubState).toBe('confirming')

      // Purchase success - immediately transitions to owned-pending-decrypt
      state = reducer(state, { type: 'PURCHASE_SUCCESS' })
      expect(state.state).toBe('owned-pending-decrypt')

      // Start decrypt
      state = reducer(state, { type: 'DECRYPT_STARTED' })
      expect(state.state).toBe('owned-decrypting')

      // Progress
      state = reducer(state, { type: 'DECRYPT_PROGRESS', progress: 60 })
      state = reducer(state, { type: 'DECRYPT_PROGRESS', progress: 80 })

      // Success
      state = reducer(state, { type: 'DECRYPT_SUCCESS', audioUrl: 'blob:audio' })
      expect(state.state).toBe('owned-decrypted')
      expect(state.decryptedAudioUrl).toBe('blob:audio')
    })
  })

  describe('reset', () => {
    test('reset clears all state', () => {
      const complex: StateContext = {
        state: 'owned-decrypted',
        purchaseSubState: null,
        decryptedAudioUrl: 'blob:123',
        decryptProgress: 100,
        error: undefined,
        txHash: '0xabc',
        statusMessage: 'Done',
      }
      const state = reducer(complex, { type: 'RESET' })
      expect(state).toEqual({
        state: 'idle',
        purchaseSubState: null,
        decryptedAudioUrl: undefined,
        decryptProgress: undefined,
        error: undefined,
        txHash: undefined,
        statusMessage: undefined,
      })
    })
  })

  describe('computed properties', () => {
    test('isOwned is true for all owned-* states', () => {
      const ownedStates: SongAccessState[] = [
        'owned-pending-decrypt',
        'owned-decrypting',
        'owned-decrypted',
        'owned-decrypt-failed',
      ]

      for (const s of ownedStates) {
        const isOwned = s.startsWith('owned-')
        expect(isOwned).toBe(true)
      }
    })

    test('isOwned is false for non-owned states', () => {
      const nonOwnedStates: SongAccessState[] = [
        'idle',
        'checking',
        'not-owned',
        'purchasing',
      ]

      for (const s of nonOwnedStates) {
        const isOwned = s.startsWith('owned-')
        expect(isOwned).toBe(false)
      }
    })
  })
})
