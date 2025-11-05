/**
 * FSRS-4.5 Algorithm Implementation (Vanilla JavaScript)
 *
 * Based on: https://github.com/open-spaced-repetition/fsrs4anki
 *
 * Core algorithm for spaced repetition scheduling using memory model.
 * All functions are pure and side-effect free.
 */

import {
  CardState,
  Rating,
  FSRS_PARAMS,
  LEARNING_STEPS,
  GRADUATING_INTERVAL,
  EASY_INTERVAL,
  RELEARNING_STEPS,
  DECAY,
  FACTOR,
  MIN_STABILITY,
  DEFAULT_DIFFICULTY,
  MIN_DIFFICULTY,
  MAX_DIFFICULTY
} from './constants.js';

/**
 * Initialize a new card (never studied)
 * @returns {Object} New card with default values
 */
export function initCard() {
  return {
    due: 0,
    stability: 0,
    difficulty: DEFAULT_DIFFICULTY,
    elapsedDays: 0,
    scheduledDays: 0,
    reps: 0,
    lapses: 0,
    state: CardState.New,
    lastReview: 0
  };
}

/**
 * Calculate retrievability (probability of recall)
 * R(t, S) = (1 + FACTOR * t / S) ** DECAY
 *
 * @param {number} elapsedDays - Days since last review
 * @param {number} stability - Current stability (days)
 * @returns {number} Retrievability (0-1)
 */
function calculateRetrievability(elapsedDays, stability) {
  if (stability < MIN_STABILITY) stability = MIN_STABILITY;
  return Math.pow(1 + FACTOR * elapsedDays / stability, DECAY);
}

/**
 * Calculate next interval based on stability and desired retention
 * I(r, s) = (s / FACTOR) * (r ** (1 / DECAY) - 1)
 *
 * @param {number} stability - Current stability (days)
 * @param {number} desiredRetention - Target retention rate (0-1)
 * @returns {number} Interval in days
 */
export function calculateInterval(stability, desiredRetention = FSRS_PARAMS.requestRetention) {
  if (stability < MIN_STABILITY) stability = MIN_STABILITY;

  const interval = (stability / FACTOR) * (Math.pow(desiredRetention, 1 / DECAY) - 1);

  // Clamp to reasonable bounds
  return Math.max(1, Math.min(FSRS_PARAMS.maximumInterval, Math.round(interval)));
}

/**
 * Calculate initial stability for a new card based on rating
 * Uses FSRS weights w[0-3]
 *
 * @param {number} rating - Rating (0-3)
 * @returns {number} Initial stability in days
 */
function initialStability(rating) {
  const w = FSRS_PARAMS.w;
  return Math.max(MIN_STABILITY, w[rating]);
}

/**
 * Calculate initial difficulty based on rating
 * D0(G) = w[4] - w[5] * (G - 2)
 * where G is rating (1=Hard, 2=Good, 3=Easy)
 *
 * @param {number} rating - Rating (1-3, excluding Again)
 * @returns {number} Initial difficulty (1-10)
 */
function initialDifficulty(rating) {
  const w = FSRS_PARAMS.w;
  // Rating 0 (Again) not used for initial difficulty
  if (rating === Rating.Again) rating = Rating.Hard;

  const difficulty = w[4] - w[5] * (rating - 2);
  return Math.max(MIN_DIFFICULTY, Math.min(MAX_DIFFICULTY, difficulty));
}

/**
 * Update difficulty after review
 * D' = D - w[6] * (R - 2.5)
 * where R is rating mapped to [1, 2, 3, 4]
 *
 * @param {number} currentDifficulty - Current difficulty (1-10)
 * @param {number} rating - Rating (0-3)
 * @returns {number} New difficulty (1-10)
 */
export function updateDifficulty(currentDifficulty, rating) {
  const w = FSRS_PARAMS.w;

  // Map rating to continuous scale: Again=1, Hard=2, Good=3, Easy=4
  const ratingScale = rating + 1;

  // Mean reversion towards 5.0 (middle difficulty)
  const difficultyChange = w[6] * (ratingScale - 2.5);
  const newDifficulty = currentDifficulty - difficultyChange;

  return Math.max(MIN_DIFFICULTY, Math.min(MAX_DIFFICULTY, newDifficulty));
}

/**
 * Calculate new stability for a card in Learning or Relearning state
 * S' = S * e^(w[8] * (R - 3 + w[9]))
 *
 * @param {Object} card - Current card state
 * @param {number} rating - Rating (0-3)
 * @returns {number} New stability in days
 */
