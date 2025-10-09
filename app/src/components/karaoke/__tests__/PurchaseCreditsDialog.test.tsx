import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/i18n/config'
import { PurchaseCreditsDialog } from '../PurchaseCreditsDialog'

/**
 * Example test showing multi-language coverage
 * Best practice: Test critical flows in all supported languages
 */
describe('PurchaseCreditsDialog', () => {
  const defaultProps = {
    open: true,
    price: '$10',
    creditAmount: 20,
    onPurchase: vi.fn(),
  }

  it('renders in English', async () => {
    await i18n.changeLanguage('en')

    render(
      <I18nextProvider i18n={i18n}>
        <PurchaseCreditsDialog {...defaultProps} />
      </I18nextProvider>
    )

    expect(screen.getByText('Purchase Credits')).toBeInTheDocument()
    expect(screen.getByText(/Get 20 credits for \$10/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Purchase' })).toBeInTheDocument()
  })

  it('renders in Mandarin', async () => {
    await i18n.changeLanguage('zh-CN')

    render(
      <I18nextProvider i18n={i18n}>
        <PurchaseCreditsDialog {...defaultProps} />
      </I18nextProvider>
    )

    expect(screen.getByText('购买积分')).toBeInTheDocument()
    expect(screen.getByText(/花费 \$10 获得 20 积分/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '购买' })).toBeInTheDocument()
  })

  it('renders in Vietnamese', async () => {
    await i18n.changeLanguage('vi')

    render(
      <I18nextProvider i18n={i18n}>
        <PurchaseCreditsDialog {...defaultProps} />
      </I18nextProvider>
    )

    expect(screen.getByText('Mua Tín Dụng')).toBeInTheDocument()
    expect(screen.getByText(/Nhận 20 tín dụng với \$10/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mua' })).toBeInTheDocument()
  })

  // Test accessibility across languages
  it('maintains accessibility in all languages', async () => {
    const languages = ['en', 'zh-CN', 'vi']

    for (const lang of languages) {
      await i18n.changeLanguage(lang)

      const { container } = render(
        <I18nextProvider i18n={i18n}>
          <PurchaseCreditsDialog {...defaultProps} />
        </I18nextProvider>
      )

      // Should have proper heading structure
      const heading = container.querySelector('h2')
      expect(heading).toBeInTheDocument()

      // Should have actionable button
      const purchaseButton = screen.getByRole('button', {
        name: lang === 'en' ? 'Purchase' : lang === 'zh-CN' ? '购买' : 'Mua'
      })
      expect(purchaseButton).toBeInTheDocument()
    }
  })
})
