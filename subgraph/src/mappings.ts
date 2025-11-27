import { BigInt, BigDecimal } from "@graphprotocol/graph-ts";
// ClipEvents - Clip registration, processing, encryption
import {
  ClipRegistered,
  ClipProcessed,
  ClipToggled,
  SongEncrypted,
} from "../generated/ClipEvents/ClipEvents";
// KaraokeEvents - Session tracking only
import {
  KaraokePerformanceGraded,
  KaraokeSessionStarted,
  KaraokeLineGraded,
  KaraokeSessionEnded,
} from "../generated/KaraokeEvents/KaraokeEvents";
import {
  TranslationAdded,
  TranslationUpdated,
  TranslationToggled,
} from "../generated/TranslationEvents/TranslationEvents";
import {
  TranslationQuestionRegistered,
  TriviaQuestionRegistered,
  SayItBackAttemptGraded,
  MultipleChoiceAttemptGraded,
  QuestionToggled,
} from "../generated/ExerciseEvents/ExerciseEvents";
import {
  AccountCreated,
  AccountMetadataUpdated,
  AccountVerified,
} from "../generated/AccountEvents/AccountEvents";
import {
  Clip,
  Performance,
  Account,
  Translation,
  GlobalStats,
  LineCard,
  LinePerformance,
  ExerciseCard,
  ExerciseAttempt,
  KaraokeSession,
  KaraokeLineScore,
} from "./entities";

// Helper to load or create global stats
function loadOrCreateGlobalStats(): GlobalStats {
  let stats = GlobalStats.load("global");
  if (stats == null) {
    stats = new GlobalStats("global");
    stats.totalClips = 0;
    stats.totalPerformances = 0;
    stats.totalAccounts = 0;
    stats.totalTranslations = 0;
    stats.enabledTranslations = 0;
    stats.totalExerciseCards = 0;
    stats.totalExerciseAttempts = 0;
    stats.totalKaraokeSessions = 0;
    stats.completedKaraokeSessions = 0;
  }
  return stats;
}

// Helper to calculate confidence level from score
function getConfidenceLevel(score: i32): string {
  if (score >= 8000) return "HIGH";
  if (score >= 6000) return "MEDIUM";
  return "LOW";
}

// Helper to check if clip has instrumental/alignments
function updateClipProcessingStatus(clip: Clip): void {
  clip.hasInstrumental = clip.instrumentalUri != null && clip.instrumentalUri != "";
  clip.hasAlignments = clip.alignmentUri != null && clip.alignmentUri != "";
  clip.hasEncryptedFull = clip.encryptedFullUri != null && clip.encryptedFullUri != "";
}

function updateExerciseCardAverages(card: ExerciseCard, newScore: i32): void {
  let oldAvg = card.averageScore;
  let oldCount = card.attemptCount;
  let newCount = oldCount + 1;

  let totalScore = oldAvg.times(BigDecimal.fromString(oldCount.toString()));
  let newScoreDecimal = BigDecimal.fromString(newScore.toString());
  let newTotal = totalScore.plus(newScoreDecimal);
  card.attemptCount = newCount;
  card.averageScore = newTotal.div(BigDecimal.fromString(newCount.toString()));
}

// ============ Clip Event Handlers ============

export function handleClipRegistered(event: ClipRegistered): void {
  let clipId = event.params.clipHash.toHexString();
  let clip = new Clip(clipId);
  clip.clipHash = event.params.clipHash;
  clip.grc20WorkId = event.params.grc20WorkId;
  clip.spotifyTrackId = event.params.spotifyTrackId;
  clip.clipStartMs = event.params.clipStartMs.toI32();
  clip.clipEndMs = event.params.clipEndMs.toI32();
  clip.metadataUri = event.params.metadataUri;
  clip.registeredBy = event.params.registeredBy;
  clip.registeredAt = event.params.timestamp;
  clip.artistLensHandle = null;
  clip.instrumentalUri = null;
  clip.alignmentUri = null;
  clip.processedAt = null;
  clip.translationCount = 0;
  clip.encryptedFullUri = null;
  clip.encryptedManifestUri = null;
  clip.unlockLockAddress = null;
  clip.unlockChainId = 0;
  clip.performanceCount = 0;
  clip.averageScore = BigDecimal.zero();
  clip.hasInstrumental = false;
  clip.hasAlignments = false;
  clip.hasEncryptedFull = false;
  clip.save();

  let stats = loadOrCreateGlobalStats();
  stats.totalClips = stats.totalClips + 1;
  stats.save();
}

