import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Item, ItemMedia, ItemContent } from '@/components/ui/item'

function TokenSkeleton() {
  return (
    <Item variant="muted">
      <ItemMedia>
        <Skeleton className="w-12 h-12 md:w-14 md:h-14 rounded-full" />
      </ItemMedia>
      <ItemContent>
        <Skeleton className="h-5 w-14 mb-1" />
        <Skeleton className="h-4 w-20" />
      </ItemContent>
      <ItemContent className="items-end">
        <Skeleton className="h-5 w-20 mb-1" />
        <Skeleton className="h-4 w-14" />
      </ItemContent>
    </Item>
  )
}

/**
 * ProfilePageSkeleton - Loading skeleton for ProfileWalletPage
 * Matches the centered layout with avatar, username, address, and token tabs
 */
export function ProfilePageSkeleton() {
  return (
    <div className="relative w-full min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Profile Header - centered */}
        <div className="flex flex-col items-center gap-4 mb-8">
          {/* Avatar - matches ProfileAvatar size="xl" */}
          <Skeleton className="w-32 h-32 md:w-40 md:h-40 rounded-full" />

          {/* Username */}
          <Skeleton className="h-7 w-32" />

          {/* Wallet Address Button */}
          <Skeleton className="h-10 w-40 rounded-full" />
        </div>

        {/* Tabs: Tokens | Achievements */}
        <Tabs defaultValue="tokens" className="w-full">
          <TabsList className="w-full grid grid-cols-2 bg-muted/50">
            <TabsTrigger value="tokens">Tokens</TabsTrigger>
            <TabsTrigger value="achievements">Achievements</TabsTrigger>
          </TabsList>

          {/* Token list skeletons - matches 2 primary tokens (Base ETH, Base USDC) */}
          <div className="mt-4 space-y-2">
            <TokenSkeleton />
            <TokenSkeleton />
          </div>
        </Tabs>
      </div>
    </div>
  )
}
