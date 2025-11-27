/**
 * GraphQL Queries for The Graph Subgraph
 */

import { gql } from 'graphql-request'

/**
 * Get user's performance history for a specific segment
 */
export const GET_USER_SEGMENT_PROGRESS = gql`
  query GetUserSegmentProgress($userAddress: Bytes!, $segmentHash: Bytes!) {
    linePerformances(
      where: { performerAddress: $userAddress, segmentHash: $segmentHash }
      orderBy: gradedAt
      orderDirection: desc
    ) {
      id
      performanceId
      lineId
      lineIndex
      score
      gradedAt
      metadataUri
    }
  }
`

/**
 * Get ALL performances for a user
 */
export const GET_USER_ALL_PERFORMANCES = gql`
  query GetUserAllPerformances($userAddress: Bytes!) {
    linePerformances(
      where: { performerAddress: $userAddress }
      orderBy: gradedAt
      orderDirection: desc
      first: 1000
    ) {
      id
      performanceId
      lineId
      lineIndex
      segmentHash
      score
      gradedAt
      metadataUri
    }
  }
`

/**
 * Get segment details with translations
 */
export const GET_SEGMENT_DETAILS = gql`
  query GetSegmentDetails($segmentHash: Bytes!) {
    segment(id: $segmentHash) {
      id
      segmentHash
      spotifyTrackId
      segmentStartMs
      segmentEndMs
      metadataUri
      instrumentalUri
      alignmentUri
      translationCount
      performanceCount
      averageScore
      registeredAt
      processedAt
      translations {
        id
        languageCode
        translationUri
        confidenceScore
        validated
      }
    }
  }
`

/**
 * Get LineCard aggregate stats
 */
export const GET_LINE_STATS = gql`
  query GetLineStats($lineId: Bytes!) {
    lineCard(id: $lineId) {
      id
      lineId
      segmentHash
      lineIndex
      performanceCount
      averageScore
      performances(first: 10, orderBy: gradedAt, orderDirection: desc) {
        performanceId
        performerAddress
        score
        gradedAt
      }
    }
  }
`

export interface LinePerformance {
  id: string
  performanceId: string
  lineId: string
  lineIndex: number
  score: number
  gradedAt: string
  metadataUri: string
  segmentHash?: string
}

export interface GetUserSegmentProgressResponse {
  linePerformances: LinePerformance[]
}

export interface GetUserAllPerformancesResponse {
  linePerformances: LinePerformance[]
}

export interface Translation {
  id: string
  languageCode: string
  translationUri: string
  confidenceScore: number
  validated: boolean
}

export interface Segment {
  id: string
  segmentHash: string
  spotifyTrackId: string
  segmentStartMs: number
  segmentEndMs: number
  metadataUri: string
  instrumentalUri: string | null
  alignmentUri: string | null
  translationCount: number
  performanceCount: number
  averageScore: string
  registeredAt: string
  processedAt: string | null
  translations: Translation[]
}

export interface GetSegmentDetailsResponse {
  segment: Segment | null
}

export interface LineCardPerformance {
  performanceId: string
  performerAddress: string
  score: number
  gradedAt: string
}

export interface LineCard {
  id: string
  lineId: string
  segmentHash: string
  lineIndex: number
  performanceCount: number
  averageScore: string
  performances: LineCardPerformance[]
}

export interface GetLineStatsResponse {
  lineCard: LineCard | null
}
