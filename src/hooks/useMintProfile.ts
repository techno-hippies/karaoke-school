import { useState } from 'react';

export const useMintProfile = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mintBatch = async (
    videoIds: string[],
    tiktokHandle: string,
    onUploadProgress?: (percent: number) => void,
    onMintProgress?: (percent: number) => void
  ) => {
    setError('Minting disabled during Lit Protocol v8 migration');
    throw new Error('Minting disabled during Lit Protocol v8 migration');
  };

  return {
    mintBatch,
    isLoading,
    error,
  };
};