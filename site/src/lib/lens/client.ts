import { PublicClient, testnet } from "@lens-protocol/client";

export const lensClient = PublicClient.create({
  environment: testnet,
  // Use localStorage to persist authentication sessions across page refreshes
  // This prevents the need to sign every page load
  storage: typeof window !== 'undefined' ? window.localStorage : undefined,
});