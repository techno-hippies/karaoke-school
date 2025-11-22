/**
 * Typed SQL Helper Functions for Identity Pipeline
 *
 * Purpose: PKP and Lens account database operations with type safety
 *
 * Architecture:
 * - pkp_accounts: Lit Protocol PKPs (Chronicle Yellowstone)
 * - lens_accounts: Lens Protocol accounts (owned by PKPs)
 * - Polymorphic design: supports both artists (spotify_artist_id) and creators (tiktok_handle)
 *
 * All queries use parameterized statements to prevent SQL injection.
 */

import { query } from './connection';
import type { Address, Hex } from 'viem';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * PKP account data for insertion
 */
export interface PKPAccountData {
  account_type: 'artist' | 'tiktok_creator';
  spotify_artist_id?: string;           // Required if account_type = 'artist'
  tiktok_handle?: string;                // Required if account_type = 'tiktok_creator'
  genius_artist_id?: number;             // Optional for artists
  network?: string;                      // Lit network (naga-dev | naga-test | naga-staging | naga-local)
  pkp_address: Address;
  pkp_token_id: string;
  pkp_public_key: string;
  pkp_owner_eoa: Address;
  transaction_hash?: Hex;
}

/**
 * Lens account data for insertion
 */
export interface LensAccountData {
  account_type: 'artist' | 'tiktok_creator';
  spotify_artist_id?: string;
  tiktok_handle?: string;
  pkp_address: Address;                  // Must exist in pkp_accounts
  lens_handle: string;
  lens_account_address: Address;
  lens_account_id: string;
  lens_metadata_uri: string;             // Grove URI
  transaction_hash?: Hex;
}

/**
 * Artist entity without PKP
 */
export interface ArtistWithoutPKP {
  spotify_artist_id: string;
  name: string;
  image_url: string | null;
}

/**
 * TikTok creator without PKP
 */
export interface CreatorWithoutPKP {
  username: string;              // Primary key from tiktok_creators
  display_name: string;
  follower_count: number | null;
}

/**
 * Entity with PKP but no Lens account
 */
export interface EntityWithPKP {
  account_type: 'artist' | 'tiktok_creator';
  spotify_artist_id: string | null;
  tiktok_handle: string | null;
  name: string;
  pkp_address: Address;
  pkp_token_id: string;
  image_url: string | null;
}

// ============================================================================
// PKP Account Queries
// ============================================================================

/**
 * Insert PKP account into database
 *
 * Used by: mint-pkps.ts processor
 *
 * @param data - PKP account data from Lit Protocol minting
 */
export async function insertPKPAccount(data: PKPAccountData): Promise<void> {
  await query(
    `INSERT INTO pkp_accounts (
      account_type,
      spotify_artist_id,
      tiktok_handle,
      network,
      pkp_address,
      pkp_token_id,
      pkp_public_key,
      pkp_owner_eoa,
      transaction_hash
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT (pkp_address) DO UPDATE SET
      transaction_hash = EXCLUDED.transaction_hash,
      network = EXCLUDED.network,
      updated_at = NOW()`,
    [
      data.account_type,
      data.spotify_artist_id || null,
      data.tiktok_handle || null,
      data.network || null,
      data.pkp_address,
      data.pkp_token_id,
      data.pkp_public_key,
      data.pkp_owner_eoa,
      data.transaction_hash || null,
    ]
  );
}

/**
 * Find artists with karaoke content but no PKP
 *
 * Used by: mint-pkps.ts processor
 *
 * Query logic:
 * - Artist must have at least one karaoke segment (validated content)
 * - Artist must NOT have a PKP yet (NOT EXISTS check)
 * - Ordered by most recent segment (artists with new content first)
 *
 * @param limit - Maximum number of artists to return
 * @returns Array of artists ready for PKP minting
 */
export async function findArtistsWithoutPKP(
  limit: number = 20
): Promise<ArtistWithoutPKP[]> {
  return await query<ArtistWithoutPKP>(
    `SELECT
      sa.spotify_artist_id,
      sa.name,
      sa.images->0->>'url' as image_url,
      MAX(ks.created_at) as latest_segment
    FROM spotify_artists sa
    JOIN tracks t ON t.primary_artist_id = sa.spotify_artist_id
    JOIN karaoke_segments ks ON ks.spotify_track_id = t.spotify_track_id
    WHERE NOT EXISTS (
      SELECT 1 FROM pkp_accounts pkp
      WHERE pkp.spotify_artist_id = sa.spotify_artist_id
    )
    GROUP BY sa.spotify_artist_id, sa.name, sa.images
    ORDER BY latest_segment DESC
    LIMIT $1`,
    [limit]
  );
}

/**
 * Find TikTok creators with content but no PKP
 *
 * Used by: mint-pkps.ts processor
 *
 * @param limit - Maximum number of creators to return
 */
export async function findCreatorsWithoutPKP(
  limit: number = 20
): Promise<CreatorWithoutPKP[]> {
  return await query<CreatorWithoutPKP>(
    `SELECT
      tc.username,
      tc.display_name,
      tc.follower_count
    FROM tiktok_creators tc
    WHERE EXISTS (
      SELECT 1 FROM tiktok_videos tv
      WHERE tv.creator_username = tc.username
    )
    AND NOT EXISTS (
      SELECT 1 FROM pkp_accounts pkp
      WHERE pkp.tiktok_handle = tc.username
    )
    ORDER BY tc.follower_count DESC NULLS LAST
    LIMIT $1`,
    [limit]
  );
}

