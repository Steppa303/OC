import React from 'react';
import { FiMusic } from 'react-icons/fi';

interface HeaderProps {
  isLoading?: boolean;
}

const Header: React.FC<HeaderProps> = ({ isLoading = false }) => {
  return (
    <header className="glass-card px-6 py-4 sm:px-8 sm:py-5 transition-all duration-300">
      <div className="flex items-center justify-center gap-3 sm:gap-4">
        <div className={`relative ${isLoading ? 'animate-pulse' : ''}`}>
          <FiMusic 
            className="w-8 h-8 sm:w-10 sm:h-10 text-purple-400"
            style={{ 
              filter: 'drop-shadow(0 0 8px rgba(168, 85, 247, 0.6))',
              transition: 'all 0.3s ease'
            }}
          />
          {isLoading && (
            <div className="absolute inset-0 w-8 h-8 sm:w-10 sm:h-10">
              <div className="absolute inset-0 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
        
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold gradient-text tracking-tight">
          MelodieGenerator
        </h1>
      </div>
      
      <p className="text-center text-white/60 text-xs sm:text-sm mt-2 font-light">
        Generative Musik • Echtzeit Visualisierung
      </p>
    </header>
  );
};

export default Header;
