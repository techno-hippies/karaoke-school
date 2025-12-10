/**
 * Survey Definitions
 *
 * Per-personality onboarding surveys to gather user preferences.
 * Survey responses are saved to UserProfile.learning for AI personalization.
 */

import type { Survey, PersonalityId, LearningPreferences } from './types'

// ============================================================
// Scarlett Surveys (Music & Karaoke focused)
// ============================================================

const SCARLETT_SURVEYS: Survey[] = [
  {
    id: 'favoriteMusician',
    questionKey: 'surveys.scarlett.favoriteMusician.question',
    profileField: 'favoriteArtists',
    multiSelect: true,
    options: [
      { id: 'beyonce', labelKey: 'surveys.scarlett.favoriteMusician.beyonce' },
      { id: 'blackpink', labelKey: 'surveys.scarlett.favoriteMusician.blackpink' },
      { id: 'jaychou', labelKey: 'surveys.scarlett.favoriteMusician.jaychou' },
      { id: 'taylor', labelKey: 'surveys.scarlett.favoriteMusician.taylor' },
      { id: 'none', labelKey: 'surveys.common.other' },
    ],
  },
  {
    id: 'englishLevel',
    questionKey: 'surveys.scarlett.englishLevel.question',
    profileField: 'goals', // Will set level in profile root
    options: [
      { id: 'beginner', labelKey: 'surveys.scarlett.englishLevel.beginner' },
      { id: 'intermediate', labelKey: 'surveys.scarlett.englishLevel.intermediate' },
      { id: 'advanced', labelKey: 'surveys.scarlett.englishLevel.advanced' },
    ],
  },
  {
    id: 'learningGoal',
    questionKey: 'surveys.scarlett.learningGoal.question',
    profileField: 'goals',
    multiSelect: true,
    options: [
      { id: 'travel', labelKey: 'surveys.scarlett.learningGoal.travel' },
      { id: 'dating', labelKey: 'surveys.scarlett.learningGoal.dating' },
      { id: 'test', labelKey: 'surveys.scarlett.learningGoal.test' },
      { id: 'job', labelKey: 'surveys.scarlett.learningGoal.job' },
      { id: 'other', labelKey: 'surveys.common.other' },
    ],
  },
]

// ============================================================
// Violet Surveys (Anime, Gaming, Music Production)
// ============================================================

const VIOLET_SURVEYS: Survey[] = [
  {
    id: 'favoriteAnime',
    questionKey: 'surveys.violet.favoriteAnime.question',
    profileField: 'favoriteAnime',
    multiSelect: true,
    options: [
      { id: 'aot', labelKey: 'surveys.violet.favoriteAnime.aot' },
      { id: 'jjk', labelKey: 'surveys.violet.favoriteAnime.jjk' },
      { id: 'spyfamily', labelKey: 'surveys.violet.favoriteAnime.spyfamily' },
      { id: 'onepiece', labelKey: 'surveys.violet.favoriteAnime.onepiece' },
      { id: 'none', labelKey: 'surveys.common.other' },
    ],
  },
  {
    id: 'favoriteGame',
    questionKey: 'surveys.violet.favoriteGame.question',
    profileField: 'favoriteGames',
    multiSelect: true,
    options: [
      { id: 'valorant', labelKey: 'surveys.violet.favoriteGame.valorant' },
      { id: 'genshin', labelKey: 'surveys.violet.favoriteGame.genshin' },
      { id: 'lol', labelKey: 'surveys.violet.favoriteGame.lol' },
      { id: 'rhythm', labelKey: 'surveys.violet.favoriteGame.rhythm' },
      { id: 'none', labelKey: 'surveys.common.other' },
    ],
  },
  {
    id: 'musicProduction',
    questionKey: 'surveys.violet.musicProduction.question',
    profileField: 'musicProductionInterest',
    options: [
      { id: 'yes-daw', labelKey: 'surveys.violet.musicProduction.yesDaw' },
      { id: 'curious', labelKey: 'surveys.violet.musicProduction.curious' },
      { id: 'listener', labelKey: 'surveys.violet.musicProduction.listener' },
    ],
  },
]

// ============================================================
// Survey Registry
// ============================================================

export const PERSONALITY_SURVEYS: Record<PersonalityId, Survey[]> = {
  scarlett: SCARLETT_SURVEYS,
  violet: VIOLET_SURVEYS,
}

/**
 * Get the next unanswered survey for a personality
 */
export function getNextSurvey(
  personalityId: PersonalityId,
  completedSurveys: string[]
): Survey | null {
  const surveys = PERSONALITY_SURVEYS[personalityId]
  if (!surveys) return null

  for (const survey of surveys) {
    if (!completedSurveys.includes(survey.id)) {
      return survey
    }
  }

  return null
}

/**
 * Check if all surveys are complete for a personality
 */
export function areSurveysComplete(
  personalityId: PersonalityId,
  completedSurveys: string[]
): boolean {
  const surveys = PERSONALITY_SURVEYS[personalityId]
  if (!surveys) return true

  return surveys.every((s) => completedSurveys.includes(s.id))
}

/**
 * Get i18n key for welcome message based on personality
 */
export function getWelcomeMessageKey(personalityId: PersonalityId): string {
  return `personalities.${personalityId}.welcomeMessage`
}

/**
 * Get i18n key for survey completion message
 */
export function getSurveyCompleteKey(personalityId: PersonalityId): string {
  return `personalities.${personalityId}.surveyComplete`
}

/**
 * Map survey response to profile field update
 */
export function mapSurveyToProfile(
  survey: Survey,
  optionId: string,
  translatedLabel: string
): Partial<LearningPreferences> {
  const update: Partial<LearningPreferences> = {}

  // Handle special cases
  if (survey.id === 'englishLevel') {
    // This updates the root profile.level, not learning
    return update
  }

  // Skip 'none' or 'other' options
  if (optionId === 'none' || optionId === 'other') {
    return update
  }

  // For multi-select, we'd need existing values to append
  // For single-select, just set the value
  if (survey.multiSelect) {
    // Will be handled by the caller to merge with existing array
    (update as any)[survey.profileField] = [translatedLabel]
  } else {
    (update as any)[survey.profileField] = optionId
  }

  return update
}
