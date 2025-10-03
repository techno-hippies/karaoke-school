import React from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '../ui/sheet';
import { Button } from '../ui/button';

interface ExternalLink {
  label: string;
  url: string;
}

interface ExternalLinksSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  songLinks?: ExternalLink[];
  lyricsLinks?: ExternalLink[];
}

export const ExternalLinksSheet: React.FC<ExternalLinksSheetProps> = ({
  open,
  onOpenChange,
  songLinks = [],
  lyricsLinks = []
}) => {
  const handleLinkClick = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="bg-neutral-900 border-neutral-800 p-0 flex flex-col"
      >
        <SheetHeader className="flex-none border-b border-neutral-800 p-4">
          <SheetTitle className="text-white text-center">External Links</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Song Links */}
          {songLinks.length > 0 && (
            <div>
              <h3 className="text-white text-base font-semibold mb-3">Song</h3>
              <div className="space-y-2">
                {songLinks.map((link, index) => (
                  <Button
                    key={index}
                    onClick={() => handleLinkClick(link.url)}
                    variant="outline"
                    className="w-full justify-start text-base"
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
              <h3 className="text-white text-base font-semibold mb-3">Lyrics</h3>
              <div className="space-y-2">
                {lyricsLinks.map((link, index) => (
                  <Button
                    key={index}
                    onClick={() => handleLinkClick(link.url)}
                    variant="outline"
                    className="w-full justify-start text-base"
                  >
                    {link.label}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