export function handleClipProcessed(event: ClipProcessed): void {
  let clipId = event.params.clipHash.toHexString();
  let clip = Clip.load(clipId);

  if (clip != null) {
    clip.instrumentalUri = event.params.instrumentalUri;
    clip.alignmentUri = event.params.alignmentUri;
    clip.translationCount = event.params.translationCount;
    clip.metadataUri = event.params.metadataUri;
    clip.processedAt = event.params.timestamp;

    updateClipProcessingStatus(clip);
    clip.save();
  }
}

export function handleClipToggled(event: ClipToggled): void {
  let clipId = event.params.clipHash.toHexString();
  let clip = Clip.load(clipId);

  if (clip != null) {
    clip.save();
  }
}

export function handleSongEncrypted(event: SongEncrypted): void {
  let clipId = event.params.clipHash.toHexString();
  let clip = Clip.load(clipId);

  if (clip != null) {
    clip.encryptedFullUri = event.params.encryptedFullUri;
    clip.encryptedManifestUri = event.params.encryptedManifestUri;
    clip.unlockLockAddress = event.params.unlockLockAddress;
    clip.unlockChainId = event.params.unlockChainId.toI32();

    updateClipProcessingStatus(clip);
    clip.save();
  }
}

// ============ Translation Event Handlers ============

export function handleTranslationAdded(event: TranslationAdded): void {
  let clipHashHex = event.params.segmentHash.toHexString();
  let translationId = clipHashHex + "-" + event.params.languageCode.toString();
  let translation = new Translation(translationId);

  translation.clip = clipHashHex;
  translation.clipHash = event.params.segmentHash;
  translation.languageCode = event.params.languageCode.toString();
  translation.translationUri = event.params.translationUri;
  translation.translationSource = event.params.translationSource;
  translation.confidenceScore = event.params.confidenceScore; // Already i32
  translation.validated = event.params.validated;
  translation.addedBy = event.params.addedBy;
  translation.addedAt = event.params.timestamp;
  translation.updatedAt = event.params.timestamp;
  translation.enabled = true;
  translation.confidenceLevel = getConfidenceLevel(event.params.confidenceScore);
  translation.save();

  // Update clip translation count
  let clip = Clip.load(clipHashHex);
  if (clip != null) {
    clip.translationCount = clip.translationCount + 1;
    clip.save();
  }

  let stats = loadOrCreateGlobalStats();
  stats.totalTranslations = stats.totalTranslations + 1;
  stats.enabledTranslations = stats.enabledTranslations + 1;
  stats.save();
}

export function handleTranslationUpdated(event: TranslationUpdated): void {
  let translationId = event.params.segmentHash.toHexString() + "-" + event.params.languageCode.toString();
  let translation = Translation.load(translationId);

  if (translation != null) {
    translation.translationUri = event.params.translationUri;
    translation.validated = event.params.validated;
    translation.updatedAt = event.params.timestamp;
    translation.save();
  }
}

export function handleTranslationToggled(event: TranslationToggled): void {
  let translationId = event.params.segmentHash.toHexString() + "-" + event.params.languageCode.toString();
  let translation = Translation.load(translationId);

  if (translation != null) {
    translation.enabled = event.params.enabled;
    translation.updatedAt = event.params.timestamp;
    translation.save();

    // Update global stats
    let stats = loadOrCreateGlobalStats();
    if (event.params.enabled) {
      stats.enabledTranslations = stats.enabledTranslations + 1;
    } else {
      stats.enabledTranslations = stats.enabledTranslations - 1;
    }
    stats.save();
  }
}

