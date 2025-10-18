import { ProfilePhotoUpload } from './ProfilePhotoUpload'
import { FormField } from './FormField'
import { InputGroup, InputGroupInput } from '@/components/ui/input-group'
import { Button } from '@/components/ui/button'
import { BackButton } from '@/components/ui/back-button'
import { cn } from '@/lib/utils'

export interface SocialLinks {
  twitter?: string
  instagram?: string
  website?: string
}

export interface EditProfileViewProps {
  // Profile data
  profilePhoto?: string
  displayName: string
  username: string
  socialLinks: SocialLinks

  // Handlers
  onPhotoChange?: (file: File) => void
  onDisplayNameChange?: (value: string) => void
  onSocialLinkChange?: (platform: 'twitter' | 'instagram' | 'website', url: string) => void
  onSave?: () => void
  onCancel?: () => void

  className?: string
}

/**
 * EditProfileView - TikTok-style edit profile page
 * Mobile-first vertical layout with photo, fields, and social links
 */
export function EditProfileView({
  profilePhoto,
  displayName,
  username,
  socialLinks,
  onPhotoChange,
  onDisplayNameChange,
  onSocialLinkChange,
  onSave,
  onCancel,
  className
}: EditProfileViewProps) {

  return (
    <div className={cn('min-h-screen bg-background', className)}>
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-2 bg-background border-b border-border">
        <BackButton onClick={onCancel} />
        <h1 className="text-foreground text-base font-semibold">Edit Profile</h1>
        <div className="w-12" />
      </div>

      {/* Content */}
      <div className="px-4 py-6 space-y-6 max-w-2xl mx-auto">
        {/* Profile Photo */}
        <ProfilePhotoUpload
          currentPhoto={profilePhoto}
          onPhotoChange={onPhotoChange}
        />

        {/* Display Name */}
        <FormField
          label="Name"
          value={displayName}
          onChange={onDisplayNameChange}
          placeholder="Enter your name"
        />

        {/* Username - Read Only */}
        <FormField
          label="Username"
          value={`@${username}`}
          readOnly
        />

        {/* Social Links - Always Visible Fields */}
        <div className="space-y-4">
          <h3 className="text-foreground text-base font-medium">
            Social Links
          </h3>

          {/* Twitter */}
          <div className="space-y-2">
            <label className="block text-muted-foreground text-base">Twitter</label>
            <InputGroup>
              <InputGroupInput
                type="url"
                value={socialLinks.twitter || ''}
                onChange={(e) => onSocialLinkChange?.('twitter', e.target.value)}
                placeholder="https://twitter.com/username"
              />
            </InputGroup>
          </div>

          {/* Instagram */}
          <div className="space-y-2">
            <label className="block text-muted-foreground text-base">Instagram</label>
            <InputGroup>
              <InputGroupInput
                type="url"
                value={socialLinks.instagram || ''}
                onChange={(e) => onSocialLinkChange?.('instagram', e.target.value)}
                placeholder="https://instagram.com/username"
              />
            </InputGroup>
          </div>

          {/* Website */}
          <div className="space-y-2">
            <label className="block text-muted-foreground text-base">Website</label>
            <InputGroup>
              <InputGroupInput
                type="url"
                value={socialLinks.website || ''}
                onChange={(e) => onSocialLinkChange?.('website', e.target.value)}
                placeholder="https://yourwebsite.com"
              />
            </InputGroup>
          </div>
        </div>

        {/* Save Button */}
        <Button onClick={onSave} className="w-full" size="lg">
          Save
        </Button>
      </div>
    </div>
  )
}
