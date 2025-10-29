import { BigInt, BigDecimal } from "@graphprotocol/graph-ts";
import {
  SongRegistered,
  SongMetadataUpdated,
  SongToggled,
} from "../generated/SongEvents/SongEvents";
import {
  SegmentRegistered,
  SegmentProcessed,
  SegmentToggled,
} from "../generated/SegmentEvents/SegmentEvents";
import {
  TranslationAdded,
  TranslationUpdated,
  TranslationToggled,
} from "../generated/TranslationEvents/TranslationEvents";
import {
  PerformanceGraded,
  PerformanceSubmitted,
} from "../generated/PerformanceGrader/PerformanceGrader";
import {
  AccountCreated,
  AccountMetadataUpdated,
  AccountVerified,
} from "../generated/AccountEvents/AccountEvents";
import {
  Song,
  Segment,
  Performance,
  Account,
  Translation,
  GlobalStats,
} from "../generated/schema";

// Helper to load or create global stats
function loadOrCreateGlobalStats(): GlobalStats {
  let stats = GlobalStats.load("global");
  if (stats == null) {
    stats = new GlobalStats("global");
    stats.totalSongs = 0;
    stats.totalSegments = 0;
    stats.totalPerformances = 0;
    stats.totalAccounts = 0;
    stats.totalTranslations = 0;
    stats.enabledTranslations = 0;
  }
  return stats;
}

// Helper to calculate confidence level from score
function getConfidenceLevel(score: i32): string {
  if (score >= 8000) return "HIGH";
  if (score >= 6000) return "MEDIUM";
  return "LOW";
}

// Helper to check if segment has instrumental/alignments
function updateSegmentProcessingStatus(segment: Segment): void {
  segment.hasInstrumental = segment.instrumentalUri != null && segment.instrumentalUri != "";
  segment.hasAlignments = segment.alignmentUri != null && segment.alignmentUri != "";
}

// ============ Song Event Handlers ============

export function handleSongRegistered(event: SongRegistered): void {
  let song = new Song(event.params.geniusId.toString());
  song.geniusId = event.params.geniusId;
  song.metadataUri = event.params.metadataUri;
  song.registeredBy = event.params.registeredBy;
  song.geniusArtistId = event.params.geniusArtistId;
  song.registeredAt = event.params.timestamp;
  song.segmentCount = 0;
  song.performanceCount = 0;
  song.translationCount = 0;
  song.save();

  let stats = loadOrCreateGlobalStats();
  stats.totalSongs = stats.totalSongs + 1;
  stats.save();
}

export function handleSongMetadataUpdated(event: SongMetadataUpdated): void {
  // Legacy handler - kept for compatibility
  // New segments reference GRC-20 work IDs directly
  let song = Song.load(event.params.geniusId.toString());
  if (song != null) {
    song.metadataUri = event.params.metadataUri;
    song.save();
  }
}

export function handleSongToggled(event: SongToggled): void {
  // Legacy handler - kept for compatibility  
  // Song toggle functionality could be used for enabling/disabling songs
  // For now, we just log it - could extend to add enabled field to Song entity
}

// ============ Segment Event Handlers ============

export function handleSegmentRegistered(event: SegmentRegistered): void {
  let segmentId = event.params.segmentHash.toHexString();
  let segment = new Segment(segmentId);
  segment.segmentHash = event.params.segmentHash;
  
  // Use grc20WorkId as primary reference (public metadata layer)
  segment.grc20WorkId = event.params.grc20WorkId.toString(); // Public GRC-20 reference
  segment.spotifyTrackId = event.params.spotifyTrackId;
  segment.segmentStartMs = event.params.segmentStartMs.toI32();
  segment.segmentEndMs = event.params.segmentEndMs.toI32();
  segment.metadataUri = event.params.metadataUri;
  segment.registeredBy = event.params.registeredBy;
  segment.registeredAt = event.params.timestamp;
  segment.instrumentalUri = null;
  segment.alignmentUri = null;
  segment.processedAt = null;
  segment.translationCount = 0;
  segment.performanceCount = 0;
  segment.averageScore = BigDecimal.zero();
  segment.hasInstrumental = false;
  segment.hasAlignments = false;
  segment.save();

  // No song segment count updates needed since segments reference GRC-20 (not genius IDs)
  // Song counts would be managed at the GRC-20 layer if needed

  let stats = loadOrCreateGlobalStats();
  stats.totalSegments = stats.totalSegments + 1;
  stats.save();
}

