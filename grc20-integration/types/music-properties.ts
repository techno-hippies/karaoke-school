/**
 * GRC-20 Property Definitions - Comprehensive Music Metadata
 *
 * Creates all properties needed for rich artist and work metadata
 */

import { Graph, type Op } from '@graphprotocol/grc-20';

export async function createMusicProperties() {
  const ops: Op[] = [];
  const properties: Record<string, string> = {};

  // ============ Core Metadata ============

  const { id: name, ops: nameOps } = Graph.createProperty({
    name: 'Name',
    dataType: 'STRING',
  });
  ops.push(...nameOps);
  properties.name = name;

  const { id: title, ops: titleOps } = Graph.createProperty({
    name: 'Title',
    dataType: 'STRING',
  });
  ops.push(...titleOps);
  properties.title = title;

  const { id: description, ops: descOps } = Graph.createProperty({
    name: 'Description',
    dataType: 'STRING',
  });
  ops.push(...descOps);
  properties.description = description;

  // ============ External IDs (Primary) ============

  const { id: geniusId, ops: geniusIdOps } = Graph.createProperty({
    name: 'Genius ID',
    dataType: 'NUMBER',
  });
  ops.push(...geniusIdOps);
  properties.geniusId = geniusId;

  const { id: geniusUrl, ops: geniusUrlOps } = Graph.createProperty({
    name: 'Genius URL',
    dataType: 'STRING',
  });
  ops.push(...geniusUrlOps);
  properties.geniusUrl = geniusUrl;

  const { id: spotifyId, ops: spotifyIdOps } = Graph.createProperty({
    name: 'Spotify ID',
    dataType: 'STRING',
  });
  ops.push(...spotifyIdOps);
  properties.spotifyId = spotifyId;

  const { id: spotifyUrl, ops: spotifyUrlOps } = Graph.createProperty({
    name: 'Spotify URL',
    dataType: 'STRING',
  });
  ops.push(...spotifyUrlOps);
  properties.spotifyUrl = spotifyUrl;

  const { id: appleMusicId, ops: appleMusicIdOps } = Graph.createProperty({
    name: 'Apple Music ID',
    dataType: 'STRING',
  });
  ops.push(...appleMusicIdOps);
  properties.appleMusicId = appleMusicId;

  const { id: appleMusicUrl, ops: appleMusicUrlOps } = Graph.createProperty({
    name: 'Apple Music URL',
    dataType: 'STRING',
  });
  ops.push(...appleMusicUrlOps);
  properties.appleMusicUrl = appleMusicUrl;

  const { id: mbid, ops: mbidOps } = Graph.createProperty({
    name: 'MusicBrainz ID',
    dataType: 'STRING',
  });
  ops.push(...mbidOps);
  properties.mbid = mbid;

  const { id: wikidataId, ops: wikidataOps } = Graph.createProperty({
    name: 'Wikidata ID',
    dataType: 'STRING',
  });
  ops.push(...wikidataOps);
  properties.wikidataId = wikidataId;

  const { id: discogsId, ops: discogsOps } = Graph.createProperty({
    name: 'Discogs ID',
    dataType: 'STRING',
  });
  ops.push(...discogsOps);
  properties.discogsId = discogsId;

  // ============ Industry Identifiers ============

  const { id: isrc, ops: isrcOps } = Graph.createProperty({
    name: 'ISRC',
    dataType: 'STRING',
  });
  ops.push(...isrcOps);
  properties.isrc = isrc;

  const { id: iswc, ops: iswcOps } = Graph.createProperty({
    name: 'ISWC',
    dataType: 'STRING',
  });
  ops.push(...iswcOps);
  properties.iswc = iswc;

  const { id: isni, ops: isniOps } = Graph.createProperty({
    name: 'ISNI',
    dataType: 'STRING',
  });
  ops.push(...isniOps);
  properties.isni = isni;

  const { id: ipi, ops: ipiOps } = Graph.createProperty({
    name: 'IPI',
    dataType: 'STRING',
  });
  ops.push(...ipiOps);
  properties.ipi = ipi;

  // ============ Social Media Handles ============

  const { id: instagramHandle, ops: instagramOps } = Graph.createProperty({
    name: 'Instagram Handle',
    dataType: 'STRING',
  });
  ops.push(...instagramOps);
  properties.instagramHandle = instagramHandle;

  const { id: tiktokHandle, ops: tiktokOps } = Graph.createProperty({
    name: 'TikTok Handle',
    dataType: 'STRING',
  });
  ops.push(...tiktokOps);
  properties.tiktokHandle = tiktokHandle;

  const { id: twitterHandle, ops: twitterOps } = Graph.createProperty({
    name: 'Twitter Handle',
    dataType: 'STRING',
  });
  ops.push(...twitterOps);
  properties.twitterHandle = twitterHandle;

  const { id: facebookHandle, ops: facebookOps } = Graph.createProperty({
    name: 'Facebook Handle',
    dataType: 'STRING',
  });
  ops.push(...facebookOps);
  properties.facebookHandle = facebookHandle;

  const { id: youtubeChannel, ops: youtubeOps } = Graph.createProperty({
    name: 'YouTube Channel',
    dataType: 'STRING',
  });
  ops.push(...youtubeOps);
  properties.youtubeChannel = youtubeChannel;

  const { id: soundcloudHandle, ops: soundcloudOps } = Graph.createProperty({
    name: 'SoundCloud Handle',
    dataType: 'STRING',
  });
  ops.push(...soundcloudOps);
  properties.soundcloudHandle = soundcloudHandle;

  // ============ Visual Assets ============

  const { id: imageUrl, ops: imageOps } = Graph.createProperty({
    name: 'Image URL',
    dataType: 'STRING',
  });
  ops.push(...imageOps);
  properties.imageUrl = imageUrl;

  const { id: headerImageUrl, ops: headerImageOps } = Graph.createProperty({
    name: 'Header Image URL',
    dataType: 'STRING',
  });
  ops.push(...headerImageOps);
  properties.headerImageUrl = headerImageUrl;

  // ============ Biographical (Artists) ============

  const { id: artistType, ops: typeOps } = Graph.createProperty({
    name: 'Artist Type',
    dataType: 'STRING',
  });
  ops.push(...typeOps);
  properties.artistType = artistType;

  const { id: country, ops: countryOps } = Graph.createProperty({
    name: 'Country',
    dataType: 'STRING',
  });
  ops.push(...countryOps);
  properties.country = country;

  const { id: gender, ops: genderOps } = Graph.createProperty({
    name: 'Gender',
    dataType: 'STRING',
  });
  ops.push(...genderOps);
  properties.gender = gender;

  const { id: birthDate, ops: birthOps } = Graph.createProperty({
    name: 'Birth Date',
    dataType: 'STRING',
  });
  ops.push(...birthOps);
  properties.birthDate = birthDate;

  const { id: deathDate, ops: deathOps } = Graph.createProperty({
    name: 'Death Date',
    dataType: 'STRING',
  });
  ops.push(...deathOps);
  properties.deathDate = deathDate;

  const { id: disambiguation, ops: disambigOps } = Graph.createProperty({
    name: 'Disambiguation',
    dataType: 'STRING',
  });
  ops.push(...disambigOps);
  properties.disambiguation = disambiguation;

  const { id: alternateNames, ops: altNamesOps } = Graph.createProperty({
    name: 'Alternate Names',
    dataType: 'STRING',
  });
  ops.push(...altNamesOps);
  properties.alternateNames = alternateNames;

  const { id: sortName, ops: sortOps } = Graph.createProperty({
    name: 'Sort Name',
    dataType: 'STRING',
  });
  ops.push(...sortOps);
  properties.sortName = sortName;

  // ============ Popularity Metrics ============

  const { id: genres, ops: genresOps } = Graph.createProperty({
    name: 'Genres',
    dataType: 'STRING',
  });
  ops.push(...genresOps);
  properties.genres = genres;

  const { id: spotifyFollowers, ops: followersOps } = Graph.createProperty({
    name: 'Spotify Followers',
    dataType: 'NUMBER',
  });
  ops.push(...followersOps);
  properties.spotifyFollowers = spotifyFollowers;

  const { id: spotifyPopularity, ops: popularityOps } = Graph.createProperty({
    name: 'Spotify Popularity',
    dataType: 'NUMBER',
  });
  ops.push(...popularityOps);
  properties.spotifyPopularity = spotifyPopularity;

  const { id: geniusFollowers, ops: geniusFollowersOps } = Graph.createProperty({
    name: 'Genius Followers',
    dataType: 'NUMBER',
  });
  ops.push(...geniusFollowersOps);
  properties.geniusFollowers = geniusFollowers;

  const { id: isVerified, ops: verifiedOps } = Graph.createProperty({
    name: 'Is Verified',
    dataType: 'STRING',
  });
  ops.push(...verifiedOps);
  properties.isVerified = isVerified;

  // ============ Song/Work Metadata ============

  const { id: language, ops: languageOps } = Graph.createProperty({
    name: 'Language',
    dataType: 'STRING',
  });
  ops.push(...languageOps);
  properties.language = language;

  const { id: releaseDate, ops: releaseDateOps } = Graph.createProperty({
    name: 'Release Date',
    dataType: 'STRING',
  });
  ops.push(...releaseDateOps);
  properties.releaseDate = releaseDate;

  const { id: album, ops: albumOps } = Graph.createProperty({
    name: 'Album',
    dataType: 'STRING',
  });
  ops.push(...albumOps);
  properties.album = album;

  const { id: durationMs, ops: durationOps } = Graph.createProperty({
    name: 'Duration (ms)',
    dataType: 'NUMBER',
  });
  ops.push(...durationOps);
  properties.durationMs = durationMs;

  const { id: annotationCount, ops: annotationOps } = Graph.createProperty({
    name: 'Annotation Count',
    dataType: 'NUMBER',
  });
  ops.push(...annotationOps);
  properties.annotationCount = annotationCount;

  const { id: pyongsCount, ops: pyongsOps } = Graph.createProperty({
    name: 'Pyongs Count',
    dataType: 'NUMBER',
  });
  ops.push(...pyongsOps);
  properties.pyongsCount = pyongsCount;

  // ============ App-Specific (Social Layer) ============

  const { id: lensAccount, ops: lensOps } = Graph.createProperty({
    name: 'Lens Account',
    dataType: 'STRING',
  });
  ops.push(...lensOps);
  properties.lensAccount = lensAccount;

  // ============ Relations ============

  const { id: composedBy, ops: composedByOps } = Graph.createProperty({
    name: 'Composed By',
    dataType: 'RELATION',
  });
  ops.push(...composedByOps);
  properties.composedBy = composedBy;

  const { id: performedBy, ops: performedByOps } = Graph.createProperty({
    name: 'Performed By',
    dataType: 'RELATION',
  });
  ops.push(...performedByOps);
  properties.performedBy = performedBy;

  const { id: recordingOf, ops: recordingOfOps } = Graph.createProperty({
    name: 'Recording Of',
    dataType: 'RELATION',
  });
  ops.push(...recordingOfOps);
  properties.recordingOf = recordingOf;

  return { ops, properties };
}
