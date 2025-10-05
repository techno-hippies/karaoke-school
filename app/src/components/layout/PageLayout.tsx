import React from 'react'
import { BackButton } from '@/components/ui/back-button'

interface PageLayoutProps {
  children: React.ReactNode

  // Header props
  title?: string
  subtitle?: string
  showBackButton?: boolean
  onBack?: () => void
  headerAction?: React.ReactNode

  // Footer props
  footer?: React.ReactNode

  // Layout options
  className?: string
  contentClassName?: string
  headerClassName?: string
  footerClassName?: string
  fullHeight?: boolean
}

/**
 * Reusable page layout with header, content area, and optional footer
 * Provides consistent structure for full-page views
 */
export const PageLayout: React.FC<PageLayoutProps> = ({
  children,
  title,
  subtitle,
  showBackButton = false,
  onBack,
  headerAction,
  footer,
  className = '',
  contentClassName = '',
  headerClassName = '',
  footerClassName = '',
  fullHeight = true,
}) => {
  return (
    <div className={`${fullHeight ? 'h-screen' : 'min-h-screen'} bg-background text-foreground flex flex-col ${className}`}>
      {/* Header */}
      {(title || showBackButton || headerAction) && (
        <header className={`flex items-center justify-between p-4 border-b border-border ${headerClassName}`}>
          <div className="flex items-center gap-4">
            {showBackButton && <BackButton onClick={onBack} />}
            {title && (
              <div>
                <h1 className="text-xl font-semibold">{title}</h1>
                {subtitle && (
                  <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
                )}
              </div>
            )}
          </div>
          {headerAction && (
            <div>{headerAction}</div>
          )}
        </header>
      )}

      {/* Main Content */}
      <main className={`flex-1 overflow-y-auto ${contentClassName}`}>
        {children}
      </main>

      {/* Footer */}
      {footer && (
        <footer className={`border-t border-border ${footerClassName}`}>
          {footer}
        </footer>
      )}
    </div>
  )
}

/**
 * Pre-configured layout for modal-style pages
 */
export const ModalPageLayout: React.FC<Omit<PageLayoutProps, 'showBackButton'>> = (props) => {
  return <PageLayout {...props} showBackButton={true} />
}

/**
 * Pre-configured layout for settings pages
 */
export const SettingsPageLayout: React.FC<PageLayoutProps> = (props) => {
  return (
    <PageLayout
      {...props}
      contentClassName={`${props.contentClassName} px-4 py-6`}
    />
  )
}