function updateStabilityLearning(card, rating) {
  const w = FSRS_PARAMS.w;
  const { stability } = card;

  if (rating === Rating.Again) {
    // Failed - return to initial stability
    return initialStability(rating);
  }

  if (rating === Rating.Good) {
    // Good rating in learning
    const newStability = stability * Math.exp(w[8] * (rating - 3 + w[9]));
    return Math.max(MIN_STABILITY, newStability);
  }

  // Hard or Easy
  const newStability = stability * Math.exp(w[8] * (rating - 3 + w[9]));
  return Math.max(MIN_STABILITY, newStability);
}

/**
 * Calculate new stability for a card in Review state
 * Uses complex FSRS-4.5 formula based on retrievability and rating
 *
 * @param {Object} card - Current card state
 * @param {number} rating - Rating (0-3)
 * @param {number} retrievability - Current retrievability (0-1)
 * @returns {number} New stability in days
 */
function updateStabilityReview(card, rating, retrievability) {
  const w = FSRS_PARAMS.w;
  const { stability, difficulty } = card;

  if (rating === Rating.Again) {
    // Failed review - reset with penalty
    const newStability = w[10] * Math.pow(difficulty, -w[11]) *
                        (Math.pow(stability + 1, w[12]) - 1) *
                        Math.exp(w[13] * (1 - retrievability));
    return Math.max(MIN_STABILITY, newStability);
  }

  if (rating === Rating.Hard) {
    // Hard rating - smaller stability increase
    const newStability = stability * (1 + Math.exp(w[14]) *
                        (11 - difficulty) *
                        Math.pow(stability, -w[15]) *
                        (Math.exp((1 - retrievability) * w[16]) - 1));
    return Math.max(MIN_STABILITY, newStability);
  }

  if (rating === Rating.Good) {
    // Good rating - normal stability increase
    const newStability = stability * (1 + Math.exp(w[14]) *
                        (11 - difficulty) *
                        Math.pow(stability, -w[15]) *
                        (Math.exp((1 - retrievability) * w[16]) - 1));
    return Math.max(MIN_STABILITY, newStability);
  }

  // Easy rating - large stability increase
  const easyBonus = 1.3; // 30% bonus for Easy rating
  const newStability = stability * (1 + Math.exp(w[14]) *
                      (11 - difficulty) *
                      Math.pow(stability, -w[15]) *
                      (Math.exp((1 - retrievability) * w[16]) - 1) *
                      easyBonus);
  return Math.max(MIN_STABILITY, newStability);
}

/**
 * Calculate next card state after a review
 *
 * @param {Object} card - Current card state
 * @param {number} rating - Rating (0-3)
 * @param {number} now - Current timestamp (seconds)
 * @returns {Object} New card state
 */
export function nextCardState(card, rating, now) {
  const newCard = { ...card };

  // Calculate elapsed time
  const elapsedSeconds = card.lastReview > 0 ? now - card.lastReview : 0;
  const elapsedDays = elapsedSeconds / 86400; // Convert to days

  newCard.lastReview = now;
  newCard.reps = card.reps + 1;

  // Handle based on current state
  switch (card.state) {
    case CardState.New:
      return handleNewCard(newCard, rating, now, elapsedDays);

    case CardState.Learning:
      return handleLearningCard(newCard, rating, now, elapsedDays);

    case CardState.Review:
      return handleReviewCard(newCard, rating, now, elapsedDays);

    case CardState.Relearning:
      return handleRelearningCard(newCard, rating, now, elapsedDays);

    default:
      return newCard;
  }
}

/**
 * Handle review for a New card (first time studying)
 */
function handleNewCard(card, rating, now, elapsedDays) {
  card.elapsedDays = 0;

  if (rating === Rating.Again) {
    // Failed first review - stay in Learning with short interval
    card.state = CardState.Learning;
    card.stability = initialStability(rating);
    card.difficulty = initialDifficulty(Rating.Hard); // Default to Hard difficulty
    card.scheduledDays = LEARNING_STEPS[0] / 1440; // Convert minutes to days
    card.due = now + (LEARNING_STEPS[0] * 60); // Convert minutes to seconds
    return card;
  }

  if (rating === Rating.Easy) {
    // Easy on first review - skip Learning, go straight to Review
    card.state = CardState.Review;
    card.stability = initialStability(rating);
    card.difficulty = initialDifficulty(rating);
    card.scheduledDays = EASY_INTERVAL;
    card.due = now + (EASY_INTERVAL * 86400);
    return card;
  }

  // Hard or Good - enter Learning state
  card.state = CardState.Learning;
  card.stability = initialStability(rating);
  card.difficulty = initialDifficulty(rating);
  card.scheduledDays = LEARNING_STEPS[0] / 1440;
  card.due = now + (LEARNING_STEPS[0] * 60);
  return card;
}

