/**
 * MLC (Mechanical Licensing Collective) Schema
 *
 * Validation for MLC API responses and licensing data
 */

import { z } from 'zod';

/**
 * MLC Writer (composer/author)
 */
export const MLCWriterSchema = z.object({
  name: z.string().min(1),
  ipi: z.string().nullable().describe('IPI (Interested Party Information) number'),
  role: z.string().describe('Composer/Author role'),
  share: z.number().gte(0).lte(100).describe('Ownership share percentage'),
});

export type MLCWriter = z.infer<typeof MLCWriterSchema>;

/**
 * MLC Publisher Administrator
 */
export const MLCAdministratorSchema = z.object({
  name: z.string().min(1),
  ipi: z.string(),
  share: z.number().gte(0).lte(100),
});

export type MLCAdministrator = z.infer<typeof MLCAdministratorSchema>;

/**
 * MLC Publisher
 */
export const MLCPublisherSchema = z.object({
  name: z.string().min(1),
  ipi: z.string(),
  share: z.number().gte(0).lte(100).describe('Direct publisher share'),
  administrators: z.array(MLCAdministratorSchema).default([]),
});

export type MLCPublisher = z.infer<typeof MLCPublisherSchema>;

/**
 * Complete MLC Licensing Data
 */
export const MLCDataSchema = z.object({
  isrc: z.string().min(1).describe('ISRC (International Standard Recording Code)'),
  mlcSongCode: z.string().min(1).describe('MLC Song Code (e.g., TB46ND)'),
  iswc: z.string().describe('ISWC (International Standard Musical Work Code)'),
  writers: z.array(MLCWriterSchema).min(1).describe('Song writers/composers'),
  publishers: z.array(MLCPublisherSchema).min(1).describe('Publishing companies'),
  totalPublisherShare: z.number()
    .gte(0)
    .lte(100)
    .describe('Total publisher share (≥98% required for Story Protocol)'),
  storyMintable: z.boolean().describe('Whether song meets Story Protocol requirements (totalPublisherShare ≥98%)'),
});

export type MLCData = z.infer<typeof MLCDataSchema>;

/**
 * MLC API Search Response
 */
export const MLCSearchResponseSchema = z.object({
  works: z.array(z.object({
    songCode: z.string(),
    title: z.string(),
    iswc: z.string().optional(),
    writers: z.array(z.any()),
    publishers: z.array(z.any()),
  })),
});

export type MLCSearchResponse = z.infer<typeof MLCSearchResponseSchema>;
