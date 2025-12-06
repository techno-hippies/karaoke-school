/**
 * GraphQL queries for study cards and performances
 */

import { gql } from 'graphql-request'

export const GET_CLIPS_WITH_PERFORMANCES = gql`
  query GetClipsWithPerformances($spotifyTrackId: String!, $performer: Bytes!) {
    clips(where: { spotifyTrackId: $spotifyTrackId }, first: 1000) {
      id
      clipHash
      spotifyTrackId
      metadataUri
      instrumentalUri
      alignmentUri
      clipStartMs
      clipEndMs
      translations {
        languageCode
        translationUri
      }
      performances(where: { performerAddress: $performer }, orderBy: gradedAt, orderDirection: desc, first: 100) {
        id
        score
        gradedAt
      }
    }
    linePerformances(where: {
      performerAddress: $performer
    }, orderBy: gradedAt, orderDirection: desc, first: 1000) {
      id
      lineId
      lineIndex
      clipHash
      score
      gradedAt
    }
  }
`

export const GET_ALL_CLIPS_WITH_PERFORMANCES = gql`
  query GetAllClipsWithPerformances($performer: Bytes!) {
    clips(first: 1000) {
      id
      clipHash
      spotifyTrackId
      metadataUri
      instrumentalUri
      alignmentUri
      clipStartMs
      clipEndMs
      translations {
        languageCode
        translationUri
      }
      performances(where: { performerAddress: $performer }, orderBy: gradedAt, orderDirection: desc, first: 100) {
        id
        score
        gradedAt
      }
    }
    linePerformances(where: {
      performerAddress: $performer
    }, orderBy: gradedAt, orderDirection: desc, first: 1000) {
      id
      lineId
      lineIndex
      clipHash
      score
      gradedAt
    }
  }
`

export const GET_EXERCISE_CARDS = gql`
  query GetExerciseCards($spotifyTrackIds: [String!]!, $performer: Bytes!, $languageCode: String) {
    exerciseCards(where: {
      spotifyTrackId_in: $spotifyTrackIds
      enabled: true
      languageCode: $languageCode
    }) {
      id
      questionId
      exerciseType
      spotifyTrackId
      languageCode
      metadataUri
      distractorPoolSize
      lineId
      lineIndex
      clipHash
      clip {
        clipHash
      }
      attempts(
        where: { performerAddress: $performer }
        orderBy: gradedAt
        orderDirection: desc
        first: 100
      ) {
        id
        score
        gradedAt
      }
    }
  }
`
