import { BigInt, BigDecimal } from "@graphprotocol/graph-ts";
import {
  SongRegistered,
} from "../generated/SongEvents/SongEvents";
import {
  SegmentRegistered,
  SegmentProcessed,
} from "../generated/SegmentEvents/SegmentEvents";
import {
  PerformanceGraded,
} from "../generated/PerformanceGrader/PerformanceGrader";
import {
  AccountCreated,
  AccountMetadataUpdated,
} from "../generated/AccountEvents/AccountEvents";
import {
  Song,
  Segment,
  Performance,
  Account,
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
  }
  return stats;
}

export function handleSongRegistered(event: SongRegistered): void {
  let song = new Song(event.params.geniusId.toString());
  song.geniusId = event.params.geniusId;
  song.metadataUri = event.params.metadataUri;
  song.registeredBy = event.params.registeredBy;
  song.geniusArtistId = event.params.geniusArtistId;
  song.registeredAt = event.params.timestamp;
  song.segmentCount = 0;
  song.performanceCount = 0;
  song.save();

  let stats = loadOrCreateGlobalStats();
  stats.totalSongs = stats.totalSongs + 1;
  stats.save();
}

export function handleSegmentRegistered(event: SegmentRegistered): void {
  let segmentId = event.params.segmentHash.toHexString();
  let segment = new Segment(segmentId);
  segment.segmentHash = event.params.segmentHash;
  segment.song = event.params.geniusId.toString();
  segment.geniusId = event.params.geniusId;
  segment.tiktokSegmentId = event.params.tiktokSegmentId;
  segment.metadataUri = event.params.metadataUri;
  segment.registeredBy = event.params.registeredBy;
  segment.registeredAt = event.params.timestamp;
  segment.instrumentalUri = null;
  segment.alignmentUri = null;
  segment.processedAt = null;
  segment.performanceCount = 0;
  segment.averageScore = BigDecimal.zero();
  segment.save();

  // Update song segment count
  let song = Song.load(event.params.geniusId.toString());
  if (song != null) {
    song.segmentCount = song.segmentCount + 1;
    song.save();
  }

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
    segment.metadataUri = event.params.metadataUri;
    segment.processedAt = event.params.timestamp;
    segment.save();
  }
}

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

  // Load segment to get songId
  let segment = Segment.load(event.params.segmentHash.toHexString());
  if (segment != null) {
    performance.songId = segment.geniusId;
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

    // Update song performance count
    let song = Song.load(segment.geniusId.toString());
    if (song != null) {
      song.performanceCount = song.performanceCount + 1;
      song.save();
    }
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
    account.save();
  }

  let stats = loadOrCreateGlobalStats();
  stats.totalPerformances = stats.totalPerformances + 1;
  stats.save();
}

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
  account.performanceCount = 0;
  account.totalScore = BigInt.zero();
  account.averageScore = BigDecimal.zero();
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
