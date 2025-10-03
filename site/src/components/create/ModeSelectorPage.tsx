import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CaretLeft, CaretRight, Microphone, VideoCamera, TiktokLogo } from '@phosphor-icons/react';
import type { ClipMetadata } from '../../types/song';

export type RecordingMode = 'practice' | 'perform' | 'lipsync';

interface ModeSelectorPageProps {
  clip?: ClipMetadata;
  onModeSelect?: (mode: RecordingMode) => void;
  onBack?: () => void;
}

export const ModeSelectorPage: React.FC<ModeSelectorPageProps> = ({
  clip: propClip,
  onModeSelect,
  onBack
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const clip = propClip || (location.state as { clip?: ClipMetadata })?.clip;

  const modes = [
    {
      id: 'practice' as RecordingMode,
      title: 'Practice',
      description: 'Audio only',
      icon: Microphone,
      iconColor: 'text-purple-400',
    },
    {
      id: 'perform' as RecordingMode,
      title: 'Perform',
      description: 'Video and audio',
      icon: VideoCamera,
      iconColor: 'text-blue-400',
    },
    {
      id: 'lipsync' as RecordingMode,
      title: 'Lip Sync',
      description: 'Video only',
      icon: TiktokLogo,
      iconColor: 'text-pink-400',
    },
  ];

  const handleBackClick = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };

  return (
    <div className="relative w-full h-screen bg-neutral-900 flex flex-col">
      {/* Header */}
      <div className="flex-none border-b border-neutral-800">
        <div className="flex items-center h-16 px-4">
          <button
            onClick={handleBackClick}
            className="w-12 h-12 flex items-center justify-center hover:bg-neutral-800 transition-colors rounded-full"
          >
            <CaretLeft className="w-6 h-6 text-white" />
          </button>
        </div>
      </div>

      {/* Mode cards - each 1/3 height */}
      <div className="flex-1 flex flex-col">
        {modes.map((mode) => {
          const Icon = mode.icon;

          return (
            <button
              key={mode.id}
              onClick={() => {
                if (onModeSelect) {
                  onModeSelect(mode.id);
                } else if (clip) {
                  navigate(`/create/camera-recorder/${clip.id}`, {
                    state: {
                      clip,
                      mode: mode.id,
                      videoEnabled: mode.id !== 'practice',
                      recordingMode: mode.id === 'lipsync' ? 'lipsync' : 'cover'
                    }
                  });
                }
              }}
              className="flex-1 border-b border-neutral-800 last:border-b-0 hover:bg-neutral-800/50 transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-center gap-6 h-full px-6">
                {/* Icon */}
                <div className="flex-shrink-0">
                  <Icon weight="duotone" className={`w-12 h-12 ${mode.iconColor}`} />
                </div>

                {/* Content */}
                <div className="flex-1 text-left">
                  <h2 className="text-white text-2xl font-bold mb-1">{mode.title}</h2>
                  <p className="text-neutral-400 text-lg">{mode.description}</p>
                </div>

                {/* Chevron */}
                <div className="flex-shrink-0">
                  <CaretRight className="w-6 h-6 text-neutral-400" weight="bold" />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
