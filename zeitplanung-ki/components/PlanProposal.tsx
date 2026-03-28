
import React, { useState, useEffect, useRef } from 'react';
import { AIPlanResponse } from '../types';
import { Check, X, Layers, Clock, Calendar, Plus, Trash2, Loader2, Sparkles, ChevronRight, Activity, FileText, MapPin, Car, Eye, PlayCircle, BarChart, Paperclip, Upload, RefreshCw, Save, GripVertical } from 'lucide-react';
import { generatePhases, LiquidGranularity, generateProjectDescription } from '../services/geminiService';
import { compressImage, cleanText } from '../utils';
import { extractTextFromPDF } from '../utils/pdfParser';

interface PlanProposalProps {
  proposal: AIPlanResponse | null;
  originalPrompt: string;
  onAccept: (modifiedProposal: AIPlanResponse, rawFiles?: File[]) => void; // Updated signature
  onDiscard: () => void;
  onHoverPhase?: (index: number | null) => void;
  onRefineSplit?: (granularity: LiquidGranularity) => Promise<void>;
  isEditing?: boolean; // NEW: Mode flag
  externalUpdateCmd?: { index: number; date: string; timestamp: number } | null; // NEW: Receive drop events from calendar
}

export const PlanProposal: React.FC<PlanProposalProps> = ({ 
    proposal, 
    originalPrompt, 
    onAccept, 
    onDiscard, 
    onHoverPhase, 
    onRefineSplit, 
    isEditing = false,
    externalUpdateCmd 
}) => {
  // Local state to allow editing before accepting
  const [plan, setPlan] = useState<AIPlanResponse | null>(null);
  const [useAIPhases, setUseAIPhases] = useState(false);
  const [isLoadingPhases, setIsLoadingPhases] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Attachments State
  const [attachments, setAttachments] = useState<string[]>([]);
  const [newRawFiles, setNewRawFiles] = useState<File[]>([]); // Files added during this session
  const [isDescLoading, setIsDescLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Local strings for inputs to allow "1,5" typing without immediate parsing issues
  const [totalHoursInput, setTotalHoursInput] = useState("");
  
  // Granularity State (1=Coarse, 2=Balanced, 3=Fine)
  const [granularity, setGranularity] = useState<number>(2);

  // Sync prop changes to local state
  useEffect(() => {
    if (proposal) {
        const initialPlan = JSON.parse(JSON.stringify(proposal));
        
        // Clean Description (Fix \n and encoding issues)
        initialPlan.description = cleanText(initialPlan.description || "");
        
        setPlan(initialPlan);
        setTotalHoursInput(proposal.totalHours.toString());
        setAttachments(proposal.attachments || []);
        setNewRawFiles([]);
        setIsSubmitting(false);
    } else {
        setPlan(null);
        setTotalHoursInput("");
        setAttachments([]);
    }
  }, [proposal]);

  // Handle External Updates (Drag & Drop from Calendar)
  useEffect(() => {
      if (externalUpdateCmd && plan) {
          const { index, date } = externalUpdateCmd;
          if (index >= 0 && index < plan.phases.length) {
              // Update local state without overwriting text edits
              const newPhases = [...plan.phases];
              newPhases[index] = { ...newPhases[index], suggestedDate: date };
              setPlan({ ...plan, phases: newPhases });
          }
      }
  }, [externalUpdateCmd]);

  // Recalculate total hours when phases change (and user is editing phases, not just total)
  useEffect(() => {
    if (plan && plan.phases.length > 0) {
      const sum = plan.phases.reduce((acc, p) => acc + p.hours, 0);
      if (Math.abs(sum - plan.totalHours) > 0.01) {
          setPlan(prev => prev ? ({ ...prev, totalHours: sum }) : null);
          setTotalHoursInput(sum.toString().replace('.', ',')); // Sync visual input
      }
    }
  }, [plan?.phases]);

  if (!plan || !proposal) return null;

  // Handle Drag Start
  const handleDragStart = (e: React.DragEvent, index: number) => {
      e.dataTransfer.setData('dragType', 'PROPOSAL_PHASE');
      e.dataTransfer.setData('index', index.toString());
      e.dataTransfer.effectAllowed = 'copyMove';
      
      // Optional: Set a drag image or feedback
      if (onHoverPhase) onHoverPhase(index); // Highlight ghost on drag start
  };

  // Handle AI Toggle
  const handleToggleAI = async () => {
    const newState = !useAIPhases;
    setUseAIPhases(newState);

    if (newState) {
      setIsLoadingPhases(true);
      try {
        const newPhases = await generatePhases(plan.title, plan.totalHours, plan.deadline, originalPrompt);
        if (newPhases && newPhases.length > 0) {
          const mappedPhases = newPhases.map(p => ({
             ...p,
             suggestedDate: undefined 
          }));
          setPlan(prev => prev ? ({ ...prev, phases: mappedPhases }) : null);
        }
      } catch (error) {
        console.error("Failed to generate phases", error);
        setUseAIPhases(false); 
      } finally {
        setIsLoadingPhases(false);
      }
    } else {
      flattenPhases();
    }
  };
  
  const handleGranularityChange = async (val: number) => {
      setGranularity(val);
      if (onRefineSplit) {
          setIsLoadingPhases(true);
          try {
              let grain: LiquidGranularity = 'balanced';
              if (val === 1) grain = 'coarse';
              if (val === 3) grain = 'fine';
              
              await onRefineSplit(grain);
          } finally {
              setIsLoadingPhases(false);
          }
      }
  };

  const handleTitleChange = (val: string) => setPlan(prev => prev ? ({ ...prev, title: val }) : null);
  const handleDescriptionChange = (val: string) => setPlan(prev => prev ? ({ ...prev, description: val }) : null);
  
  // --- INTELLIGENT DATE SHIFT ---
  const handleStartDateChange = (newStartDate: string) => {
      setPlan(prev => {
          if (!prev) return null;

          const oldStart = prev.startDate ? new Date(prev.startDate) : new Date();
          const newStart = new Date(newStartDate);
          
          const toIsoDate = (d: Date) => {
              const yyyy = d.getFullYear();
              const mm = String(d.getMonth() + 1).padStart(2, '0');
              const dd = String(d.getDate()).padStart(2, '0');
              return `${yyyy}-${mm}-${dd}`;
          };

          const diffTime = newStart.getTime() - oldStart.getTime();
          
          if (isNaN(diffTime) || diffTime === 0) {
               return { ...prev, startDate: newStartDate };
          }

          let newDeadline = prev.deadline;
          if (prev.deadline) {
              const oldDeadline = new Date(prev.deadline);
              const newDeadlineDate = new Date(oldDeadline.getTime() + diffTime);
              newDeadline = toIsoDate(newDeadlineDate);
          }

          const updatedPhases = prev.phases.map(phase => {
              if (!phase.suggestedDate) return phase;

              const originalDatePart = phase.suggestedDate.split('T')[0];
              const originalTimePart = phase.suggestedDate.includes('T') ? phase.suggestedDate.split('T')[1] : '';

              const oldPhaseDate = new Date(originalDatePart);
              const newPhaseDate = new Date(oldPhaseDate.getTime() + diffTime);
              
              let newDateStr = toIsoDate(newPhaseDate);
              
              if (originalTimePart) {
                  newDateStr += `T${originalTimePart}`;
              }

              return {
                  ...phase,
                  suggestedDate: newDateStr
              };
          });

          return { 
              ...prev, 
              startDate: newStartDate,
              deadline: newDeadline,
              phases: updatedPhases
          };
      });
  };

  const handleDeadlineChange = (val: string) => setPlan(prev => prev ? ({ ...prev, deadline: val }) : null);
  
  const parseLocalizedFloat = (val: string): number => {
      const normalized = val.replace(/,/g, '.');
      const num = parseFloat(normalized);
      return isNaN(num) ? 0 : num;
  };

  const handleTotalHoursChange = (valStr: string) => {
      setTotalHoursInput(valStr); 
      const val = parseLocalizedFloat(valStr);
      
      setPlan(prev => {
          if (!prev) return null;
          let newPhases = [...prev.phases];
          if (newPhases.length === 1) {
              newPhases[0] = { ...newPhases[0], hours: val };
          }
          return { ...prev, totalHours: val, phases: newPhases };
      });
  };

  const handleTotalHoursBlur = () => {
      const val = parseLocalizedFloat(totalHoursInput);
      setTotalHoursInput(val.toString().replace('.', ',')); 
  };
  
  const handleIsExternalChange = (val: boolean) => setPlan(prev => prev ? ({ ...prev, isExternal: val }) : null);
  const handleLocationChange = (val: string) => setPlan(prev => prev ? ({ ...prev, location: val }) : null);

  const handlePhaseChange = (index: number, field: 'name' | 'hours' | 'suggestedDate', value: string | number) => {
    if (!plan) return;
    const newPhases = [...plan.phases];
    newPhases[index] = { ...newPhases[index], [field]: value };
    setPlan({ ...plan, phases: newPhases });
  };

  const addPhase = () => {
    if (!plan) return;
    setPlan({
      ...plan,
      phases: [
        ...plan.phases,
        { name: 'Neue Aufgabe', hours: 1, rationale: 'Manuell hinzugefügt', suggestedDate: undefined, status: 'pending' }
      ]
    });
  };

  const removePhase = (index: number) => {
    if (!plan) return;
    const newPhases = plan.phases.filter((_, i) => i !== index);
    setPlan({ ...plan, phases: newPhases });
  };

  const flattenPhases = () => {
    if (!plan) return;
    setPlan({
      ...plan,
      phases: [{
        name: plan.title, 
        hours: plan.totalHours,
        rationale: 'Zusammengeführt',
        suggestedDate: plan.phases[0]?.suggestedDate,
        status: 'pending' 
      }]
    });
  };

  // --- ATTACHMENT HANDLING ---
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      const imageFiles = files.filter(f => f.type.startsWith('image/'));
      const base64Files = await Promise.all(imageFiles.map(compressImage));
      
      setAttachments(prev => [...prev, ...base64Files]);
      setNewRawFiles(prev => [...prev, ...files]); // Keep track for uploading later

      // Auto-analyze PDF description if present
      const pdfFiles = files.filter(f => f.type === 'application/pdf');
      if (pdfFiles.length > 0) {
          setIsDescLoading(true);
          try {
             const texts = await Promise.all(pdfFiles.map(extractTextFromPDF));
             const combinedText = texts.join("\n\n");
             const newDesc = await generateProjectDescription(plan.description || "", combinedText);
             // Apply cleanText to newly generated description too
             handleDescriptionChange(cleanText(newDesc));
          } finally {
             setIsDescLoading(false);
          }
      }
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
    // Note: We can't easily remove from newRawFiles by index because indices mismatch if mix of old/new.
    // For simplicity in this demo, we just don't upload deleted new files, but we'd need complex logic to track.
    // Instead, we just pass all newRawFiles to App.tsx and let it upload, then we only save the URLs that are in 'attachments' state.
  };

  const handleGenerateDescription = async () => {
    if (attachments.length === 0) {
        alert("Bitte lade zuerst Dateien hoch.");
        return;
    }
    
    setIsDescLoading(true);
    try {
        const imageParts = attachments.map(base64 => {
            const mimeMatch = base64.match(/data:(.*?);base64,/);
            const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
            const data = base64.split(',')[1];
            return {
                inlineData: { mimeType, data }
            };
        });

        const newDesc = await generateProjectDescription(plan.description || "", "Generiere basierend auf den Bildern.", imageParts);
        if (newDesc) {
            handleDescriptionChange(cleanText(newDesc));
        }
    } catch (e) {
        console.error("Failed to generate description", e);
    } finally {
        setIsDescLoading(false);
    }
  };

  const openAttachment = (src: string) => {
    const newWindow = window.open();
    if (newWindow) {
        if (src.startsWith('data:application/pdf') || src.toLowerCase().endsWith('.pdf')) {
             newWindow.document.write(`<iframe width='100%' height='100%' src='${src}'></iframe>`);
        } else {
             newWindow.document.write(`<img src="${src}" style="max-width: 100%;" />`);
        }
    }
  };


  const handleAcceptClick = async () => {
    if (!plan || isSubmitting) return;
    
    setIsSubmitting(true);
    try {
        // We pass the updated plan AND the attachments array (URLs/Base64) to the parent.
        // The parent (App.tsx) handles uploading newRawFiles if needed.
        const planWithAttachments = { ...plan, attachments };
        await onAccept(planWithAttachments, newRawFiles);
    } catch (e) {
        console.error("Submission failed", e);
        setIsSubmitting(false);
    }
  };

  const getConfidenceColor = (score: number) => {
      if (score >= 80) return 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30';
      if (score >= 50) return 'text-amber-400 bg-amber-500/20 border-amber-500/30';
      return 'text-red-400 bg-red-500/20 border-red-500/30';
  };

  const displayStartDate = plan.startDate || new Date().toISOString().split('T')[0];

  return (
    <>
    {/* 
        NO BACKDROP! 
        Removed the fixed inset div to allow interaction with the calendar underneath.
        This makes Drag & Drop possible.
    */}
    
    {/* Side Drawer */}
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl bg-slate-900/95 backdrop-blur-xl border-l border-slate-700/50 shadow-2xl shadow-black transform transition-transform duration-500 ease-out animate-in slide-in-from-right flex flex-col pointer-events-auto">
        
        {/* Header */}
        <div className="relative overflow-hidden shrink-0">
           <div className={`absolute inset-0 bg-gradient-to-br z-0 ${isEditing ? 'from-amber-900/40 to-orange-900/40' : 'from-indigo-900/50 to-purple-900/50'}`}></div>
           <div className="relative z-10 p-8 border-b border-white/10">
              <div className="flex justify-between items-start">
                <div>
                   <div className={`flex items-center gap-2 font-mono text-xs uppercase tracking-widest mb-2 ${isEditing ? 'text-amber-300' : 'text-indigo-300'}`}>
                      {isEditing ? <RefreshCw className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />} 
                      {isEditing ? 'Update Mode' : 'AI Proposal'}
                   </div>
                   <h2 className="text-3xl font-bold text-white tracking-tight">{isEditing ? 'Projekt bearbeiten' : 'Plan Review'}</h2>
                   <div className="flex items-center gap-2 mt-2">
                      <p className="text-slate-300 text-sm max-w-md">
                        {isEditing ? 'Passe die Details unten an. ' : 'Prüfe den Vorschlag.'} 
                        Ziehe Phasen per <span className="text-indigo-300 font-bold">Drag & Drop</span> in den Kalender links.
                      </p>
                      {!isEditing && (
                        <span className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                           <Eye className="w-3 h-3" /> Preview Active
                        </span>
                      )}
                   </div>
                </div>
                <button 
                  onClick={onDiscard}
                  disabled={isSubmitting}
                  className="p-2 bg-white/5 hover:bg-white/10 rounded-full text-white/70 hover:text-white transition-colors disabled:opacity-50"
                >
                    <X className="w-5 h-5" />
                </button>
              </div>

              {/* Confidence Score (Only for new proposals) */}
              {!isEditing && proposal.confidenceScore !== undefined && (
                  <div className="mt-6 flex items-center gap-3">
                      <div className="flex-grow h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-1000 ease-out ${proposal.confidenceScore >= 80 ? 'bg-emerald-500' : proposal.confidenceScore >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                            style={{ width: `${proposal.confidenceScore}%` }}
                          />
                      </div>
                      <div className={`px-2 py-1 rounded text-[10px] font-mono uppercase tracking-wide border flex items-center gap-1 ${getConfidenceColor(proposal.confidenceScore)}`}>
                          <Activity className="w-3 h-3" />
                          {proposal.confidenceScore}%
                      </div>
                  </div>
              )}
           </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-grow overflow-y-auto p-8 space-y-8 custom-scrollbar">
          
          {/* Main Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="text-xs font-mono text-slate-500 uppercase tracking-widest mb-2 block">Projekt Name</label>
              <input 
                type="text" 
                value={plan.title}
                onChange={(e) => handleTitleChange(e.target.value)}
                disabled={isSubmitting}
                className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-lg text-white font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all placeholder-slate-600 disabled:opacity-50"
              />
            </div>

            <div className="p-4 bg-slate-800/30 rounded-xl border border-slate-700/50 flex flex-col gap-1">
                 <label className="text-[10px] font-mono text-slate-500 uppercase tracking-widest flex items-center gap-1">
                   <Clock className="w-3 h-3" /> Total Hours
                 </label>
                 <div className="relative">
                    <input 
                      type="text"
                      inputMode="decimal"
                      value={totalHoursInput}
                      onChange={(e) => handleTotalHoursChange(e.target.value)}
                      onBlur={handleTotalHoursBlur}
                      disabled={isSubmitting}
                      className="text-2xl font-bold text-slate-200 font-mono bg-transparent border-b border-slate-700 hover:border-indigo-500 focus:border-indigo-500 focus:outline-none w-full transition-colors pb-1 disabled:opacity-50"
                    />
                    <span className="absolute right-0 bottom-2 text-sm text-slate-500 font-sans font-normal pointer-events-none">Std.</span>
                 </div>
            </div>
            
            {/* Dates */}
            <div className="md:col-span-2 grid grid-cols-2 gap-4">
                 <div className="p-4 bg-slate-800/30 rounded-xl border border-slate-700/50 flex flex-col gap-1">
                     <label className="text-[10px] font-mono text-slate-500 uppercase tracking-widest flex items-center gap-1">
                       <PlayCircle className="w-3 h-3" /> Start Datum
                     </label>
                     <input 
                       type="date" 
                       value={displayStartDate}
                       onChange={(e) => handleStartDateChange(e.target.value)}
                       disabled={isSubmitting}
                       className="bg-transparent text-lg font-bold text-slate-200 font-mono focus:outline-none w-full border-b border-transparent hover:border-slate-700 focus:border-indigo-500 transition-colors pb-1 disabled:opacity-50"
                     />
                 </div>

                 <div className="p-4 bg-slate-800/30 rounded-xl border border-slate-700/50 flex flex-col gap-1">
                     <label className="text-[10px] font-mono text-slate-500 uppercase tracking-widest flex items-center gap-1">
                       <Calendar className="w-3 h-3" /> Deadline
                     </label>
                     <input 
                       type="date" 
                       value={plan.deadline}
                       onChange={(e) => handleDeadlineChange(e.target.value)}
                       disabled={isSubmitting}
                       className="bg-transparent text-lg font-bold text-slate-200 font-mono focus:outline-none w-full border-b border-transparent hover:border-slate-700 focus:border-indigo-500 transition-colors pb-1 disabled:opacity-50"
                     />
                 </div>
            </div>

            {/* Location */}
            <div className="md:col-span-2 grid grid-cols-2 gap-4 bg-indigo-500/5 p-4 rounded-xl border border-indigo-500/10">
                <div className="flex items-center gap-3">
                   <div 
                      className={`w-10 h-10 rounded-lg flex items-center justify-center cursor-pointer transition-all ${plan.isExternal ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-500 hover:bg-slate-700'} ${isSubmitting ? 'pointer-events-none opacity-50' : ''}`}
                      onClick={() => !isSubmitting && handleIsExternalChange(!plan.isExternal)}
                   >
                      <Car className="w-5 h-5" />
                   </div>
                   <div>
                      <div className="text-xs font-bold text-indigo-300">Außentermin?</div>
                      <div className="text-[10px] text-slate-500">Klicken zum Umschalten</div>
                   </div>
                </div>
                
                {plan.isExternal && (
                  <div className="relative animate-in fade-in slide-in-from-left-2">
                     <label className="text-[10px] font-mono text-slate-500 uppercase tracking-widest flex items-center gap-1 mb-1">
                       <MapPin className="w-3 h-3" /> Ort
                     </label>
                     <input 
                       type="text" 
                       value={plan.location || ''}
                       onChange={(e) => handleLocationChange(e.target.value)}
                       placeholder="z.B. Hannover"
                       disabled={isSubmitting}
                       className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
                     />
                  </div>
                )}
            </div>
          </div>

          {/* Description & Attachments */}
          <div className="md:col-span-2 space-y-3">
            <div className="flex justify-between items-center">
                <label className="text-xs font-mono text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <FileText className="w-3 h-3" /> Briefing
                </label>
                <button 
                    type="button"
                    onClick={handleGenerateDescription}
                    disabled={isDescLoading || attachments.length === 0 || isSubmitting}
                    className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 disabled:opacity-50"
                    title="Beschreibung aus Bildern generieren"
                >
                     {isDescLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                     AI Gen
                </button>
            </div>
            <textarea
                value={plan.description || ''}
                onChange={(e) => handleDescriptionChange(e.target.value)}
                placeholder="Projektbeschreibung..."
                disabled={isSubmitting}
                className="w-full bg-slate-800/30 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 min-h-[120px] resize-y leading-relaxed disabled:opacity-50"
            />
            
            {/* Attachment Strip */}
            <div className="border border-dashed border-slate-700 rounded-xl p-3 bg-slate-900/50">
                <div className="flex justify-between items-center mb-2">
                   <div className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                       <Paperclip className="w-3 h-3" /> Anhänge ({attachments.length})
                   </div>
                   <button 
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isSubmitting}
                      className="text-[10px] text-indigo-400 hover:text-white flex items-center gap-1 px-2 py-1 rounded hover:bg-indigo-500/20 transition-colors"
                   >
                      <Upload className="w-3 h-3" /> Upload
                   </button>
                   <input type="file" ref={fileInputRef} className="hidden" multiple accept="image/*,.pdf" onChange={handleFileSelect} />
                </div>
                
                {attachments.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {attachments.map((src, idx) => {
                         const isPdf = src.startsWith('data:application/pdf') || src.toLowerCase().endsWith('.pdf');
                         return (
                            <div key={idx} className="relative group w-14 h-14 rounded-lg overflow-hidden border border-slate-700 bg-slate-800 cursor-pointer" onClick={() => openAttachment(src)}>
                                {isPdf ? (
                                    <div className="w-full h-full flex items-center justify-center text-red-400"><FileText className="w-6 h-6" /></div>
                                ) : (
                                    <img src={src} alt="att" className="w-full h-full object-cover" />
                                )}
                                <button 
                                  onClick={(e) => { e.stopPropagation(); removeAttachment(idx); }}
                                  className="absolute top-0.5 right-0.5 bg-black/60 text-white p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                            </div>
                         );
                      })}
                    </div>
                ) : (
                    <div className="text-center text-[10px] text-slate-600 py-2">Keine Anhänge</div>
                )}
            </div>
          </div>

          {/* Rationale / Options */}
          {(!isEditing || plan.rationale) && (
            <div className="relative group">
                <div className="relative bg-slate-900 rounded-xl p-4 border border-slate-700/50">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-3 h-3 text-indigo-400" />
                    <span className="text-xs font-bold text-indigo-400 uppercase tracking-wide">Rationale</span>
                  </div>
                  <p className="text-sm text-slate-300 font-mono leading-relaxed opacity-90">
                    {plan.rationale || 'Keine Begründung verfügbar.'}
                  </p>
                </div>
            </div>
          )}
          
          <div className="flex flex-col gap-4 bg-black/30 p-4 rounded-xl border border-white/5 backdrop-blur-md">
                 <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="font-semibold text-white text-sm">Smart Deconstruction</span>
                      <span className="text-slate-400 text-xs">Projekt automatisch in Phasen unterteilen?</span>
                    </div>
                    <button
                        onClick={handleToggleAI}
                        disabled={isLoadingPhases || isSubmitting}
                        className={`relative inline-flex h-8 w-14 items-center rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${useAIPhases ? 'bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.5)]' : 'bg-slate-700'} disabled:opacity-50`}
                    >
                        <span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-lg transition duration-300 ease-in-out ${useAIPhases ? 'translate-x-7' : 'translate-x-1'}`} />
                    </button>
                 </div>

                 {onRefineSplit && (
                     <div className="pt-4 border-t border-white/5 animate-in slide-in-from-top-2">
                        <div className="flex justify-between items-center mb-2">
                            <span className="font-semibold text-white text-xs flex items-center gap-2">
                                <BarChart className="w-3 h-3 text-indigo-400 rotate-90" />
                                Aufteilung
                            </span>
                            <span className="text-[10px] font-mono text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                                {granularity === 1 ? 'GROBE BLÖCKE' : granularity === 3 ? 'FEINE SCHRITTE' : 'AUSGEWOGEN'}
                            </span>
                        </div>
                        <input 
                            type="range" 
                            min="1" 
                            max="3" 
                            step="1"
                            value={granularity}
                            onChange={(e) => handleGranularityChange(parseInt(e.target.value))}
                            disabled={isLoadingPhases || isSubmitting}
                            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500 disabled:opacity-50"
                        />
                     </div>
                 )}

                 {isLoadingPhases && (
                     <div className="flex items-center justify-center py-2 text-xs text-indigo-400 animate-pulse">
                         <Loader2 className="w-4 h-4 animate-spin mr-2" />
                         Berechne neue Struktur...
                     </div>
                 )}
          </div>

          {/* Phases List */}
          <div>
            <div className="flex justify-between items-end mb-4 border-b border-slate-800 pb-2">
              <h4 className="font-bold text-white text-lg">
                Phasen
                <span className="ml-2 text-sm font-normal text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">{plan.phases.length}</span>
              </h4>
              <button 
                onClick={addPhase}
                disabled={isSubmitting}
                className="text-xs bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-3 py-1.5 rounded-lg flex items-center gap-1 font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-3 h-3" /> Phase hinzufügen
              </button>
            </div>

            <div className="space-y-3">
              {plan.phases.map((phase, idx) => (
                <div 
                    key={idx} 
                    className="flex items-center gap-3 p-3 bg-slate-800/40 rounded-xl border border-slate-700/50 hover:border-indigo-500/30 transition-all group hover:bg-slate-800/70"
                    onMouseEnter={() => onHoverPhase && onHoverPhase(idx)}
                    onMouseLeave={() => onHoverPhase && onHoverPhase(null)}
                    draggable={!isSubmitting}
                    onDragStart={(e) => handleDragStart(e, idx)}
                >
                  {/* Grip Handle */}
                  <div className="text-slate-600 hover:text-white cursor-grab active:cursor-grabbing self-start mt-1.5 -ml-1">
                      <GripVertical className="w-4 h-4" />
                  </div>

                  <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-xs font-mono text-slate-500 shrink-0 border border-slate-700 self-start mt-0.5">
                    {(idx + 1).toString().padStart(2, '0')}
                  </div>
                  
                  <div className="flex-grow min-w-0">
                       <textarea 
                          value={phase.name}
                          onChange={(e) => {
                             handlePhaseChange(idx, 'name', e.target.value);
                             e.target.style.height = 'auto';
                             e.target.style.height = e.target.scrollHeight + 'px';
                          }}
                          disabled={isSubmitting}
                          ref={(el) => { if(el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }}}
                          className="w-full bg-transparent border-none p-0 text-sm text-slate-200 focus:ring-0 placeholder-slate-600 font-medium resize-none overflow-hidden leading-relaxed disabled:opacity-60"
                          rows={1}
                          placeholder="Name der Aufgabe"
                       />
                       {phase.rationale && phase.rationale !== 'Manuell hinzugefügt' && (
                         <div className="text-[10px] text-slate-500 mt-0.5 font-mono opacity-70 whitespace-normal leading-relaxed">{phase.rationale}</div>
                       )}
                  </div>

                  <div className="flex items-center gap-2 pr-2 self-start mt-0.5">
                     <input 
                        type="date"
                        value={phase.suggestedDate || ''}
                        onChange={(e) => handlePhaseChange(idx, 'suggestedDate', e.target.value)}
                        disabled={isSubmitting}
                        className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-300 w-24 focus:ring-0 focus:border-indigo-500 placeholder-slate-600 disabled:opacity-50"
                        title="Festes Datum für diese Phase"
                     />
                     
                     <div className="bg-slate-900 rounded-lg flex items-center px-2 py-1 border border-slate-700 group-hover:border-slate-600">
                        <input 
                            type="text"
                            inputMode="decimal"
                            value={phase.hours.toString().replace('.', ',')}
                            onChange={(e) => handlePhaseChange(idx, 'hours', parseLocalizedFloat(e.target.value))}
                            disabled={isSubmitting}
                            className="w-12 bg-transparent border-none p-0 text-xs text-center text-slate-200 focus:ring-0 font-mono disabled:opacity-50"
                        />
                        <span className="text-[10px] text-slate-600 font-mono ml-1">h</span>
                     </div>
                     <button 
                        onClick={() => removePhase(idx)}
                        disabled={isSubmitting}
                        className="p-1.5 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-0"
                        title="Entfernen"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 bg-slate-900/90 backdrop-blur border-t border-slate-800 flex justify-between items-center shrink-0">
          <div className="text-xs text-slate-500 font-mono">
             {plan.phases.length} Steps • {plan.totalHours}h Total
          </div>
          <div className="flex gap-3">
            <button 
                onClick={onDiscard}
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 font-medium text-sm transition-colors disabled:opacity-50"
            >
                Abbrechen
            </button>
            <button 
                onClick={handleAcceptClick}
                disabled={plan.phases.length === 0 || isLoadingPhases || isSubmitting}
                className={`group relative px-6 py-2.5 rounded-xl text-white font-bold text-sm transition-all shadow-lg hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 overflow-hidden min-w-[140px] flex justify-center ${isEditing ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-500/25 hover:shadow-amber-500/40' : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/25 hover:shadow-indigo-500/40'}`}
            >
                <span className="relative z-10 flex items-center gap-2">
                    {isSubmitting ? (
                        <>
                           <Loader2 className="w-4 h-4 animate-spin" />
                           Speichere...
                        </>
                    ) : (
                        <>
                           {isEditing ? 'Update Project' : 'Start Planning'} <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </>
                    )}
                </span>
                {!isSubmitting && <div className="absolute top-0 -inset-full h-full w-1/2 z-5 block transform -skew-x-12 bg-gradient-to-r from-transparent to-white opacity-20 group-hover:animate-shine" />}
            </button>
          </div>
        </div>
    </div>
    </>
  );
};
