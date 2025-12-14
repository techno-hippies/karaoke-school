#!/usr/bin/env bun
/**
 * MVP Karaoke Agent
 *
 * Plays through a list of songs with TTS and talking in between.
 *
 * Usage:
 *   bun play-karaoke.ts
 *
 * Requires:
 *   - Chrome running with --remote-debugging-port=9222
 *   - bun run dev:all (TTS, Browser, Orchestrator services)
 *   - App running at localhost:5173
 */

const BROWSER_URL = 'http://localhost:3032'
const TTS_URL = 'http://localhost:3030'
const APP_URL = 'http://localhost:5173'

// Songs to play
const PLAYLIST = [
  { path: '/#/beyonce/naughty-girl/karaoke', title: 'Naughty Girl', artist: 'Beyoncé' },
  { path: '/#/the-beatles/revolution/karaoke', title: 'Revolution', artist: 'The Beatles' },
  { path: '/#/taylor-swift/the-fate-of-ophelia/karaoke', title: 'The Fate of Ophelia', artist: 'Taylor Swift' },
]

// Intros and outros
const INTROS = [
  "Hey everyone! Let's get this karaoke stream started!",
  "Alright, next song coming up!",
  "Okay okay, here we go with another one!",
]

const REACTIONS = {
  great: [
    "Wow, that was amazing! I really nailed that one!",
    "Yes! That felt so good!",
    "I'm on fire tonight!",
  ],
  good: [
    "Not bad, not bad at all!",
    "Pretty solid performance there!",
    "I'll take that score!",
  ],
  okay: [
    "Well, that could have been better...",
    "Hmm, I know I can do better than that.",
    "Let's move on and try the next one!",
  ],
}

const WAITING_COMMENTS = [
  "Let's see how I did on that one...",
  "Okay, waiting for my score now!",
  "I think I did pretty well, let's find out!",
  "Fingers crossed for a good grade!",
  "That was fun! Wonder what score I got.",
  "Hmm, some of those lines were tricky!",
  "I felt good about that performance!",
]

