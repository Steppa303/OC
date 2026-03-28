
import React, { useState } from 'react';
import { User, Project } from '../types';
import { X, Share2, Globe, Lock, Copy, Check, Filter, MessageSquare, EyeOff, Loader2 } from 'lucide-react';
import { createSharedView } from '../services/shareService';

interface ShareModalProps {
  currentUser: User;
  projects: Project[];
  onClose: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({ currentUser, projects, onClose }) => {
  const [scope, setScope] = useState<'all' | 'project'>('all');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [allowRequests, setAllowRequests] = useState(true);
  const [showDetails, setShowDetails] = useState(false);
  
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);

  const handleScopeChange = (newScope: 'all' | 'project') => {
      setScope(newScope);
      setGeneratedLink(null); // Reset link when changing settings
  };

  const handleCreateLink = async () => {
    if (scope === 'project' && !selectedProjectId) {
        alert("Bitte wähle ein Projekt aus.");
        return;
    }

    setIsLoading(true);
    try {
        // NOTE: undefined values (like projectId when scope is 'all') are handled/sanitized in shareService.ts
        const view = await createSharedView(currentUser.id, {
            projectId: scope === 'project' ? selectedProjectId : undefined,
            allowRequests,
            showDetails
        });

        // Construct URL - Assuming typical hash routing or query param for now until Phase 2 routing is finalized
        // For now: /?shareId=... to allow the main app to detect it on load (simplest integration)
        const baseUrl = window.location.origin + window.location.pathname;
        const link = `${baseUrl}?shareId=${view.id}`;
        
        setGeneratedLink(link);
    } catch (e) {
        alert("Fehler beim Erstellen des Links.");
    } finally {
        setIsLoading(false);
    }
  };

  const copyToClipboard = () => {
      if (!generatedLink) return;
      navigator.clipboard.writeText(generatedLink);
      setHasCopied(true);
      setTimeout(() => setHasCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
      <div className="bg-slate-900 w-full max-w-lg rounded-2xl border border-indigo-500/30 shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-slate-800 bg-slate-950/50">
           <div className="flex items-center gap-3">
               <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400 border border-indigo-500/20">
                   <Share2 className="w-5 h-5" />
               </div>
               <div>
                   <h2 className="font-bold text-slate-200 text-lg">Plan teilen</h2>
                   <p className="text-xs text-indigo-400/80 font-mono">Read-Only Access</p>
               </div>
           </div>
           <button onClick={onClose} className="p-2 text-slate-500 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
               <X className="w-5 h-5" />
           </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
            
            {!generatedLink ? (
                <>
                    {/* Scope Selection */}
                    <div className="space-y-3">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Was soll geteilt werden?</label>
                        <div className="grid grid-cols-2 gap-3">
                            <button 
                                onClick={() => handleScopeChange('all')}
                                className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${scope === 'all' ? 'bg-indigo-600/20 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-800/80'}`}
                            >
                                <Globe className="w-5 h-5" />
                                <span className="text-sm font-medium">Gesamter Kalender</span>
                            </button>
                            <button 
                                onClick={() => handleScopeChange('project')}
                                className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${scope === 'project' ? 'bg-indigo-600/20 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-800/80'}`}
                            >
                                <Filter className="w-5 h-5" />
                                <span className="text-sm font-medium">Einzelnes Projekt</span>
                            </button>
                        </div>

                        {scope === 'project' && (
                             <div className="animate-in slide-in-from-top-2">
                                 <select 
                                    value={selectedProjectId}
                                    onChange={(e) => setSelectedProjectId(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                 >
                                     <option value="" disabled>Projekt wählen...</option>
                                     {projects.map(p => (
                                         <option key={p.id} value={p.id}>{p.title}</option>
                                     ))}
                                 </select>
                             </div>
                        )}
                    </div>

                    {/* Permissions */}
                    <div className="space-y-3">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Einstellungen</label>
                        
                        <label className="flex items-center justify-between p-3 rounded-xl bg-slate-800/40 border border-slate-800 cursor-pointer hover:border-slate-700 transition-colors">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${allowRequests ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-700 text-slate-500'}`}>
                                    <MessageSquare className="w-4 h-4" />
                                </div>
                                <div>
                                    <div className="text-sm font-medium text-slate-200">Anfragen erlauben</div>
                                    <div className="text-xs text-slate-500">Gäste können Wünsche ("Inbound Requests") senden</div>
                                </div>
                            </div>
                            <input type="checkbox" checked={allowRequests} onChange={(e) => setAllowRequests(e.target.checked)} className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-indigo-500 focus:ring-indigo-500" />
                        </label>

                        <label className="flex items-center justify-between p-3 rounded-xl bg-slate-800/40 border border-slate-800 cursor-pointer hover:border-slate-700 transition-colors">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${showDetails ? 'bg-indigo-500/10 text-indigo-400' : 'bg-slate-700 text-slate-500'}`}>
                                    <EyeOff className="w-4 h-4" />
                                </div>
                                <div>
                                    <div className="text-sm font-medium text-slate-200">Details anzeigen</div>
                                    <div className="text-xs text-slate-500">Beschreibungen und KI-Begründungen sichtbar machen</div>
                                </div>
                            </div>
                            <input type="checkbox" checked={showDetails} onChange={(e) => setShowDetails(e.target.checked)} className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-indigo-500 focus:ring-indigo-500" />
                        </label>
                    </div>

                    <button
                        onClick={handleCreateLink}
                        disabled={isLoading}
                        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl text-sm shadow-lg shadow-indigo-900/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4"
                    >
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                        Secure Link generieren
                    </button>
                </>
            ) : (
                <div className="flex flex-col items-center animate-in zoom-in duration-300">
                    <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-400 mb-4 border border-emerald-500/20">
                        <Check className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Link erstellt!</h3>
                    <p className="text-sm text-slate-400 text-center mb-6">
                        Dieser Link gewährt Lesezugriff auf {scope === 'all' ? 'den gesamten Kalender' : 'das ausgewählte Projekt'}.
                    </p>

                    <div className="w-full flex gap-2">
                        <input 
                            type="text" 
                            readOnly 
                            value={generatedLink} 
                            className="flex-grow bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 font-mono focus:outline-none"
                        />
                        <button 
                            onClick={copyToClipboard}
                            className={`px-4 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2 ${hasCopied ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-white hover:bg-slate-700'}`}
                        >
                            {hasCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </button>
                    </div>

                    <button 
                        onClick={() => { setGeneratedLink(null); onClose(); }} 
                        className="mt-6 text-sm text-slate-500 hover:text-white"
                    >
                        Schließen
                    </button>
                </div>
            )}

        </div>
      </div>
    </div>
  );
};
