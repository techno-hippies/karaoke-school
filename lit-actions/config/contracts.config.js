/**
 * Deployed Contract Addresses
 *
 * LENS TESTNET (Chain ID: 37111) - PRIMARY
 * RPC: https://rpc.testnet.lens.xyz
 * Explorer: https://block-explorer.testnet.lens.xyz
 *
 * BASE SEPOLIA (Chain ID: 84532) - LEGACY
 * RPC: https://sepolia.base.org
 * Explorer: https://sepolia.basescan.org
 */

// ============================================================
// LENS TESTNET CONTRACTS (PRIMARY)
// ============================================================

// Exercise Grading
export const EXERCISE_EVENTS_ADDRESS = '0xcB2b397E02b50A0eeCecb922bb76aBE46DFb7832'; // Deployed ✅

// Events
export const CLIP_EVENTS_ADDRESS = '0x369Cd327c39E2f00b851f06B6e25bb01a5149961'; // Deployed ✅ 2025-11-10
export const SONG_EVENTS_ADDRESS = '0x0A15fFdBD70FC657C3f3E17A7faFEe3cD33DF7B6'; // Deployed ✅
export const ACCOUNT_EVENTS_ADDRESS = '0x3709f41cdc9E7852140bc23A21adCe600434d4E8'; // Deployed ✅

// Network Config
export const LENS_TESTNET_RPC = 'https://rpc.testnet.lens.xyz';
export const LENS_TESTNET_CHAIN_ID = 37111;

// ============================================================
// BASE SEPOLIA CONTRACTS (LEGACY - NO LONGER USED)
// ============================================================

// Deprecated - old contracts (left for reference only)
export const KARAOKE_CATALOG_ADDRESS = '0xe43A62838f70384Ed7a4C205E70d20f56d1Da711';
export const KARAOKE_CREDITS_ADDRESS = '0x6de183934E68051c407266F877fafE5C20F74653';
export const FSRS_TRACKER_ADDRESS = '0xcB208EFA5B615472ee9b8Dea913624caefB6C1F3';
export const BASE_SEPOLIA_RPC = 'https://sepolia.base.org';

// PKP Wallet Address (not a contract) - The actual PKP used by Lit Actions (Relayer)  
export const PKP_ADDRESS = '0x3345Cb3A0CfEcb47bC3D638e338D26c870FA2b23'; // Updated PKP from contracts/.env
export const PKP_PUBLIC_KEY = '0x043a5f87717daafe9972ee37154786845a74368d269645685ef51d7ac32c59a20df5340b8adb154b1ac137a8f2c0a6aedbcdbc46448cc545ea7f5233918d324939';

// Treasury
export const TREASURY_ADDRESS = '0x0C6433789d14050aF47198B2751f6689731Ca79C';
