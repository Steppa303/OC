import React from 'react';
import { Grid3x3, LayoutGrid, StretchHorizontal } from 'lucide-react';

export type ZoomLevel = 'macro' | 'standard' | 'micro';

interface ZoomControllerProps {
  currentLevel: ZoomLevel;
  onChange: (level: ZoomLevel) => void;
}

export const ZoomController: React.FC<ZoomControllerProps> = ({ currentLevel, onChange }) => {
  return (
    <div className="flex bg-slate-900/50 p-1 rounded-lg border border-slate-800/50 backdrop-blur-sm">
      <button
        onClick={() => onChange('macro')}
        className={`p-2 rounded-md transition-all duration-200 flex items-center gap-2 ${
          currentLevel === 'macro' 
            ? 'bg-slate-700 text-white shadow-sm ring-1 ring-white/10' 
            : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
        }`}
        title="Macro View (90 Days)"
      >
        <Grid3x3 className="w-4 h-4" />
        {currentLevel === 'macro' && <span className="text-xs font-bold animate-in fade-in zoom-in duration-200">90d</span>}
      </button>

      <button
        onClick={() => onChange('standard')}
        className={`p-2 rounded-md transition-all duration-200 flex items-center gap-2 ${
          currentLevel === 'standard' 
            ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/20' 
            : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
        }`}
        title="Standard View (28 Days)"
      >
        <LayoutGrid className="w-4 h-4" />
        {currentLevel === 'standard' && <span className="text-xs font-bold animate-in fade-in zoom-in duration-200">Month</span>}
      </button>

      <button
        onClick={() => onChange('micro')}
        className={`p-2 rounded-md transition-all duration-200 flex items-center gap-2 ${
          currentLevel === 'micro' 
            ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-500/20' 
            : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
        }`}
        title="Micro View (7 Days)"
      >
        <StretchHorizontal className="w-4 h-4" />
        {currentLevel === 'micro' && <span className="text-xs font-bold animate-in fade-in zoom-in duration-200">Week</span>}
      </button>
    </div>
  );
};