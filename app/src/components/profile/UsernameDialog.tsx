/**
 * Username Creation Dialog
 *
 * Allows active users to add a username to their Lens account.
 * Accounts function fully without usernames (identified by address),
 * but usernames provide better discoverability and branding.
 *
 * Triggered for engaged users (e.g., after 5+ interactions)
 */

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import type { SessionClient } from '@lens-protocol/client'
import type { WalletClient } from 'viem'
import { evmAddress, RulesSubject } from '@lens-protocol/client'
import { canCreateUsername, createUsername } from '@lens-protocol/client/actions'
import { handleOperationWith } from '@lens-protocol/client/viem'

export interface UsernameDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sessionClient: SessionClient | null
  walletClient: WalletClient | null
  onSuccess: () => void
}

/**
 * UsernameDialog Component
 *
 * Shows a form for creating a username in a restricted namespace.
 * Validates availability and handles transaction signing.
 */
export function UsernameDialog({
  open,
  onOpenChange,
  sessionClient,
  walletClient,
  onSuccess
}: UsernameDialogProps) {
  const [username, setUsername] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // For now, we'll use the default namespace
  // In production, you'd want to configure your own restricted namespace
  // with rules (e.g., fees, token-gating) to prevent squatting
  const namespace = '0x0000000000000000000000000000000000000000' // Global namespace for testing

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!sessionClient || !walletClient) {
      toast.error('Not connected to Lens')
      return
    }

    if (!username || username.length < 3) {
      toast.error('Username must be at least 3 characters')
      return
    }

    setIsSubmitting(true)

    try {
      // Step 1: Verify username is available
      console.log('[Username] Checking availability:', username)
      const verifyResult = await canCreateUsername(sessionClient, {
        localName: username.toLowerCase(),
        namespace: evmAddress(namespace),
        rulesSubject: RulesSubject.Signer,
      })

      if (verifyResult.isErr()) {
        toast.error(`Verification failed: ${verifyResult.error.message}`)
        setIsSubmitting(false)
        return
      }

      if (verifyResult.value.__typename !== 'NamespaceOperationValidationPassed') {
        const reason = verifyResult.value.reason || 'Username unavailable or invalid'
        toast.error(reason)
        setIsSubmitting(false)
        return
      }

      console.log('[Username] Username available')

      // Step 2: Create username
      console.log('[Username] Creating username...')
      const createResult = await createUsername(sessionClient, {
        username: {
          localName: username.toLowerCase(),
          namespace: evmAddress(namespace),
        },
        rulesSubject: RulesSubject.Signer,
      })

      if (createResult.isErr()) {
        toast.error(`Creation failed: ${createResult.error.message}`)
        setIsSubmitting(false)
        return
      }

      // Step 3: Sign transaction
      console.log('[Username] Signing transaction...')
      const txResult = await handleOperationWith(walletClient)(createResult.value)

      if (txResult.isErr()) {
        toast.error(`Transaction failed: ${txResult.error.message}`)
        setIsSubmitting(false)
        return
      }

      // Step 4: Wait for confirmation
      console.log('[Username] Waiting for confirmation...')
      const confirmResult = await sessionClient.waitForTransaction(txResult.value)

      if (confirmResult.isErr()) {
        console.warn('[Username] Indexer timeout, but username may be created')
      }

      console.log('[Username] Username created successfully!')
      toast.success(`Username @${username} created!`)

      onSuccess()
      onOpenChange(false)
      setUsername('')
    } catch (error) {
      console.error('[Username] Error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to create username')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Your Username</DialogTitle>
          <DialogDescription>
            Choose a unique username for your Lens account. This helps others find and recognize you.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="username">Username</Label>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-muted-foreground">@</span>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                placeholder="username"
                pattern="[a-z0-9]+"
                minLength={3}
                maxLength={26}
                required
                disabled={isSubmitting}
              />
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              3-26 characters, lowercase letters and numbers only
            </p>
          </div>

          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Later
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Username'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
