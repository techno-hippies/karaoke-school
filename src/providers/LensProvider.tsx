import React from 'react';
import { LensProvider as LensReactProvider, PublicClient } from '@lens-protocol/react';
import { testnet } from '@lens-protocol/client';

interface LensProviderProps {
  children: React.ReactNode;
}

// Create the PublicClient with proper configuration
const client = PublicClient.create({
  environment: testnet,
  storage: typeof window !== 'undefined' ? window.localStorage : undefined,
});

export function LensProvider({ children }: LensProviderProps) {
  return (
    <LensReactProvider client={client}>
      {children}
    </LensReactProvider>
  );
}