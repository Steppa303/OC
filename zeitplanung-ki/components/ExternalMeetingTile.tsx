import React from 'react';
import { Car } from 'lucide-react';

interface ExternalMeetingTileProps {
  weekday: string;
  day: string;
  hours: number;
  phases: { title: string; color: string }[];
}

export const ExternalMeetingTile: React.FC<ExternalMeetingTileProps> = ({ weekday, day, hours, phases }) => {
  return (
    <div className="absolute inset-0 bg-slate-900 border border-cyan-500/30 flex flex-col items-center justify-center p-2 text-center overflow-hidden">
      {/* Background Tech Elements */}
      <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-cyan-500"></div>
      <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-cyan-500"></div>
      <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-cyan-500"></div>
      <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-cyan-500"></div>
      
      <div className="absolute inset-0 bg-cyan-500/5 animate-pulse"></div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-1">
        <div className="flex items-center gap-1 text-[10px] font-mono font-bold text-cyan-500 uppercase tracking-widest">
            <Car className="w-3 h-3" />
            <span>EXTERN</span>
        </div>
        
        <div className="text-2xl font-black text-white leading-none mt-1">{day}</div>
        <div className="text-[9px] font-bold text-slate-500 uppercase">{weekday}</div>

        <div className="mt-2 flex flex-col gap-1 w-full px-2">
            {phases.slice(0, 2).map((p, i) => (
                <div key={i} className="flex items-center gap-1 text-[9px] text-cyan-100 bg-cyan-900/40 px-1 py-0.5 rounded border border-cyan-500/20 truncate">
                    <div className={`w-1.5 h-1.5 rounded-full ${p.color} shrink-0`}></div>
                    <span className="truncate">{p.title}</span>
                </div>
            ))}
            {phases.length > 2 && (
                <div className="text-[8px] text-cyan-500/70">+ {phases.length - 2} more</div>
            )}
        </div>
        
        <div className="absolute top-1 right-1 text-[9px] font-mono text-cyan-400">
            {hours}h
        </div>
      </div>
    </div>
  );
};