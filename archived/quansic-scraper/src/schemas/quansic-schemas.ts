import { z } from 'zod';

// Quansic Identifiers Schema
export const QuansicIdentifiersSchema = z.object({
  ipi: z.array(z.string()).optional(),
  ipn: z.string().optional(),
  isnis: z.array(z.string()).optional(),
  musicbrainzId: z.string().optional(),
  spotifyId: z.string().optional(),
  appleId: z.string().optional(),
  deezerId: z.string().optional(),
  discogsId: z.array(z.string()).optional(),
  wikidataId: z.string().optional(),
  amazonId: z.array(z.string()).optional(),
});

// Quansic Recording Schema  
export const QuansicRecordingSchema = z.object({
  isrc: z.string(),
  title: z.string(),
  subtitle: z.string().optional(),
  duration: z.string().optional(),
  year: z.string().optional(),
});

// Quansic Work Schema
export const QuansicWorkSchema = z.object({
  iswc: z.string().optional().nullable(),
  title: z.string(),
  role: z.string().optional(),
  q1Score: z.number().optional(),
});

// Quansic Release Schema
export const QuansicReleaseSchema = z.object({
  upc: z.string().optional(),
  title: z.string(),
  type: z.string().optional(),
  year: z.string().optional(),
});

// Quansic Name Variant Schema
export const QuansicNameVariantSchema = z.object({
  name: z.string().optional(),
  fullname: z.string().optional(),
  language: z.string().optional(),
});

// Quansic Work Contributor Schema
export const QuansicWorkContributorSchema = z.object({
  name: z.string(),
  ids: z.object({
    quansicId: z.string().optional(),
    ipis: z.array(z.string()).optional(),
    isnis: z.array(z.string()).optional(),
    musicBrainzIds: z.array(z.string()).optional(),
    spotifyIds: z.array(z.string()).optional(),
    appleIds: z.array(z.string()).optional(),
    deezerIds: z.array(z.string()).optional(),
  }).optional(),
  role: z.string().optional(),
  popularity: z.number().optional(),
  birthdate: z.string().optional(),
  firstname: z.string().optional(),
  lastname: z.string().optional(),
  nameType: z.string().optional(),
  nationality: z.string().optional(),
  type: z.string().optional(),
  gender: z.string().optional(),
});

// Quansic Recording Work Schema (detailed)
export const QuansicRecordingWorkSchema = z.object({
  iswc: z.string(),
  title: z.string(),
  q1Score: z.number().optional(),
  q2Score: z.number().optional(),
  contributors: z.array(QuansicWorkContributorSchema).optional(),
});

// Quansic Recording Works Response Schema
export const QuansicRecordingWorksResponseSchema = z.object({
  status: z.string(),
  results: z.object({
    offset: z.number(),
    total: z.number(),
    data: z.array(QuansicRecordingWorkSchema),
  }),
});

// Quansic Artist Schema (from scraper)
export const QuansicArtistSchema = z.object({
  id: z.string(), // ISNI
  name: z.string(),
  type: z.string().optional(),
  dateOfBirth: z.string().optional(),
  nationality: z.string().optional(),
  identifiers: QuansicIdentifiersSchema.optional(),
  recordings: z.array(QuansicRecordingSchema).optional(),
  works: z.array(QuansicWorkSchema).optional(),
  releases: z.array(QuansicReleaseSchema).optional(),
  nameVariants: z.array(QuansicNameVariantSchema).optional(),
});