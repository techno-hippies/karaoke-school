import { PublicClient, testnet } from "@lens-protocol/react";

/**
 * Lens Public Client
 * Configured for testnet environment with localStorage for session persistence
 */
export const lensClient = PublicClient.create({
  environment: testnet,
  storage: typeof window !== 'undefined' ? window.localStorage : undefined,
});
