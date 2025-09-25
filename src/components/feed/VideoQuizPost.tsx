import React, { useState, useEffect, useRef } from 'react';
import { Heart, ChatCircle, ShareNetwork, MusicNote, Plus } from '@phosphor-icons/react';
import { ActionButton } from './ActionButton';
import { MultipleChoiceExercise } from '../exercises/MultipleChoiceExercise';
import type { MultipleChoiceOption } from '../exercises/MultipleChoiceExercise';
import GradientText from '../ui/GradientText';

interface VideoQuizPostProps {
  videoUrl?: string;
  thumbnailUrl?: string;
  username: string;
  description: string;
  likes: number;
  comments: number;
  shares: number;
  musicTitle?: string;
  
  // Quiz props
  showQuizAfter?: number; // seconds to wait before showing quiz
  question: string;
  options: MultipleChoiceOption[];
  exerciseType?: 'translate' | 'trivia';
  megapotAmount?: number;
  onQuizAnswer?: (selectedId: string, isCorrect: boolean) => void;
}

export const VideoQuizPost: React.FC<VideoQuizPostProps> = ({
  videoUrl,
  thumbnailUrl,
  username,
  description,
  likes,
  comments,
  shares,
  musicTitle = 'Original Sound',
  showQuizAfter = 5,
  question,
  options,
  exerciseType = 'trivia',
  megapotAmount = 1032323,
  onQuizAnswer
}) => {
  const [showQuiz, setShowQuiz] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(30);
  const [hasAnswered, setHasAnswered] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const formatCount = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  const formatMegapot = (amount: number) => {
    return amount.toLocaleString('en-US');
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else if (minutes > 0) {
      return `${minutes}:${secs.toString().padStart(2, '0')}`;
    } else {
      return `:${secs.toString().padStart(2, '0')}`;
    }
  };

  // Show quiz after video plays for X seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowQuiz(true);
      if (videoRef.current) {
        videoRef.current.pause();
      }
    }, showQuizAfter * 1000);

    return () => clearTimeout(timer);
  }, [showQuizAfter]);

  // Countdown timer when quiz is shown
  useEffect(() => {
    if (!showQuiz || hasAnswered) return;

    const interval = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          setHasAnswered(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [showQuiz, hasAnswered]);

  const handleQuizAnswer = (selectedId: string, isCorrect: boolean) => {
    setHasAnswered(true);
    onQuizAnswer?.(selectedId, isCorrect);
    
    // Immediately advance to next video after answering
    setTimeout(() => {
      // Scroll to next video
      const container = document.querySelector('.snap-y.snap-mandatory');
      if (container) {
        const currentIndex = Array.from(container.children).findIndex(
          child => child.contains(videoRef.current)
        );
        const nextElement = container.children[currentIndex + 1];
        if (nextElement) {
          nextElement.scrollIntoView({ behavior: 'smooth' });
        }
      }
    }, 500);
  };

  return (
    <div className="relative h-screen w-full bg-black snap-start">
      {/* Video/Thumbnail Background */}
      <div className={`absolute inset-0 bg-neutral-900 transition-all duration-500 ${showQuiz ? 'opacity-30' : 'opacity-100'}`}>
        {thumbnailUrl && !videoUrl && (
          <img 
            src={thumbnailUrl} 
            alt={description}
            className="w-full h-full object-cover"
          />
        )}
        {videoUrl && (
          <video
            ref={videoRef}
            src={videoUrl}
            className="w-full h-full object-cover"
            loop
            muted
            playsInline
            autoPlay
          />
        )}
      </div>

      {/* Quiz Overlay */}
      {showQuiz && (
        <div className={`absolute inset-0 flex items-center justify-center z-20 px-2 md:px-4 transition-all duration-300 pointer-events-none ${showQuiz ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
          <div className="w-full max-w-2xl bg-black/90 backdrop-blur-sm rounded-2xl p-4 md:p-6 border border-neutral-800 pointer-events-auto">
            {/* Prize and Timer Header */}
            <div className="flex items-center justify-between mb-4 md:mb-6 gap-2">
              <div className="text-lg md:text-xl font-medium leading-relaxed text-white flex items-center gap-1">
                <span>Win</span>
                <GradientText
                  colors={["#FFD700", "#FFA500", "#FF69B4", "#FFD700", "#FFA500"]}
                  animationSpeed={3}
                  showBorder={false}
                  className="font-bold"
                >
                  ${formatMegapot(megapotAmount)}
                </GradientText>
              </div>
              <div className={`text-lg md:text-xl font-medium ${timeRemaining <= 10 ? 'text-red-400' : 'text-white'} leading-relaxed`}>
                {formatTime(timeRemaining)}
              </div>
            </div>
            
            <MultipleChoiceExercise
              question={question}
              options={options}
              exerciseType={exerciseType}
              onAnswer={handleQuizAnswer}
              hasAnswered={hasAnswered}
            />
          </div>
        </div>
      )}

      {/* Content Overlay - Hidden when quiz is shown */}
      {!showQuiz && (
        <div className="absolute inset-0 flex flex-col justify-end">
          {/* Right side actions */}
          <div className="absolute right-2 bottom-20 flex flex-col items-center gap-6">
            {/* Profile Avatar with Follow Button */}
            <div className="relative">
              <button 
                onClick={() => {
                  console.log(`[Profile] Navigating to profile: @${username}`);
                  // TODO: Navigate to /profile/${username}
                }}
                className="w-12 h-12 rounded-full bg-neutral-300 overflow-hidden cursor-pointer"
              >
                <img 
                  src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`}
                  alt={username}
                  className="w-full h-full object-cover"
                />
              </button>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  console.log(`[Follow] Following user: @${username}`);
                  // TODO: Implement follow functionality
                }}
                className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-6 h-6 bg-[#FE2C55] hover:bg-[#FF0F3F] rounded-full flex items-center justify-center cursor-pointer transition-colors"
              >
                <Plus className="w-4 h-4 text-white" />
              </button>
            </div>

            <ActionButton 
              icon={Heart} 
              count={likes} 
              onClick={() => console.log('[Like] Liked video')}
            />

            <ActionButton 
              icon={ChatCircle} 
              count={comments} 
              onClick={() => console.log('[Comment] Opening comments')}
            />

            <ActionButton 
              icon={ShareNetwork} 
              count={shares} 
              onClick={() => console.log('[Share] Sharing video')}
            />
          </div>

          {/* Bottom info */}
          <div className="p-4 pb-20 bg-gradient-to-t from-black/80 to-transparent">
            <h3 className="text-white font-semibold mb-2">@{username}</h3>
            <p className="text-white text-sm mb-3">{description}</p>
            <div className="flex items-center gap-2">
              <MusicNote className="w-4 h-4 text-white" />
              <span className="text-white text-sm">{musicTitle}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};