/**
 * FSRS-4.5 Constants and Parameters
 *
 * Based on: https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm
 *
 * FSRS (Free Spaced Repetition Scheduler) is a modern spaced repetition algorithm
 * that uses a memory model to schedule reviews based on:
 * - Stability (S): How long you can remember (in days)
 * - Difficulty (D): How hard the material is to learn (1-10 scale)
 */

/**
 * Card States (matches FSRS-4.5 spec)
 */
export const CardState = {
  New: 0,         // Never studied
  Learning: 1,    // Short-term repetition (< 1 day intervals)
  Review: 2,      // Long-term repetition (days/weeks/months)
  Relearning: 3   // Failed review, back to short intervals
};

/**
 * Review Ratings (matches FSRS-4.5 spec)
 */
export const Rating = {
  Again: 0,  // Complete failure, restart learning
  Hard: 1,   // Difficult but remembered
  Good: 2,   // Correct with effort
  Easy: 3    // Trivial, increase interval significantly
};

/**
 * FSRS-4.5 Default Parameters
 *
 * These weights are trained on optimal review intervals.
 * Can be customized per user with training data.
 */
export const FSRS_PARAMS = {
  // Target retention rate (90% = remember 90% of cards)
  requestRetention: 0.9,

  // Maximum interval in days (100 years)
  maximumInterval: 36500,

  // FSRS-4.5 weights (17 parameters)
  // w[0-3]: Initial stability for each rating (Again, Hard, Good, Easy)
  // w[4-7]: Difficulty adjustment
  // w[8-16]: Advanced stability calculations
  w: [
    0.4,    // w[0]: Initial stability for Again
    0.6,    // w[1]: Initial stability for Hard
    2.4,    // w[2]: Initial stability for Good
    5.8,    // w[3]: Initial stability for Easy
    4.93,   // w[4]: Difficulty decay factor
    0.94,   // w[5]: Difficulty mean reversion
    0.86,   // w[6]: Difficulty weight for Hard
    0.01,   // w[7]: Difficulty weight for Easy
    1.49,   // w[8]: Stability factor for Again in Learning
    0.14,   // w[9]: Stability factor for Good in Learning
    0.94,   // w[10]: Stability factor for Again in Review
    2.18,   // w[11]: Stability factor for Hard in Review
    0.05,   // w[12]: Stability factor for Easy in Review
    0.34,   // w[13]: Retrievability decay
    1.26,   // w[14]: Retrievability offset
    0.29,   // w[15]: Stability growth factor
    2.61    // w[16]: Stability bonus for Easy
  ]
};

/**
 * Learning Steps (minutes)
 * Used for New and Relearning cards before they graduate to Review
 */
export const LEARNING_STEPS = [1, 10]; // 1 min, 10 min

/**
 * Graduating Interval (days)
 * Days to wait after passing Learning before first Review
 */
export const GRADUATING_INTERVAL = 1;

/**
 * Easy Interval (days)
 * Days to wait after rating Easy on first review
 */
export const EASY_INTERVAL = 4;

/**
 * Relearning Steps (minutes)
 * Steps for cards that failed review (Again rating in Review state)
 */
export const RELEARNING_STEPS = [10];

/**
 * Decay constant for retrievability calculation
 * Higher value = faster forgetting curve
 */
export const DECAY = -0.5;

/**
 * Factor constant for stability calculations
 * Used in FSRS memory model
 */
export const FACTOR = 0.9 ** (1 / DECAY) - 1;

/**
 * Data type conversion constants for contract compatibility
 * Contract uses scaled integers for precision
 */
export const SCALE = {
  STABILITY: 100,      // stability * 100 (uint16: 0-655.35 days)
  DIFFICULTY: 10,      // difficulty * 10 (uint8: 0-25.5)
  ELAPSED_DAYS: 10,    // elapsed * 10 (uint16: 0-6553.5 days)
  SCHEDULED_DAYS: 10   // scheduled * 10 (uint16: 0-6553.5 days)
};

/**
 * Minimum stability value (0.01 days = ~15 minutes)
 * Prevents division by zero and ensures reasonable intervals
 */
export const MIN_STABILITY = 0.01;

/**
 * Maximum values for contract compatibility
 */
export const MAX_VALUES = {
  STABILITY: 655.35,      // uint16 max / 100
  DIFFICULTY: 25.5,       // uint8 max / 10
  ELAPSED_DAYS: 6553.5,   // uint16 max / 10
  SCHEDULED_DAYS: 6553.5, // uint16 max / 10
  REPS: 255,              // uint8 max
  LAPSES: 255             // uint8 max
};

/**
 * Default initial difficulty (5.0 on 1-10 scale)
 * Middle difficulty for new cards
 */
export const DEFAULT_DIFFICULTY = 5.0;

/**
 * Difficulty bounds (1-10 scale)
 */
export const MIN_DIFFICULTY = 1.0;
export const MAX_DIFFICULTY = 10.0;
