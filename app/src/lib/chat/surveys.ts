/**
 * Per-personality survey configurations
 *
 * Each AI personality has their own onboarding surveys tailored to their interests.
 * Survey responses are stored in the global UserProfile so all AIs can access them.
 */

import type { PersonalityId } from './types'

export interface SurveyOption {
  id: string
  label: string
}

export interface SurveyConfig {
  id: string
  question: string
  options: SurveyOption[]
  /** Path in UserProfile to save response (dot notation) */
  saveTo: string
  /** If true, append to array; if false, set value */
  isArray: boolean
  /** Skip saving the 'none' option */
  skipNone?: boolean
}

/**
 * Scarlett's surveys - Music & Karaoke focused
 */
const SCARLETT_SURVEYS: SurveyConfig[] = [
  {
    id: 'favoriteMusician',
    question: "Of these musicians, who is your favorite?",
    options: [
      { id: 'beyonce', label: 'Beyoncé' },
      { id: 'blackpink', label: 'BLACKPINK' },
      { id: 'jay-chou', label: 'Jay Chou' },
      { id: 'taylor', label: 'Taylor Swift' },
      { id: 'none', label: 'None of these' },
    ],
    saveTo: 'learning.favoriteArtists',
    isArray: true,
    skipNone: true,
  },
  {
    id: 'englishLevel',
    question: "How would you describe your English level?",
    options: [
      { id: 'beginner', label: 'Beginner - I know basics' },
      { id: 'intermediate', label: 'Intermediate - I can hold conversations' },
      { id: 'advanced', label: 'Advanced - I want to polish my skills' },
    ],
    saveTo: 'level',
    isArray: false,
  },
  {
    id: 'karaokeGoal',
    question: "What's your main learning goal?",
    options: [
      { id: 'pronunciation', label: 'Better pronunciation' },
      { id: 'vocabulary', label: 'Learn new vocabulary' },
      { id: 'confidence', label: 'Build speaking confidence' },
      { id: 'fun', label: 'Just for fun!' },
    ],
    saveTo: 'learning.goals',
    isArray: true,
  },
]

/**
 * Violet's surveys - Anime, Gaming & Music Production focused
 */
const VIOLET_SURVEYS: SurveyConfig[] = [
  {
    id: 'favoriteAnime',
    question: "What anime are you into?",
    options: [
      { id: 'aot', label: 'Attack on Titan' },
      { id: 'jjk', label: 'Jujutsu Kaisen' },
      { id: 'spy-family', label: 'Spy x Family' },
      { id: 'one-piece', label: 'One Piece' },
      { id: 'none', label: 'Not really into anime' },
    ],
    saveTo: 'learning.favoriteAnime',
    isArray: true,
    skipNone: true,
  },
  {
    id: 'favoriteGame',
    question: "What games do you play?",
    options: [
      { id: 'valorant', label: 'Valorant' },
      { id: 'genshin', label: 'Genshin Impact' },
      { id: 'lol', label: 'League of Legends' },
      { id: 'rhythm', label: 'Rhythm games (osu!, etc.)' },
      { id: 'none', label: "Don't game much" },
    ],
    saveTo: 'learning.favoriteGames',
    isArray: true,
    skipNone: true,
  },
  {
    id: 'musicProduction',
    question: "Interested in making music?",
    options: [
      { id: 'yes-daw', label: 'Yes, I use a DAW' },
      { id: 'curious', label: 'Curious to learn' },
      { id: 'listener', label: 'Just a listener' },
    ],
    saveTo: 'learning.musicProductionInterest',
    isArray: false,
  },
]

/**
 * Map of personality ID to their surveys
 */
export const PERSONALITY_SURVEYS: Record<PersonalityId, SurveyConfig[]> = {
  scarlett: SCARLETT_SURVEYS,
  violet: VIOLET_SURVEYS,
}

/**
 * Get the next uncompleted survey for a personality
 */
export function getNextSurvey(
  personalityId: PersonalityId,
  completedSurveyIds: string[]
): SurveyConfig | null {
  const surveys = PERSONALITY_SURVEYS[personalityId]
  if (!surveys) return null

  for (const survey of surveys) {
    if (!completedSurveyIds.includes(survey.id)) {
      return survey
    }
  }

  return null // All surveys completed
}

/**
 * Check if all surveys are completed for a personality
 */
export function allSurveysCompleted(
  personalityId: PersonalityId,
  completedSurveyIds: string[]
): boolean {
  const surveys = PERSONALITY_SURVEYS[personalityId]
  if (!surveys) return true

  return surveys.every(s => completedSurveyIds.includes(s.id))
}

/**
 * Get welcome message for a personality
 */
export function getWelcomeMessage(personalityId: PersonalityId, name: string): string {
  switch (personalityId) {
    case 'scarlett':
      return `Hey! I'm ${name}. Let me get to know you a bit first so I can help you learn English through music!`
    case 'violet':
      return `Yo, ${name} here. Quick vibe check before we chat - what are you into?`
    default:
      return `Welcome! I'm ${name}. Let me get to know you first.`
  }
}

/**
 * Get follow-up message after survey completion
 */
export function getSurveyFollowUp(
  personalityId: PersonalityId,
  surveyId: string,
  selectedOption: SurveyOption
): string {
  // Scarlett follow-ups
  if (personalityId === 'scarlett') {
    if (surveyId === 'favoriteMusician') {
      if (selectedOption.id === 'none') {
        return "No worries! We can explore all kinds of music together. What genres do you enjoy?"
      }
      return `${selectedOption.label}! Great taste. Their songs are perfect for learning English.`
    }
    if (surveyId === 'englishLevel') {
      return `Got it! I'll tailor our practice to your ${selectedOption.label.toLowerCase().split(' ')[0]} level.`
    }
    if (surveyId === 'karaokeGoal') {
      return "Perfect, I'll keep that in mind. Let's start learning!"
    }
  }

  // Violet follow-ups
  if (personalityId === 'violet') {
    if (surveyId === 'favoriteAnime') {
      if (selectedOption.id === 'none') {
        return "Fair enough, anime isn't for everyone. What about music or games?"
      }
      return `${selectedOption.label}? Nice, that soundtrack slaps. Good taste.`
    }
    if (surveyId === 'favoriteGame') {
      if (selectedOption.id === 'none') {
        return "All good, more time for music then."
      }
      if (selectedOption.id === 'rhythm') {
        return "Rhythm games? Respect. That's basically musical training."
      }
      return `${selectedOption.label} player, huh? Solid choice.`
    }
    if (surveyId === 'musicProduction') {
      if (selectedOption.id === 'yes-daw') {
        return "Nice! What DAW? I'm an Ableton person myself."
      }
      if (selectedOption.id === 'curious') {
        return "I can teach you some basics. It's easier than people think."
      }
      return "That's cool, nothing wrong with just vibing to music."
    }
  }

  return "Thanks! Let's continue."
}