// ============ Exercise Event Handlers ============

export function handleTranslationQuestionRegistered(event: TranslationQuestionRegistered): void {
  let cardId = event.params.questionId.toHexString();
  let card = new ExerciseCard(cardId);
  card.questionId = event.params.questionId;
  card.exerciseType = "TRANSLATION_MULTIPLE_CHOICE";
  card.spotifyTrackId = event.params.spotifyTrackId;
  card.languageCode = event.params.languageCode;
  card.metadataUri = event.params.metadataUri;
  card.distractorPoolSize = event.params.distractorPoolSize;
  card.enabled = true;
  card.createdAt = event.params.timestamp;
  card.registeredBy = event.params.registeredBy;
  card.clipHash = event.params.segmentHash;
  card.lineId = event.params.lineId;
  card.lineIndex = event.params.lineIndex;
  let clipId = event.params.segmentHash.toHexString();
  let lineId = event.params.lineId.toHexString();

  let lineCard = LineCard.load(lineId);
  if (lineCard == null) {
    lineCard = new LineCard(lineId);
    lineCard.lineId = event.params.lineId;
    lineCard.clipHash = event.params.segmentHash;
    lineCard.lineIndex = event.params.lineIndex;
    lineCard.clip = clipId;
    lineCard.performanceCount = 0;
    lineCard.averageScore = BigDecimal.zero();
    lineCard.save();
  }

  card.clip = clipId;
  card.line = lineId;

  card.attemptCount = 0;
  card.averageScore = BigDecimal.zero();
  card.save();

  let stats = loadOrCreateGlobalStats();
  stats.totalExerciseCards = stats.totalExerciseCards + 1;
  stats.save();
}

export function handleTriviaQuestionRegistered(event: TriviaQuestionRegistered): void {
  let cardId = event.params.questionId.toHexString();
  let card = new ExerciseCard(cardId);
  card.questionId = event.params.questionId;
  card.exerciseType = "TRIVIA_MULTIPLE_CHOICE";
  card.spotifyTrackId = event.params.spotifyTrackId; // Now a string, not indexed bytes
  card.languageCode = event.params.languageCode;
  card.metadataUri = event.params.metadataUri;
  card.distractorPoolSize = event.params.distractorPoolSize;
  card.enabled = true;
  card.createdAt = event.params.timestamp;
  card.registeredBy = event.params.registeredBy;

  // Trivia questions are song-level; leave clip/line fields null
  card.attemptCount = 0;
  card.averageScore = BigDecimal.zero();
  card.save();

  let stats = loadOrCreateGlobalStats();
  stats.totalExerciseCards = stats.totalExerciseCards + 1;
  stats.save();
}

