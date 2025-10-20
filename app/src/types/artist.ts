/**
 * Artist types from ArtistRegistryV2 contract
 */

export enum ProfileSource {
  MANUAL = 0,     // Created via pkp-lens-flow pipeline
  GENERATED = 1   // Created on-demand via Lit Action
}

export interface Artist {
  geniusArtistId: number
  pkpAddress: string
  lensHandle: string
  lensAccountAddress: string
  source: ProfileSource
  verified: boolean
  hasContent: boolean
  createdAt: bigint
  updatedAt: bigint
}

export interface ArtistMetadata {
  // Rich metadata stored in Lens Account Metadata
  bio?: string
  avatarUrl?: string
  coverImageUrl?: string
  isni?: string
  ipi?: string
  spotifyId?: string
  socials?: {
    twitter?: string
    instagram?: string
    tiktok?: string
  }
}
