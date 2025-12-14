import { BigInt, BigDecimal, json, JSONValue, JSONValueKind } from "@graphprotocol/graph-ts";
// KaraokeEvents - Clip lifecycle + karaoke grading
import {
  ClipRegistered,
  ClipProcessed,
  ClipToggled,
  ClipLocalizationUpdated,
  SongEncrypted,
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

// Helper to extract a string value from a JSON object by key
function getJsonString(obj: JSONValue, key: string): string | null {
  if (obj.kind != JSONValueKind.OBJECT) return null;
  let objMap = obj.toObject();
  let value = objMap.get(key);
  if (value == null || value.kind != JSONValueKind.STRING) return null;
  return value.toString();
}

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
  let existingClip = Clip.load(clipId);

  if (existingClip != null) {
    // Update existing clip (allows re-emission to update metadata)
    existingClip.clipHash = event.params.clipHash;
    existingClip.spotifyTrackId = event.params.spotifyTrackId;
    existingClip.iswc = event.params.iswc;
    existingClip.title = event.params.title;
    existingClip.artist = event.params.artist;
    existingClip.artistSlug = event.params.artistSlug;
    existingClip.songSlug = event.params.songSlug;
    existingClip.coverUri = event.params.coverUri;
    existingClip.thumbnailUri = event.params.thumbnailUri;
    existingClip.clipStartMs = event.params.clipStartMs.toI32();
    existingClip.clipEndMs = event.params.clipEndMs.toI32();
    existingClip.metadataUri = event.params.metadataUri;
    existingClip.registeredBy = event.params.registeredBy;
    existingClip.registeredAt = event.params.timestamp;
    existingClip.save();
    return;
  }

  // Create new clip
  let clip = new Clip(clipId);
  clip.clipHash = event.params.clipHash;
  clip.spotifyTrackId = event.params.spotifyTrackId;
  clip.iswc = event.params.iswc;
  clip.title = event.params.title;
  clip.artist = event.params.artist;
  clip.artistSlug = event.params.artistSlug;
  clip.songSlug = event.params.songSlug;
  clip.coverUri = event.params.coverUri;
  clip.thumbnailUri = event.params.thumbnailUri;
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
  clip.performanceCount = 0;
  clip.averageScore = BigDecimal.zero();
  clip.hasInstrumental = false;
  clip.hasAlignments = false;
  clip.hasEncryptedFull = false;
  clip.studyCount = 0;
  clip.genres = [];
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
    // Treat empty string as "not provided" to keep entity data clean.
    let alignmentUri = event.params.alignmentUri;
    clip.alignmentUri = alignmentUri.length > 0 ? alignmentUri : null;
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

    updateClipProcessingStatus(clip);
    clip.save();
  }
}

export function handleClipLocalizationUpdated(event: ClipLocalizationUpdated): void {
  let clipId = event.params.clipHash.toHexString();
  let clip = Clip.load(clipId);

  if (clip != null) {
    // Parse JSON localizations string
    // Format: {"title_zh":"...","artist_zh":"...","title_es":"...",...}
    let localizationsStr = event.params.localizations;
    if (localizationsStr.length > 0) {
      let parsed = json.try_fromString(localizationsStr);
      if (parsed.isOk) {
        let obj = parsed.value;

        // Extract all title localizations
        let title_zh = getJsonString(obj, "title_zh");
        let title_vi = getJsonString(obj, "title_vi");
        let title_id = getJsonString(obj, "title_id");
        let title_ja = getJsonString(obj, "title_ja");
        let title_ko = getJsonString(obj, "title_ko");
        let title_es = getJsonString(obj, "title_es");
        let title_pt = getJsonString(obj, "title_pt");
        let title_ar = getJsonString(obj, "title_ar");
        let title_tr = getJsonString(obj, "title_tr");
        let title_ru = getJsonString(obj, "title_ru");
        let title_hi = getJsonString(obj, "title_hi");
        let title_th = getJsonString(obj, "title_th");

        // Extract all artist localizations
        let artist_zh = getJsonString(obj, "artist_zh");
        let artist_vi = getJsonString(obj, "artist_vi");
        let artist_id = getJsonString(obj, "artist_id");
        let artist_ja = getJsonString(obj, "artist_ja");
        let artist_ko = getJsonString(obj, "artist_ko");
        let artist_es = getJsonString(obj, "artist_es");
        let artist_pt = getJsonString(obj, "artist_pt");
        let artist_ar = getJsonString(obj, "artist_ar");
        let artist_tr = getJsonString(obj, "artist_tr");
        let artist_ru = getJsonString(obj, "artist_ru");
        let artist_hi = getJsonString(obj, "artist_hi");
        let artist_th = getJsonString(obj, "artist_th");

        // Set fields (only update if value present in JSON)
        if (title_zh != null) clip.title_zh = title_zh;
        if (title_vi != null) clip.title_vi = title_vi;
        if (title_id != null) clip.title_id = title_id;
        if (title_ja != null) clip.title_ja = title_ja;
        if (title_ko != null) clip.title_ko = title_ko;
        if (title_es != null) clip.title_es = title_es;
        if (title_pt != null) clip.title_pt = title_pt;
        if (title_ar != null) clip.title_ar = title_ar;
        if (title_tr != null) clip.title_tr = title_tr;
        if (title_ru != null) clip.title_ru = title_ru;
        if (title_hi != null) clip.title_hi = title_hi;
        if (title_th != null) clip.title_th = title_th;

        if (artist_zh != null) clip.artist_zh = artist_zh;
        if (artist_vi != null) clip.artist_vi = artist_vi;
        if (artist_id != null) clip.artist_id = artist_id;
        if (artist_ja != null) clip.artist_ja = artist_ja;
        if (artist_ko != null) clip.artist_ko = artist_ko;
        if (artist_es != null) clip.artist_es = artist_es;
        if (artist_pt != null) clip.artist_pt = artist_pt;
        if (artist_ar != null) clip.artist_ar = artist_ar;
        if (artist_tr != null) clip.artist_tr = artist_tr;
        if (artist_ru != null) clip.artist_ru = artist_ru;
        if (artist_hi != null) clip.artist_hi = artist_hi;
        if (artist_th != null) clip.artist_th = artist_th;
      }
    }

    // Parse genres JSON string into array
    let genresStr = event.params.genres;
    if (genresStr.length > 0) {
      // Simple JSON array parsing: ["genre1", "genre2"]
      // Remove brackets and split by comma
      let stripped = genresStr.slice(1, genresStr.length - 1); // Remove [ and ]
      if (stripped.length > 0) {
        let genres: string[] = [];
        let parts = stripped.split(",");
        for (let i = 0; i < parts.length; i++) {
          // Remove quotes and trim whitespace
          let genre = parts[i].trim();
          if (genre.startsWith('"') && genre.endsWith('"')) {
            genre = genre.slice(1, genre.length - 1);
          }
          if (genre.length > 0) {
            genres.push(genre);
          }
        }
        clip.genres = genres;
      }
    }

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
  translation.validated = false;
  translation.addedBy = event.params.addedBy;
  translation.addedAt = event.params.timestamp;
  translation.updatedAt = event.params.timestamp;
  translation.enabled = true;
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
  card.spotifyTrackId = event.params.spotifyTrackId;
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

  // Link to clip if it exists and increment studyCount for trending
  let clipId = event.params.clipHash.toHexString();
  let clip = Clip.load(clipId);
  if (clip != null) {
    session.clip = clipId;
    // Increment study count for trending
    clip.studyCount = clip.studyCount + 1;
    clip.save();
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
