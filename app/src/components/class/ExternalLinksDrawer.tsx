import {
  Drawer,
  DrawerContent,
} from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'

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
      <DrawerContent className="bg-background p-4 space-y-6">
          {/* Song Links */}
          {songLinks.length > 0 && (
            <div>
              <h3 className="text-foreground text-base font-semibold mb-3">Song</h3>
              <div className="space-y-2">
                {songLinks.map((link, index) => (
                  <Button
                    key={index}
                    onClick={() => handleLinkClick(link.url)}
                    variant="outline"
                    size="lg"
                    className="w-full justify-start text-base px-4"
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
              <h3 className="text-foreground text-base font-semibold mb-3">Lyrics</h3>
              <div className="space-y-2">
                {lyricsLinks.map((link, index) => (
                  <Button
                    key={index}
                    onClick={() => handleLinkClick(link.url)}
                    variant="outline"
                    size="lg"
                    className="w-full justify-start text-base px-4"
                  >
                    {link.label}
                  </Button>
                ))}
              </div>
            </div>
          )}
      </DrawerContent>
    </Drawer>
  )
}
