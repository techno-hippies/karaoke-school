import { useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { VisuallyHidden } from '@/components/ui/visually-hidden'
import {
  WhatsappLogo,
  XLogo,
  TelegramLogo,
  Link,
  DownloadSimple,
  ShareNetwork,
  CircleNotch,
} from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'

interface ShareSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  postUrl: string
  postDescription?: string
  onCopyLink?: () => void
  onDownload?: () => Promise<void>
}

/**
 * ShareSheet - Bottom sheet with share options
 * - Primary: Native share (navigator.share) on mobile
 * - Secondary: X, Telegram, WhatsApp share URLs
 * - Utility: Copy link, Save video
 */
export function ShareSheet({
  open,
  onOpenChange,
  postUrl,
  postDescription = 'Check out this video!',
  onCopyLink,
  onDownload,
}: ShareSheetProps) {
  const { t } = useTranslation()
  const [isDownloading, setIsDownloading] = useState(false)

  // --- Derived share data ----------------------------------------------------

  const shareUrl = postUrl
  const shareText = postDescription

  const encodedUrl = encodeURIComponent(shareUrl)
  const encodedText = encodeURIComponent(shareText)
  const encodedTextWithUrl = encodeURIComponent(`${shareText} ${shareUrl}`)

  const xShareUrl = `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`
  const telegramShareUrl = `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`
  const whatsappShareUrl = `https://wa.me/?text=${encodedTextWithUrl}`

  // --- Environment / capability checks (SSR-safe) ---------------------------

  const canUseNativeShare =
    typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  const userAgent =
    typeof navigator !== 'undefined' ? navigator.userAgent : ''

  const isMobile =
    !!userAgent &&
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      userAgent,
    )

  // --- Helpers ---------------------------------------------------------------

  const openShareWindow = (url: string) => {
    if (typeof window === 'undefined') return

    window.open(url, '_blank', 'noopener,noreferrer')
    onOpenChange(false)
  }

  const handleNativeShare = async () => {
    // If native share is available, use it as the hero experience
    if (canUseNativeShare) {
      try {
        await navigator.share({
          title: 'Karaoke',
          text: shareText,
          url: shareUrl,
        })
        onOpenChange(false)
      } catch (error) {
        // User cancelled – this is not an actual error for UX
        console.debug('User dismissed native share', error)
      }
      return
    }

    // Fallback: copy link + toast
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl)
        onCopyLink?.()
      }
    } catch (error) {
      console.error('Failed to copy link from native share fallback', error)
    }

    onOpenChange(false)
  }

  const handleCopyLink = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl)
      }
      onCopyLink?.()
    } catch (error) {
      console.error('Failed to copy link', error)
    } finally {
      onOpenChange(false)
    }
  }

  const handleSaveVideo = async () => {
    if (!onDownload) return

    setIsDownloading(true)
    try {
      await onDownload()
      onOpenChange(false)
    } catch (error) {
      console.error('Download failed:', error)
    } finally {
      setIsDownloading(false)
    }
  }

  // --- Share options config --------------------------------------------------

  const shareOptions = [
    // Native share: star of the show on mobile
    {
      id: 'native',
      name: t('share.share'),
      icon: ShareNetwork,
      color: 'bg-primary hover:bg-primary/90',
      hidden: !(isMobile && canUseNativeShare),
      action: () => {
        void handleNativeShare()
      },
    },
    {
      id: 'x',
      name: t('share.x'),
      icon: XLogo,
      color: 'bg-neutral-900 hover:bg-neutral-800',
      hidden: false,
      action: () => openShareWindow(xShareUrl),
    },
    {
      id: 'telegram',
      name: t('share.telegram'),
      icon: TelegramLogo,
      color: 'bg-sky-500 hover:bg-sky-600',
      hidden: false,
      action: () => openShareWindow(telegramShareUrl),
    },
    {
      id: 'whatsapp',
      name: t('share.whatsapp'),
      icon: WhatsappLogo,
      color: 'bg-green-600 hover:bg-green-700',
      hidden: false,
      action: () => openShareWindow(whatsappShareUrl),
    },
  ]

  const visibleOptions = shareOptions.filter((option) => !option.hidden)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-auto bg-card border-border pb-8 px-4"
      >
        <VisuallyHidden>
          <SheetTitle>{t('share.title')}</SheetTitle>
          <SheetDescription>
            {t('share.description')}
          </SheetDescription>
        </VisuallyHidden>

        {/* Social Share Options - evenly distributed across width */}
        <div className="w-full flex justify-evenly mb-6 pt-6">
          {visibleOptions.slice(0, 4).map((option) => {
            const Icon = option.icon
            return (
              <button
                key={option.id}
                type="button"
                onClick={option.action}
                className="flex flex-col items-center gap-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-xl"
              >
                <div
                  className={`w-14 h-14 rounded-full ${option.color} flex items-center justify-center transition-transform duration-150 hover:scale-105 active:scale-95`}
                >
                  <Icon size={28} weight="fill" className="text-foreground" />
                </div>
                <span className="text-foreground text-sm">{option.name}</span>
              </button>
            )
          })}
        </div>

        {/* Other Options */}
        <div className="space-y-2">
          <Button
            variant="outline"
            className="w-full justify-start gap-3 h-14 text-base"
            onClick={() => {
              void handleCopyLink()
            }}
          >
            <Link size={22} weight="regular" />
            {t('share.copyLink')}
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start gap-3 h-14 text-base"
            onClick={() => void handleSaveVideo()}
            disabled={isDownloading}
          >
            {isDownloading ? (
              <CircleNotch size={22} weight="bold" className="animate-spin" />
            ) : (
              <DownloadSimple size={22} weight="regular" />
            )}
            {t('share.saveVideo')}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
