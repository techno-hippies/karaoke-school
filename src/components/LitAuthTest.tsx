import React, { useState } from 'react'
import { AuthButtons } from './auth/AuthButtons'
import { useLitAuth } from '../providers/LitAuthProvider'
import { Button } from './ui/button'
import { PageLayout } from './layout/PageLayout'

export const LitAuthTest: React.FC = () => {
  const { 
    isAuthenticated, 
    authMethod, 
    pkpInfo,
    signMessage,
    getPkpViemAccount 
  } = useLitAuth()
  
  const [testMessage, setTestMessage] = useState('Hello from Lit Protocol v8!')
  const [signature, setSignature] = useState<string | null>(null)
  const [pkpAccount, setPkpAccount] = useState<any>(null)
  const [isSigningLoading, setIsSigningLoading] = useState(false)

  // Test signing a message
  const handleTestSign = async () => {
    if (!isAuthenticated) return
    
    setIsSigningLoading(true)
    try {
      const sig = await signMessage(testMessage)
      setSignature(sig)
    } catch (err) {
      console.error('Error signing message:', err)
    } finally {
      setIsSigningLoading(false)
    }
  }

  // Test getting PKP Viem account
  const handleGetViemAccount = async () => {
    if (!isAuthenticated) return
    
    try {
      const account = await getPkpViemAccount()
      setPkpAccount(account)
      console.log('PKP Viem Account:', account)
    } catch (err) {
      console.error('Error getting Viem account:', err)
    }
  }

  return (
    <PageLayout>
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <h1 className="text-3xl font-bold">Lit Protocol v8 Auth Test</h1>
        
        {/* Auth Section */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Authentication</h2>
          <AuthButtons />
        </div>

        {/* PKP Info Section */}
        {isAuthenticated && pkpInfo && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4">PKP Information</h2>
            <div className="space-y-2 text-sm">
              <p><strong>Auth Method:</strong> {authMethod?.type}</p>
              <p><strong>PKP Public Key:</strong></p>
              <p className="font-mono text-xs break-all bg-neutral-100 p-2 rounded">
                {pkpInfo.publicKey || pkpInfo.pubkey}
              </p>
              {pkpInfo.tokenId && (
                <p><strong>Token ID:</strong> {pkpInfo.tokenId}</p>
              )}
              {pkpInfo.ethAddress && (
                <p><strong>ETH Address:</strong> {pkpInfo.ethAddress}</p>
              )}
            </div>
          </div>
        )}

        {/* Signing Test Section */}
        {isAuthenticated && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Test PKP Signing</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Message to sign:
                </label>
                <input
                  type="text"
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  className="w-full p-2 border rounded"
                />
              </div>
              
              <Button 
                onClick={handleTestSign}
                disabled={isSigningLoading}
              >
                {isSigningLoading ? 'Signing...' : 'Sign Message'}
              </Button>

              {signature && (
                <div>
                  <p className="text-sm font-medium mb-1">Signature:</p>
                  <p className="font-mono text-xs break-all bg-neutral-100 p-2 rounded">
                    {signature}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Viem Account Test Section */}
        {isAuthenticated && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4">PKP Viem Account</h2>
            <div className="space-y-4">
              <Button onClick={handleGetViemAccount}>
                Get PKP Viem Account
              </Button>
              
              {pkpAccount && (
                <div>
                  <p className="text-sm font-medium mb-1">Account Address:</p>
                  <p className="font-mono text-xs break-all bg-neutral-100 p-2 rounded">
                    {pkpAccount.address}
                  </p>
                  <p className="text-sm text-neutral-600 mt-2">
                    This account can be used with wagmi/viem for transactions!
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Comparison with RainbowKit */}
        <div className="bg-blue-50 rounded-lg p-6">
          <h3 className="font-semibold mb-2">Migration Status</h3>
          <p className="text-sm text-neutral-700 mb-2">
            ✅ Lit Protocol v8 authentication is now running alongside RainbowKit.
          </p>
          <ul className="text-sm text-neutral-600 space-y-1 ml-4">
            <li>• WebAuthn (biometric) authentication working</li>
            <li>• EOA wallet authentication working</li>
            <li>• PKP minting and access functional</li>
            <li>• PKP signing capabilities tested</li>
            <li>• PKP Viem Account for transactions ready</li>
          </ul>
          <p className="text-sm text-neutral-700 mt-4">
            Both auth systems are currently active. RainbowKit can be safely removed once all features are verified.
          </p>
        </div>
      </div>
    </PageLayout>
  )
}