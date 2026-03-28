import React from 'react';
import { FiPlay, FiStopCircle, FiLoader } from 'react-icons/fi';

interface PlayControlsProps {
  isPlaying: boolean;
  onPlay: () => void;
  onStop: () => void;
  isLoading: boolean;
}

const PlayControls: React.FC<PlayControlsProps> = ({
  isPlaying,
  onPlay,
  onStop,
  isLoading
}) => {
  return (
    <div className="glass-card p-6 sm:p-8 transition-all duration-300">
      <div className="flex items-center justify-center gap-4 sm:gap-6">
        {/* Play Button */}
        <button
          onClick={onPlay}
          disabled={isPlaying || isLoading}
          className={`
            relative group flex items-center justify-center gap-3
            w-full sm:w-auto px-8 py-4 sm:py-5 min-h-[56px]
            bg-gradient-to-r from-purple-600 to-indigo-600
            hover:from-purple-500 hover:to-indigo-500
            active:from-purple-700 active:to-indigo-700
            disabled:from-gray-600 disabled:to-gray-700
            disabled:cursor-not-allowed
            text-white font-bold text-lg sm:text-xl
            rounded-xl shadow-lg
            hover:shadow-xl hover:shadow-purple-500/30
            active:shadow-inner
            transform transition-all duration-300
            hover:scale-105 active:scale-95
            disabled:transform-none disabled:opacity-60
            focus:outline-none focus:ring-2 focus:ring-purple-500/50
            min-w-[160px] sm:min-w-[180px]
          `}
          aria-label="Abspielen"
        >
          {isLoading && isPlaying ? (
            <FiLoader className="w-6 h-6 sm:w-7 sm:h-7 animate-spin" />
          ) : (
            <FiPlay className="w-6 h-6 sm:w-7 sm:h-7 group-hover:scale-110 transition-transform duration-300" />
          )}
          <span className="tracking-wide">
            {isLoading && isPlaying ? 'STARTET...' : 'PLAY'}
          </span>
        </button>

        {/* Stop Button */}
        <button
          onClick={onStop}
          disabled={!isPlaying || isLoading}
          className={`
            relative group flex items-center justify-center gap-3
            w-full sm:w-auto px-8 py-4 sm:py-5 min-h-[56px]
            bg-gradient-to-r from-red-600 to-pink-600
            hover:from-red-500 hover:to-pink-500
            active:from-red-700 active:to-pink-700
            disabled:from-gray-600 disabled:to-gray-700
            disabled:cursor-not-allowed
            text-white font-bold text-lg sm:text-xl
            rounded-xl shadow-lg
            hover:shadow-xl hover:shadow-red-500/30
            active:shadow-inner
            transform transition-all duration-300
            hover:scale-105 active:scale-95
            disabled:transform-none disabled:opacity-60
            focus:outline-none focus:ring-2 focus:ring-red-500/50
            min-w-[160px] sm:min-w-[180px]
          `}
          aria-label="Stoppen"
        >
          {isLoading && !isPlaying ? (
            <FiLoader className="w-6 h-6 sm:w-7 sm:h-7 animate-spin" />
          ) : (
            <FiStopCircle className="w-6 h-6 sm:w-7 sm:h-7 group-hover:scale-110 transition-transform duration-300" />
          )}
          <span className="tracking-wide">
            {isLoading && !isPlaying ? 'STOPPT...' : 'STOP'}
          </span>
        </button>
      </div>

      {/* Status Indicator */}
      <div className="mt-4 sm:mt-6 flex items-center justify-center gap-2">
        <div className={`
          w-3 h-3 rounded-full transition-all duration-300
          ${isPlaying 
            ? 'bg-green-400 shadow-lg shadow-green-400/50 animate-pulse' 
            : 'bg-gray-500'
          }
        `} />
        <span className="text-white/60 text-sm font-light">
          {isLoading 
            ? (isPlaying ? 'Initialisiere...' : 'Beende...')
            : isPlaying 
              ? 'Aktiv' 
              : 'Bereit'
          }
        </span>
      </div>
    </div>
  );
};

export default PlayControls;