// ============================================================================
// Lens Account Queries
// ============================================================================

/**
 * Insert Lens account into database
 *
 * Used by: create-lens-accounts.ts processor
 *
 * @param data - Lens account data from Lens Protocol creation
 */
export async function insertLensAccount(data: LensAccountData): Promise<void> {
  await query(
    `INSERT INTO lens_accounts (
      account_type,
      spotify_artist_id,
      tiktok_handle,
      pkp_address,
      lens_handle,
      lens_account_address,
      lens_account_id,
      lens_metadata_uri,
      transaction_hash
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT (lens_handle) DO UPDATE SET
      lens_metadata_uri = EXCLUDED.lens_metadata_uri,
      transaction_hash = EXCLUDED.transaction_hash,
      updated_at = NOW()`,
    [
      data.account_type,
      data.spotify_artist_id || null,
      data.tiktok_handle || null,
      data.pkp_address,
      data.lens_handle,
      data.lens_account_address,
      data.lens_account_id,
      data.lens_metadata_uri,
      data.transaction_hash || null,
    ]
  );
}

/**
 * Find entities with PKP but no Lens account
 *
 * Used by: create-lens-accounts.ts processor
 *
 * Query combines artists and TikTok creators using UNION.
 * Returns unified interface for both entity types.
 *
 * @param limit - Maximum number of entities to return
 * @param accountType - Optional filter: 'artist', 'tiktok_creator', or undefined for both
 */
export async function findEntitiesWithoutLens(
  limit: number = 20,
  accountType?: 'artist' | 'tiktok_creator'
): Promise<EntityWithPKP[]> {
  // Build query dynamically based on accountType filter
  const includeArtists = !accountType || accountType === 'artist';
  const includeCreators = !accountType || accountType === 'tiktok_creator';

  const queries: string[] = [];

  if (includeArtists) {
    queries.push(`
      -- Artists with PKP but no Lens
      SELECT
        'artist'::TEXT as account_type,
        sa.spotify_artist_id,
        NULL::TEXT as tiktok_handle,
        sa.name,
        pkp.pkp_address,
        pkp.pkp_token_id,
        sa.images->0->>'url' as image_url
      FROM spotify_artists sa
      INNER JOIN pkp_accounts pkp
        ON pkp.spotify_artist_id = sa.spotify_artist_id
        AND pkp.account_type = 'artist'
      WHERE NOT EXISTS (
        SELECT 1 FROM lens_accounts la
        WHERE la.spotify_artist_id = sa.spotify_artist_id
      )
    `);
  }

  if (includeCreators) {
    queries.push(`
      -- TikTok creators with PKP but no Lens
      SELECT
        'tiktok_creator'::TEXT as account_type,
        NULL::TEXT as spotify_artist_id,
        tc.username as tiktok_handle,
        tc.display_name as name,
        pkp.pkp_address,
        pkp.pkp_token_id,
        NULL::TEXT as image_url
      FROM tiktok_creators tc
      INNER JOIN pkp_accounts pkp
        ON pkp.tiktok_handle = tc.username
        AND pkp.account_type = 'tiktok_creator'
      WHERE NOT EXISTS (
        SELECT 1 FROM lens_accounts la
        WHERE la.tiktok_handle = tc.username
      )
    `);
  }

  const sql = `
    ${queries.join('\n    UNION ALL\n')}
    ORDER BY account_type, name
    LIMIT $1
  `;

  return await query<EntityWithPKP>(sql, [limit]);
}

// ============================================================================
// Query Helpers (Read Operations)
// ============================================================================

/**
 * Check if artist has PKP
 *
 * @param spotifyArtistId - Spotify artist ID
 * @returns True if PKP exists
 */
export async function hasPKP(spotifyArtistId: string): Promise<boolean> {
  const results = await query<{ exists: boolean }>(
    `SELECT EXISTS(
      SELECT 1 FROM pkp_accounts
      WHERE spotify_artist_id = $1
    ) as exists`,
    [spotifyArtistId]
  );

  return results[0].exists;
}

/**
 * Get PKP address for artist
 *
 * @param spotifyArtistId - Spotify artist ID
 * @returns PKP address or null if not minted
 */
export async function getPKPAddress(
  spotifyArtistId: string
): Promise<Address | null> {
  const results = await query<{ pkp_address: Address }>(
    `SELECT pkp_address
     FROM pkp_accounts
     WHERE spotify_artist_id = $1`,
    [spotifyArtistId]
  );

  return results.length > 0 ? results[0].pkp_address : null;
}

/**
 * Get Lens handle for artist
 *
 * @param spotifyArtistId - Spotify artist ID
 * @returns Lens handle or null if not created
 */
export async function getLensHandle(
  spotifyArtistId: string
): Promise<string | null> {
  const results = await query<{ lens_handle: string }>(
    `SELECT lens_handle
     FROM lens_accounts
     WHERE spotify_artist_id = $1`,
    [spotifyArtistId]
  );

  return results.length > 0 ? results[0].lens_handle : null;
}

/**
 * Count total PKP accounts
 *
 * @returns Total number of PKPs (artists + creators)
 */
export async function countPKPAccounts(): Promise<number> {
  const results = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM pkp_accounts`
  );

  return parseInt(results[0].count, 10);
}

/**
 * Count total Lens accounts
 *
 * @returns Total number of Lens accounts
 */
export async function countLensAccounts(): Promise<number> {
  const results = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM lens_accounts`
  );

  return parseInt(results[0].count, 10);
}
