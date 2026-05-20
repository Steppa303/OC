
import React, { useState, useRef } from 'react';
import { Project, ProjectPhase } from '../types';
import { X, Save, Plus, Trash2, Sparkles, Loader2, ArrowRight, Paperclip, Upload, FileText, RefreshCw, ExternalLink, Eye, MapPin, Car, PlayCircle } from 'lucide-react';
import { generateId, compressImage } from '../utils';
import { extractTextFromPDF } from '../utils/pdfParser';
import { refineProjectPlan, generateProjectDescription } from '../services/geminiService';

interface EditProjectModalProps {
  project: Project;
  phases: ProjectPhase[];
  onSave: (updatedProject: Project, updatedPhases: ProjectPhase[]) => void;
  onClose: () => void;
}

export const EditProjectModal: React.FC<EditProjectModalProps> = ({ project, phases, onSave, onClose }) => {
  const [title, setTitle] = useState(project.title);
  const [description, setDescription] = useState(project.description || "");
  const [deadline, setDeadline] = useState(project.deadline);
  // Default start date to today if not present (backward compatibility)
  const [startDate, setStartDate] = useState(project.startDate || new Date().toISOString().split('T')[0]);
  const [totalHours, setTotalHours] = useState(project.totalHours);
  const [localPhases, setLocalPhases] = useState<ProjectPhase[]>(JSON.parse(JSON.stringify(phases)));
  const [attachments, setAttachments] = useState<string[]>(project.attachments || []);
  
  // New Fields
  const [isExternal, setIsExternal] = useState(project.isExternal || false);
  const [location, setLocation] = useState(project.location || "");

  // AI Edit State
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isDescLoading, setIsDescLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...project,
      title,
      description,
      deadline,
      startDate,
      totalHours: Number(totalHours),
      attachments, // Save attachments
      isExternal,
      location: isExternal ? location : undefined
    }, localPhases);
  };

  const handlePhaseChange = (id: string, field: keyof ProjectPhase, value: string | number) => {
    setLocalPhases(prev => prev.map(p => {
      if (p.id === id) {
        return { ...p, [field]: value };
      }
      return p;
    }));
  };

  const handleDeletePhase = (id: string) => {
    setLocalPhases(prev => prev.filter(p => p.id !== id));
  };

  const handleAddPhase = () => {
    const newPhase: ProjectPhase = {
      id: generateId(),
      projectId: project.id,
      name: "Neue Phase",
      hours: 1,
      suggestedDate: project.deadline, // Default to deadline
      status: 'pending'
    };
    setLocalPhases(prev => [...prev, newPhase]);
  };
  
  // Helper for German input "1,5"
  const parseLocalizedFloat = (val: string): number => {
      const normalized = val.replace(/,/g, '.');
      const num = parseFloat(normalized);
      return isNaN(num) ? 0 : num;
  };

  const handleAiRefine = async () => {
    if (!aiPrompt.trim()) return;
    
    setIsAiLoading(true);
    try {
      // Prepare simplified objects for AI context
      const currentProjectSimple = { title, totalHours, deadline, startDate, description, isExternal, location };
      const currentPhasesSimple = localPhases.map(p => ({
        name: p.name,
        hours: p.hours,
        suggestedDate: p.suggestedDate
      }));

      const response = await refineProjectPlan(
        currentProjectSimple, 
        currentPhasesSimple, 
        aiPrompt
      );

      // Apply changes to state
      setTitle(response.title);
      setTotalHours(response.totalHours);
      setDeadline(response.deadline);
      if (response.startDate) setStartDate(response.startDate);
      if (response.description) setDescription(response.description);
      if (response.isExternal !== undefined) setIsExternal(response.isExternal);
      if (response.location) setLocation(response.location);

      // Map response phases to new ProjectPhase objects
      const newPhases: ProjectPhase[] = response.phases.map((p: any) => ({
        id: generateId(),
        projectId: project.id,
        name: p.name,
        hours: p.hours,
        suggestedDate: p.suggestedDate || response.deadline,
        status: 'pending' 
      }));

      setLocalPhases(newPhases);
      setAiPrompt('');
      
    } catch (error) {
      console.error(error);
      alert("Konnte Änderungen nicht anwenden. Bitte versuche es erneut.");
    } finally {
      setIsAiLoading(false);
    }
  };

  // Generate description ONLY from attachments
  const handleGenerateDescription = async () => {
    if (attachments.length === 0) {
        alert("Bitte lade zuerst Dateien hoch, um eine Beschreibung zu generieren.");
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

        const newDesc = await generateProjectDescription(description, "Generiere basierend auf den angehängten Bildern.", imageParts);
        if (newDesc) {
            setDescription(newDesc);
        }
    } catch (e) {
        console.error("Failed to generate description", e);
        alert("Fehler bei der Generierung.");
    } finally {
        setIsDescLoading(false);
    }
  };

  // --- File Handling ---
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files) as File[];
      const imageFiles = files.filter(f => f.type.startsWith('image/'));
      
      const base64Files = await Promise.all(imageFiles.map(compressImage));
      setAttachments(prev => [...prev, ...base64Files]);
      
      const pdfFiles = files.filter(f => f.type === 'application/pdf');
      if (pdfFiles.length > 0) {
          setIsDescLoading(true);
          try {
             const texts = await Promise.all(pdfFiles.map(extractTextFromPDF));
             const combinedText = texts.join("\n\n");
             const newDesc = await generateProjectDescription(description, combinedText);
             setDescription(newDesc);
          } finally {
             setIsDescLoading(false);
          }
      }
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files) as File[];
      const imageFiles = files.filter(f => f.type.startsWith('image/'));
      const base64Files = await Promise.all(imageFiles.map(compressImage));
      setAttachments(prev => [...prev, ...base64Files]);

      const pdfFiles = files.filter(f => f.type === 'application/pdf');
      if (pdfFiles.length > 0) {
          setIsDescLoading(true);
          try {
             const texts = await Promise.all(pdfFiles.map(extractTextFromPDF));
             const combinedText = texts.join("\n\n");
             const newDesc = await generateProjectDescription(description, combinedText);
             setDescription(newDesc);
          } finally {
             setIsDescLoading(false);
          }
      }
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const openAttachment = (src: string) => {
    // Open Base64 string or URL in new tab
    const newWindow = window.open();
    if (newWindow) {
        if (src.startsWith('data:application/pdf')) {
             // For Base64 PDF, we embed it in an iframe to ensure it renders
             newWindow.document.write(`<iframe width='100%' height='100%' src='${src}'></iframe>`);
        } else {
             newWindow.document.write(`<img src="${src}" style="max-width: 100%;" />`);
        }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-300 flex flex-col max-h-[90vh] border border-slate-800">
        <div className="flex justify-between items-center p-4 border-b border-slate-800 flex-shrink-0">
          <h2 className="text-lg font-bold text-slate-200">Projekt bearbeiten</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* AI Assist Section */}
        <div className="bg-indigo-500/10 p-4 border-b border-indigo-500/20 flex-shrink-0">
          <label className="text-xs font-bold text-indigo-400 mb-2 flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            KI-Assistenz: Sag mir, was geändert werden soll
          </label>
          <div className="flex gap-2">
            <input 
              type="text" 
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAiRefine()}
              placeholder="z.B. 'Ändere den Ort auf Berlin' oder 'Verschiebe alles'"
              className="flex-grow text-sm px-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-950 text-slate-200 placeholder-slate-600"
              disabled={isAiLoading}
            />
            <button 
              onClick={handleAiRefine}
              disabled={isAiLoading || !aiPrompt.trim()}
              className="bg-indigo-600 hover:bg-indigo-500 text-white p-2 rounded-lg disabled:opacity-50 transition-colors"
            >
              {isAiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-grow overflow-hidden">
          <div className="p-6 overflow-y-auto space-y-6">
            
            {/* Attachments Section */}
            <div 
              className={`border-2 border-dashed rounded-xl p-4 transition-colors ${isDragging ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-700 hover:border-slate-500 bg-slate-950/30'}`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
              onDrop={handleDrop}
            >
              <div className="flex justify-between items-start mb-3">
                 <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                   <Paperclip className="w-4 h-4" /> Anhänge ({attachments.length})
                 </label>
                 <button 
                    type="button" 
                    onClick={() => fileInputRef.current?.click()}
                    className="text-indigo-400 hover:text-indigo-300 text-xs flex items-center gap-1"
                 >
                   <Upload className="w-3 h-3" /> Hochladen
                 </button>
                 <input type="file" ref={fileInputRef} className="hidden" multiple accept="image/*,.pdf" onChange={handleFileSelect} />
              </div>
              
              {attachments.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {attachments.map((src, idx) => {
                    // Simple check for PDF based on Base64 header or file extension if it's a URL
                    const isPdf = src.startsWith('data:application/pdf') || src.toLowerCase().endsWith('.pdf');

                    return (
                        <div key={idx} className="relative group w-20 h-20 rounded-lg overflow-hidden border border-slate-700 bg-slate-900 cursor-pointer shadow-sm hover:shadow-indigo-500/20 hover:border-indigo-500/50 transition-all">
                            {/* Content Preview */}
                            <div 
                                className="w-full h-full flex items-center justify-center"
                                onClick={() => openAttachment(src)}
                                title="Klicken zum Öffnen"
                            >
                                {isPdf ? (
                                    <div className="flex flex-col items-center justify-center gap-1 text-red-400">
                                        <FileText className="w-8 h-8" />
                                        <span className="text-[9px] uppercase font-bold text-red-500/80">PDF</span>
                                    </div>
                                ) : (
                                    <img src={src} alt="attachment" className="w-full h-full object-cover" />
                                )}
                            </div>

                            {/* Hover Overlay: Open Action */}
                            <div 
                                className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none"
                            >
                                <Eye className="w-6 h-6 text-white drop-shadow-md" />
                            </div>

                            {/* Delete Button (Absolute Top Right) */}
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    removeAttachment(idx);
                                }}
                                className="absolute top-0.5 right-0.5 bg-black/60 hover:bg-red-500 text-white rounded-md p-1 opacity-0 group-hover:opacity-100 transition-all z-10"
                                title="Löschen"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center text-slate-500 text-xs py-2">
                  Dateien hierher ziehen um sie anzuhängen. (PDFs werden direkt analysiert)
                </div>
              )}
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-slate-300 border-b border-slate-800 pb-2">Allgemeine Infos</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">
                    Projekt Titel
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-200"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">
                    Gesamtstunden
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={totalHours.toString().replace('.', ',')}
                    onChange={(e) => setTotalHours(parseLocalizedFloat(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-200"
                    required
                  />
                </div>

                {/* Dates Row */}
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1 flex items-center gap-1">
                     <PlayCircle className="w-3 h-3" /> Start Datum
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-200"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">
                    Deadline
                  </label>
                  <input
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-200"
                    required
                  />
                </div>
                
                {/* Location Settings */}
                <div className="md:col-span-2 bg-slate-950/50 p-3 rounded-lg border border-slate-800">
                    <div className="flex items-center gap-3 mb-3">
                         <input 
                            type="checkbox" 
                            id="isExternal"
                            checked={isExternal || false}
                            onChange={(e) => setIsExternal(e.target.checked)}
                            className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-slate-900"
                         />
                         <label htmlFor="isExternal" className="text-sm font-bold text-indigo-300 flex items-center gap-2 cursor-pointer select-none">
                             <Car className="w-4 h-4" /> Außentermin / Vor Ort
                         </label>
                    </div>
                    
                    {isExternal && (
                        <div className="animate-in slide-in-from-top-2">
                             <label className="block text-xs font-mono text-slate-500 mb-1 flex items-center gap-1">
                                <MapPin className="w-3 h-3" /> Ort
                             </label>
                             <input 
                                type="text"
                                value={location}
                                onChange={(e) => setLocation(e.target.value)}
                                placeholder="z.B. Berlin Studio"
                                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-200 text-sm"
                             />
                        </div>
                    )}
                </div>

              </div>
            </div>
            
            {/* Description Editor */}
            <div className="space-y-2">
                <div className="flex justify-between items-center">
                    <label className="block text-sm font-medium text-slate-400 flex items-center gap-2">
                         <FileText className="w-4 h-4" /> Beschreibung / Briefing
                    </label>
                    <button 
                        type="button"
                        onClick={handleGenerateDescription}
                        disabled={isDescLoading || attachments.length === 0}
                        className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 disabled:opacity-50"
                        title="Generiert Beschreibung neu aus aktuellen Bildern"
                    >
                         {isDescLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                         Aus Bildern generieren
                    </button>
                </div>
                <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-200 min-h-[100px] text-sm font-mono leading-relaxed"
                    placeholder="Projektbeschreibung..."
                />
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <h3 className="font-semibold text-slate-300">Phasen & Aufwand</h3>
                <button 
                  type="button"
                  onClick={handleAddPhase}
                  className="text-indigo-400 hover:text-indigo-300 text-sm font-medium flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" /> Phase hinzufügen
                </button>
              </div>
              
              <div className="space-y-3">
                {localPhases.map((phase) => (
                  <div key={phase.id} className="flex gap-3 items-start bg-slate-950/50 p-3 rounded-lg border border-slate-800">
                    <div className="flex-grow space-y-2">
                      <div>
                        <label className="text-xs text-slate-500 block mb-1">Phasen Name</label>
                        <input
                          type="text"
                          value={phase.name}
                          onChange={(e) => handlePhaseChange(phase.id, 'name', e.target.value)}
                          className="w-full px-2 py-1.5 text-sm bg-slate-900 border border-slate-700 rounded text-slate-200 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>
                    <div className="w-24 flex-shrink-0 space-y-2">
                      <div>
                        <label className="text-xs text-slate-500 block mb-1">Stunden</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={phase.hours.toString().replace('.', ',')}
                          onChange={(e) => handlePhaseChange(phase.id, 'hours', parseLocalizedFloat(e.target.value))}
                          className="w-full px-2 py-1.5 text-sm bg-slate-900 border border-slate-700 rounded text-slate-200 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>
                    <div className="w-28 flex-shrink-0 space-y-2">
                       <div>
                        <label className="text-xs text-slate-500 block mb-1">Datum</label>
                        <input
                          type="date"
                          value={phase.suggestedDate}
                          onChange={(e) => handlePhaseChange(phase.id, 'suggestedDate', e.target.value)}
                          className="w-full px-2 py-1.5 text-sm bg-slate-900 border border-slate-700 rounded text-slate-200 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeletePhase(phase.id)}
                      className="mt-6 p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                      title="Phase löschen"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {localPhases.length === 0 && (
                   <div className="text-center text-slate-500 text-sm py-4 italic">
                     Keine Phasen definiert.
                   </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex-shrink-0 p-4 border-t border-slate-800 bg-slate-900 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-400 hover:bg-slate-800 rounded-lg font-medium text-sm transition-colors"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium text-sm transition-colors flex items-center gap-2"
            >
              <Save className="w-4 h-4" /> Speichern
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};