export function handleSegmentProcessed(event: SegmentProcessed): void {
  let segmentId = event.params.segmentHash.toHexString();
  let segment = Segment.load(segmentId);

  if (segment != null) {
    segment.instrumentalUri = event.params.instrumentalUri;
    segment.alignmentUri = event.params.alignmentUri;
    segment.translationCount = event.params.translationCount;
    segment.metadataUri = event.params.metadataUri;
    segment.processedAt = event.params.timestamp;
    
    updateSegmentProcessingStatus(segment);
    segment.save();

    // No song translation count updates needed - GRC-20 is the public layer
  }
}

export function handleSegmentToggled(event: SegmentToggled): void {
  let segmentId = event.params.segmentHash.toHexString();
  let segment = Segment.load(segmentId);
  
  if (segment != null) {
    // Could add enabled field to Segment entity if needed
    // For now, just log the toggle event
    segment.save();
  }
}

// ============ Translation Event Handlers ============

export function handleTranslationAdded(event: TranslationAdded): void {
  let translationId = event.params.segmentHash.toHexString() + "-" + event.params.languageCode.toString();
  let translation = new Translation(translationId);
  
  translation.segment = event.params.segmentHash.toHexString();
  translation.segmentHash = event.params.segmentHash;
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

  // Update segment translation count
  let segment = Segment.load(event.params.segmentHash.toHexString());
  if (segment != null) {
    segment.translationCount = segment.translationCount + 1;
    segment.save();

    // No song updates needed - GRC-20 is the public layer
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

// ============ Performance Event Handlers ============

export function handlePerformanceGraded(event: PerformanceGraded): void {
  let performanceId = event.params.performanceId.toString();
  let performance = new Performance(performanceId);
  performance.performanceId = event.params.performanceId;
  performance.segment = event.params.segmentHash.toHexString();
  performance.performer = event.params.performer.toHexString();
  performance.performerAddress = event.params.performer;
  performance.score = event.params.score;
  performance.metadataUri = event.params.metadataUri;
  performance.gradedAt = event.params.timestamp;

  // Load segment to update stats (grc20WorkId already stored)
  let segment = Segment.load(event.params.segmentHash.toHexString());
  if (segment != null) {
    performance.songId = BigInt.zero(); // GRC-20 work ID, not genius ID
    performance.segmentHash = segment.segmentHash;

    // Update segment stats
    let oldAvg = segment.averageScore;
    let oldCount = segment.performanceCount;
    let newCount = oldCount + 1;

    // Calculate new average: (oldAvg * oldCount + newScore) / newCount
    let totalScore = oldAvg.times(BigDecimal.fromString(oldCount.toString()));
    let newScore = BigDecimal.fromString(event.params.score.toString());
    let newTotal = totalScore.plus(newScore);
    let newAvg = newTotal.div(BigDecimal.fromString(newCount.toString()));

    segment.performanceCount = newCount;
    segment.averageScore = newAvg;
    segment.save();

    // No song performance count updates needed - GRC-20 is the public layer
  } else {
    // Fallback if segment not found
    performance.songId = BigInt.zero();
    performance.segmentHash = event.params.segmentHash;
  }

  performance.save();

  // Update or create account
  let accountId = event.params.performer.toHexString();
  let account = Account.load(accountId);
  if (account != null) {
    account.updatedAt = event.params.timestamp;
    account.performanceCount = account.performanceCount + 1;
    account.totalScore = account.totalScore.plus(BigInt.fromI32(event.params.score));
    account.averageScore = account.totalScore
      .toBigDecimal()
      .div(BigDecimal.fromString(account.performanceCount.toString()));
    
    // Update best score
    if (event.params.score > account.bestScore) {
      account.bestScore = event.params.score;
    }
    
    account.save();
  }

  let stats = loadOrCreateGlobalStats();
  stats.totalPerformances = stats.totalPerformances + 1;
  stats.save();
}

export function handlePerformanceSubmitted(event: PerformanceSubmitted): void {
  // Performance submission events are logged but don't require entity creation
  // The actual Performance entity is created when PerformanceGraded event is emitted
  // This allows tracking of submitted vs graded performances if needed
}

// ============ Account Event Handlers ============

export function handleAccountCreated(event: AccountCreated): void {
  let accountId = event.params.lensAccountAddress.toHexString();
  let account = new Account(accountId);
  account.lensAccountAddress = event.params.lensAccountAddress;
  account.pkpAddress = event.params.pkpAddress;
  account.username = event.params.username;
  account.metadataUri = event.params.metadataUri;
  account.geniusArtistId = event.params.geniusArtistId.toI32();
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
