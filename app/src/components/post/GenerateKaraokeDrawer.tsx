import {
  Drawer,
  DrawerContent,
} from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'

interface GenerateKaraokeDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onGenerate: () => void
}

/**
 * GenerateKaraokeDrawer - Prompt user to generate karaoke segments
 * Shown when a song hasn't been processed yet (cold start)
 */
export function GenerateKaraokeDrawer({
  open,
  onOpenChange,
  onGenerate,
}: GenerateKaraokeDrawerProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="p-4 flex flex-col">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-full">
            <h2 className="text-2xl font-bold text-foreground">Generate Karaoke</h2>
            <p className="text-base text-muted-foreground mt-3">
              Nobody has played this song before, so the segments need to be generated! Processing takes 15-30 seconds.
            </p>
          </div>

          <Button
            size="lg"
            onClick={onGenerate}
            className="w-full"
          >
            Generate
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
