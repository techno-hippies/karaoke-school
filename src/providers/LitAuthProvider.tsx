import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react'
import { createLitClient } from '@lit-protocol/lit-client'
import { nagaDev } from '@lit-protocol/networks'
import { 
  createAuthManager, 
  storagePlugins,
  WebAuthnAuthenticator,
  ViemAccountAuthenticator,
  WalletClientAuthenticator
} from '@lit-protocol/auth'
import { privateKeyToAccount } from 'viem/accounts'
import { computeAddress } from 'ethers/lib/utils'
import { useWalletClient } from 'wagmi'

// Types
interface AuthMethod {
  type: 'webauthn' | 'wallet' | 'claimed-pkp'
  pkpPublicKey?: string
  authContext?: any
  authData?: any
}

interface LitAuthContextType {
  // State
  isAuthenticated: boolean
  isLoading: boolean
  hasInitialized: boolean  // Added to track if localStorage has been read
  error: string | null
  authMethod: AuthMethod | null
  pkpInfo: any | null
  pkpViemAccount: any | null  // The actual Viem account for transactions

  // Auth methods
  signUpWithWebAuthn: () => Promise<void>
  authenticateWithWebAuthn: () => Promise<void>
  connectWallet: () => Promise<void>
  signOut: () => void

  // PKP operations
  signMessage: (message: string) => Promise<string>
  getPkpViemAccount: () => Promise<any>
}

// Auth Manager - singleton instance
const authManager = createAuthManager({
  storage: storagePlugins.localStorage({
    appName: "karaoke-school",
    networkName: "naga-dev",
  }),
})

// Auth service base URL for WebAuthn
const AUTH_SERVICE_URL = import.meta.env.VITE_LIT_AUTH_SERVICE_URL || "https://naga-auth-service.onrender.com"

// Create context
const LitAuthContext = createContext<LitAuthContextType | null>(null)

// Hook to use auth context
export const useLitAuth = () => {
  const context = useContext(LitAuthContext)
  if (!context) {
    throw new Error('useLitAuth must be used within LitAuthProvider')
  }
  return context
}

interface LitAuthProviderProps {
  children: ReactNode
}

