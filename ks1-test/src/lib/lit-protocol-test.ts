/**
 * Lit Protocol PKP Test Suite for One.js
 * Matches main app's exact implementation
 */

import { createLitClient } from '@lit-protocol/lit-client'
import { createAuthManager, storagePlugins, WebAuthnAuthenticator } from '@lit-protocol/auth'
import { nagaDev } from '@lit-protocol/networks'

const IS_DEV = true

export interface PKPTestResult {
  success: boolean
  platform: string
  tests: {
    litClientInit: boolean
    authManagerInit: boolean
    webAuthnAvailable: boolean
  }
  errors: string[]
  warnings: string[]
  performanceMs: number
  clientMethods?: string[]
  authManagerMethods?: string[]
}

/**
 * Test 1: Initialize Lit Protocol Client
 * Matches main app: src/lib/lit/client.ts
 */
async function testLitClientInit(): Promise<{
  success: boolean
  error?: string
  client?: any
  methods?: string[]
}> {
  try {
    console.log('[Lit Test] Initializing Lit Protocol client...')
    console.log('[Lit Test] Using nagaDev network (Chronicle)')

    const client = await createLitClient({
      network: nagaDev,
    })

    // List available methods
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(client))
      .filter(m => typeof (client as any)[m] === 'function' && !m.startsWith('_'))
      .slice(0, 10) // First 10 methods

    console.log('[Lit Test] ✅ Lit client initialized')
    console.log('[Lit Test] Available methods:', methods.join(', '))

    return { success: true, client, methods }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error('[Lit Test] ❌ Lit client init failed:', errorMsg)
    return { success: false, error: errorMsg }
  }
}

/**
 * Test 2: Initialize Auth Manager
 * Matches main app: src/lib/lit/client.ts
 */
function testAuthManagerInit(): {
  success: boolean
  error?: string
  authManager?: any
  methods?: string[]
} {
  try {
    console.log('[Lit Test] Initializing auth manager...')

    const authManager = createAuthManager({
      storage: storagePlugins.localStorage({
        appName: 'ks1-test',
        networkName: 'naga-dev',
      }),
    })

    // List available methods
    const methods = Object.getOwnPropertyNames(authManager)
      .filter(m => typeof (authManager as any)[m] === 'function' && !m.startsWith('_'))

    console.log('[Lit Test] ✅ Auth manager initialized')
    console.log('[Lit Test] Available methods:', methods.join(', '))

    return { success: true, authManager, methods }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error('[Lit Test] ❌ Auth manager init failed:', errorMsg)
    return { success: false, error: errorMsg }
  }
}

/**
 * Test 3: WebAuthn Availability
 * Check if WebAuthn is supported in this environment
 */
function testWebAuthnAvailability(): {
  success: boolean
  error?: string
  warning?: string
} {
  try {
    console.log('[Lit Test] Checking WebAuthn availability...')

    // Check if PublicKeyCredential is available
    const isAvailable = typeof window !== 'undefined' && 'PublicKeyCredential' in window

    if (!isAvailable) {
      const warning = 'WebAuthn not available (requires HTTPS or localhost)'
      console.warn('[Lit Test] ⚠️', warning)
      return { success: false, warning }
    }

    console.log('[Lit Test] ✅ WebAuthn available')
    console.log('[Lit Test] Note: Registration/auth requires user interaction (button click)')

    return { success: true }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error('[Lit Test] ❌ WebAuthn check failed:', errorMsg)
    return { success: false, error: errorMsg }
  }
}

/**
 * Run Full PKP Test Suite
 * Tests initialization only - WebAuthn requires user interaction
 */