export function handleSayItBackAttemptGraded(event: SayItBackAttemptGraded): void {
  let cardId = event.params.lineId.toHexString();
  let card = ExerciseCard.load(cardId);

  if (card == null) {
    card = new ExerciseCard(cardId);
    card.questionId = event.params.lineId;
    card.exerciseType = "SAY_IT_BACK";

    let clipId = event.params.segmentHash.toHexString();
    card.clip = clipId;
    card.clipHash = event.params.segmentHash;
    card.line = cardId;
    card.lineId = event.params.lineId;
    card.lineIndex = event.params.lineIndex;

    let clip = Clip.load(clipId);
    if (clip != null) {
      card.spotifyTrackId = clip.spotifyTrackId;
    } else {
      card.spotifyTrackId = "";
    }

    card.languageCode = "en"; // default placeholder; actual language derived from metadata
    card.metadataUri = "";
    card.distractorPoolSize = 0;
    card.enabled = true;
    card.createdAt = event.params.timestamp;
    card.registeredBy = event.transaction.from;
    card.attemptCount = 0;
    card.averageScore = BigDecimal.zero();
  }

  let attemptId = event.params.attemptId.toString();
  let attempt = new ExerciseAttempt(attemptId);
  attempt.attemptId = event.params.attemptId;
  attempt.card = card.id;
  attempt.questionId = card.questionId;
  let accountId = event.params.learner.toHexString();
  attempt.performer = accountId;
  attempt.performerAddress = event.params.learner;
  attempt.score = event.params.score;
  attempt.rating = event.params.rating;
  attempt.metadataUri = event.params.metadataUri;
  attempt.gradedAt = event.params.timestamp;
  attempt.save();

  updateExerciseCardAverages(card, event.params.score);
  card.save();

  let stats = loadOrCreateGlobalStats();
  stats.totalExerciseAttempts = stats.totalExerciseAttempts + 1;
  stats.save();

  // Mirror the event into LinePerformance so FSRS can track attempts without PerformanceGrader
  let lineCardId = event.params.lineId.toHexString();
  let clipId = event.params.segmentHash.toHexString();
  let lineCard = LineCard.load(lineCardId);

  if (lineCard == null) {
    lineCard = new LineCard(lineCardId);
    lineCard.lineId = event.params.lineId;
    lineCard.clipHash = event.params.segmentHash;
    lineCard.lineIndex = event.params.lineIndex;
    lineCard.clip = clipId;
    lineCard.performanceCount = 0;
    lineCard.averageScore = BigDecimal.zero();
  } else {
    lineCard.clip = clipId;
    lineCard.clipHash = event.params.segmentHash;
    lineCard.lineIndex = event.params.lineIndex;
  }

  let linePerformanceId = event.params.attemptId.toString();
  let linePerformance = LinePerformance.load(linePerformanceId);
  let isNewPerformance = false;
  if (linePerformance == null) {
    linePerformance = new LinePerformance(linePerformanceId);
    isNewPerformance = true;
  }
  linePerformance.performanceId = event.params.attemptId;
  linePerformance.line = lineCard.id;
  linePerformance.lineId = event.params.lineId;
  linePerformance.clip = clipId;
  linePerformance.clipHash = event.params.segmentHash;
  linePerformance.lineIndex = event.params.lineIndex;
  linePerformance.performer = accountId;
  linePerformance.performerAddress = event.params.learner;
  linePerformance.score = event.params.score;
  linePerformance.metadataUri = event.params.metadataUri;
  linePerformance.gradedAt = event.params.timestamp;
  linePerformance.save();

  if (isNewPerformance) {
    let previousAvg = lineCard.averageScore;
    let previousCount = lineCard.performanceCount;
    let updatedCount = previousCount + 1;
    let updatedTotal = previousAvg
      .times(BigDecimal.fromString(previousCount.toString()))
      .plus(BigDecimal.fromString(event.params.score.toString()));
    lineCard.performanceCount = updatedCount;
    lineCard.averageScore = updatedTotal.div(BigDecimal.fromString(updatedCount.toString()));
  }
  lineCard.save();

  let account = Account.load(accountId);
  if (account != null) {
    account.updatedAt = event.params.timestamp;
    if (isNewPerformance) {
      account.performanceCount = account.performanceCount + 1;
      account.totalScore = account.totalScore.plus(BigInt.fromI32(event.params.score));
      account.averageScore = account.totalScore
        .toBigDecimal()
        .div(BigDecimal.fromString(account.performanceCount.toString()));
      if (event.params.score > account.bestScore) {
        account.bestScore = event.params.score;
      }
    }
    account.save();
  }

  if (isNewPerformance) {
    stats.totalPerformances = stats.totalPerformances + 1;
    stats.save();
  }
}

