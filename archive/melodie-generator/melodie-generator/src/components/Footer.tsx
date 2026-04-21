import React from 'react';
import { FiInfo, FiHeart, FiCode } from 'react-icons/fi';

const Footer: React.FC = () => {
  return (
    <footer className="glass-card px-6 py-4 sm:px-8 sm:py-5 transition-all duration-300">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-2 text-white/60 text-xs sm:text-sm">
          <FiInfo className="w-4 h-4 text-purple-400" />
          <span className="font-light">
            Generative Musik in Echtzeit
          </span>
        </div>
        
        <div className="flex items-center gap-4 sm:gap-6 text-white/40 text-xs sm:text-sm">
          <div className="flex items-center gap-1.5 hover:text-white/70 transition-colors duration-300 cursor-default">
            <FiCode className="w-3.5 h-3.5" />
            <span>React + TypeScript</span>
          </div>
          <div className="flex items-center gap-1.5 hover:text-white/70 transition-colors duration-300 cursor-default">
            <FiHeart className="w-3.5 h-3.5 text-pink-400" />
            <span>Made with passion</span>
          </div>
        </div>
      </div>
      
      <div className="mt-3 pt-3 border-t border-white/10 text-center">
        <p className="text-white/30 text-xs font-light">
          © {new Date().getFullYear()} MelodieGenerator • Alle Einstellungen sind in Echtzeit anpassbar
        </p>
      </div>
    </footer>
  );
};

export default Footer;