/**
 * Handle review for a card in Learning state
 */
function handleLearningCard(card, rating, now, elapsedDays) {
  card.elapsedDays = elapsedDays;

  if (rating === Rating.Again) {
    // Failed learning - restart learning steps
    card.lapses += 1;
    card.stability = initialStability(rating);
    card.difficulty = updateDifficulty(card.difficulty, rating);
    card.scheduledDays = LEARNING_STEPS[0] / 1440;
    card.due = now + (LEARNING_STEPS[0] * 60);
    return card;
  }

  // Update stability
  card.stability = updateStabilityLearning(card, rating);
  card.difficulty = updateDifficulty(card.difficulty, rating);

  if (rating === Rating.Easy) {
    // Graduate to Review with Easy interval
    card.state = CardState.Review;
    card.scheduledDays = EASY_INTERVAL;
    card.due = now + (EASY_INTERVAL * 86400);
    return card;
  }

  // Good or Hard - graduate to Review with normal interval
  card.state = CardState.Review;
  card.scheduledDays = GRADUATING_INTERVAL;
  card.due = now + (GRADUATING_INTERVAL * 86400);
  return card;
}

/**
 * Handle review for a card in Review state
 */
function handleReviewCard(card, rating, now, elapsedDays) {
  card.elapsedDays = elapsedDays;

  // Calculate retrievability
  const retrievability = calculateRetrievability(elapsedDays, card.stability);

  if (rating === Rating.Again) {
    // Failed review - enter Relearning
    card.state = CardState.Relearning;
    card.lapses += 1;
    card.stability = updateStabilityReview(card, rating, retrievability);
    card.difficulty = updateDifficulty(card.difficulty, rating);
    card.scheduledDays = RELEARNING_STEPS[0] / 1440;
    card.due = now + (RELEARNING_STEPS[0] * 60);
    return card;
  }

  // Update stability and difficulty
  card.stability = updateStabilityReview(card, rating, retrievability);
  card.difficulty = updateDifficulty(card.difficulty, rating);

  // Calculate next interval
  const interval = calculateInterval(card.stability, FSRS_PARAMS.requestRetention);
  card.scheduledDays = interval;
  card.due = now + (interval * 86400);

  return card;
}

/**
 * Handle review for a card in Relearning state
 */
function handleRelearningCard(card, rating, now, elapsedDays) {
  card.elapsedDays = elapsedDays;

  if (rating === Rating.Again) {
    // Failed relearning - restart
    card.stability = initialStability(rating);
    card.difficulty = updateDifficulty(card.difficulty, rating);
    card.scheduledDays = RELEARNING_STEPS[0] / 1440;
    card.due = now + (RELEARNING_STEPS[0] * 60);
    return card;
  }

  // Passed relearning - graduate back to Review
  card.state = CardState.Review;
  card.stability = updateStabilityLearning(card, rating);
  card.difficulty = updateDifficulty(card.difficulty, rating);

  const interval = Math.max(1, Math.round(card.stability));
  card.scheduledDays = interval;
  card.due = now + (interval * 86400);

  return card;
}

/**
 * Encode card for contract storage (scale values)
 *
 * @param {Object} card - Card with float values
 * @returns {Object} Card with scaled integer values for contract
 */
export function encodeCardForContract(card) {
  return {
    due: Math.floor(card.due),
    stability: Math.floor(card.stability * 100), // Scale up by 100
    difficulty: Math.floor(card.difficulty * 10), // Scale up by 10
    elapsedDays: Math.floor(card.elapsedDays * 10), // Scale up by 10
    scheduledDays: Math.floor(card.scheduledDays * 10), // Scale up by 10
    reps: Math.min(255, card.reps), // Clamp to uint8
    lapses: Math.min(255, card.lapses), // Clamp to uint8
    state: card.state,
    lastReview: Math.floor(card.lastReview)
  };
}

/**
 * Decode card from contract storage (descale values)
 *
 * @param {Object} contractCard - Card with scaled integer values
 * @returns {Object} Card with float values
 */
export function decodeCardFromContract(contractCard) {
  return {
    due: contractCard.due,
    stability: contractCard.stability / 100, // Scale down
    difficulty: contractCard.difficulty / 10, // Scale down
    elapsedDays: contractCard.elapsedDays / 10, // Scale down
    scheduledDays: contractCard.scheduledDays / 10, // Scale down
    reps: contractCard.reps,
    lapses: contractCard.lapses,
    state: contractCard.state,
    lastReview: contractCard.lastReview
  };
}