export function handleMultipleChoiceAttemptGraded(event: MultipleChoiceAttemptGraded): void {
  let cardId = event.params.questionId.toHexString();
  let card = ExerciseCard.load(cardId);
  if (card == null) {
    // If a grading event arrives before registration, create placeholder to avoid null references
    card = new ExerciseCard(cardId);
    card.questionId = event.params.questionId;
    card.exerciseType = "TRANSLATION_MULTIPLE_CHOICE";
    card.spotifyTrackId = "";
    card.languageCode = "";
    card.metadataUri = "";
    card.distractorPoolSize = 0;
    card.enabled = true;
    card.createdAt = event.params.timestamp;
    card.registeredBy = event.transaction.from;
    card.attemptCount = 0;
    card.averageScore = BigDecimal.zero();
  }

  let attemptId = event.params.attemptId.toString();
  let attempt = new ExerciseAttempt(attemptId);
  attempt.attemptId = event.params.attemptId;
  attempt.card = card.id;
  attempt.questionId = event.params.questionId;
  let accountId = event.params.learner.toHexString();
  attempt.performer = accountId;
  attempt.performerAddress = event.params.learner;
  attempt.score = event.params.score;
  attempt.rating = event.params.rating;
  attempt.metadataUri = event.params.metadataUri;
  attempt.gradedAt = event.params.timestamp;
  attempt.save();

  updateExerciseCardAverages(card, event.params.score);
  card.save();

  let stats = loadOrCreateGlobalStats();
  stats.totalExerciseAttempts = stats.totalExerciseAttempts + 1;
  stats.save();
}

export function handleQuestionToggled(event: QuestionToggled): void {
  let cardId = event.params.questionId.toHexString();
  let card = ExerciseCard.load(cardId);
  if (card != null) {
    card.enabled = event.params.enabled;
    card.save();
  }
}

// ============ Account Event Handlers ============

export function handleAccountCreated(event: AccountCreated): void {
  let accountId = event.params.lensAccountAddress.toHexString();
  let account = new Account(accountId);
  account.lensAccountAddress = event.params.lensAccountAddress;
  account.pkpAddress = event.params.pkpAddress;
  account.username = event.params.username;
  account.metadataUri = event.params.metadataUri;
  account.createdAt = event.params.timestamp;
  account.updatedAt = event.params.timestamp;
  account.verified = false; // Default to unverified
  account.performanceCount = 0;
  account.totalScore = BigInt.zero();
  account.averageScore = BigDecimal.zero();
  account.bestScore = 0;
  account.save();

  let stats = loadOrCreateGlobalStats();
  stats.totalAccounts = stats.totalAccounts + 1;
  stats.save();
}

export function handleAccountMetadataUpdated(event: AccountMetadataUpdated): void {
  let accountId = event.params.lensAccountAddress.toHexString();
  let account = Account.load(accountId);

  if (account != null) {
    account.metadataUri = event.params.metadataUri;
    account.updatedAt = event.params.timestamp;
    account.save();
  }
}

export function handleAccountVerified(event: AccountVerified): void {
  let accountId = event.params.lensAccountAddress.toHexString();
  let account = Account.load(accountId);

  if (account != null) {
    account.verified = event.params.verified;
    account.updatedAt = event.params.timestamp;
    account.save();
  }
}