export async function runPKPTestSuite(): Promise<PKPTestResult> {
  const startTime = Date.now()
  const errors: string[] = []
  const warnings: string[] = []
  const platform = typeof navigator !== 'undefined' && /Android|iPhone/.test(navigator.userAgent) ? 'mobile' : 'web'

  const result: PKPTestResult = {
    success: false,
    platform,
    tests: {
      litClientInit: false,
      authManagerInit: false,
      webAuthnAvailable: false,
    },
    errors,
    warnings,
    performanceMs: 0,
  }

  try {
    console.log('='.repeat(60))
    console.log('🧪 Lit Protocol PKP Test Suite (One.js)')
    console.log('Platform:', platform)
    console.log('Network: nagaDev (Chronicle)')
    console.log('='.repeat(60))

    // Test 1: Initialize Lit Client
    const initResult = await testLitClientInit()
    result.tests.litClientInit = initResult.success
    result.clientMethods = initResult.methods

    if (!initResult.success) {
      errors.push(`Lit client init: ${initResult.error}`)
      throw new Error('Lit client init failed')
    }

    // Test 2: Initialize Auth Manager
    const authResult = testAuthManagerInit()
    result.tests.authManagerInit = authResult.success
    result.authManagerMethods = authResult.methods

    if (!authResult.success) {
      errors.push(`Auth manager init: ${authResult.error}`)
      throw new Error('Auth manager init failed')
    }

    // Test 3: WebAuthn Availability
    const webAuthnResult = testWebAuthnAvailability()
    result.tests.webAuthnAvailable = webAuthnResult.success

    if (!webAuthnResult.success && webAuthnResult.warning) {
      warnings.push(webAuthnResult.warning)
    }

    if (!webAuthnResult.success && webAuthnResult.error) {
      errors.push(`WebAuthn check: ${webAuthnResult.error}`)
    }

    result.success = result.tests.litClientInit && result.tests.authManagerInit

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    if (!errors.includes(`Unexpected error: ${errorMsg}`)) {
      errors.push(`Unexpected error: ${errorMsg}`)
    }
  } finally {
    result.errors = errors
    result.warnings = warnings
    result.performanceMs = Date.now() - startTime

    console.log('='.repeat(60))
    console.log('📊 Results')
    console.log('='.repeat(60))
    console.log('Overall:', result.success ? '✅ PASS' : '❌ FAIL')
    console.log('Tests:')
    console.log(' - Lit client init:', result.tests.litClientInit ? '✅' : '❌')
    console.log(' - Auth manager init:', result.tests.authManagerInit ? '✅' : '❌')
    console.log(' - WebAuthn available:', result.tests.webAuthnAvailable ? '✅' : '⚠️')
    console.log('Errors:', result.errors.length)
    result.errors.forEach(err => console.log(' -', err))
    console.log('Warnings:', result.warnings.length)
    result.warnings.forEach(warn => console.log(' -', warn))
    console.log('Time:', result.performanceMs, 'ms')
    console.log('='.repeat(60))
  }

  return result
}

/**
 * Interactive WebAuthn Registration Test
 * Call this from a button click (requires user gesture)
 * Matches main app: src/lib/lit/auth-webauthn.ts
 */
export async function testWebAuthnRegistration(): Promise<{
  success: boolean
  error?: string
  pkpInfo?: {
    publicKey: string
    ethAddress: string
    tokenId: string
  }
}> {
  try {
    console.log('[Lit Test] Starting WebAuthn registration...')
    console.log('[Lit Test] This will prompt for passkey creation')

    const result = await WebAuthnAuthenticator.registerAndMintPKP({
      username: 'KS1 Test User',
      authServiceBaseUrl: 'https://naga-dev-auth-service.getlit.dev',
      scopes: ['sign-anything'],
    }) as { pkpInfo: any; webAuthnPublicKey: string; authData?: any }

    console.log('[Lit Test] ✅ Registration successful!')
    console.log('[Lit Test] PKP Address:', result.pkpInfo.ethAddress)
    console.log('[Lit Test] PKP Public Key:', result.pkpInfo.pubkey.slice(0, 20) + '...')

    return {
      success: true,
      pkpInfo: {
        publicKey: result.pkpInfo.pubkey,
        ethAddress: result.pkpInfo.ethAddress,
        tokenId: result.pkpInfo.tokenId.toString(),
      },
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error('[Lit Test] ❌ Registration failed:', errorMsg)
    return { success: false, error: errorMsg }
  }
}

/**
 * Interactive WebAuthn Authentication Test
 * Call this from a button click (requires user gesture)
 * Matches main app: src/lib/lit/auth-webauthn.ts
 */
export async function testWebAuthnAuthentication(): Promise<{
  success: boolean
  error?: string
  pkpInfo?: {
    publicKey: string
    ethAddress: string
    tokenId: string
  }
}> {
  try {
    console.log('[Lit Test] Starting WebAuthn authentication...')
    console.log('[Lit Test] This will prompt for passkey')

    // Authenticate with WebAuthn
    const authData = await WebAuthnAuthenticator.authenticate()

    console.log('[Lit Test] ✅ Authentication successful')
    console.log('[Lit Test] Auth Method ID:', authData.authMethodId.slice(0, 20) + '...')

    // Get PKP for this credential
    const litClient = await createLitClient({ network: nagaDev })

    const pkpsResult = await litClient.viewPKPsByAuthData({
      authData: {
        authMethodType: authData.authMethodType,
        authMethodId: authData.authMethodId,
      },
      pagination: {
        limit: 5,
        offset: 0,
      },
    })

    if (!pkpsResult || !pkpsResult.pkps || pkpsResult.pkps.length === 0) {
      throw new Error('No PKP found for this credential. Please register first.')
    }

    const pkp = pkpsResult.pkps[0]

    console.log('[Lit Test] ✅ PKP found')
    console.log('[Lit Test] PKP Address:', pkp.ethAddress)

    return {
      success: true,
      pkpInfo: {
        publicKey: pkp.pubkey,
        ethAddress: pkp.ethAddress,
        tokenId: pkp.tokenId.toString(),
      },
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error('[Lit Test] ❌ Authentication failed:', errorMsg)
    return { success: false, error: errorMsg }
  }
}
