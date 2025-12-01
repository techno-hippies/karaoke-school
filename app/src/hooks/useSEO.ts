import { useEffect } from 'react'

interface SEOOptions {
  title: string
  description?: string
  image?: string
  url?: string
  type?: 'website' | 'music.song' | 'video.other'
}

/**
 * Updates document title and meta tags for SEO.
 *
 * Note: This is client-side only. Social media crawlers (WeChat, Facebook, Twitter)
 * don't execute JavaScript, so they see the default tags in index.html.
 * For dynamic OG tags, use a Cloudflare Worker or similar edge function.
 *
 * This hook helps with:
 * - Google indexing (executes JS)
 * - Browser tab titles
 * - In-app sharing context
 */
export function useSEO({ title, description, image, url, type = 'website' }: SEOOptions) {
  useEffect(() => {
    // Update document title
    const prevTitle = document.title
    document.title = title

    // Helper to update meta tag
    const updateMeta = (property: string, content: string) => {
      let meta = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement
      if (!meta) {
        meta = document.createElement('meta')
        meta.setAttribute('property', property)
        document.head.appendChild(meta)
      }
      meta.content = content
    }

    // Helper to update name-based meta tag
    const updateNameMeta = (name: string, content: string) => {
      let meta = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement
      if (!meta) {
        meta = document.createElement('meta')
        meta.setAttribute('name', name)
        document.head.appendChild(meta)
      }
      meta.content = content
    }

    // Update OG tags
    updateMeta('og:title', title)
    updateMeta('og:type', type)
    if (description) {
      updateMeta('og:description', description)
      updateNameMeta('description', description)
    }
    if (image) {
      updateMeta('og:image', image)
    }
    if (url) {
      updateMeta('og:url', url)
    }

    // Update Twitter tags
    updateMeta('twitter:title', title)
    if (description) {
      updateMeta('twitter:description', description)
    }
    if (image) {
      updateMeta('twitter:image', image)
    }

    // Cleanup on unmount - restore previous title
    return () => {
      document.title = prevTitle
    }
  }, [title, description, image, url, type])
}

/**
 * Generate bilingual title for song pages
 * Format: "Song - Artist | 歌曲 - 艺术家"
 */
export function generateSongTitle(songTitle: string, artist: string): string {
  return `${songTitle} - ${artist} | 卡拉OK学校`
}

/**
 * Generate bilingual description for song pages
 */
export function generateSongDescription(songTitle: string, artist: string): string {
  return `练习唱 "${songTitle}" (${artist}) 学习英语 | Practice singing "${songTitle}" by ${artist} to learn English`
}
