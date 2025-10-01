import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

/**
 * Custom hook to track navigation history for proper back button behavior
 * Prevents closing the app on first page back navigation
 */
export const useNavigationHistory = () => {
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    // Track navigation count in sessionStorage
    const navCount = sessionStorage.getItem('navigationCount')
    const count = navCount ? parseInt(navCount) + 1 : 1
    sessionStorage.setItem('navigationCount', count.toString())
  }, [location])

  const canGoBack = () => {
    const navCount = sessionStorage.getItem('navigationCount')
    return navCount ? parseInt(navCount) > 1 : false
  }

  const goBackOrHome = () => {
    if (canGoBack()) {
      navigate(-1)
    } else {
      navigate('/')
    }
  }

  return {
    canGoBack: canGoBack(),
    goBackOrHome,
    navigationCount: parseInt(sessionStorage.getItem('navigationCount') || '1')
  }
}