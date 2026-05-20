
import React, { useState, useRef } from 'react';
import { X, Send, Sparkles, User, AlertCircle, Loader2, CheckCircle2, Mic, StopCircle, Keyboard } from 'lucide-react';
import { submitInboundRequest } from '../services/shareService';
import { transcribeAudio } from '../services/geminiService';
import { SharedView } from '../types';

interface TaskRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  viewConfig: SharedView; // Contains creatorId and shareId
}

export const TaskRequestModal: React.FC<TaskRequestModalProps> = ({ isOpen, onClose, viewConfig }) => {
  const [guestName, setGuestName] = useState('');
  const [requestText, setRequestText] = useState('');
  const [priority, setPriority] = useState<'normal' | 'high'>('normal');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Audio Recording State
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  if (!isOpen) return null;

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Stop all tracks to release mic
        stream.getTracks().forEach(track => track.stop());
        
        // --- AUTO PROCESS & SUBMIT ---
        setIsSubmitting(true);
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' }); 
        
        try {
            // 1. Convert to Base64
            const reader = new FileReader();
            reader.readAsDataURL(audioBlob);
            
            reader.onloadend = async () => {
                try {
                    const base64Audio = (reader.result as string).split(',')[1];
                    
                    // 2. Transcribe
                    const transcript = await transcribeAudio(base64Audio);
                    
                    // 3. Submit directly
                    const finalText = requestText ? `${requestText}\n\n[Audio]: ${transcript}` : transcript;
                    
                    await submitInboundRequest(viewConfig.id, viewConfig.creatorId, {
                        guestName: guestName || 'Audio Gast',
                        requestText: finalText,
                        priority
                    });
                    
                    setIsSuccess(true);
                    setTimeout(() => {
                        onClose();
                        setIsSuccess(false);
                        setRequestText('');
                    }, 2000);

                } catch (err) {
                    console.error("Processing chain failed", err);
                    alert("Verarbeitung fehlgeschlagen. Bitte versuche es mit Text.");
                    setIsSubmitting(false);
                }
            };
        } catch (e) {
            console.error(e);
            alert("Fehler bei der Audio-Verarbeitung.");
            setIsSubmitting(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (e) {
      console.error("Microphone access denied", e);
      alert("Mikrofonzugriff erforderlich.");
    }
  };

  const stopAndSubmit = () => {
    if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop(); // Triggers onstop which handles the rest
        setIsRecording(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim() || !requestText.trim()) return;

    setIsSubmitting(true);
    try {
      await submitInboundRequest(viewConfig.id, viewConfig.creatorId, {
        guestName,
        requestText,
        priority
      });
      setIsSuccess(true);
      setTimeout(() => {
          onClose();
          setIsSuccess(false);
          setRequestText('');
          // Keep guestName for convenience
      }, 2000);
    } catch (error) {
      alert("Fehler beim Senden. Bitte versuche es erneut.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 w-full max-w-lg rounded-2xl border border-indigo-500/30 shadow-2xl flex flex-col overflow-hidden relative">
        
        {/* Decorative Gradient Blob */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-[80px] pointer-events-none"></div>

        {isSuccess ? (
            <div className="p-12 flex flex-col items-center justify-center text-center animate-in zoom-in duration-300">
                <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-400 mb-6 border border-emerald-500/20">
                    <CheckCircle2 className="w-10 h-10" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Anfrage gesendet!</h2>
                <p className="text-slate-400">Der Planer wurde benachrichtigt und wird deine Anfrage prüfen.</p>
            </div>
        ) : (
            <>
                <div className="flex justify-between items-center p-5 border-b border-slate-800 bg-slate-950/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400 border border-indigo-500/20">
                            <Sparkles className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="font-bold text-slate-200 text-lg">Wunsch äußern</h2>
                            <p className="text-xs text-indigo-400/80 font-mono">Was soll erledigt werden?</p>
                        </div>
                    </div>
                    <button onClick={onClose} disabled={isSubmitting} className="p-2 text-slate-500 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleManualSubmit} className="p-6 space-y-6">
                    
                    {/* 1. Identity & Priority */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                                <User className="w-3 h-3" /> Dein Name
                            </label>
                            <input 
                                type="text" 
                                value={guestName}
                                onChange={(e) => setGuestName(e.target.value)}
                                placeholder="Name / Firma"
                                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                                required
                                disabled={isSubmitting}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Dringlichkeit</label>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setPriority('normal')}
                                    disabled={isSubmitting}
                                    className={`flex-1 py-3 rounded-xl border text-xs font-bold uppercase tracking-wide transition-all ${priority === 'normal' ? 'bg-slate-800 border-indigo-500/50 text-white' : 'bg-slate-950 border-slate-800 text-slate-500'}`}
                                >
                                    Normal
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPriority('high')}
                                    disabled={isSubmitting}
                                    className={`flex-1 py-3 rounded-xl border text-xs font-bold uppercase tracking-wide transition-all flex items-center justify-center gap-1 ${priority === 'high' ? 'bg-rose-500/10 border-rose-500/50 text-rose-400' : 'bg-slate-950 border-slate-800 text-slate-500'}`}
                                >
                                    <AlertCircle className="w-3 h-3" /> Hoch
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* 2. PROMINENT AUDIO INPUT */}
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                                Dein Anliegen
                            </label>
                        </div>

                        {!isRecording ? (
                            <div className="space-y-4">
                                {/* BIG MICROPHONE BUTTON */}
                                <button
                                    type="button"
                                    onClick={startRecording}
                                    disabled={isSubmitting}
                                    className="w-full relative group overflow-hidden bg-gradient-to-br from-indigo-600 to-purple-700 hover:from-indigo-500 hover:to-purple-600 rounded-2xl p-6 flex flex-col items-center justify-center gap-3 transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/20 border border-white/10"
                                >
                                    <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                    <div className="p-4 bg-white/10 rounded-full border border-white/20 group-hover:scale-110 transition-transform duration-300">
                                        <Mic className="w-8 h-8 text-white" />
                                    </div>
                                    <div className="text-center">
                                        <div className="text-lg font-bold text-white">Audioaufnahme starten</div>
                                        <div className="text-indigo-200 text-xs mt-1">Einfach einsprechen – wir transkribieren.</div>
                                    </div>
                                </button>

                                {/* TEXT AREA (Secondary) */}
                                <div className="relative">
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none -top-8">
                                        <span className="bg-slate-900 px-3 text-xs text-slate-600 uppercase font-bold tracking-widest">oder tippen</span>
                                    </div>
                                    <textarea 
                                        value={requestText}
                                        onChange={(e) => setRequestText(e.target.value)}
                                        placeholder="Tippe deine Anfrage hier..."
                                        className="w-full bg-slate-950/50 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 min-h-[80px] resize-none leading-relaxed transition-colors placeholder-slate-600"
                                        disabled={isSubmitting}
                                    />
                                    {requestText.trim() && (
                                        <button
                                            type="submit"
                                            disabled={isSubmitting || !guestName.trim()}
                                            className="absolute bottom-3 right-3 bg-indigo-600 hover:bg-indigo-500 text-white p-2 rounded-lg shadow-lg transition-transform hover:scale-105"
                                            title="Senden"
                                        >
                                            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                        </button>
                                    )}
                                </div>
                            </div>
                        ) : (
                            /* RECORDING ACTIVE STATE */
                            <div className="bg-slate-950/80 border border-red-500/30 rounded-2xl p-8 flex flex-col items-center justify-center relative overflow-hidden">
                                <div className="absolute inset-0 bg-red-500/5 animate-pulse"></div>
                                <div className="flex items-center gap-3 mb-4">
                                    <span className="w-4 h-4 bg-red-500 rounded-full animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.6)]"></span>
                                    <span className="text-red-400 font-bold text-lg uppercase tracking-wider">Aufnahme läuft</span>
                                </div>
                                
                                <div className="flex gap-1 h-8 items-end mb-8">
                                    {[...Array(8)].map((_, i) => (
                                        <div key={i} className="w-1.5 bg-red-500/50 rounded-full animate-[bounce_1s_infinite]" style={{ height: `${Math.random() * 32 + 8}px`, animationDelay: `${i * 0.1}s` }}></div>
                                    ))}
                                </div>

                                <button
                                    type="button"
                                    onClick={stopAndSubmit}
                                    className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-4 rounded-xl text-sm shadow-[0_0_30px_rgba(220,38,38,0.4)] animate-pulse flex items-center justify-center gap-2 transition-all hover:scale-105"
                                >
                                    <StopCircle className="w-5 h-5" />
                                    Aufnahme beenden & Absenden
                                </button>
                            </div>
                        )}
                    </div>

                </form>
            </>
        )}
      </div>
    </div>
  );
};
