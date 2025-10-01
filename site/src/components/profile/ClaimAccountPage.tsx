import React from 'react';
import { Button } from '../ui/button';
import { Key, ArrowLeft } from '@phosphor-icons/react';

interface ClaimAccountPageProps {
  username: string;
  claimableAmount: number;
  onBack: () => void;
  onClaim: () => void;
}

export const ClaimAccountPage: React.FC<ClaimAccountPageProps> = ({ 
  username,
  claimableAmount,
  onBack,
  onClaim 
}) => {
  return (
    <div className="relative h-screen w-full bg-black flex flex-col">
      {/* Header with back button */}
      <div className="relative z-10 px-4 py-4">
        <Button
          onClick={onBack}
          variant="ghost"
          size="icon"
          className="text-white hover:bg-neutral-800"
        >
          <ArrowLeft className="w-6 h-6" weight="regular" />
        </Button>
      </div>

      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-600 to-pink-600 opacity-20" />
      
      {/* Content - centered vertically in remaining space */}
      <div className="flex-1 flex items-center justify-center">
        <div className="relative z-10 text-center px-8 max-w-md">
          <div className="text-yellow-400 mb-6 flex justify-center">
            <Key className="w-20 h-20" weight="duotone" />
          </div>
          
          <h2 className="text-4xl font-bold text-white mb-2">
            Claim @{username}
          </h2>
          
          <p className="text-5xl font-bold text-green-400">
            ${claimableAmount}
          </p>
        </div>
      </div>

      {/* Button at bottom */}
      <div className="relative z-10 p-6 pb-8">
        <Button
          onClick={onClaim}
          size="lg"
          className="w-full h-14 bg-white text-black hover:bg-neutral-100 font-bold text-lg"
        >
          Claim
        </Button>
      </div>
    </div>
  );
};