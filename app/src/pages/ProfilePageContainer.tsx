import { useTranslation } from 'react-i18next'
import { ProfileWalletPage, type Achievement } from '@/components/profile/ProfileWalletPage'
import { ProfilePageSkeleton } from '@/components/profile/ProfilePageSkeleton'
import { useAuth } from '@/contexts/AuthContext'
import { usePKPBalances } from '@/hooks/usePKPBalances'
import { Button } from '@/components/ui/button'

/**
 * ProfilePageContainer - Container for the user's own profile
 * Wallet-focused view with tokens and achievements
 */
export function ProfilePageContainer({ onConnectWallet }: { onConnectWallet?: () => void }) {
  const { t } = useTranslation()

  // Auth data from context
  const { lensAccount, pkpAddress, isPKPReady } = useAuth()

  // Fetch token balances
  const { balances, isLoading: balancesLoading } = usePKPBalances()

  // Show sign up CTA for unauthenticated users
  if (!isPKPReady) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 px-4">
        <h2 className="text-2xl font-bold text-center">{t('study.signUp')}</h2>
        <p className="text-muted-foreground text-center">{t('study.signUpDescription')}</p>
        <Button onClick={onConnectWallet}>
          {t('study.signUp')}
        </Button>
      </div>
    )
  }

  // Show loading state while account is loading
  const isLoading = !lensAccount || !pkpAddress

  if (isLoading) {
    return <ProfilePageSkeleton />
  }

  // Extract profile data
  const username = lensAccount.metadata?.name || lensAccount.username?.localName || undefined
  const avatarUrl = lensAccount.metadata?.picture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${username || pkpAddress}`

  // TODO: Achievements from app-specific contract/database
  const mockAchievements: Achievement[] = [
    {
      id: '1',
      title: 'First Steps',
      description: 'Complete your first practice session',
      isLocked: false,
      unlockedAt: new Date(Date.now() - 86400000 * 3),
    },
    {
      id: '2',
      title: '7 Day Streak',
      description: 'Practice 7 days in a row',
      isLocked: false,
      unlockedAt: new Date(Date.now() - 86400000 * 1),
    },
    {
      id: '3',
      title: 'Perfect Score',
      description: 'Get 100% on any song',
      isLocked: true,
    },
  ]

  const handleCopyAddress = async () => {
    if (!pkpAddress) return
    try {
      await navigator.clipboard.writeText(pkpAddress)
      console.log('Address copied to clipboard')
    } catch (err) {
      console.error('Failed to copy address:', err)
    }
  }

  return (
    <ProfileWalletPage
      username={username}
      avatarUrl={avatarUrl}
      walletAddress={pkpAddress}
      tokens={balances}
      achievements={mockAchievements}
      onCopyAddress={handleCopyAddress}
    />
  )
}
