import { useState, useEffect } from 'react'
import { gql } from 'graphql-request'
import { graphClient } from '@/lib/graphql/client'
import { useAuth } from '@/contexts/AuthContext'

const GET_USER_ACTIVITY = gql`
  query GetUserActivity($address: String!) {
    exerciseAttempts(
      where: { performerAddress: $address }
      first: 1000
      orderBy: gradedAt
      orderDirection: desc
    ) {
      gradedAt
    }
    karaokeSessions(
      where: { performer: $address }
      first: 1000
      orderBy: startedAt
      orderDirection: desc
    ) {
      startedAt
      endedAt
    }
  }
`

function calculateStreak(timestamps: number[]): number {
  if (timestamps.length === 0) return 0

  const sorted = [...timestamps].sort((a, b) => b - a)
  const uniqueDays = new Set(sorted.map(ts => Math.floor(ts / 86400)))
  const days = Array.from(uniqueDays).sort((a, b) => b - a)

  if (days.length === 0) return 0

  const today = Math.floor(Date.now() / 1000 / 86400)
  if (days[0] < today - 1) return 0

  let streak = 1
  for (let i = 1; i < days.length; i++) {
    if (days[i - 1] - days[i] === 1) {
      streak++
    } else {
      break
    }
  }

  return streak
}

export function useUserStreak() {
  const { pkpAddress } = useAuth()
  const [streak, setStreak] = useState(0)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!pkpAddress) {
      setStreak(0)
      return
    }

    const fetchStreak = async () => {
      setIsLoading(true)
      try {
        const data = await graphClient.request<{
          exerciseAttempts: { gradedAt: string }[]
          karaokeSessions: { startedAt: string; endedAt: string }[]
        }>(GET_USER_ACTIVITY, { address: pkpAddress.toLowerCase() })

        const timestamps: number[] = []

        for (const attempt of data.exerciseAttempts) {
          timestamps.push(parseInt(attempt.gradedAt) || 0)
        }

        for (const session of data.karaokeSessions) {
          const ts = parseInt(session.endedAt || session.startedAt) || 0
          if (ts > 0) timestamps.push(ts)
        }

        setStreak(calculateStreak(timestamps))
      } catch (err) {
        console.error('[useUserStreak] Error fetching streak:', err)
        setStreak(0)
      } finally {
        setIsLoading(false)
      }
    }

    fetchStreak()
  }, [pkpAddress])

  return { streak, isLoading }
}