export function handleKaraokePerformanceGraded(event: KaraokePerformanceGraded): void {
  let performanceId = event.params.performanceId.toString();
  let performance = new Performance(performanceId);
  performance.performanceId = event.params.performanceId;
  let clipId = event.params.clipHash.toHexString();
  performance.clip = clipId;
  performance.performer = event.params.performer.toHexString();
  performance.performerAddress = event.params.performer;
  performance.score = event.params.similarityScore;
  performance.metadataUri = event.params.metadataUri;
  performance.gradedAt = event.params.timestamp;

  // Load clip to update stats
  let clip = Clip.load(clipId);
  if (clip != null) {
    performance.clipHash = clip.clipHash;

    // Update clip stats
    let oldAvg = clip.averageScore;
    let oldCount = clip.performanceCount;
    let newCount = oldCount + 1;

    // Calculate new average
    let totalScore = oldAvg.times(BigDecimal.fromString(oldCount.toString()));
    let newScore = BigDecimal.fromString(event.params.similarityScore.toString());
    let newTotal = totalScore.plus(newScore);
    let newAvg = newTotal.div(BigDecimal.fromString(newCount.toString()));

    clip.performanceCount = newCount;
    clip.averageScore = newAvg;
    clip.save();
  }

  // Update account stats
  let accountId = event.params.performer.toHexString();
  let account = Account.load(accountId);

  if (account != null) {
    let oldAvg = account.averageScore;
    let oldCount = account.performanceCount;
    let newCount = oldCount + 1;

    let totalScore = oldAvg.times(BigDecimal.fromString(oldCount.toString()));
    let newScore = BigDecimal.fromString(event.params.similarityScore.toString());
    let newTotal = totalScore.plus(newScore);
    let newAvg = newTotal.div(BigDecimal.fromString(newCount.toString()));

    account.performanceCount = newCount;
    account.averageScore = newAvg;
    account.save();
  }

  performance.save();

  // Update global stats
  let stats = loadOrCreateGlobalStats();
  stats.totalPerformances = stats.totalPerformances + 1;
  stats.save();
}

// ============ Karaoke Session Event Handlers ============

export function handleKaraokeSessionStarted(event: KaraokeSessionStarted): void {
  let sessionId = event.params.sessionId.toHexString();
  let session = new KaraokeSession(sessionId);
  session.sessionId = event.params.sessionId;
  session.clipHash = event.params.clipHash;
  session.performer = event.params.performer;
  session.expectedLineCount = event.params.expectedLineCount;
  session.completedLineCount = 0;
  session.aggregateScore = 0;
  session.isCompleted = false;
  session.wasAbandoned = false;
  session.startedAt = event.params.timestamp;
  session.endedAt = null;

  // Link to clip if it exists
  let clipId = event.params.clipHash.toHexString();
  let clip = Clip.load(clipId);
  if (clip != null) {
    session.clip = clipId;
  } else {
    // Create a placeholder reference; the clip entity must exist for the relation
    session.clip = clipId;
  }

  session.save();

  let stats = loadOrCreateGlobalStats();
  stats.totalKaraokeSessions = stats.totalKaraokeSessions + 1;
  stats.save();
}

export function handleKaraokeLineGraded(event: KaraokeLineGraded): void {
  let sessionId = event.params.sessionId.toHexString();
  let session = KaraokeSession.load(sessionId);

  if (session == null) {
    // Session should exist; if not, skip this event
    return;
  }

  // Create line score entity
  let lineScoreId = sessionId + "-" + event.params.lineIndex.toString();
  let lineScore = new KaraokeLineScore(lineScoreId);
  lineScore.session = sessionId;
  lineScore.sessionId = event.params.sessionId;
  lineScore.lineIndex = event.params.lineIndex;
  lineScore.score = event.params.score;
  lineScore.rating = event.params.rating;
  lineScore.metadataUri = event.params.metadataUri;
  lineScore.timestamp = event.params.timestamp;
  lineScore.save();

  // Update session aggregates
  // Increment completed line count
  session.completedLineCount = session.completedLineCount + 1;

  // Recalculate aggregate score (running average)
  let oldTotal = session.aggregateScore * (session.completedLineCount - 1);
  let newTotal = oldTotal + event.params.score;
  session.aggregateScore = newTotal / session.completedLineCount;

  session.save();
}

export function handleKaraokeSessionEnded(event: KaraokeSessionEnded): void {
  let sessionId = event.params.sessionId.toHexString();
  let session = KaraokeSession.load(sessionId);

  if (session == null) {
    return;
  }

  session.isCompleted = event.params.completed;
  session.wasAbandoned = !event.params.completed;
  session.endedAt = event.params.timestamp;
  session.save();

  // Update global stats for completed sessions
  if (event.params.completed) {
    let stats = loadOrCreateGlobalStats();
    stats.completedKaraokeSessions = stats.completedKaraokeSessions + 1;
    stats.save();
  }
}
