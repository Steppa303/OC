
import React from 'react';
import { DayCapacity, DAILY_CAPACITY_HOURS } from '../types';
import { TrendingUp } from 'lucide-react';

interface CapacityTrendProps {
  days: DayCapacity[];
}

export const CapacityTrend: React.FC<CapacityTrendProps> = ({ days }) => {
  // Take next 7 days for the sparkline
  const trendDays = days.slice(0, 7);
  
  if (trendDays.length === 0) return null;

  // --- SMART AVERAGE CALCULATION ---
  const totalLoad = trendDays.reduce((a, b) => a + b.totalHoursBooked, 0);

  // Count days that are relevant for the average:
  // 1. All Weekdays (Mon-Fri) are counted (even if 0, to show availability)
  // 2. Weekends are ONLY counted if work is actually scheduled there
  const relevantDaysCount = trendDays.reduce((count, day) => {
      const date = new Date(day.date);
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;

      if (!isWeekend || day.totalHoursBooked > 0) {
          return count + 1;
      }
      return count;
  }, 0);

  const averageLoad = relevantDaysCount > 0 ? totalLoad / relevantDaysCount : 0;
  // ---------------------------------

  // Calculate SVG points
  const width = 200;
  const height = 50;
  const maxHours = Math.max(DAILY_CAPACITY_HOURS * 1.5, ...trendDays.map(d => d.totalHoursBooked));
  const stepX = width / (trendDays.length - 1);

  // Generate points for the smooth line
  const points = trendDays.map((day, index) => {
    const x = index * stepX;
    // Invert Y axis (0 is top in SVG)
    const y = height - (day.totalHoursBooked / maxHours) * height;
    return `${x},${y}`;
  }).join(' ');

  // Create area path (line points + close loop at bottom)
  const areaPoints = `${points} ${width},${height} 0,${height}`;

  return (
    <div className="glass-card rounded-2xl p-6 relative overflow-hidden">
        <div className="flex justify-between items-start mb-4">
            <div>
                <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-indigo-400" />
                    7-Day Load
                </h3>
            </div>
            <div className="text-xs font-mono text-slate-500" title={`Based on ${relevantDaysCount} active days`}>
               Avg: {averageLoad.toFixed(1)}h
            </div>
        </div>

        <div className="h-[60px] w-full relative">
            {/* SVG Graph */}
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible" preserveAspectRatio="none">
                {/* Gradient Definition */}
                <defs>
                    <linearGradient id="trendGradient" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity="0.5" />
                        <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
                    </linearGradient>
                </defs>

                {/* Dashed Line for Capacity Limit */}
                <line 
                    x1="0" 
                    y1={height - (DAILY_CAPACITY_HOURS / maxHours) * height} 
                    x2={width} 
                    y2={height - (DAILY_CAPACITY_HOURS / maxHours) * height} 
                    stroke="#475569" 
                    strokeWidth="1" 
                    strokeDasharray="4 4" 
                    className="opacity-50"
                />

                {/* Area Fill */}
                <polygon points={areaPoints} fill="url(#trendGradient)" />

                {/* The Line */}
                <polyline 
                    points={points} 
                    fill="none" 
                    stroke="#818cf8" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                />

                {/* Data Points */}
                {trendDays.map((day, index) => {
                     const x = index * stepX;
                     const y = height - (day.totalHoursBooked / maxHours) * height;
                     const isOverloaded = day.totalHoursBooked > DAILY_CAPACITY_HOURS;
                     
                     return (
                         <circle 
                            key={index} 
                            cx={x} 
                            cy={y} 
                            r={isOverloaded ? 3 : 2} 
                            className={`${isOverloaded ? 'fill-red-500 stroke-red-500/50' : 'fill-indigo-400 stroke-indigo-900'} transition-all hover:r-4`}
                            strokeWidth="2"
                         />
                     );
                })}
            </svg>
        </div>
        
        {/* X-Axis Labels */}
        <div className="flex justify-between mt-2 text-[9px] font-mono text-slate-500 uppercase">
             {trendDays.map((d, i) => (
                 <span key={i}>{new Date(d.date).toLocaleDateString('de-DE', { weekday: 'short' }).slice(0, 2)}</span>
             ))}
        </div>
    </div>
  );
};
