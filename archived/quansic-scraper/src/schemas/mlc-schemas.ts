import { z } from 'zod';

// MLC Writer Schema
export const MLCWriterSchema = z.object({
  ipiNumber: z.string().nullable().optional(),
  firstName: z.string().nullable().optional(),
  lastName: z.string().nullable().optional(),
  role: z.string().nullable().optional(),
  shareholderCopyrightOwnershipPercentage: z.number().nullable().optional(),
}).passthrough();

// MLC Publisher Schema
export const MLCPublisherSchema = z.object({
  publisherName: z.string().nullable().optional(),
  publisherType: z.string().nullable().optional(),
  shareholderCopyrightOwnershipPercentage: z.number().nullable().optional(),
  administratorName: z.string().nullable().optional(),
  administratorPublishers: z.array(z.any()).optional(),
}).passthrough();

// MLC Recording Schema
export const MLCRecordingSchema = z.object({
  id: z.string().nullable().optional(),
  isrc: z.string().nullable().optional(),
  recordingTitle: z.string().nullable().optional(),
  recordingDisplayArtistName: z.string().nullable().optional(),
  productTitle: z.string().nullable().optional(),
  dsp: z.string().nullable().optional(),
  label: z.string().nullable().optional(),
  duration: z.union([z.number(), z.string(), z.null()]).optional(),
  releaseDate: z.string().nullable().optional(),
  hfaSongCode: z.string().nullable().optional(),
}).passthrough();

// MLC Work Details Schema
export const MLCWorkDetailsSchema = z.object({
  id: z.number(),
  iswc: z.string().optional().nullable(),
  title: z.string(),
  songCode: z.string().nullable().optional(),
  totalKnownShares: z.number().nullable().optional(),
  writers: z.array(MLCWriterSchema).nullable().optional(),
  originalPublishers: z.array(MLCPublisherSchema).nullable().optional(),
  recordings: z.array(MLCRecordingSchema).nullable().optional(),
  matchedRecordings: z.union([
    z.object({
      count: z.number(),
      recordings: z.array(MLCRecordingSchema)
    }),
    z.array(MLCRecordingSchema)
  ]).nullable().optional(),
}).passthrough();

// MLC Search Result Schema  
export const MLCSearchResultSchema = z.object({
  content: z.array(MLCWorkDetailsSchema),
  last: z.boolean(),
  totalElements: z.number(),
  totalPages: z.number(),
  number: z.number(),
});