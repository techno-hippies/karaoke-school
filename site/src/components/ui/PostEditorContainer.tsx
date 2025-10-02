import React from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { useLensAuth } from '../../hooks/lens/useLensAuth';
import { PostEditor } from './PostEditor';
import type { PostProgress } from './PostEditor';

interface SelectedSegment {
  start: number;
  end: number;
  lyrics: Array<{ text: string; timestamp: number }>;
}

interface PostEditorContainerProps {
  videoThumbnail?: string;
  videoBlob?: Blob;
  segment?: SelectedSegment;
  audioUrl?: string;
  songId?: string;
  songTitle?: string;
  onBack?: () => void;
  onPost?: (caption: string) => void;
  onLensPost?: (result: { postId: string; metadataUri: string; videoUri: string }) => void;
  maxCaptionLength?: number;
  className?: string;
}

/**
 * Container component that provides wagmi and Lens auth to PostEditor
 * Use this in production, use PostEditor directly in Storybook
 */
export const PostEditorContainer: React.FC<PostEditorContainerProps> = (props) => {
  // Get wallet connection for Lens posting
  const { address: walletAddress, isConnected: isWalletConnected } = useAccount();
  const { data: walletClient } = useWalletClient();

  // Get Lens authentication state
  const { isAuthenticated, sessionClient, authenticatedUser, canPost, authState, handleLogin } = useLensAuth();

  return (
    <PostEditor
      {...props}
      walletAddress={walletAddress}
      isWalletConnected={isWalletConnected}
      walletClient={walletClient}
      sessionClient={sessionClient}
      isAuthenticated={isAuthenticated}
      authenticatedUser={authenticatedUser}
      canPost={canPost}
      authState={authState}
      onLogin={handleLogin}
    />
  );
};
