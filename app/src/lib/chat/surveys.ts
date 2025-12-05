/**
 * Per-personality survey configurations
 *
 * Each AI personality has their own onboarding surveys tailored to their interests.
 * Survey responses are stored in the global UserProfile so all AIs can access them.
 */

import type { PersonalityId } from './types'

export interface SurveyOption {
  id: string
  /** i18n key for the option label */
  labelKey: string
}

export interface SurveyConfig {
  id: string
  /** i18n key for the question text */
  questionKey: string
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
    questionKey: 'survey.scarlett.favoriteMusician.question',
    options: [
      { id: 'beyonce', labelKey: 'survey.scarlett.favoriteMusician.beyonce' },
      { id: 'blackpink', labelKey: 'survey.scarlett.favoriteMusician.blackpink' },
      { id: 'jay-chou', labelKey: 'survey.scarlett.favoriteMusician.jayChou' },
      { id: 'taylor', labelKey: 'survey.scarlett.favoriteMusician.taylor' },
      { id: 'none', labelKey: 'survey.scarlett.favoriteMusician.none' },
    ],
    saveTo: 'learning.favoriteArtists',
    isArray: true,
    skipNone: true,
  },
  {
    id: 'englishLevel',
    questionKey: 'survey.scarlett.englishLevel.question',
    options: [
      { id: 'beginner', labelKey: 'survey.scarlett.englishLevel.beginner' },
      { id: 'intermediate', labelKey: 'survey.scarlett.englishLevel.intermediate' },
      { id: 'advanced', labelKey: 'survey.scarlett.englishLevel.advanced' },
    ],
    saveTo: 'level',
    isArray: false,
  },
  {
    id: 'learningGoal',
    questionKey: 'survey.scarlett.learningGoal.question',
    options: [
      { id: 'travel', labelKey: 'survey.scarlett.learningGoal.travel' },
      { id: 'dating', labelKey: 'survey.scarlett.learningGoal.dating' },
      { id: 'test', labelKey: 'survey.scarlett.learningGoal.test' },
      { id: 'job', labelKey: 'survey.scarlett.learningGoal.job' },
      { id: 'other', labelKey: 'survey.scarlett.learningGoal.other' },
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
    questionKey: 'survey.violet.favoriteAnime.question',
    options: [
      { id: 'aot', labelKey: 'survey.violet.favoriteAnime.aot' },
      { id: 'jjk', labelKey: 'survey.violet.favoriteAnime.jjk' },
      { id: 'spy-family', labelKey: 'survey.violet.favoriteAnime.spyFamily' },
      { id: 'one-piece', labelKey: 'survey.violet.favoriteAnime.onePiece' },
      { id: 'none', labelKey: 'survey.violet.favoriteAnime.none' },
    ],
    saveTo: 'learning.favoriteAnime',
    isArray: true,
    skipNone: true,
  },
  {
    id: 'favoriteGame',
    questionKey: 'survey.violet.favoriteGame.question',
    options: [
      { id: 'valorant', labelKey: 'survey.violet.favoriteGame.valorant' },
      { id: 'genshin', labelKey: 'survey.violet.favoriteGame.genshin' },
      { id: 'lol', labelKey: 'survey.violet.favoriteGame.lol' },
      { id: 'rhythm', labelKey: 'survey.violet.favoriteGame.rhythm' },
      { id: 'none', labelKey: 'survey.violet.favoriteGame.none' },
    ],
    saveTo: 'learning.favoriteGames',
    isArray: true,
    skipNone: true,
  },
  {
    id: 'musicProduction',
    questionKey: 'survey.violet.musicProduction.question',
    options: [
      { id: 'yes-daw', labelKey: 'survey.violet.musicProduction.yesDaw' },
      { id: 'curious', labelKey: 'survey.violet.musicProduction.curious' },
      { id: 'listener', labelKey: 'survey.violet.musicProduction.listener' },
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
 * Get welcome message i18n key for a personality
 */
export function getWelcomeMessageKey(personalityId: PersonalityId): string {
  return `personalities.${personalityId}.welcomeIntro`
}
