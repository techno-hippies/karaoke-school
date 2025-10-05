import { Camera } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

export interface ProfilePhotoUploadProps {
  currentPhoto?: string
  onPhotoChange?: (file: File) => void
  className?: string
}

/**
 * ProfilePhotoUpload - Profile photo with upload button
 * Shows current photo with "Change Photo" button overlay on mobile
 */
export function ProfilePhotoUpload({
  currentPhoto,
  onPhotoChange,
  className
}: ProfilePhotoUploadProps) {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && onPhotoChange) {
      onPhotoChange(file)
    }
  }

  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      {/* Profile Photo */}
      <div className="relative w-24 h-24 rounded-lg overflow-hidden bg-neutral-800">
        {currentPhoto ? (
          <img
            src={currentPhoto}
            alt="Profile"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-purple-500 via-pink-500 to-red-500 flex items-center justify-center">
            <Camera className="w-12 h-12 text-foreground" />
          </div>
        )}
      </div>

      {/* Upload Button */}
      <label
        htmlFor="photo-upload"
        className="text-blue-500 text-base font-medium cursor-pointer hover:text-blue-400 transition-colors"
      >
        Change Photo
        <input
          id="photo-upload"
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </label>
    </div>
  )
}
