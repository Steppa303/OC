
import React from 'react';
import { InboundRequest } from '../types';
import { X, Inbox, Archive, Sparkles, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { updateRequestStatus } from '../services/shareService';

interface InboxModalProps {
  requests: InboundRequest[];
  onClose: () => void;
  onTakeover: (text: string) => void;
}

export const InboxModal: React.FC<InboxModalProps> = ({ requests, onClose, onTakeover }) => {
  
  const handleArchive = async (id: string) => {
      await updateRequestStatus(id, 'dismissed');
  };

  const handleProcess = async (req: InboundRequest) => {
      onTakeover(req.requestText);
      // Mark as processed immediately (UI will update via subscription)
      await updateRequestStatus(req.id, 'processed');
      onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
      <div className="bg-slate-900 w-full max-w-2xl rounded-2xl border border-indigo-500/30 shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200 h-[70vh]">
        
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-slate-800 bg-slate-950/50">
           <div className="flex items-center gap-3">
               <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400 border border-indigo-500/20">
                   <Inbox className="w-5 h-5" />
               </div>
               <div>
                   <h2 className="font-bold text-slate-200 text-lg">Eingang</h2>
                   <p className="text-xs text-indigo-400/80 font-mono">Offene Anfragen von extern</p>
               </div>
           </div>
           <button onClick={onClose} className="p-2 text-slate-500 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
               <X className="w-5 h-5" />
           </button>
        </div>

        {/* Content */}
        <div className="flex-grow overflow-y-auto custom-scrollbar p-4 space-y-4 bg-slate-900">
            {requests.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-500 opacity-60">
                    <CheckCircle2 className="w-16 h-16 mb-4 stroke-1" />
                    <p>Alles erledigt. Keine neuen Anfragen.</p>
                </div>
            ) : (
                requests.map(req => (
                    <div key={req.id} className="bg-slate-950/50 border border-slate-800 rounded-xl p-4 transition-all hover:border-indigo-500/30 group">
                        
                        <div className="flex justify-between items-start mb-3">
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-slate-200 text-sm">{req.guestName}</span>
                                    {req.priority === 'high' && (
                                        <span className="flex items-center gap-1 text-[10px] font-bold uppercase bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded border border-rose-500/20">
                                            <AlertCircle className="w-3 h-3" /> High Prio
                                        </span>
                                    )}
                                </div>
                                <span className="text-[10px] text-slate-500 flex items-center gap-1">
                                    <Clock className="w-3 h-3" /> {new Date(req.createdAt).toLocaleString('de-DE')}
                                </span>
                            </div>
                        </div>

                        <div className="bg-slate-900 rounded-lg p-3 text-sm text-slate-300 font-medium mb-4 whitespace-pre-wrap border border-slate-800">
                            {req.requestText}
                        </div>

                        <div className="flex justify-end gap-2">
                            <button 
                                onClick={() => handleArchive(req.id)}
                                className="px-3 py-2 rounded-lg text-xs font-bold text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-2"
                            >
                                <Archive className="w-3.5 h-3.5" /> Archivieren
                            </button>
                            <button 
                                onClick={() => handleProcess(req)}
                                className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-900/20 transition-all flex items-center gap-2 hover:scale-105"
                            >
                                <Sparkles className="w-3.5 h-3.5" /> In Planer übernehmen
                            </button>
                        </div>

                    </div>
                ))
            )}
        </div>
      </div>
    </div>
  );
};
