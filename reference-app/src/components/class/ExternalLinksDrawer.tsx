import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'

interface ExternalLink {
  label: string
  url: string
}

interface ExternalLinksDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  songLinks?: ExternalLink[]
  lyricsLinks?: ExternalLink[]
}

export function ExternalLinksDrawer({
  open,
  onOpenChange,
  songLinks = [],
  lyricsLinks = []
}: ExternalLinksDrawerProps) {
  const handleLinkClick = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="bg-background max-h-[80vh]">
        {/* Drag Handle */}
        <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-muted-foreground/20 mt-4 mb-2" />

        <DrawerHeader className="flex-shrink-0">
          <DrawerTitle className="text-center text-lg md:text-xl">External Links</DrawerTitle>
        </DrawerHeader>

        <ScrollArea className="flex-1 px-4 pb-4">
          <div className="space-y-6">
            {/* Song Links */}
            {songLinks.length > 0 && (
              <div>
                <h3 className="text-foreground text-base md:text-lg font-semibold mb-3">Song</h3>
                <div className="space-y-2">
                  {songLinks.map((link, index) => (
                    <Button
                      key={index}
                      onClick={() => handleLinkClick(link.url)}
                      variant="outline"
                      size="lg"
                      className="w-full justify-start text-base md:text-lg px-4"
                    >
                      {link.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Lyrics Links */}
            {lyricsLinks.length > 0 && (
              <div>
                <h3 className="text-foreground text-base md:text-lg font-semibold mb-3">Lyrics</h3>
                <div className="space-y-2">
                  {lyricsLinks.map((link, index) => (
                    <Button
                      key={index}
                      onClick={() => handleLinkClick(link.url)}
                      variant="outline"
                      size="lg"
                      className="w-full justify-start text-base md:text-lg px-4"
                    >
                      {link.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </DrawerContent>
    </Drawer>
  )
}