const GRADING_PROGRESS_COMMENTS = [
  "Still grading... this AI judge is thorough!",
  "Taking its time to evaluate my singing...",
  "Almost there, I can feel it!",
  "Come on, show me that score!",
  "The suspense is killing me!",
]

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function speak(text: string): Promise<void> {
  console.log(`[TTS] "${text}"`)
  const waitMs = text.length * 60 + 1000
  console.log(`[TTS] Waiting ${waitMs}ms for speech...`)
  await fetch(`${TTS_URL}/speak`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  // Wait for speech to finish (rough estimate)
  await sleep(waitMs)
  console.log(`[TTS] Done speaking`)
}

async function browserLaunch(): Promise<boolean> {
  const res = await fetch(`${BROWSER_URL}/launch`, { method: 'POST' })
  const data = await res.json()
  return data.ok
}

async function browserNavigate(url: string): Promise<boolean> {
  console.log(`[Browser] Navigating to ${url}`)
  try {
    const res = await fetch(`${BROWSER_URL}/navigate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })
    const data = await res.json()
    console.log(`[Browser] Navigate result:`, data)
    return data.ok
  } catch (err) {
    console.error(`[Browser] Navigate error:`, err)
    return false
  }
}

async function getKaraokeStatus(): Promise<{ recording: boolean; canStart: boolean }> {
  const res = await fetch(`${BROWSER_URL}/karaoke/status`)
  return res.json()
}

async function getLyrics(): Promise<{ lyrics: any[]; title: string; artist: string } | null> {
  const res = await fetch(`${BROWSER_URL}/lyrics`)
  const data = await res.json()
  return data.data || null
}

async function startKaraoke(): Promise<boolean> {
  const res = await fetch(`${BROWSER_URL}/karaoke/start`, { method: 'POST' })
  const data = await res.json()
  return data.ok
}

async function clickKaraokeButton(): Promise<boolean> {
  const res = await fetch(`${BROWSER_URL}/click-karaoke`, { method: 'POST' })
  const data = await res.json()
  return data.ok
}

async function scheduleTTS(lyrics: any[], startedAt: number): Promise<void> {
  await fetch(`${TTS_URL}/schedule`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lines: lyrics, startedAt }),
  })
  console.log(`[TTS] Scheduled ${lyrics.length} lines`)
}

interface KaraokeResults {
  stillGrading: boolean
  grade: string | null  // 'A' | 'B' | 'C' | 'D' | 'F'
  averageScore: number | null
  completed: number
  total: number
  skipped: number
  timedOut: boolean
}

async function getResults(): Promise<KaraokeResults | null> {
  const res = await fetch(`${BROWSER_URL}/karaoke/results`)
  const data = await res.json()
  return data.results
}

async function getScore(): Promise<number | null> {
  const res = await fetch(`${BROWSER_URL}/karaoke/score`)
  const data = await res.json()
  return data.score
}

async function waitForSongToFinish(lyrics: any[]): Promise<void> {
  // Calculate song duration from lyrics
  const lastLine = lyrics[lyrics.length - 1]
  const durationMs = lastLine.endMs + 3000 // Add 3s buffer after last line
  console.log(`[Agent] Waiting ${Math.round(durationMs / 1000)}s for song to finish...`)
  await sleep(durationMs)
  console.log('[Agent] Song finished')
}

async function playSong(song: typeof PLAYLIST[0], index: number): Promise<number | null> {
  console.log(`\n${'='.repeat(50)}`)
  console.log(`[Agent] Song ${index + 1}/${PLAYLIST.length}: ${song.title} by ${song.artist}`)
  console.log('='.repeat(50))

  // Intro
  const intro = index === 0
    ? `${pick(INTROS)} First up, we have ${song.title} by ${song.artist}!`
    : `${pick(INTROS)} This one is ${song.title} by ${song.artist}!`
  await speak(intro)

  // Navigate to song page first (resets stale results page state)
  const songPagePath = song.path.replace('/karaoke', '')
  await browserNavigate(`${APP_URL}${songPagePath}`)
  await sleep(2000)

  // Click Karaoke button to go to karaoke page
  console.log('[Agent] Clicking Karaoke button...')
  await clickKaraokeButton()
  await sleep(3000)

  // Wait for lyrics to load
  let lyrics = null
  for (let i = 0; i < 10; i++) {
    lyrics = await getLyrics()
    if (lyrics && lyrics.lyrics?.length > 0) break
    console.log('[Agent] Waiting for lyrics...')
    await sleep(1000)
  }

  if (!lyrics || !lyrics.lyrics?.length) {
    console.error('[Agent] Failed to load lyrics!')
    await speak("Hmm, something went wrong loading the lyrics. Let me skip this one.")
    return null
  }

  console.log(`[Agent] Loaded ${lyrics.lyrics.length} lines`)

  // Wait for Start button
  let status = await getKaraokeStatus()
  for (let i = 0; i < 10; i++) {
    if (status.canStart) break
    console.log('[Agent] Waiting for Start button...')
    await sleep(1000)
    status = await getKaraokeStatus()
  }

  if (!status.canStart) {
    console.error('[Agent] Start button not available!')
    await speak("I can't start this song for some reason. Moving on!")
    return null
  }

  // Start karaoke
  console.log('[Agent] Starting karaoke...')
  const startedAt = Date.now()
  const started = await startKaraoke()

  if (!started) {
    console.error('[Agent] Failed to start karaoke!')
    return null
  }

  // Schedule TTS immediately
  await scheduleTTS(lyrics.lyrics, startedAt)

  // Wait for song to finish (based on lyrics duration)
  await waitForSongToFinish(lyrics.lyrics)

  // Initial comment while waiting for grading
  await speak(pick(WAITING_COMMENTS))

  // Poll for grading to complete (up to 45 seconds)
  console.log('[Agent] Waiting for grading to complete...')
  let results: KaraokeResults | null = null
  let lastCommentAt = Date.now()
  let commentCount = 0

  for (let i = 0; i < 45; i++) {
    await sleep(1000)
    results = await getResults()
    if (results) {
      console.log(`[Agent] Grading: ${results.completed}/${results.total} lines (stillGrading: ${results.stillGrading})`)
      if (!results.stillGrading) {
        console.log('[Agent] Grading complete!')
        break
      }

      // Add commentary every ~12 seconds while grading (max 2 extra comments)
      const timeSinceLastComment = Date.now() - lastCommentAt
      if (timeSinceLastComment > 12000 && commentCount < 2) {
        await speak(pick(GRADING_PROGRESS_COMMENTS))
        lastCommentAt = Date.now()
        commentCount++
      }
    }
  }

  // Get final results
  if (!results || results.stillGrading) {
    console.log('[Agent] Grading timed out, getting whatever results are available')
    results = await getResults()
  }

  const score = results?.averageScore
  // Compute grade from score if not provided (handles timeout edge case)
  let grade = results?.grade
  if (!grade && score !== null && score !== undefined) {
    if (score >= 90) grade = 'A'
    else if (score >= 75) grade = 'B'
    else if (score >= 60) grade = 'C'
    else if (score >= 40) grade = 'D'
    else grade = 'F'
  }
  console.log(`[Agent] Grade: ${grade}, Score: ${score}%`)

  // React to grade
  if (grade) {
    let reaction: string
    if (grade === 'A') {
      reaction = pick(REACTIONS.great)
    } else if (grade === 'B' || grade === 'C') {
      reaction = pick(REACTIONS.good)
    } else {
      reaction = pick(REACTIONS.okay)
    }
    await speak(`I got ${grade === 'A' ? 'an' : 'a'} ${grade}! ${reaction}`)
  } else if (score !== null && score !== undefined) {
    // Fallback: just mention the score
    await speak(`I scored ${score} percent! Not bad!`)
  }

  return score
}

async function main() {
  console.log('[Agent] Starting Karaoke MVP')
  console.log(`[Agent] Playlist: ${PLAYLIST.length} songs\n`)

  // Launch browser
  console.log('[Agent] Launching browser...')
  await browserLaunch()
  await sleep(2000)

  // Play each song
  const scores: (number | null)[] = []
  for (let i = 0; i < PLAYLIST.length; i++) {
    const score = await playSong(PLAYLIST[i], i)
    scores.push(score)

    // Brief pause between songs
    if (i < PLAYLIST.length - 1) {
      await sleep(3000)
    }
  }

  // Wrap up
  const validScores = scores.filter((s): s is number => s !== null)
  const avgScore = validScores.length > 0
    ? Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length)
    : 0

  await speak(`That's all for tonight! I played ${PLAYLIST.length} songs with an average score of ${avgScore} percent. Thanks for watching!`)

  console.log('\n[Agent] Session complete!')
  console.log(`[Agent] Scores: ${scores.map((s, i) => `${PLAYLIST[i].title}: ${s ?? 'N/A'}%`).join(', ')}`)
  console.log(`[Agent] Average: ${avgScore}%`)
}

main().catch(console.error)
