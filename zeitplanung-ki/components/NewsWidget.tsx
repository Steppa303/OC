import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CHANGELOG_DATA, ChangelogEntry, ChangeType } from '../data/changelog';
import { Sparkles, Zap, Wrench, ChevronRight, X, PartyPopper, Calendar } from 'lucide-react';

export const NewsWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [latestVersion, setLatestVersion] = useState('');

  useEffect(() => {
    const currentLatest = CHANGELOG_DATA[0]?.version || '0.0.0';
    setLatestVersion(currentLatest);
    
    const lastSeen = localStorage.getItem('last_seen_version');
    
    // Check if new version available (or first visit)
    if (!lastSeen || lastSeen !== currentLatest) {
      setHasUnread(true);
      // AUTO-OPEN MODAL ON APP START IF NEW
      setIsOpen(true);
    }
  }, []);

  const handleOpen = () => {
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
    // Mark as read when closing/dismissing
    setHasUnread(false);
    if (latestVersion) {
        localStorage.setItem('last_seen_version', latestVersion);
    }
  };

  const getIcon = (type: ChangeType) => {
    switch (type) {
      case 'FEATURE': return <Sparkles className="w-3.5 h-3.5 text-indigo-400" />;
      case 'IMPROVEMENT': return <Zap className="w-3.5 h-3.5 text-amber-400" />;
      case 'FIX': return <Wrench className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  const getTypeLabel = (type: ChangeType) => {
    switch (type) {
      case 'FEATURE': return 'Neu';
      case 'IMPROVEMENT': return 'Verbessert';
      case 'FIX': return 'Fix';
    }
  };

  const getTypeColor = (type: ChangeType) => {
      switch (type) {
        case 'FEATURE': return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
        case 'IMPROVEMENT': return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
        case 'FIX': return 'bg-slate-700/50 text-slate-400 border-slate-600/50';
      }
  };

  const latestEntry = CHANGELOG_DATA[0];

  return (
    <>
      {/* Compact Widget Card */}
      <div 
        onClick={handleOpen}
        className="glass-card rounded-2xl p-6 relative overflow-hidden group cursor-pointer border border-slate-800 hover:border-indigo-500/30 transition-all duration-300"
      >
        {/* Animated Background Blob */}
        <div className={`absolute -right-10 -top-10 w-40 h-40 bg-indigo-500/20 rounded-full blur-[60px] group-hover:bg-indigo-500/30 transition duration-700 ${hasUnread ? 'animate-pulse' : ''}`}></div>
        
        <div className="relative z-10 flex justify-between items-start">
           <div>
              <h3 className="font-bold text-lg mb-1 text-white flex items-center gap-2">
                 <PartyPopper className={`w-4 h-4 ${hasUnread ? 'text-indigo-400 animate-bounce' : 'text-slate-400'}`} /> 
                 Was ist neu?
              </h3>
              <p className="text-slate-400 text-xs font-mono uppercase tracking-widest mb-3">
                 v{latestEntry.version} • {latestEntry.title}
              </p>
           </div>
           
           {hasUnread && (
               <span className="relative flex h-3 w-3">
                 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                 <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
               </span>
           )}
        </div>

        <div className="relative z-10">
           <button className="text-sm text-indigo-400 font-medium group-hover:text-indigo-300 flex items-center gap-1 transition-colors">
              Changelog ansehen <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
           </button>
        </div>
      </div>

      {/* Modal / Expanded View (PORTAL) */}
      {isOpen && createPortal(
        <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 animate-in fade-in duration-300"
            onClick={handleClose} // Click outside to close
        >
           <div 
                onClick={(e) => e.stopPropagation()} // Prevent close on content click
                className="bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col animate-in zoom-in-95 duration-300 scale-100"
           >
              
              {/* Header */}
              <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950/50 rounded-t-2xl">
                 <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                       <Sparkles className="w-5 h-5 text-indigo-400" /> What's New
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">Die neuesten Updates und Verbesserungen.</p>
                 </div>
                 <button onClick={handleClose} className="p-2 text-slate-500 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
                    <X className="w-6 h-6" />
                 </button>
              </div>

              {/* Scrollable List */}
              <div className="overflow-y-auto p-6 space-y-8 custom-scrollbar">
                 {CHANGELOG_DATA.map((entry, idx) => (
                    <div key={entry.version} className={`relative pl-8 ${idx !== CHANGELOG_DATA.length - 1 ? 'pb-8 border-l border-slate-800' : ''}`}>
                        {/* Timeline Dot */}
                        <div className={`absolute left-[-5px] top-0 w-2.5 h-2.5 rounded-full ring-4 ring-slate-900 ${idx === 0 ? 'bg-indigo-500' : 'bg-slate-700'}`}></div>
                        
                        <div className="flex flex-col gap-1 mb-4">
                           <div className="flex items-center gap-3">
                              <span className={`text-sm font-bold ${idx === 0 ? 'text-white' : 'text-slate-300'}`}>v{entry.version}</span>
                              <span className="text-xs text-slate-500 font-mono flex items-center gap-1 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                                 <Calendar className="w-3 h-3" /> {new Date(entry.date).toLocaleDateString()}
                              </span>
                           </div>
                           <h3 className="text-xl font-bold text-indigo-100">{entry.title}</h3>
                        </div>

                        <div className="space-y-3">
                           {entry.changes.map((change, cIdx) => (
                              <div key={cIdx} className="flex gap-3 items-start group">
                                 <div className={`mt-0.5 p-1 rounded-md shrink-0 border ${getTypeColor(change.type)}`}>
                                     {getIcon(change.type)}
                                 </div>
                                 <div>
                                     <div className="flex items-baseline gap-2 mb-0.5">
                                        <span className={`text-[10px] font-bold uppercase tracking-wider ${change.type === 'FEATURE' ? 'text-indigo-400' : change.type === 'IMPROVEMENT' ? 'text-amber-400' : 'text-slate-400'}`}>
                                            {getTypeLabel(change.type)}
                                        </span>
                                     </div>
                                     <p className="text-sm text-slate-300 leading-relaxed">{change.text}</p>
                                 </div>
                              </div>
                           ))}
                        </div>
                    </div>
                 ))}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-slate-800 bg-slate-950/50 rounded-b-2xl text-center">
                 <button onClick={handleClose} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors text-sm shadow-lg shadow-indigo-900/20">
                    Verstanden & Schließen
                 </button>
              </div>

           </div>
        </div>,
        document.body
      )}
    </>
  );
};
