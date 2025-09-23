import React, { createContext, useContext } from 'react';
import { useConnectModal } from '@rainbow-me/rainbowkit';

interface WalletModalContextType {
  openWalletModal: () => void;
}

const WalletModalContext = createContext<WalletModalContextType | null>(null);

export const useWalletModal = () => {
  const context = useContext(WalletModalContext);
  if (!context) {
    throw new Error('useWalletModal must be used within WalletModalProvider');
  }
  return context;
};

export const WalletModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { openConnectModal } = useConnectModal();

  const openWalletModal = () => {
    if (openConnectModal) {
      openConnectModal();
    }
  };

  return (
    <WalletModalContext.Provider value={{ openWalletModal }}>
      {children}
    </WalletModalContext.Provider>
  );
};