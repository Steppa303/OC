
import React, { useState, useEffect, useRef } from 'react';
import { User, BugTicket, BugPriority, BugStatus, BugComment } from '../types';
import { X, Bug, Send, Paperclip, CheckCircle2, AlertCircle, Clock, Ban, MessageSquare, ChevronRight, Filter, Loader2, Image as ImageIcon, Check } from 'lucide-react';
import { db } from '../lib/firebase';
import { generateId, uploadFile } from '../utils';

interface BugTrackerModalProps {
  currentUser: User;
  onClose: () => void;
}

export const BugTrackerModal: React.FC<BugTrackerModalProps> = ({ currentUser, onClose }) => {
  const [activeTab, setActiveTab] = useState<'report' | 'list'>('list');
  const [tickets, setTickets] = useState<BugTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<BugTicket | null>(null);
  const [showMyBugsOnly, setShowMyBugsOnly] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // --- REPORT FORM STATE ---
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPriority, setNewPriority] = useState<BugPriority>('medium');
  const [newAttachment, setNewAttachment] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- COMMENT STATE ---
  const [commentText, setCommentText] = useState('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<string | null>(null); // Stores the status currently being applied

  // --- FETCH TICKETS ---
  useEffect(() => {
    setIsLoading(true);
    const unsubscribe = db.collection('bugs')
      .orderBy('updatedAt', 'desc')
      .onSnapshot((snapshot) => {
        // FIX: Spread doc.data() BEFORE id: doc.id to ensure the Firestore Document ID is the one used.
        // This fixes "No document to update" errors if the internal ID field differs from the Document ID.
        const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as BugTicket));
        setTickets(data);
        
        // Update selected ticket in real-time if open
        if (selectedTicket) {
            const updatedSelected = data.find(t => t.id === selectedTicket.id);
            if (updatedSelected) {
                // Determine if we need to clear the unread flag locally
                // Only prevent update if we are currently typing to avoid jitter, 
                // but generally we want realtime updates.
                if (updatedSelected.reporterId === currentUser.id && updatedSelected.hasUnreadUpdate) {
                    markAsRead(updatedSelected.id);
                } else {
                    setSelectedTicket(updatedSelected);
                }
            }
        }
        setIsLoading(false);
      });
    return () => unsubscribe();
  }, [selectedTicket?.id, currentUser.id]);

  const markAsRead = async (ticketId: string) => {
      // Optimistic update locally
      setSelectedTicket(prev => prev ? ({...prev, hasUnreadUpdate: false}) : null);
      // DB Update
      try {
          await db.collection('bugs').doc(ticketId).update({ hasUnreadUpdate: false });
      } catch (e) {
          console.error("Failed to mark as read", e);
      }
  };

  // --- ACTIONS ---

  const handleCreateBug = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDesc.trim()) return;

    setIsSubmitting(true);
    try {
        let attachmentUrl: string | undefined = undefined;
        if (newAttachment) {
            attachmentUrl = await uploadFile(newAttachment);
        }

        const bugId = generateId();
        const newBug: BugTicket = {
            id: bugId, 
            reporterId: currentUser.id,
            reporterName: currentUser.name,
            title: newTitle,
            description: newDesc,
            priority: newPriority,
            status: 'open',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            hasUnreadUpdate: false,
            comments: [],
            ...(attachmentUrl ? { attachmentUrl } : {})
        };

        // FIX: Use .doc(id).set() instead of .add() to ensure Document ID matches internal ID field
        await db.collection('bugs').doc(bugId).set(newBug);
        
        // Reset form
        setNewTitle('');
        setNewDesc('');
        setNewPriority('medium');
        setNewAttachment(null);
        setActiveTab('list');
    } catch (error) {
        console.error("Error creating bug", error);
        alert("Konnte Bug nicht erstellen.");
    } finally {
        setIsSubmitting(false);
    }
  };

  const handlePostComment = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedTicket || !commentText.trim()) return;

      const newComment: BugComment = {
          id: generateId(),
          authorId: currentUser.id,
          authorName: currentUser.name,
          text: commentText,
          createdAt: new Date().toISOString(),
          isSystemMessage: false
      };

      const isReporter = selectedTicket.reporterId === currentUser.id;
      const updatedComments = [...(selectedTicket.comments || []), newComment];
      
      // Optimistic UI Update
      const prevTicket = selectedTicket;
      setSelectedTicket({ ...selectedTicket, comments: updatedComments });
      setCommentText('');

      try {
          const ticketRef = db.collection('bugs').doc(selectedTicket.id);
          await ticketRef.update({
              comments: updatedComments,
              updatedAt: new Date().toISOString(),
              hasUnreadUpdate: !isReporter
          });
      } catch (err) {
          console.error("Failed to post comment", err);
          setSelectedTicket(prevTicket); // Revert on error
          alert("Fehler beim Senden des Kommentars.");
      }
  };

  const handleStatusChange = async (newStatus: BugStatus) => {
      if (!selectedTicket) return;
      if (selectedTicket.status === newStatus) return;

      setIsUpdatingStatus(newStatus);

      const systemComment: BugComment = {
          id: generateId(),
          authorId: currentUser.id,
          authorName: currentUser.name,
          text: `Status geändert zu: ${newStatus.toUpperCase().replace('_', ' ')}`,
          createdAt: new Date().toISOString(),
          isSystemMessage: true
      };

      const isReporter = selectedTicket.reporterId === currentUser.id;
      const updatedComments = [...(selectedTicket.comments || []), systemComment];

      // Optimistic UI Update
      const prevTicket = selectedTicket;
      setSelectedTicket({ 
          ...selectedTicket, 
          status: newStatus,
          comments: updatedComments,
          updatedAt: new Date().toISOString()
      });

      try {
        const ticketRef = db.collection('bugs').doc(selectedTicket.id);
        await ticketRef.update({
            status: newStatus,
            updatedAt: new Date().toISOString(),
            comments: updatedComments,
            hasUnreadUpdate: !isReporter
        });
      } catch (err) {
        console.error("Failed to update status", err);
        setSelectedTicket(prevTicket); // Revert
        alert("Status konnte nicht geändert werden.");
      } finally {
        setIsUpdatingStatus(null);
      }
  };

  // --- HELPER UI ---

  const getStatusBadge = (status: BugStatus) => {
      switch (status) {
          case 'open': return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-700 text-slate-300 border border-slate-600">Open</span>;
          case 'in_progress': return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/20 text-amber-400 border border-amber-500/30">In Progress</span>;
          case 'resolved': return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Resolved</span>;
          case 'wont_fix': return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-red-500/20 text-red-400 border border-red-500/30">Wont Fix</span>;
      }
  };

  const getPriorityIcon = (prio: BugPriority) => {
      switch (prio) {
          case 'low': return <span className="w-2 h-2 rounded-full bg-slate-500" title="Low"></span>;
          case 'medium': return <span className="w-2 h-2 rounded-full bg-amber-500" title="Medium"></span>;
          case 'high': return <span className="w-2 h-2 rounded-full bg-orange-500" title="High"></span>;
          case 'critical': return <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse" title="Critical"></span>;
      }
  };

  const filteredTickets = showMyBugsOnly 
    ? tickets.filter(t => t.reporterId === currentUser.id)
    : tickets;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-slate-900 w-full max-w-4xl h-[85vh] rounded-2xl border border-rose-900/30 shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* HEADER */}
        <div className="flex justify-between items-center p-4 border-b border-slate-800 bg-slate-950/50">
           <div className="flex items-center gap-3">
               <div className="p-2 bg-rose-500/10 rounded-lg text-rose-500 border border-rose-500/20">
                   <Bug className="w-5 h-5" />
               </div>
               <div>
                   <h2 className="font-bold text-slate-200">Bug Tracker</h2>
                   <p className="text-xs text-rose-400/80 font-mono">Melden, nicht meckern.</p>
               </div>
           </div>
           <button onClick={onClose} className="p-2 text-slate-500 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
               <X className="w-5 h-5" />
           </button>
        </div>

        {/* TABS & CONTENT */}
        <div className="flex flex-grow overflow-hidden">
            
            {/* SIDEBAR / LIST */}
            <div className={`flex flex-col w-full md:w-1/3 border-r border-slate-800 bg-slate-900/50 ${selectedTicket ? 'hidden md:flex' : 'flex'}`}>
                {/* Controls */}
                <div className="p-3 border-b border-slate-800 flex gap-2">
                    <button 
                        onClick={() => { setActiveTab('list'); setSelectedTicket(null); }}
                        className={`flex-1 py-2 text-xs font-bold uppercase tracking-wide rounded-lg transition-colors ${activeTab === 'list' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        Liste
                    </button>
                    <button 
                        onClick={() => { setActiveTab('report'); setSelectedTicket(null); }}
                        className={`flex-1 py-2 text-xs font-bold uppercase tracking-wide rounded-lg transition-colors ${activeTab === 'report' ? 'bg-rose-600 text-white shadow-lg shadow-rose-900/20' : 'text-slate-500 hover:text-rose-400'}`}
                    >
                        + Melden
                    </button>
                </div>

                {activeTab === 'list' && (
                    <>
                        <div className="px-3 py-2 flex items-center justify-between text-xs text-slate-500 border-b border-slate-800/50">
                            <span>{filteredTickets.length} Tickets</span>
                            <button 
                                onClick={() => setShowMyBugsOnly(!showMyBugsOnly)}
                                className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${showMyBugsOnly ? 'bg-indigo-500/20 text-indigo-300' : 'hover:bg-slate-800'}`}
                            >
                                <Filter className="w-3 h-3" /> Nur Meine
                            </button>
                        </div>
                        <div className="flex-grow overflow-y-auto custom-scrollbar">
                            {isLoading ? (
                                <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-slate-600" /></div>
                            ) : filteredTickets.length === 0 ? (
                                <div className="text-center p-8 text-slate-500 text-xs italic">Keine Bugs gefunden. <br/> Alles sauber!</div>
                            ) : (
                                filteredTickets.map(ticket => {
                                    const isUnread = ticket.reporterId === currentUser.id && ticket.hasUnreadUpdate;
                                    return (
                                        <div 
                                            key={ticket.id}
                                            onClick={() => {
                                                setSelectedTicket(ticket);
                                                if (isUnread) markAsRead(ticket.id);
                                            }}
                                            className={`p-3 border-b border-slate-800 hover:bg-slate-800/50 cursor-pointer transition-colors relative group ${selectedTicket?.id === ticket.id ? 'bg-slate-800 border-l-2 border-l-rose-500' : 'border-l-2 border-l-transparent'}`}
                                        >
                                            <div className="flex justify-between items-start mb-1">
                                                <div className="font-medium text-sm text-slate-200 truncate pr-2 flex items-center gap-2">
                                                    {isUnread && <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shrink-0"></span>}
                                                    {ticket.title}
                                                </div>
                                                <div className="flex items-center gap-1 shrink-0">
                                                    {getPriorityIcon(ticket.priority)}
                                                </div>
                                            </div>
                                            <div className="flex justify-between items-end">
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-[10px] text-slate-500">
                                                        {ticket.reporterId === currentUser.id ? 'Du' : ticket.reporterName.split(' ')[0]} • {new Date(ticket.updatedAt).toLocaleDateString('de-DE', { month: 'short', day: 'numeric'})}
                                                    </span>
                                                    {getStatusBadge(ticket.status)}
                                                </div>
                                                <ChevronRight className="w-4 h-4 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </>
                )}

                {activeTab === 'report' && (
                    <div className="flex-grow overflow-y-auto p-4">
                        <form onSubmit={handleCreateBug} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-1">Titel</label>
                                <input 
                                    type="text" 
                                    value={newTitle}
                                    onChange={e => setNewTitle(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-rose-500"
                                    placeholder="Kurz und knackig"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-1">Priorität</label>
                                <div className="flex bg-slate-950 rounded-lg p-1 border border-slate-700">
                                    {(['low', 'medium', 'high', 'critical'] as BugPriority[]).map(p => (
                                        <button
                                            type="button"
                                            key={p}
                                            onClick={() => setNewPriority(p)}
                                            className={`flex-1 py-1.5 text-[10px] uppercase font-bold rounded transition-colors ${newPriority === p ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                                        >
                                            {p}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-1">Beschreibung</label>
                                <textarea 
                                    value={newDesc}
                                    onChange={e => setNewDesc(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-rose-500 h-32 resize-none"
                                    placeholder="Was ist passiert? Schritte zum Reproduzieren..."
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-1">Screenshot (Optional)</label>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2 rounded-lg text-xs flex items-center gap-2 border border-slate-700"
                                    >
                                        <Paperclip className="w-3.5 h-3.5" /> 
                                        {newAttachment ? 'Datei ändern' : 'Anhängen'}
                                    </button>
                                    {newAttachment && <span className="text-xs text-rose-400 truncate max-w-[150px]">{newAttachment.name}</span>}
                                    <input 
                                        type="file" 
                                        ref={fileInputRef} 
                                        className="hidden" 
                                        accept="image/*"
                                        onChange={(e) => e.target.files && setNewAttachment(e.target.files[0])} 
                                    />
                                </div>
                            </div>
                            <button
                                type="submit"
                                disabled={isSubmitting || !newTitle || !newDesc}
                                className="w-full bg-rose-600 hover:bg-rose-500 text-white font-bold py-3 rounded-lg text-sm shadow-lg shadow-rose-900/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4"
                            >
                                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bug className="w-4 h-4" />}
                                Käfer fangen
                            </button>
                        </form>
                    </div>
                )}
            </div>

            {/* DETAIL VIEW */}
            <div className={`flex-grow flex-col bg-slate-950 relative w-full md:w-2/3 ${selectedTicket ? 'flex' : 'hidden md:flex'}`}>
                {selectedTicket ? (
                    <>
                        <div className="flex-grow overflow-y-auto p-6 custom-scrollbar">
                            {/* Mobile Back Button */}
                            <button onClick={() => setSelectedTicket(null)} className="md:hidden text-slate-400 mb-4 flex items-center gap-1 text-sm"><ChevronRight className="w-4 h-4 rotate-180" /> Zurück</button>

                            <div className="flex justify-between items-start mb-4">
                                <h2 className="text-2xl font-bold text-white leading-tight pr-4">{selectedTicket.title}</h2>
                                <div className="flex flex-col items-end gap-2">
                                    {getStatusBadge(selectedTicket.status)}
                                    {selectedTicket.status !== 'resolved' && (
                                        <button 
                                            onClick={() => handleStatusChange('resolved')}
                                            disabled={isUpdatingStatus !== null}
                                            className="text-[10px] flex items-center gap-1 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 px-2 py-1 rounded transition-colors"
                                        >
                                            <Check className="w-3 h-3" /> Als gelöst markieren
                                        </button>
                                    )}
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-4 text-xs text-slate-500 border-b border-slate-800 pb-4 mb-6">
                                <span className="flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> {selectedTicket.priority} Priority</span>
                                <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {new Date(selectedTicket.createdAt).toLocaleDateString()}</span>
                                <span className="text-slate-400 font-semibold">Reporter: {selectedTicket.reporterName}</span>
                            </div>

                            <div className="prose prose-invert prose-sm max-w-none text-slate-300 mb-6 whitespace-pre-wrap">
                                {selectedTicket.description}
                            </div>

                            {selectedTicket.attachmentUrl && (
                                <div className="mb-8">
                                    <div className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-2"><ImageIcon className="w-3 h-3" /> Screenshot</div>
                                    <a href={selectedTicket.attachmentUrl} target="_blank" rel="noreferrer" className="block w-full max-w-sm rounded-lg overflow-hidden border border-slate-800 hover:border-slate-600 transition-colors">
                                        <img src={selectedTicket.attachmentUrl} alt="Bug Attachment" className="w-full h-auto" />
                                    </a>
                                </div>
                            )}

                            {/* Status Control */}
                            <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 mb-8">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Status ändern</label>
                                <div className="flex flex-wrap gap-2">
                                    {(['open', 'in_progress', 'resolved', 'wont_fix'] as BugStatus[]).map(s => (
                                        <button
                                            key={s}
                                            onClick={() => handleStatusChange(s)}
                                            disabled={selectedTicket.status === s || isUpdatingStatus !== null}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all flex items-center gap-2 ${selectedTicket.status === s ? 'bg-slate-700 text-white cursor-default' : 'bg-slate-950 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-800'}`}
                                        >
                                            {isUpdatingStatus === s && <Loader2 className="w-3 h-3 animate-spin" />}
                                            {s.replace('_', ' ')}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Chat History */}
                            <div className="space-y-6">
                                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-800 pb-2">Verlauf</div>
                                {selectedTicket.comments.length === 0 ? (
                                    <div className="text-slate-600 text-sm italic">Noch keine Kommentare.</div>
                                ) : (
                                    selectedTicket.comments.map(comment => (
                                        <div key={comment.id} className={`flex gap-3 ${comment.isSystemMessage ? 'justify-center opacity-60 my-2' : ''}`}>
                                            {!comment.isSystemMessage && (
                                                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-400 border border-slate-700 shrink-0">
                                                    {comment.authorName.charAt(0)}
                                                </div>
                                            )}
                                            <div className={`${comment.isSystemMessage ? 'text-xs text-slate-500 font-mono py-1 px-3 bg-slate-900 rounded-full border border-slate-800' : 'flex-grow bg-slate-900 p-3 rounded-lg border border-slate-800'}`}>
                                                {!comment.isSystemMessage && (
                                                    <div className="flex justify-between items-baseline mb-1">
                                                        <span className="text-xs font-bold text-rose-400">{comment.authorName}</span>
                                                        <span className="text-[10px] text-slate-600">{new Date(comment.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                                    </div>
                                                )}
                                                <p className={`text-sm ${comment.isSystemMessage ? '' : 'text-slate-300'}`}>{comment.text}</p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Comment Input */}
                        <div className="p-4 bg-slate-900 border-t border-slate-800 shrink-0">
                            <form onSubmit={handlePostComment} className="flex gap-2">
                                <input 
                                    type="text" 
                                    value={commentText}
                                    onChange={e => setCommentText(e.target.value)}
                                    placeholder="Kommentar schreiben..."
                                    className="flex-grow bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-rose-500"
                                />
                                <button 
                                    type="submit" 
                                    disabled={!commentText.trim()}
                                    className="p-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Send className="w-5 h-5" />
                                </button>
                            </form>
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-600 opacity-60">
                        <Bug className="w-16 h-16 mb-4 stroke-1" />
                        <p className="text-sm">Wähle ein Ticket aus oder erstelle ein neues.</p>
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};