export const LitAuthProvider: React.FC<LitAuthProviderProps> = ({ children }) => {
  // Initialize state - start with false and set from localStorage in useEffect to avoid hydration issues
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [hasInitialized, setHasInitialized] = useState(false)
  
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [authMethod, setAuthMethod] = useState<AuthMethod | null>(null)
  const [pkpInfo, setPkpInfo] = useState<any>(null)
  
  const [litClient, setLitClient] = useState<any>(null)
  const [pkpViemAccount, setPkpViemAccount] = useState<any>(null)

  // Initialize authentication state from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined' || hasInitialized) return

    try {
      const saved = localStorage.getItem('lit_pkp_info')
      if (saved) {
        const parsed = JSON.parse(saved)
        console.log('[LitAuth] Restoring authentication state from localStorage:', parsed)

        // Set authentication state
        setIsAuthenticated(true)
        setAuthMethod({
          type: parsed.authMethodType || 'webauthn',
          pkpPublicKey: parsed.pkpPublicKey
        })

        // If we have a pkpPublicKey but no ethAddress, compute it
        if (parsed.pkpPublicKey && !parsed.ethAddress) {
          try {
            const ethAddress = computeAddress(parsed.pkpPublicKey)
            parsed.ethAddress = ethAddress
          } catch (e) {
            console.error('[LitAuth] Error computing ETH address:', e)
          }
        }

        setPkpInfo(parsed)
      } else {
        console.log('[LitAuth] No saved authentication state found')
      }
    } catch (e) {
      console.error('[LitAuth] Error restoring authentication state:', e)
    } finally {
      setHasInitialized(true)
    }
  }, [hasInitialized])

  // Recreate PKP Viem account on mount if we have stored auth
  useEffect(() => {
    // If we have PKP info but no Viem account, try to recreate it
    if (hasInitialized && isAuthenticated && authMethod && pkpInfo?.pkpPublicKey && !pkpViemAccount && !isLoading) {
      console.log('[LitAuth] Attempting to recreate PKP Viem account from stored auth')
      recreatePkpViemFromStoredAuth();
    }
  }, [hasInitialized, isAuthenticated, authMethod, pkpInfo?.pkpPublicKey, pkpViemAccount, isLoading])
  
  // Function to recreate PKP Viem account from stored auth
  const recreatePkpViemFromStoredAuth = async () => {
    if (!pkpInfo?.pkpPublicKey || !authMethod) return;
    
    setIsLoading(true);
    try {
      const client = await initLitClient();
      
      // Check if we have cached session signatures
      const cacheKey = `lit-auth:karaoke-school:naga-dev:${pkpInfo.ethAddress}`;
      const cachedAuth = localStorage.getItem(cacheKey);
      
      if (cachedAuth) {
        // We have cached auth context, try to use it
        const authData = JSON.parse(cachedAuth);
        
        // Create PKP Viem account with cached auth
        const { baseSepolia } = await import('viem/chains');
        const viemAccount = await client.getPkpViemAccount({
          pkpPublicKey: pkpInfo.pkpPublicKey,
          authContext: authData,
          chainConfig: baseSepolia
        });
        
        setPkpViemAccount(viemAccount);
        console.log('[LitAuth] Recreated PKP Viem account from cache:', viemAccount.address);
      } else {
        // Need to authenticate to get auth context
        console.log('[LitAuth] No cached auth context, need fresh authentication for transactions');
      }
    } catch (err) {
      console.error('[LitAuth] Failed to recreate PKP Viem account:', err);
      // Auth context might be expired, user needs to re-authenticate
    } finally {
      setIsLoading(false);
    }
  }
  

  // Get wallet client from wagmi (for wallet connection)
  const { data: walletClient } = useWalletClient()

  // Initialize Lit client
  const initLitClient = useCallback(async () => {
    if (!litClient) {
      const client = await createLitClient({
        network: nagaDev,
      })
      setLitClient(client)
      return client
    }
    return litClient
  }, [litClient])

  // Sign up with WebAuthn (register + mint PKP)
  const signUpWithWebAuthn = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      const client = await initLitClient()
      
      // Register WebAuthn credential and mint PKP
      const { pkpInfo: mintedPkp, webAuthnPublicKey, authData } = await WebAuthnAuthenticator.registerAndMintPKP({
        authServiceBaseUrl: AUTH_SERVICE_URL,
        scopes: ["sign-anything"],
      })
      
      console.log('PKP minted successfully:', mintedPkp)
      console.log('Auth data from registration:', authData)
      
      // The registration response should include authData
      // If not, create it from the registration info
      const authDataForContext = authData || {
        authMethodType: 3, // WebAuthn type
        authMethodId: webAuthnPublicKey,
        accessToken: JSON.stringify({ 
          webAuthnPublicKey,
          pkpTokenId: mintedPkp.tokenId 
        })
      }
      
      // Create PKP auth context
      const authContext = await authManager.createPkpAuthContext({
        authData: authDataForContext,
        pkpPublicKey: mintedPkp.pubkey,
        authConfig: {
          resources: [
            ["pkp-signing", "*"],
            ["lit-action-execution", "*"],
          ],
          expiration: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(), // 24 hours
          statement: "",
          domain: window.location.origin,
        },
        litClient: client,
      })
      
      // Update state
      setPkpInfo(mintedPkp)
      setAuthMethod({
        type: 'webauthn',
        pkpPublicKey: mintedPkp.pubkey,
        authContext,
        authData
      })
      setIsAuthenticated(true)
      
      // Create PKP Viem account for transactions
      try {
        const { baseSepolia } = await import('viem/chains')
        const viemAccount = await client.getPkpViemAccount({
          pkpPublicKey: mintedPkp.pubkey,
          authContext,
          chainConfig: baseSepolia
        })
        setPkpViemAccount(viemAccount)
        
        // Cache the auth context for later use
        const cacheKey = `lit-auth:karaoke-school:naga-dev:${mintedPkp.ethAddress}`;
        localStorage.setItem(cacheKey, JSON.stringify(authContext));
        
        console.log('[LitAuth] Created PKP Viem account after signup:', viemAccount.address)
      } catch (err) {
        console.error('[LitAuth] Failed to create Viem account:', err)
      }
      
      // Store PKP info in localStorage for persistence
      const dataToStore = {
        pkpPublicKey: mintedPkp.pubkey,
        authMethodType: 'webauthn',
        ethAddress: mintedPkp.ethAddress,
        tokenId: mintedPkp.tokenId
      }
      console.log('[LitAuth] Storing to localStorage after signup:', dataToStore)
      localStorage.setItem('lit_pkp_info', JSON.stringify(dataToStore))
      
    } catch (err: any) {
      console.error('WebAuthn signup error:', err)
      setError(err.message || 'Failed to sign up with WebAuthn')
    } finally {
      setIsLoading(false)
    }
  }, [initLitClient])

  // Authenticate with existing WebAuthn credential
  const authenticateWithWebAuthn = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      const client = await initLitClient()
      
      // Authenticate with existing WebAuthn credential
      const authData = await WebAuthnAuthenticator.authenticate({
        authServiceBaseUrl: AUTH_SERVICE_URL,
      })
      
      console.log('Authenticated with WebAuthn:', authData)
      
      // Get PKPs associated with this auth method
      const result = await client.viewPKPsByAuthData({
        authData: {
          authMethodType: authData.authMethodType,
          authMethodId: authData.authMethodId,
        },
        pagination: {
          limit: 5,
          offset: 0,
        }
      })
      
      if (!result.pkps || result.pkps.length === 0) {
        throw new Error('No PKP found for this WebAuthn credential. Please sign up first.')
      }
      
      const pkp = result.pkps[0]
      console.log('Found PKP:', pkp)
      
      // Create auth context
      const authContext = await authManager.createPkpAuthContext({
        authData,
        pkpPublicKey: pkp.publicKey,
        authConfig: {
          resources: [
            ["pkp-signing", "*"],
            ["lit-action-execution", "*"],
          ],
          expiration: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
          statement: "",
          domain: window.location.origin,
        },
        litClient: client,
      })
      
      // Update state
      setPkpInfo(pkp)
      setAuthMethod({
        type: 'webauthn',
        pkpPublicKey: pkp.publicKey,
        authContext,
        authData
      })
      setIsAuthenticated(true)
      
      // Create PKP Viem account for transactions
      try {
        const { baseSepolia } = await import('viem/chains')
        const viemAccount = await client.getPkpViemAccount({
          pkpPublicKey: pkp.publicKey,
          authContext,
          chainConfig: baseSepolia
        })
        setPkpViemAccount(viemAccount)
        
        // Cache the auth context for later use
        const cacheKey = `lit-auth:karaoke-school:naga-dev:${pkp.ethAddress}`;
        localStorage.setItem(cacheKey, JSON.stringify(authContext));
        
        console.log('[LitAuth] Created PKP Viem account after login:', viemAccount.address)
      } catch (err) {
        console.error('[LitAuth] Failed to create Viem account:', err)
      }
      
      const dataToStore = {
        pkpPublicKey: pkp.publicKey,
        authMethodType: 'webauthn',
        ethAddress: pkp.ethAddress,
        tokenId: pkp.tokenId
      }
      console.log('[LitAuth] Storing to localStorage after login:', dataToStore)
      localStorage.setItem('lit_pkp_info', JSON.stringify(dataToStore))
      
    } catch (err: any) {
      console.error('WebAuthn authentication error:', err)
      setError(err.message || 'Failed to authenticate with WebAuthn')
    } finally {
      setIsLoading(false)
    }
  }, [initLitClient])

  // Connect wallet (EOA) and mint/access PKP
  const connectWallet = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      if (!walletClient) {
        // If no wallet connected via wagmi, try direct connection
        if (!window.ethereum) {
          throw new Error('No wallet detected. Please install MetaMask or another wallet.')
        }
        
        // Request account access
        await window.ethereum.request({ method: 'eth_requestAccounts' })
        throw new Error('Please connect your wallet first')
      }
      
      const client = await initLitClient()
      
      // Authenticate with wallet
      const authData = await WalletClientAuthenticator.authenticate(walletClient as any)
      
      // Check for existing PKPs
      const result = await client.viewPKPsByAuthData({
        authData: {
          authMethodType: authData.authMethodType,
          authMethodId: authData.authMethodId,
        },
        pagination: {
          limit: 5,
          offset: 0,
        }
      })
      
      let pkp
      if (result.pkps && result.pkps.length > 0) {
        // Use existing PKP
        pkp = result.pkps[0]
      } else {
        // Mint new PKP
        const mintResult = await client.mintWithAuth({
          account: walletClient as any,
          authData,
          scopes: ['sign-anything'],
        })
        pkp = { publicKey: mintResult.pkpPublicKey }
      }
      
      // Create auth context
      const authContext = await authManager.createPkpAuthContext({
        authData,
        pkpPublicKey: pkp.publicKey,
        authConfig: {
          resources: [
            ["pkp-signing", "*"],
            ["lit-action-execution", "*"],
          ],
          expiration: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
          statement: "",
          domain: window.location.origin,
        },
        litClient: client,
      })
      
      // Update state
      setPkpInfo(pkp)
      setAuthMethod({
        type: 'wallet',
        pkpPublicKey: pkp.publicKey,
        authContext,
        authData
      })
      setIsAuthenticated(true)
      
      // Store for persistence
      const dataToStore = {
        pkpPublicKey: pkp.publicKey,
        authMethodType: 'wallet',
        ethAddress: pkp.ethAddress,
        tokenId: pkp.tokenId
      }
      console.log('[LitAuth] Storing to localStorage after wallet connect:', dataToStore)
      localStorage.setItem('lit_pkp_info', JSON.stringify(dataToStore))
      
    } catch (err: any) {
      console.error('Wallet connection error:', err)
      setError(err.message || 'Failed to connect wallet')
    } finally {
      setIsLoading(false)
    }
  }, [walletClient, initLitClient])

  // Sign out
  const signOut = useCallback(() => {
    console.log('[LitAuth] Signing out - clearing localStorage')
    setIsAuthenticated(false)
    setAuthMethod(null)
    setPkpInfo(null)
    setError(null)
    localStorage.removeItem('lit_pkp_info')
    
    if (litClient) {
      litClient.disconnect()
      setLitClient(null)
    }
  }, [litClient])

  // Sign a message with PKP
  const signMessage = useCallback(async (message: string) => {
    if (!authMethod?.authContext || !authMethod?.pkpPublicKey) {
      throw new Error('Not authenticated')
    }
    
    const client = await initLitClient()
    
    const signature = await client.pkpSign({
      pubKey: authMethod.pkpPublicKey,
      authContext: authMethod.authContext,
      toSign: new TextEncoder().encode(message),
      chain: 'ethereum',
    })
    
    return signature.hex
  }, [authMethod, initLitClient])

  // Get PKP Viem account for transactions
  const getPkpViemAccount = useCallback(async () => {
    if (!authMethod?.authContext || !authMethod?.pkpPublicKey) {
      throw new Error('Not authenticated')
    }
    
    const client = await initLitClient()
    const { baseSepolia } = await import('viem/chains')
    
    return await client.getPkpViemAccount({
      pkpPublicKey: authMethod.pkpPublicKey,
      authContext: authMethod.authContext,
      chainConfig: baseSepolia
    })
  }, [authMethod, initLitClient])

  const value = {
    isAuthenticated,
    isLoading,
    hasInitialized,  // Expose initialization state
    error,
    authMethod,
    pkpInfo,
    pkpViemAccount,  // Expose the Viem account
    signUpWithWebAuthn,
    authenticateWithWebAuthn,
    connectWallet,
    signOut,
    signMessage,
    getPkpViemAccount,
  }

  return (
    <LitAuthContext.Provider value={value}>
      {children}
    </LitAuthContext.Provider>
  )
}