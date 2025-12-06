/**
 * UserProfilePage - Container for viewing user profiles
 * Route: /u/:handle
 *
 * Displays a user's profile with their videos and stats.
 * For own profile, redirects to /wallet (unified wallet+profile page).
 */

import { type Component, Show, createMemo } from 'solid-js'
import { useParams, useNavigate } from '@solidjs/router'
import { useAuth } from '@/contexts/AuthContext'
import { useLensAccount } from '@/hooks/useLensAccount'
import { ProfilePageView } from '@/components/profile/ProfilePageView'
import { Spinner } from '@/components/ui/spinner'
import { Button } from '@/components/ui/button'

export const UserProfilePage: Component = () => {
  const params = useParams<{ handle: string }>()
  const navigate = useNavigate()
  const auth = useAuth()

  // Get handle from URL params
  const handle = () => params.handle

  // Fetch the Lens account for this handle
  const { account, isLoading, error } = useLensAccount(handle)

  // Check if this is the current user's own profile
  const isOwnProfile = createMemo(() => {
    const lensAccount = auth.lensAccount()
    if (!lensAccount || !account()) return false
    return lensAccount.address === account()?.address
  })

  const handleBack = () => {
    navigate(-1)
  }

  return (
    <div class="min-h-screen bg-background">
      {/* Loading state */}
      <Show when={isLoading()}>
        <div class="flex items-center justify-center min-h-screen">
          <Spinner size="lg" />
        </div>
      </Show>

      {/* Error state */}
      <Show when={error() && !isLoading()}>
        <div class="flex flex-col items-center justify-center min-h-screen gap-4 px-4">
          <h2 class="text-xl font-semibold text-destructive">Error Loading Profile</h2>
          <p class="text-muted-foreground text-center">{error()?.message}</p>
          <Button onClick={handleBack} variant="outline">
            Go Back
          </Button>
        </div>
      </Show>

      {/* Not found state */}
      <Show when={!account() && !isLoading() && !error()}>
        <div class="flex flex-col items-center justify-center min-h-screen gap-4 px-4">
          <h2 class="text-xl font-semibold">User Not Found</h2>
          <p class="text-muted-foreground text-center">
            The user @{handle()} doesn't exist or hasn't been registered.
          </p>
          <Button onClick={handleBack} variant="outline">
            Go Back
          </Button>
        </div>
      </Show>

      {/* Profile view */}
      <Show when={account() && !isLoading()}>
        <ProfilePageView
          username={account()?.username}
          avatarUrl={account()?.avatarUrl}
          bio={account()?.bio}
          walletAddress={account()?.address}
          isOwnProfile={isOwnProfile()}
          isVerified={false}
          following={0}
          followers={0}
          onBack={handleBack}
        />
      </Show>
    </div>
  )
}
