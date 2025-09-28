/**
 * Mappings between blockchain addresses/ENS names and TikTok creator handles
 * 
 * This is a temporary solution for V1 where you manually seed content.
 * In V2, this should come from the blockchain registry or a verification system.
 */

export interface CreatorMapping {
  handle: string;           // TikTok handle with @ prefix
  displayName?: string;     // Optional display name
  verified?: boolean;       // Whether this mapping is verified
  pkpPublicKey?: string;    // The PKP that controls this creator's uploads
}

/**
 * Main mapping dictionary
 * Keys can be:
 * - ENS names (vitalik.eth)
 * - Ethereum addresses (0x...)
 * - Direct TikTok handles (without @)
 */
export const CREATOR_MAPPINGS: Record<string, CreatorMapping> = {
  // ============= ENS Names =============
  // Map ENS names to actual seeded creators
  // Since you don't have vitalik's videos, map to a creator you do have
  'test.eth': {
    handle: '@bellapoarch',
    displayName: 'Test Profile',
    verified: false
  },
  
  // ============= Ethereum Addresses =============
  
  // Your wallet address - no TikTok mapping since you post as Lens account
  // '0x0c6433789d14050af47198b2751f6689731ca79c': {
  //   handle: '@khaby.lame',
  //   displayName: 'Khaby Lame',
  //   verified: false
  // },
  
  // ============= Direct TikTok Handles =============
  // These are the creators you've actually seeded based on your scripts
  
  'slim3ball69_': {
    handle: '@slim3ball69_',
    displayName: 'slim3ball69_',
    verified: true
  },
  
  'addisonre': {
    handle: '@addisonre',
    displayName: 'Addison Rae',
    verified: true
  },
  
  '17d34': {
    handle: '@17d34',
    displayName: '17d34',
    verified: true
  },
  
  'ad1yn22': {
    handle: '@ad1yn22',
    displayName: 'ad1yn22',
    verified: true
  },
  
  // From test scripts
  'alice_test': {
    handle: '@alice_test',
    displayName: 'Alice Test',
    verified: false
  },
  
  'charlie_v2': {
    handle: '@charlie_v2',
    displayName: 'Charlie V2',
    verified: false
  },
  
  'bellapoarch': {
    handle: '@bellapoarch',
    displayName: 'Bella Poarch',
    verified: false
  },
  
  // Add more creators as you seed them
  // Format: 'handle_without_@': { handle: '@handle', ... }
};

/**
 * Helper function to get creator info from any identifier
 */
export function getCreatorInfo(identifier: string | undefined): CreatorMapping | undefined {
  if (!identifier) return undefined;
  
  // Direct lookup
  const direct = CREATOR_MAPPINGS[identifier];
  if (direct) return direct;
  
  // Try lowercase for addresses
  const lowercase = CREATOR_MAPPINGS[identifier.toLowerCase()];
  if (lowercase) return lowercase;
  
  // If it starts with @, try without it
  if (identifier.startsWith('@')) {
    const withoutAt = identifier.slice(1);
    return CREATOR_MAPPINGS[withoutAt];
  }
  
  // Not found
  return undefined;
}

/**
 * Get just the handle from any identifier
 */
export function getCreatorHandle(identifier: string | undefined): string | undefined {
  if (!identifier) return undefined;
  
  // If already a handle, return it
  if (identifier.startsWith('@')) {
    return identifier;
  }
  
  const info = getCreatorInfo(identifier);
  return info?.handle;
}

/**
 * Check if a creator is verified
 */
export function isCreatorVerified(identifier: string | undefined): boolean {
  const info = getCreatorInfo(identifier);
  return info?.verified || false;
}

/**
 * Get all seeded creator handles
 */
export function getAllSeededCreators(): string[] {
  const handles = new Set<string>();
  
  Object.values(CREATOR_MAPPINGS).forEach(creator => {
    handles.add(creator.handle);
  });
  
  return Array.from(handles);
}

/**
 * TODO: In V2, this should query the blockchain registry
 * Example implementation:
 * 
 * async function getCreatorFromRegistry(identifier: string) {
 *   const contract = new Contract(REGISTRY_ADDRESS, REGISTRY_ABI, provider);
 *   const creatorData = await contract.getCreator(identifier);
 *   return {
 *     handle: creatorData.handle,
 *     pkpPublicKey: creatorData.pkpPublicKey,
 *     videoCount: creatorData.videoCount
 *   };
 * }
 */