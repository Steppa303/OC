
import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, ArrowRight, Paperclip, X, BrainCircuit, ScanSearch, Lightbulb, Mail, FileText, AlertTriangle, Calendar } from 'lucide-react';
import { dataURLtoFile } from '../utils';
import { parseEmail } from '../utils/emailParser';
import { parseCalendarFile } from '../utils/calendarParser';

interface MagicInputProps {
  onSubmit: (text: string, files: File[]) => Promise<void>;
  isLoading: boolean;
  externalText?: string | null; // NEW: Allow external injection (from Inbox)
}

export const MagicInput: React.FC<MagicInputProps> = ({ onSubmit, isLoading, externalText }) => {
  const [input, setInput] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [isParsingFile, setIsParsingFile] = useState(false);
  
  // Phase 2: Oversize Detection State
  const [isOversize, setIsOversize] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Loading Text Animation State
  const [loadingText, setLoadingText] = useState("Processing...");
  
  // Check for oversize request (e.g. > 8h)
  useEffect(() => {
     const match = input.match(/\b(\d+(?:[.,]\d+)?)\s*(?:h|std|stunden|hours)\b/i);
     if (match) {
        const hours = parseFloat(match[1].replace(',', '.'));
        setIsOversize(hours > 8); 
     } else {
        setIsOversize(false);
     }
  }, [input]);
  
  // React to external text injection (Inbox Transfer)
  useEffect(() => {
      if (externalText) {
          setInput(externalText);
          // Optional: Focus textarea
          if (textareaRef.current) {
              textareaRef.current.focus();
              // Adjust height
              textareaRef.current.style.height = 'auto';
              textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
          }
      }
  }, [externalText]);
  
  useEffect(() => {
    if (!isLoading) return;
    
    // Dynamic messages based on Oversize context
    const normalMessages = [
        "Analysiere Anfrage...", 
        "Prüfe Kalenderverfügbarkeit...", 
        "Lese Dokumente (PDF/Mail/ICS)...",
        "Optimiere Deadlines...", 
        "Berechne neuen Zeitplan..."
    ];

    const liquidMessages = [
        "Prüfe Kapazitäten...",
        "Aufgabe > 8h: Aktiviere Liquid Flow...",
        "Zerlege in Teilaufgaben...",
        "Suche freie Kalender-Slots...",
        "Finalisiere Zeitplan..."
    ];

    const messages = isOversize ? liquidMessages : normalMessages;
    
    let i = 0;
    setLoadingText(messages[0]);
    
    const interval = setInterval(() => {
        i = (i + 1) % messages.length;
        setLoadingText(messages[i]);
    }, 1200);
    
    return () => clearInterval(interval);
  }, [isLoading]); 

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() || files.length > 0) {
      onSubmit(input, files);
      setInput('');
      setFiles([]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const processDroppedFiles = async (droppedFiles: File[]) => {
      setIsParsingFile(true);
      try {
          const emlFiles = droppedFiles.filter(f => f.name.endsWith('.eml') || f.type === 'message/rfc822');
          const icsFiles = droppedFiles.filter(f => f.name.endsWith('.ics') || f.type === 'text/calendar');
          const regularFiles = droppedFiles.filter(f => 
             !f.name.endsWith('.eml') && f.type !== 'message/rfc822' && 
             !f.name.endsWith('.ics') && f.type !== 'text/calendar'
          );

          // 1. Process Regular Files (Images, PDFs)
          if (regularFiles.length > 0) {
             setFiles(prev => [...prev, ...regularFiles]);
          }

          // 2. Process EML Files
          if (emlFiles.length > 0) {
             for (const emlFile of emlFiles) {
                  const parsed = await parseEmail(emlFile);
                  const emailContext = `\n\n--------------------------------------------------\n[E-MAIL IMPORT]\nBetreff: ${parsed.subject}\nDatum (Gesendet): ${parsed.date || 'Unbekannt'}\n\n${parsed.body}\n--------------------------------------------------\n`;
                  setInput(prev => (prev + emailContext).trim());
                  
                  if (parsed.attachments.length > 0) {
                     setFiles(prev => [...prev, ...parsed.attachments]);
                  }
             }
          }

          // 3. Process ICS Files
          if (icsFiles.length > 0) {
             for (const icsFile of icsFiles) {
                 const calendarText = await parseCalendarFile(icsFile);
                 setInput(prev => (prev + "\n\n" + calendarText).trim());
                 // We don't necessarily add the .ics file to the 'files' array for upload, 
                 // as we've extracted the text. But we could show a visual indicator if desired.
                 // For now, let's add it to files just for the visual preview icon so user knows it was dropped.
                 setFiles(prev => [...prev, icsFile]);
             }
          }

      } catch (err) {
         console.error(err);
         alert("Fehler beim Lesen der Dateien.");
      } finally {
         setIsParsingFile(false);
      }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    // Case 1: Actual Files dropped
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(e.dataTransfer.files) as File[];
      await processDroppedFiles(droppedFiles);
    } 
    // Case 2: Drop detected but no files (Typical when dragging directly from Mail Client)
    else if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
       const hasText = Array.from(e.dataTransfer.items).some((i: DataTransferItem) => i.kind === 'string' && i.type === 'text/plain');
       if (!hasText) {
          alert("Browser-Limitierung: Direktes Ziehen aus Mail-Programmen wird vom Browser oft blockiert.\n\nLösung: Ziehe die E-Mail/Kalenderdatei bitte zuerst auf deinen Desktop und von dort hierher.");
       } else {
          const textData = e.dataTransfer.getData('text/plain');
          if (textData) {
             setInput(prev => (prev + "\n" + textData).trim());
          }
       }
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      await processDroppedFiles(newFiles);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const clipboardItems = e.clipboardData.items;
    const pastedFiles: File[] = [];

    for (let i = 0; i < clipboardItems.length; i++) {
      if (clipboardItems[i].type.indexOf('image') !== -1) {
        const file = clipboardItems[i].getAsFile();
        if (file) {
           pastedFiles.push(file);
        }
      }
    }

    const html = e.clipboardData.getData('text/html');
    if (html) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const images = doc.getElementsByTagName('img');

      for (let i = 0; i < images.length; i++) {
        const src = images[i].src;
        if (src.startsWith('data:image')) {
           try {
             const file = dataURLtoFile(src, `pasted_image_${Date.now()}_${i}.png`);
             pastedFiles.push(file);
           } catch (err) {
             console.warn('Failed to convert pasted image', err);
           }
        }
      }
    }

    if (pastedFiles.length > 0) {
      setFiles(prev => [...prev, ...pastedFiles]);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto mb-8 relative z-10">
      <form onSubmit={handleSubmit} className="relative group flex flex-col gap-3">
        {isOversize && !isLoading && (
            <div className="absolute -top-8 left-0 right-0 flex justify-center animate-in slide-in-from-bottom-2 fade-in">
                <div className="bg-orange-500/10 border border-orange-500/40 text-orange-400 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide flex items-center gap-2 backdrop-blur-sm shadow-[0_0_15px_rgba(249,115,22,0.2)]">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Oversize Alert: Liquid Flow aktiviert
                </div>
            </div>
        )}

        <div 
          className="relative"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* Glow Effect */}
          <div className={`absolute -inset-0.5 bg-gradient-to-r transition duration-1000 group-hover:duration-200 rounded-2xl blur ${isOversize ? 'from-orange-500 to-amber-500 opacity-60' : 'from-blue-600 to-indigo-600 opacity-30 group-hover:opacity-60'} ${isDragging ? 'opacity-80' : ''}`}></div>
          
          <div className={`relative bg-slate-900 rounded-xl shadow-2xl border transition-colors duration-300 ${isDragging ? 'border-indigo-400 bg-slate-800' : isOversize ? 'border-orange-500/50' : 'border-slate-800'}`}>
            
            {/* Input Area */}
            <div className="flex items-start p-2">
              <div className={`pl-4 pr-3 py-4 ${isOversize ? 'text-orange-400' : 'text-indigo-400'}`}>
                {isLoading ? (
                  <BrainCircuit className="w-6 h-6 animate-pulse text-indigo-300" />
                ) : (
                  <Sparkles className="w-6 h-6" />
                )}
              </div>
              
              {isLoading || isParsingFile ? (
                  <div className="flex-grow p-4 min-h-[80px] flex items-center">
                    <div className="flex items-center gap-3">
                        <span className="relative flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
                        </span>
                        <span className="text-lg font-mono text-indigo-300 animate-pulse">
                          {isParsingFile ? "Lese Dateien (ICS/Mail)..." : loadingText}
                        </span>
                    </div>
                  </div>
              ) : (
                  <textarea
                    ref={textareaRef}
                    className="flex-grow p-4 text-lg text-slate-200 placeholder-slate-500 focus:outline-none bg-transparent resize-none min-h-[80px]"
                    placeholder="Projekt beschreiben oder Dateien hier ablegen (ICS, PDF, E-Mail)..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onPaste={handlePaste}
                    rows={input.split('\n').length > 1 ? Math.min(input.split('\n').length, 12) : 1}
                  />
              )}

              <div className="flex flex-col gap-2 p-2">
                <button
                  type="submit"
                  disabled={isLoading || isParsingFile || (!input.trim() && files.length === 0)}
                  className={`p-3 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[3rem] ${isOversize ? 'bg-orange-600 hover:bg-orange-500 text-white shadow-[0_0_15px_rgba(249,115,22,0.4)]' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_15px_rgba(79,70,229,0.4)]'}`}
                >
                  <ArrowRight className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-slate-400 hover:text-indigo-400 p-3 rounded-lg hover:bg-slate-800 transition-colors flex items-center justify-center"
                  title="Dateien anhängen (Bilder, PDF, .eml, .ics)"
                  disabled={isLoading || isParsingFile}
                >
                  <Paperclip className="w-5 h-5" />
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  multiple 
                  onChange={handleFileSelect}
                  // Allow images, emails, calendars AND PDFs
                  accept="image/*,.eml,message/rfc822,.pdf,.ics,text/calendar" 
                />
              </div>
            </div>

            {/* File Previews */}
            {!isLoading && !isParsingFile && files.length > 0 && (
              <div className="px-4 pb-4 flex flex-wrap gap-2 animate-in fade-in slide-in-from-top-1 duration-300">
                {files.map((file, idx) => (
                  <div key={idx} className="relative group/file">
                    <div className="flex items-center gap-2 bg-slate-800 rounded-lg pr-2 border border-slate-700 overflow-hidden">
                      {file.type.startsWith('image/') ? (
                        <img 
                          src={URL.createObjectURL(file)} 
                          alt="preview" 
                          className="w-10 h-10 object-cover"
                        />
                      ) : file.type === 'application/pdf' ? (
                          <div className="w-10 h-10 bg-red-500/10 flex items-center justify-center text-red-400">
                             <FileText className="w-5 h-5" />
                          </div>
                      ) : file.name.endsWith('.ics') || file.type === 'text/calendar' ? (
                          <div className="w-10 h-10 bg-orange-500/10 flex items-center justify-center text-orange-400">
                             <Calendar className="w-5 h-5" />
                          </div>
                      ) : (
                        <div className="w-10 h-10 bg-slate-700 flex items-center justify-center text-xs text-slate-400">
                           {file.name.endsWith('.eml') ? <Mail className="w-5 h-5" /> : "FILE"}
                        </div>
                      )}
                      <span className="text-xs text-slate-300 max-w-[100px] truncate">{file.name}</span>
                      <button 
                        type="button"
                        onClick={() => removeFile(idx)}
                        className="p-1 hover:text-red-400 text-slate-500"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Drag Overlay Hint */}
            {isDragging && !isLoading && !isParsingFile && (
              <div className="absolute inset-0 bg-indigo-500/10 border-2 border-indigo-500 border-dashed rounded-xl flex items-center justify-center z-20 backdrop-blur-sm">
                <div className="text-indigo-300 font-semibold bg-slate-900/80 px-4 py-2 rounded-lg pointer-events-none flex items-center gap-2">
                  <Paperclip className="w-4 h-4" /> Dateien hier ablegen (Bilder, PDF, E-Mails, ICS)
                </div>
              </div>
            )}
          </div>
        </div>
      </form>
    </div>
  );
};
