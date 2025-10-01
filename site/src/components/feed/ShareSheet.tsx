import React from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { 
  WechatLogo,
  WhatsappLogo, 
  XLogo, 
  InstagramLogo, 
  TelegramLogo,
  Link,
  DownloadSimple
} from '@phosphor-icons/react';

interface ShareSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postUrl: string;
  postDescription?: string;
}

export const ShareSheet: React.FC<ShareSheetProps> = ({
  open,
  onOpenChange,
  postUrl,
  postDescription = 'Check out this video!',
}) => {
  const shareOptions = [
    {
      id: 'wechat',
      name: 'WeChat',
      icon: WechatLogo,
      color: 'bg-green-500',
      action: () => {
        console.log('Share to WeChat');
      }
    },
    {
      id: 'x',
      name: 'X',
      icon: XLogo,
      color: 'bg-neutral-800',
      action: () => {
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(postDescription)}&url=${encodeURIComponent(postUrl)}`);
      }
    },
    {
      id: 'telegram',
      name: 'Telegram',
      icon: TelegramLogo,
      color: 'bg-blue-400',
      action: () => {
        window.open(`https://t.me/share/url?url=${encodeURIComponent(postUrl)}&text=${encodeURIComponent(postDescription)}`);
      }
    },
    {
      id: 'instagram',
      name: 'Instagram',
      icon: InstagramLogo,
      color: 'bg-gradient-to-br from-purple-600 to-pink-500',
      action: () => {
        console.log('Share to Instagram');
      }
    },
    {
      id: 'whatsapp',
      name: 'WhatsApp',
      icon: WhatsappLogo,
      color: 'bg-green-600',
      action: () => {
        window.open(`https://wa.me/?text=${encodeURIComponent(postDescription + ' ' + postUrl)}`);
      }
    },
  ];

  const handleCopyLink = () => {
    navigator.clipboard.writeText(postUrl);
    console.log('Link copied!');
    onOpenChange(false);
  };

  const handleSaveVideo = () => {
    console.log('Save video');
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-auto bg-black border-neutral-800 pb-8">
        <SheetHeader className="pb-4">
          <SheetTitle className="text-white text-center">
            Share to
          </SheetTitle>
        </SheetHeader>
        
        {/* Social Share Options */}
        <div className="grid grid-cols-5 gap-3 px-2 mb-6">
          {shareOptions.map((option) => {
            const Icon = option.icon;
            return (
              <button
                key={option.id}
                onClick={() => {
                  option.action();
                  onOpenChange(false);
                }}
                className="flex flex-col items-center gap-2"
              >
                <div className={`w-12 h-12 rounded-full ${option.color} flex items-center justify-center`}>
                  <Icon size={24} weight="fill" className="text-white" />
                </div>
                <span className="text-white text-xs">{option.name}</span>
              </button>
            );
          })}
        </div>
        
        {/* Other Options */}
        <div className="space-y-2 px-2">
          <Button
            variant="outline"
            className="w-full justify-start gap-3 h-12 bg-transparent border-neutral-700 hover:bg-neutral-800 hover:border-neutral-600 text-white"
            onClick={handleCopyLink}
          >
            <Link size={20} weight="regular" />
            Copy link
          </Button>
          
          <Button
            variant="outline"
            className="w-full justify-start gap-3 h-12 bg-transparent border-neutral-700 hover:bg-neutral-800 hover:border-neutral-600 text-white"
            onClick={handleSaveVideo}
          >
            <DownloadSimple size={20} weight="regular" />
            Save video
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};