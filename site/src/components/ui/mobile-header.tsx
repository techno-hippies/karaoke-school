import React from 'react'
import { ArrowLeft, X } from '@phosphor-icons/react'
import { useNavigationHistory } from '../../hooks/navigation/useNavigationHistory'

interface MobileHeaderProps {
  title: string
  icon?: 'back' | 'close'
  onIconClick?: () => void
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({ 
  title, 
  icon = 'back',
  onIconClick 
}) => {
  const { goBackOrHome } = useNavigationHistory()
  
  const handleClick = () => {
    if (onIconClick) {
      onIconClick()
    } else if (icon === 'back') {
      goBackOrHome()
    }
  }
  
  return (
    <div className="md:hidden flex items-center p-4 border-b border-neutral-800">
      <button
        onClick={handleClick}
        className="p-2 hover:bg-neutral-800 rounded-full cursor-pointer"
      >
        {icon === 'back' ? (
          <ArrowLeft className="h-5 w-5 text-white" />
        ) : (
          <X className="h-5 w-5 text-white" />
        )}
      </button>
      <span className="ml-3 font-semibold text-white truncate">{title}</span>
    </div>
  )
}