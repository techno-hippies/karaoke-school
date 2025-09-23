import { PublicClient, testnet } from "@lens-protocol/client";

// Create Lens client for testnet (where your app is deployed)
export const lensClient = PublicClient.create({
  environment: testnet,
  // Add origin for authentication if needed in non-browser environments
  // origin: "https://your-domain.com",
});