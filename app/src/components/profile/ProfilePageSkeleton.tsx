import { BackButton } from '@/components/ui/back-button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

/**
 * ProfilePageSkeleton - Loading skeleton for ProfilePage
 * Matches the exact layout of ProfilePage with shimmer placeholders
 */
export function ProfilePageSkeleton() {
  return (
    <div className="relative w-full h-screen bg-background flex justify-center">
      <div className="relative w-full h-screen md:max-w-6xl flex flex-col">
        {/* Header - matches ProfilePage */}
        <div className="flex-shrink-0">
          <div className="flex items-center h-12 px-4 pt-2">
            <BackButton />
          </div>
        </div>

        {/* Main content - matches ProfilePage overflow and scrollbar classes */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide">
          {/* Profile Section - matches ProfilePage pt-4 pb-2 px-4 md:px-6 */}
          <div className="pt-4 pb-2 px-4 md:px-6">
            <div className="flex flex-col md:flex-row gap-4 md:gap-8 items-center md:items-start">
              {/* Avatar Skeleton - matches size="xl" = w-32 h-32 md:w-40 md:h-40 */}
              <div className="w-32 h-32 md:w-40 md:h-40 rounded-full bg-muted animate-pulse flex-shrink-0" />

              {/* Info Section - matches ProfilePage flex-1 w-full */}
              <div className="flex-1 w-full">
                {/* ProfileInfo Skeleton - centered on mobile, left on desktop */}
                <div className="text-center md:text-left">
                  {/* Display name */}
                  <div className="flex items-center gap-2 mb-1 justify-center md:justify-start">
                    <div className="h-6 md:h-8 w-40 md:w-48 bg-muted rounded animate-pulse" />
                  </div>
                  {/* Username handle */}
                  <div className="h-5 md:h-6 w-32 md:w-36 bg-muted rounded animate-pulse mb-2 md:mb-4 mx-auto md:mx-0" />
                </div>

                {/* ProfileStats Skeleton - matches mt-2 gap-6 mb-4 and horizontal layout */}
                <div className="mt-2 flex gap-6 mb-4 justify-center md:justify-start">
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-8 bg-muted rounded animate-pulse" />
                    <div className="h-5 w-16 bg-muted rounded animate-pulse" />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-8 bg-muted rounded animate-pulse" />
                    <div className="h-5 w-16 bg-muted rounded animate-pulse" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs Section - matches px-4 md:px-6 mt-2 space-y-4 pb-8 */}
          <div className="px-4 md:px-6 mt-2 space-y-4 pb-8">
            {/* Tabs with content - matches ProfilePage structure */}
            <Tabs defaultValue="dances" className="w-full">
              <TabsList className="w-full grid grid-cols-2 bg-muted/50">
                <TabsTrigger value="dances">Dances</TabsTrigger>
                <TabsTrigger value="achievements">Achievements</TabsTrigger>
              </TabsList>

              {/* TabsContent - matches mt-4 */}
              <div className="mt-4">
                {/* Video Grid Skeleton - matches VideoGrid grid (no extra padding) */}
                <div className="grid grid-cols-3 gap-1 md:gap-2">
                  {[...Array(9)].map((_, i) => (
                    <div
                      key={i}
                      className="aspect-[9/16] bg-muted animate-pulse"
                    />
                  ))}
                </div>
              </div>
            </Tabs>
          </div>
        </div>

        {/* Sticky Footer - matches Edit Profile button */}
        <div className="flex-shrink-0 bg-gradient-to-t from-background via-background to-transparent pt-8 pb-4 px-4">
          <div className="h-12 w-full bg-muted rounded-lg animate-pulse" />
        </div>
      </div>
    </div>
  )
}
