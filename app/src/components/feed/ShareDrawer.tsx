import {
  Drawer,
  DrawerContent,
} from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import {
  WechatLogo,
  WhatsappLogo,
  XLogo,
  InstagramLogo,
  TelegramLogo,
  Link,
  DownloadSimple
} from '@phosphor-icons/react'

interface ShareDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  postUrl: string
  postDescription?: string
  onCopyLink?: () => void
  onDownload?: () => void
}

/**
 * ShareDrawer - Bottom drawer with share options
 * Supports social platforms, copy link, and download
 */
export function ShareDrawer({
  open,
  onOpenChange,
  postUrl,
  postDescription = 'Check out this video!',
  onCopyLink,
  onDownload
}: ShareDrawerProps) {
  const shareOptions = [
    {
      id: 'wechat',
      name: 'WeChat',
      icon: WechatLogo,
      color: 'bg-green-500 hover:bg-green-600',
      action: () => {
        console.log('Share to WeChat')
        onOpenChange(false)
      }
    },
    {
      id: 'x',
      name: 'X',
      icon: XLogo,
      color: 'bg-neutral-800 hover:bg-neutral-900',
      action: () => {
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(postDescription)}&url=${encodeURIComponent(postUrl)}`)
        onOpenChange(false)
      }
    },
    {
      id: 'telegram',
      name: 'Telegram',
      icon: TelegramLogo,
      color: 'bg-blue-400 hover:bg-blue-500',
      action: () => {
        window.open(`https://t.me/share/url?url=${encodeURIComponent(postUrl)}&text=${encodeURIComponent(postDescription)}`)
        onOpenChange(false)
      }
    },
    {
      id: 'instagram',
      name: 'Instagram',
      icon: InstagramLogo,
      color: 'bg-gradient-to-br from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600',
      action: () => {
        console.log('Share to Instagram')
        onOpenChange(false)
      }
    },
    {
      id: 'whatsapp',
      name: 'WhatsApp',
      icon: WhatsappLogo,
      color: 'bg-green-600 hover:bg-green-700',
      action: () => {
        window.open(`https://wa.me/?text=${encodeURIComponent(postDescription + ' ' + postUrl)}`)
        onOpenChange(false)
      }
    },
  ]

  const handleCopyLink = () => {
    navigator.clipboard.writeText(postUrl)
    onCopyLink?.()
    onOpenChange(false)
  }

  const handleSaveVideo = () => {
    onDownload?.()
    onOpenChange(false)
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="bg-card pb-8 px-4">
        {/* Social Share Options - 4 column grid */}
        <div className="w-full grid grid-cols-4 gap-4 mb-6 pt-6">
          {shareOptions.slice(0, 4).map((option) => {
            const Icon = option.icon
            return (
              <div key={option.id} className="flex justify-center">
                <button
                  onClick={option.action}
                  className="flex flex-col items-center gap-2 cursor-pointer"
                >
                  <div className={`w-14 h-14 rounded-full ${option.color} flex items-center justify-center transition-all`}>
                    <Icon size={28} weight="fill" className="text-foreground" />
                  </div>
                  <span className="text-foreground text-sm">{option.name}</span>
                </button>
              </div>
            )
          })}
        </div>

        {/* Other Options */}
        <div className="space-y-2">
          <Button
            variant="outline"
            className="w-full justify-start gap-3 h-14 text-base"
            onClick={handleCopyLink}
          >
            <Link size={22} weight="regular" />
            Copy link
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start gap-3 h-14 text-base"
            onClick={handleSaveVideo}
          >
            <DownloadSimple size={22} weight="regular" />
            Save video
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
