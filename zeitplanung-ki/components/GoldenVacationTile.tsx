import React, { useState, useEffect } from 'react';
import { Palmtree, Sun, Waves, Music } from 'lucide-react';

const VACATION_AUDIO_URL = "https://firebasestorage.googleapis.com/v0/b/grandiosezeitplanung.firebasestorage.app/o/attachments%2Furlaub.wav?alt=media&token=fbd73246-9d26-44fb-83c7-4c915781661f";

// --- PRELOAD LOGIC ---
// Create a global Audio instance at module level so it fetches immediately when the app loads.
const preloadedAudio = new Audio(VACATION_AUDIO_URL);
preloadedAudio.preload = 'auto'; // Hint browser to download immediately
preloadedAudio.loop = true;
preloadedAudio.volume = 0.5;
// Force load call to start buffering
preloadedAudio.load();

/**
 * GoldenVacationTile - Die isolierte Urlaubskachel.
 * Alle Animationen (Liquid Gold, Dancing Palm, Particles) sind hier enthalten.
 */
export const GoldenVacationTile = () => {
  const [isHovered, setIsHovered] = useState(false);

  // Safety cleanup: Ensure audio stops if component unmounts
  useEffect(() => {
    return () => {
      preloadedAudio.pause();
      preloadedAudio.currentTime = 0;
    };
  }, []);

  const handleMouseEnter = () => {
    setIsHovered(true);
    
    const playPromise = preloadedAudio.play();
    if (playPromise !== undefined) {
        playPromise.catch(error => {
            console.debug("Audio play blocked (waiting for user interaction):", error);
        });
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    preloadedAudio.pause();
    preloadedAudio.currentTime = 0; // Reset to start
  };

  return (
    <div 
      className="relative group cursor-pointer select-none"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* CSS-Animationen für die Kachel */}
      <style>{`
        @keyframes liquid-gold {
          0% { transform: translateX(-250%) skewX(-30deg); }
          100% { transform: translateX(250%) skewX(-30deg); }
        }
        @keyframes dub-wave {
          0%, 100% { transform: translateX(-15%) translateY(30px); }
          50% { transform: translateX(15%) translateY(-30px); }
        }
        @keyframes dub-dance {
          0%, 100% { transform: rotate(-10deg) scale(1); }
          50% { transform: rotate(10deg) scale(1.15); }
        }
        @keyframes dub-shake {
          0%, 100% { transform: scale(1.1) rotate(0deg); }
          25% { transform: scale(1.13) rotate(-1deg); } 
          75% { transform: scale(1.13) rotate(1deg); }  
        }
        @keyframes bass-pulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 0.9; transform: scale(1.1); }
        }
        @keyframes dub-float {
          0% { transform: translateY(0) translateX(0) scale(1); opacity: 0; }
          30% { opacity: 1; }
          100% { transform: translateY(-300px) translateX(100px) scale(0); opacity: 0; }
        }
        .animate-liquid-gold { animation: liquid-gold 2.5s ease-in-out infinite; }
        .animate-dub-shake { animation: dub-shake 0.7s linear infinite; }
        .animate-dub-dance { animation: dub-dance 1.4s ease-in-out infinite; }
        .animate-bass-pulse { animation: bass-pulse 0.7s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
        .animate-dub-float { animation: dub-float linear infinite; }
        .animate-dub-wave { animation: dub-wave 5s ease-in-out infinite; }
      `}</style>

      {/* Massives Glow Aura (Äußerer Effekt) */}
      <div className={`absolute -inset-24 bg-gradient-to-r from-red-600/40 via-yellow-500/40 to-emerald-600/40 rounded-[6rem] blur-[120px] transition-opacity duration-700 pointer-events-none ${isHovered ? 'opacity-80 animate-bass-pulse' : 'opacity-0'}`}></div>

      {/* Die Haupt-Kachel */}
      <div className={`relative w-96 h-96 sm:w-[32rem] sm:h-[32rem] rounded-[5rem] overflow-hidden border-[10px] border-amber-200/50 shadow-[0_100px_200px_-50px_rgba(0,0,0,0.9),inset_0_0_100px_rgba(255,255,255,0.5)] flex flex-col items-center justify-center bg-gradient-to-br from-amber-400 via-yellow-50 to-amber-950 transition-all duration-700 ${isHovered ? 'scale-110 -rotate-1 animate-dub-shake' : ''}`}>
        
        {/* Rasta-Streifen oben */}
        <div className="absolute top-0 left-0 right-0 h-8 flex shadow-2xl z-40 border-b-2 border-black/20">
          <div className="h-full w-1/3 bg-[#CC0000]"></div>
          <div className="h-full w-1/3 bg-[#FFCC00]"></div>
          <div className="h-full w-1/3 bg-[#007700]"></div>
        </div>

        {/* Shine Effekt (Liquid Gold) */}
        <div className={`absolute inset-0 bg-gradient-to-tr from-transparent via-white/70 to-transparent -translate-x-full pointer-events-none z-10 ${isHovered ? 'animate-liquid-gold' : ''}`}></div>

        {/* Hintergrund Dekoration */}
        <Sun className={`absolute top-12 right-12 w-36 h-36 text-amber-300/30 transition-all duration-[5000ms] ${isHovered ? 'rotate-[1080deg] scale-150' : 'rotate-0'}`} />
        
        <div className="absolute bottom-0 left-0 right-0 h-64 opacity-30 pointer-events-none z-10">
          <Waves className="w-full h-full text-amber-950 animate-dub-wave" />
        </div>

        {/* Zentrale Palme */}
        <div className={`relative z-30 transform transition-all duration-1000 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${isHovered ? 'scale-140 translate-y-[-20px]' : ''}`}>
          <div className={`absolute -inset-16 bg-white/60 blur-[80px] rounded-full transition-opacity duration-700 ${isHovered ? 'opacity-100' : 'opacity-20'}`}></div>
          <Palmtree 
            className={`w-64 h-64 sm:w-80 sm:h-80 text-slate-950 drop-shadow-[0_40px_60px_rgba(0,0,0,0.7)] ${isHovered ? 'animate-dub-dance' : ''}`} 
            strokeWidth={0.5}
          />
        </div>

        {/* Vacation Badge (formerly Legend) */}
        <div className="mt-12 z-30 text-center">
          <div className={`px-12 py-5 bg-slate-950/95 rounded-[3rem] border-4 border-amber-400 transition-all duration-1000 ${isHovered ? 'shadow-[0_0_80px_rgba(251,191,36,1)] scale-110 border-white rotate-2' : ''}`}>
            <span className="text-amber-400 font-black text-4xl sm:text-5xl flex items-center gap-6 tracking-tighter">
              <Sun className={`w-12 h-12 ${isHovered ? 'animate-spin' : ''}`} />
              URLAUB
            </span>
          </div>
        </div>

        {/* Schwebende Licht-Partikel */}
        {[...Array(15)].map((_, i) => (
          <div 
            key={i}
            className={`absolute w-4 h-4 bg-yellow-100 rounded-full transition-opacity duration-1000 ${isHovered ? 'opacity-70 animate-dub-float' : 'opacity-0'}`}
            style={{
              top: `${10 + Math.random() * 80}%`,
              left: `${10 + Math.random() * 80}%`,
              animationDelay: `${i * 0.15}s`,
              animationDuration: `${2 + Math.random() * 4}s`
            }}
          ></div>
        ))}
      </div>
    </div>
  );
};