
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MagicInput } from './components/MagicInput';
import { HeatmapCalendar } from './components/HeatmapCalendar';
import { ProjectList } from './components/ProjectList';
import { PlanProposal } from './components/PlanProposal';
// REMOVED: EditProjectModal
import { DeleteConfirmModal } from './components/DeleteConfirmModal';
import { FocusMode } from './components/FocusMode';
import { CapacityTrend } from './components/CapacityTrend';
import { TimelineWidget } from './components/TimelineWidget';
import { QuickEditModal } from './components/QuickEditModal';
import { BugTrackerModal } from './components/BugTrackerModal'; 
import { NewsWidget } from './components/NewsWidget'; 
import { ZoomController, ZoomLevel } from './components/ZoomController'; 
import { ShareModal } from './components/ShareModal'; 
import { SharedViewApp } from './components/SharedViewApp'; 
import { InboxModal } from './components/InboxModal';
import { Project, ProjectPhase, DayCapacity, AIPlanResponse, DAILY_CAPACITY_HOURS, User, BugTicket, InboundRequest } from './types';
import { formatDate, addDays, getDaysArray, generateId, getRandomColor, generateRecurringDates, compressImage, uploadFile } from './utils';
import { extractTextFromPDF } from './utils/pdfParser';
import { parseProjectRequest, suggestSchedule, detectUserIntent, extractTimeOffDetails, rebalanceSchedule, parseManagementRequest, detectOversizeRequest, calculateLiquidSchedule, LiquidGranularity } from './services/geminiService';
import { subscribeToRequests } from './services/shareService';
import { LayoutDashboard, Calendar as CalendarIcon, Settings, Sparkles, Shield, ShieldCheck, Power, Info, Car, MapPin, ChevronDown, User as UserIcon, LogOut, Check, Bug, Share2, Inbox } from 'lucide-react';
import { db } from './lib/firebase';
import confetti from 'canvas-confetti';

// --- USER CONFIGURATION ---
const USERS: User[] = [
  { id: 'user_bastian', name: 'Bastian Lewin', initials: 'BL', color: 'from-indigo-600 to-purple-600' },
  { id: 'user_martin', name: 'Martin Giessmann', initials: 'MG', color: 'from-blue-600 to-cyan-600' }
];

// Helper to remove undefined fields which Firestore rejects
const sanitizeForFirestore = (obj: any) => {
  const newObj = { ...obj };
  Object.keys(newObj).forEach(key => {
    if (newObj[key] === undefined) {
      delete newObj[key];
    }
  });
  return newObj;
};

const App: React.FC = () => {
  // --- ROUTING CHECK (Phase 2) ---
  const [shareId] = useState<string | null>(() => {
      const params = new URLSearchParams(window.location.search);
      return params.get('shareId');
  });

  if (shareId) {
      return <SharedViewApp shareId={shareId} />;
  }

  // --- STANDARD APP LOGIC BELOW ---

  // --- State ---
  const [currentUser, setCurrentUser] = useState<User>(USERS[0]);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const [dbProjects, setDbProjects] = useState<Project[]>([]);
  const [dbPhases, setDbPhases] = useState<ProjectPhase[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(true);
  
  // Safe Mode / Playground State
  const [isSafeMode, setIsSafeMode] = useState(false);
  const [mockData, setMockData] = useState<{projects: Project[], phases: ProjectPhase[]} | null>(null);

  const [proposal, setProposal] = useState<AIPlanResponse | null>(null);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null); // NEW: Track edit mode
  const [currentPrompt, setCurrentPrompt] = useState<string>('');
  
  // Interaction State for Ghost Tiles
  const [activeGhostIndex, setActiveGhostIndex] = useState<number | null>(null);
  const [highlightedProjectId, setHighlightedProjectId] = useState<string | null>(null);
  
  // Drag & Drop Bridge: Calendar -> Proposal
  const [proposalDragDropCmd, setProposalDragDropCmd] = useState<{ index: number; date: string; timestamp: number } | null>(null);

  // File Handling States
  const [pendingFiles, setPendingFiles] = useState<string[]>([]); // Base64 strings for PREVIEW only
  const [pendingRawFiles, setPendingRawFiles] = useState<File[]>([]); // Actual files to upload to Storage

  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
  const [quickEditDate, setQuickEditDate] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(formatDate(new Date()));
  
  // TACTICAL ZOOM STATE
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('standard');
  const [calendarStartDate, setCalendarStartDate] = useState(new Date());
  
  // Bug Tracker State
  const [isBugTrackerOpen, setIsBugTrackerOpen] = useState(false);
  const [hasBugNotifications, setHasBugNotifications] = useState(false);

  // Share Modal State
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  // Inbox State (Phase 4)
  const [isInboxOpen, setIsInboxOpen] = useState(false);
  const [inboundRequests, setInboundRequests] = useState<InboundRequest[]>([]);
  const [incomingRequestText, setIncomingRequestText] = useState<string | null>(null);

  // Dynamic Date Range based on Zoom Level
  const daysToShow = useMemo(() => {
     switch(zoomLevel) {
        case 'macro': return 90;
        case 'micro': return 7;
        default: return 28;
     }
  }, [zoomLevel]);

  // Handlers for Calendar Navigation
  const handlePrevRange = () => setCalendarStartDate(d => addDays(d, -daysToShow));
  const handleNextRange = () => setCalendarStartDate(d => addDays(d, daysToShow));
  const handleSetStartDate = (date: Date) => setCalendarStartDate(date);
  
  const handleZoomChange = (newLevel: ZoomLevel) => {
    setZoomLevel(newLevel);
    if (selectedDate) {
        const targetDate = new Date(selectedDate);
        setCalendarStartDate(targetDate);
    }
  };

  const calendarDays = useMemo(() => getDaysArray(calendarStartDate, addDays(calendarStartDate, daysToShow - 1)), [calendarStartDate, daysToShow]);

  // --- Click Outside Handler for User Menu ---
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // --- Active Data Filtering (User + Safe Mode) ---
  const allProjectsSource = isSafeMode && mockData ? mockData.projects : dbProjects;
  const allPhasesSource = isSafeMode && mockData ? mockData.phases : dbPhases;

  // Filter Projects by User
  const projects = useMemo(() => {
    return allProjectsSource.filter(p => {
       if (p.userId === currentUser.id) return true;
       // Legacy Data Support: Assume data without ID belongs to the first user (Bastian)
       if (!p.userId && currentUser.id === USERS[0].id) return true;
       return false;
    });
  }, [allProjectsSource, currentUser.id]);

  const phases = useMemo(() => {
    const visibleProjectIds = projects.map(p => p.id);
    return allPhasesSource.filter(p => visibleProjectIds.includes(p.projectId));
  }, [allPhasesSource, projects]);


  // --- Audio Unlock & Firestore Subscriptions ---
  useEffect(() => {
    // 1. Audio Unlocker
    const unlockAudio = () => {
        const audio = new Audio("data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAgZGF0YQQAAAAAAA==");
        audio.play().then(() => {
            console.debug("Audio Context Unlocked");
        }).catch(() => {});
        document.removeEventListener('click', unlockAudio);
        document.removeEventListener('keydown', unlockAudio);
    };
    
    document.addEventListener('click', unlockAudio);
    document.addEventListener('keydown', unlockAudio);

    // 2. Subscribe to Projects
    const unsubscribeProjects = db.collection('projects').onSnapshot((snapshot) => {
      const data = snapshot.docs.map(docSnapshot => ({
        ...docSnapshot.data(),
        id: docSnapshot.id
      } as Project));
      setDbProjects(data);
      setIsDataLoading(false);
    });

    // 3. Subscribe to Phases
    const unsubscribePhases = db.collection('phases').onSnapshot((snapshot) => {
      const data = snapshot.docs.map(docSnapshot => ({
        ...docSnapshot.data(),
        id: docSnapshot.id
      } as ProjectPhase));
      setDbPhases(data);
      setIsDataLoading(false);
    });
    
    // 4. Subscribe to Bug Notifications
    const unsubscribeBugs = db.collection('bugs')
        .where('reporterId', '==', currentUser.id)
        .where('hasUnreadUpdate', '==', true)
        .onSnapshot((snapshot) => {
            setHasBugNotifications(!snapshot.empty);
        });
    
    // 5. Subscribe to Inbox Requests
    const unsubscribeRequests = subscribeToRequests(currentUser.id, (reqs) => {
        setInboundRequests(reqs);
    });

    return () => {
      unsubscribeProjects();
      unsubscribePhases();
      unsubscribeBugs();
      unsubscribeRequests();
      document.removeEventListener('click', unlockAudio);
      document.removeEventListener('keydown', unlockAudio);
    };
  }, [currentUser.id]);

  const generateMockData = () => {
    const currentYear = new Date().getFullYear();
    const mockProjects: Project[] = [];
    const mockPhases: ProjectPhase[] = [];
    
    const isWorkDay = (d: Date) => d.getDay() !== 0 && d.getDay() !== 6;

    const recurringTemplates = [
        { title: "Weekly Team Sync", day: 1, hours: 1.5, color: "bg-slate-600" },
        { title: "Leitungsrunde", day: 4, hours: 2, color: "bg-slate-500" },
    ];

    recurringTemplates.forEach(tmpl => {
        const pId = generateId();
        const totalInstances = 52; 
        const totalHours = totalInstances * tmpl.hours;

        mockProjects.push({
            id: pId,
            userId: currentUser.id,
            title: tmpl.title,
            totalHours: totalHours,
            deadline: `${currentYear}-12-31`,
            color: tmpl.color,
            description: "Safe Mode: Simuliertes Meeting."
        });

        let d = new Date(currentYear, 0, 1);
        while (d.getFullYear() === currentYear) {
            if (d.getDay() === tmpl.day) {
                const isPast = d < new Date();
                mockPhases.push({
                    id: generateId(),
                    projectId: pId,
                    name: tmpl.title,
                    hours: tmpl.hours,
                    suggestedDate: formatDate(d) + "T10:00",
                    status: isPast ? 'completed' : 'pending'
                });
            }
            d.setDate(d.getDate() + 1);
        }
    });

    const scenarios = [
        {
            title: "Safe Mode: Website Relaunch",
            startMonth: new Date().getMonth(), 
            durationWeeks: 4,
            totalHours: 40,
            phases: ["Design", "Content", "Dev", "Testing"],
            desc: "Ein Beispielprojekt für den Safe Mode."
        }
    ];

    scenarios.forEach(scen => {
        const pId = generateId();
        const startDate = new Date();
        const deadlineDate = new Date(startDate);
        deadlineDate.setDate(startDate.getDate() + (scen.durationWeeks * 7));

        mockProjects.push({
            id: pId,
            userId: currentUser.id,
            title: scen.title,
            totalHours: scen.totalHours,
            deadline: formatDate(deadlineDate),
            color: getRandomColor(),
            description: scen.desc
        });

        const hoursPerPhase = scen.totalHours / scen.phases.length;
        const totalProjectDays = (deadlineDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24);
        const daysStep = Math.floor(totalProjectDays / scen.phases.length);

        let currentPhaseDate = new Date(startDate);

        scen.phases.forEach((phaseName) => {
            currentPhaseDate.setDate(currentPhaseDate.getDate() + daysStep);
            while (!isWorkDay(currentPhaseDate)) {
                currentPhaseDate.setDate(currentPhaseDate.getDate() + 1);
            }
            if (currentPhaseDate > deadlineDate) currentPhaseDate = deadlineDate;

            mockPhases.push({
                id: generateId(),
                projectId: pId,
                name: phaseName,
                hours: Number(hoursPerPhase.toFixed(2)),
                suggestedDate: formatDate(currentPhaseDate),
                status: 'pending'
            });
        });
    });

    return { projects: mockProjects, phases: mockPhases };
  };

  const handleToggleSafeMode = () => {
    if (!isSafeMode) {
        let initialData;
        if (dbProjects.length > 0) {
            initialData = {
                projects: JSON.parse(JSON.stringify(dbProjects)),
                phases: JSON.parse(JSON.stringify(dbPhases))
            };
        } else {
            initialData = generateMockData();
        }
        setMockData(initialData);
        setIsSafeMode(true);
        triggerSuccessEffect();
    } else {
        setIsSafeMode(false);
        setMockData(null);
    }
  };

  const dailyCapacityData: DayCapacity[] = useMemo(() => {
    const meetingKeywords = ['meeting', 'besprechung', 'konferenz', 'call', 'viko', 'telco', 'jour fixe', 'daily', 'weekly', 'review', 'orga', 'leitungsrunde'];

    return calendarDays.map((dateObj) => {
      const dateStr = formatDate(dateObj);
      const daysPhases = phases.filter(p => p.suggestedDate.split('T')[0] === dateStr);
      const totalHoursBooked = daysPhases.reduce((acc, curr) => acc + curr.hours, 0);
      
      const daysDeadlines = projects.filter(p => {
        if (p.isTimeOff) return false;
        if (p.deadline !== dateStr) return false;
        const titleLower = p.title.toLowerCase();
        const isMeeting = meetingKeywords.some(keyword => titleLower.includes(keyword));
        return !isMeeting;
      });

      let status: DayCapacity['status'] = 'free';
      if (totalHoursBooked > DAILY_CAPACITY_HOURS) status = 'overloaded';
      else if (totalHoursBooked > DAILY_CAPACITY_HOURS * 0.75) status = 'busy';
      else if (totalHoursBooked > 0) status = 'optimal';

      return {
        date: dateStr,
        totalHoursBooked,
        phases: daysPhases,
        deadlines: daysDeadlines,
        status
      };
    });
  }, [phases, projects, calendarDays]);

  const todaysPhases = useMemo(() => {
    const todayStr = formatDate(new Date());
    return phases.filter(p => p.suggestedDate.split('T')[0] === todayStr);
  }, [phases]);

  // --- Ghost Phase Logic for Calendar Preview ---
  const ghostPhases = useMemo(() => {
    if (!proposal) return [];
    
    // Map AI Proposal phases to temporary ProjectPhase objects
    return proposal.phases.map((p, i) => ({
       id: `ghost-${i}-${Date.now()}`,
       projectId: 'ghost-project-preview',
       name: p.name,
       hours: p.hours,
       suggestedDate: p.suggestedDate || proposal.deadline, // Fallback if no date proposed
       status: 'pending',
       isGhost: true // Mark as ghost
    } as ProjectPhase));
  }, [proposal]);


  const handleTogglePhaseStatus = async (phaseId: string) => {
    const phase = phases.find(p => p.id === phaseId);
    if (!phase) return;

    const newStatus: ProjectPhase['status'] = phase.status === 'completed' ? 'pending' : 'completed';

    if (isSafeMode) {
        setMockData(prev => {
            if (!prev) return null;
            const updatedPhases = prev.phases.map(p => p.id === phaseId ? { ...p, status: newStatus } : p);
            return { ...prev, phases: updatedPhases };
        });
        if (newStatus === 'completed') triggerSuccessEffect();
        return;
    }

    try {
        await db.collection('phases').doc(phaseId).update({ status: newStatus });
        if (newStatus === 'completed') triggerSuccessEffect();
    } catch (error) {
        console.error("Error updating phase status:", error);
    }
  };

  const handleAIRequest = async (text: string, files: File[]) => {
    setIncomingRequestText(null);
    setIsLoading(true);
    setCurrentPrompt(text);
    setEditingProjectId(null); // Ensure we are in create mode
    setProposalDragDropCmd(null); // Reset bridge
    
    try {
      const imageFiles = files.filter(f => f.type.startsWith('image/'));
      const pdfFiles = files.filter(f => f.type === 'application/pdf');
      
      const base64Images = await Promise.all(imageFiles.map(compressImage));
      setPendingFiles(base64Images);
      setPendingRawFiles(files); 

      let extractedContext = "";
      if (pdfFiles.length > 0) {
         const pdfTexts = await Promise.all(pdfFiles.map(extractTextFromPDF));
         extractedContext = "\n\n--- PDF INHALTE ---\n" + pdfTexts.join("\n\n----------------\n");
      }

      const fullPrompt = text + extractedContext;
      const currentDate = formatDate(new Date());

      const intent = await detectUserIntent(text);

      if (intent === 'MANAGEMENT') {
        const command = await parseManagementRequest(text, currentDate);
        const relevantProjects = projects.filter(p => 
           command.keywords.some(k => p.title.toLowerCase().includes(k.toLowerCase()))
        );
        const relevantProjectIds = relevantProjects.map(p => p.id);

        let targetPhases = phases.filter(p => {
           const matchesKeyword = command.keywords.some(k => p.name.toLowerCase().includes(k.toLowerCase()));
           const belongsToProject = relevantProjectIds.includes(p.projectId);
           return matchesKeyword || belongsToProject;
        });

        if (command.dateFilter) {
           const filterDate = new Date(command.dateFilter.date);
           const filterEndDate = command.dateFilter.endDate ? new Date(command.dateFilter.endDate) : null;
           
           targetPhases = targetPhases.filter(p => {
               const pDate = new Date(p.suggestedDate.split('T')[0]);
               if (command.dateFilter?.operator === 'AFTER') return pDate >= filterDate;
               if (command.dateFilter?.operator === 'BEFORE') return pDate < filterDate;
               if (command.dateFilter?.operator === 'ON') return pDate.getTime() === filterDate.getTime();
               if (command.dateFilter?.operator === 'BETWEEN' && filterEndDate) return pDate >= filterDate && pDate <= filterEndDate;
               return true;
           });
        }

        if (command.action === 'DELETE') {
            const phasesToDeleteIds = targetPhases.map(p => p.id);
            const projectsToDeleteIds: string[] = [];

            if (command.targetLevel === 'PROJECT') {
                relevantProjectIds.forEach(id => projectsToDeleteIds.push(id));
            }

            if (phasesToDeleteIds.length === 0 && projectsToDeleteIds.length === 0) {
                alert("Keine passenden Einträge gefunden.");
            } else {
                 if (isSafeMode) {
                     setMockData(prev => {
                         if (!prev) return null;
                         return {
                             projects: prev.projects.filter(p => !projectsToDeleteIds.includes(p.id)),
                             phases: prev.phases.filter(p => !phasesToDeleteIds.includes(p.id))
                         };
                     });
                 } else {
                     const batch = db.batch();
                     phasesToDeleteIds.forEach(id => batch.delete(db.collection('phases').doc(id)));
                     projectsToDeleteIds.forEach(id => batch.delete(db.collection('projects').doc(id)));
                     await batch.commit();
                 }
                 triggerSuccessEffect();
                 alert(`${command.confirmationMessage}\n(${phasesToDeleteIds.length} Einträge gelöscht)`);
            }
        }

      } else if (intent === 'TIMEOFF') {
          const timeOffDetails = await extractTimeOffDetails(text, currentDate);
          const start = new Date(timeOffDetails.startDate);
          const end = new Date(timeOffDetails.endDate);
          
          const conflictingPhases = phases.filter(p => {
             const pDate = new Date(p.suggestedDate.split('T')[0]);
             return pDate >= start && pDate <= end;
          }).map(p => {
             const proj = projects.find(proj => proj.id === p.projectId);
             return {
                id: p.id,
                name: p.name,
                date: p.suggestedDate,
                deadline: proj?.deadline || "2099-12-31",
                projectTitle: proj?.title || "Unknown",
                hours: p.hours
             };
          });

          const existingLoad = dailyCapacityData.map(d => ({
            date: d.date,
            hours: d.totalHoursBooked
          }));

          const updates = await rebalanceSchedule(
             timeOffDetails.startDate,
             timeOffDetails.endDate,
             conflictingPhases,
             currentDate,
             existingLoad
          );

          if (isSafeMode) {
             const newVacId = generateId();
             const newVacProject: Project = {
                id: newVacId,
                userId: currentUser.id,
                title: `[SAFE] ${timeOffDetails.title}`,
                totalHours: 0,
                deadline: timeOffDetails.endDate,
                color: 'bg-teal-700',
                description: timeOffDetails.reason,
                isTimeOff: true
             };

             const newVacPhases: ProjectPhase[] = [];
             for(let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                 if (d.getDay() !== 0 && d.getDay() !== 6) {
                    newVacPhases.push({
                       id: generateId(),
                       projectId: newVacId,
                       name: "Abwesend (Safe Mode)",
                       hours: 8,
                       suggestedDate: formatDate(d),
                       status: 'scheduled'
                    });
                 }
             }
             newVacProject.totalHours = newVacPhases.length * 8;

             setMockData(prev => {
                if (!prev) return null;
                let updatedPhases = [...prev.phases];
                updates.forEach(u => {
                   const idx = updatedPhases.findIndex(p => p.id === u.phaseId);
                   if (idx !== -1) {
                      const originalTime = updatedPhases[idx].suggestedDate.includes('T') 
                           ? updatedPhases[idx].suggestedDate.split('T')[1] 
                           : '';
                      updatedPhases[idx] = { 
                          ...updatedPhases[idx], 
                          suggestedDate: originalTime ? `${u.newDate}T${originalTime}` : u.newDate 
                      };
                   }
                });
                return {
                    projects: [...prev.projects, newVacProject],
                    phases: [...updatedPhases, ...newVacPhases]
                };
             });

             triggerSuccessEffect();
             alert(`Safe Mode: Urlaub simuliert. ${updates.length} Konflikte gelöst.`);

          } else {
             const batch = db.batch();

             updates.forEach(upd => {
                const ref = db.collection('phases').doc(upd.phaseId);
                const originalPhase = phases.find(p => p.id === upd.phaseId);
                const originalTime = originalPhase?.suggestedDate.includes('T') 
                   ? originalPhase.suggestedDate.split('T')[1] 
                   : '';
                const newDateTime = originalTime ? `${upd.newDate}T${originalTime}` : upd.newDate;
                batch.update(ref, { suggestedDate: newDateTime });
             });

             const vacProjectId = generateId();
             const vacProject: Project = {
                id: vacProjectId,
                userId: currentUser.id,
                title: timeOffDetails.title,
                totalHours: 0,
                deadline: timeOffDetails.endDate,
                color: 'bg-slate-700',
                description: `Automatisch generiert: ${timeOffDetails.reason}`,
                isTimeOff: true
             };

             const vacPhases: ProjectPhase[] = [];
             for(let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                 if (d.getDay() !== 0 && d.getDay() !== 6) {
                    vacPhases.push({
                       id: generateId(),
                       projectId: vacProjectId,
                       name: "Abwesend / Blockiert",
                       hours: 8,
                       suggestedDate: formatDate(d),
                       status: 'scheduled'
                    });
                 }
             }
             vacProject.totalHours = vacPhases.length * 8;

             if (vacPhases.length > 0) {
                batch.set(db.collection('projects').doc(vacProjectId), vacProject);
                vacPhases.forEach(vp => {
                   batch.set(db.collection('phases').doc(vp.id), vp);
                });
             }

             await batch.commit();
             triggerSuccessEffect();
             alert(`Urlaub eingetragen! ${updates.length} Aufgaben wurden automatisch verschoben.`);
          }

      } else {
          // --- STANDARD PROJECT FLOW ---
          const response = await parseProjectRequest(fullPrompt, currentDate, false);
          const projectStart = response.startDate || currentDate;
          
          // Liquid Flow
          if ((response.totalHours > 8 || detectOversizeRequest(fullPrompt)) && !response.recurrence?.isRecurring) {
              const availableSlots = dailyCapacityData
                  .filter(d => {
                      const date = new Date(d.date);
                      const day = date.getDay();
                      return day !== 0 && day !== 6; 
                  })
                  .map(d => ({
                      date: d.date,
                      freeHours: Math.max(0, 8 - d.totalHoursBooked)
                  }));

              const liquidPhases = await calculateLiquidSchedule(
                  response.title,
                  response.totalHours,
                  response.deadline,
                  projectStart,
                  availableSlots
              );

              if (liquidPhases.length > 0) {
                  response.phases = liquidPhases.map(p => ({
                      name: p.name,
                      hours: p.hours,
                      rationale: p.rationale,
                      suggestedDate: p.date
                  }));
                  response.rationale = "Projekt wurde automatisch auf verfügbare Kapazitäten verteilt (Liquid Task Flow).";
              }
          }
          
          setProposal(response);
      }

    } catch (error) {
      console.error(error);
      alert("Anfrage konnte nicht verarbeitet werden. Bitte versuche es erneut.");
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleRefineLiquidSplit = async (granularity: LiquidGranularity) => {
      if (!proposal) return;
      
      const availableSlots = dailyCapacityData
          .filter(d => {
              const date = new Date(d.date);
              const day = date.getDay();
              return day !== 0 && day !== 6;
          })
          .map(d => ({
              date: d.date,
              freeHours: Math.max(0, 8 - d.totalHoursBooked)
          }));

      const liquidPhases = await calculateLiquidSchedule(
          proposal.title,
          proposal.totalHours,
          proposal.deadline,
          proposal.startDate || formatDate(new Date()),
          availableSlots,
          granularity
      );

      if (liquidPhases.length > 0) {
          const newPhases = liquidPhases.map(p => ({
              name: p.name,
              hours: p.hours,
              rationale: p.rationale,
              suggestedDate: p.date
          }));
          
          setProposal(prev => prev ? ({ ...prev, phases: newPhases, rationale: `Neuberechnung mit Granularität: ${granularity}` }) : null);
      }
  };

  const handleAcceptProposal = async (finalProposal: AIPlanResponse, newFiles?: File[]) => {
    const planToUse = finalProposal || proposal;
    if (!planToUse) return;

    setIsLoading(true);

    // 1. Handle New Uploads (if any)
    let addedAttachmentUrls: string[] = [];
    if (newFiles && newFiles.length > 0) {
        try {
            const uploadPromises = newFiles.map(file => uploadFile(file));
            addedAttachmentUrls = await Promise.all(uploadPromises);
        } catch (e) {
            console.error("Storage upload failed", e);
            alert("Warnung: Neue Dateien konnten nicht in die Cloud geladen werden.");
        }
    }

    // Combine old existing attachments with newly uploaded ones
    const finalAttachmentUrls = [...(planToUse.attachments || []), ...addedAttachmentUrls];

    // --- CASE 1: SAFE MODE ---
    if (isSafeMode) {
         if (editingProjectId) {
             // UPDATE MODE
             setMockData(prev => {
                if (!prev) return null;
                const updatedProjects = prev.projects.map(p => p.id === editingProjectId ? {
                   ...p,
                   title: planToUse.title,
                   description: planToUse.description,
                   totalHours: planToUse.totalHours,
                   startDate: planToUse.startDate,
                   deadline: planToUse.deadline,
                   attachments: finalAttachmentUrls,
                   isExternal: planToUse.isExternal,
                   location: planToUse.location
                } : p);
                
                // Replace phases: Filter out old ones, add new ones
                const otherPhases = prev.phases.filter(p => p.projectId !== editingProjectId);
                const newPhasesMock = planToUse.phases.map(p => ({
                    id: p.id || generateId(), // Keep ID if exists
                    projectId: editingProjectId,
                    name: p.name,
                    hours: p.hours,
                    suggestedDate: p.suggestedDate || planToUse.deadline,
                    status: p.status || 'pending'
                } as ProjectPhase));

                return {
                    projects: updatedProjects,
                    phases: [...otherPhases, ...newPhasesMock]
                };
             });
         } else {
             // CREATE MODE
             const newProjectId = generateId();
             const newProject: Project = {
                id: newProjectId,
                userId: currentUser.id,
                title: `[SAFE] ${planToUse.title}`,
                totalHours: planToUse.totalHours,
                startDate: planToUse.startDate || formatDate(new Date()),
                deadline: planToUse.deadline,
                color: getRandomColor(),
                attachments: finalAttachmentUrls,
                description: planToUse.description,
                isExternal: planToUse.isExternal,
                location: planToUse.location
             };
             
             const newPhases = planToUse.phases.map(p => ({
                id: generateId(),
                projectId: newProjectId,
                name: p.name,
                hours: p.hours,
                suggestedDate: p.suggestedDate || planToUse.deadline,
                status: 'pending' as const
             }));

             setMockData(prev => prev ? ({
                projects: [...prev.projects, newProject],
                phases: [...prev.phases, ...newPhases]
             }) : null);
         }
         
         triggerSuccessEffect();
         resetProposalState();
         setIsLoading(false);
         return;
    }

    // --- CASE 2: REAL DB MODE ---
    const projectId = editingProjectId || generateId();

    const projectData: Project = {
      id: projectId,
      userId: currentUser.id,
      title: planToUse.title,
      totalHours: planToUse.totalHours,
      startDate: planToUse.startDate || formatDate(new Date()),
      deadline: planToUse.deadline,
      color: getRandomColor(), // Maybe preserve color on edit? For now random if not fetched, but we usually overwrite full object.
      // Actually, if editing, we should ideally keep the color if it's not in AIPlanResponse. 
      // Current flow overwrites. To fix, we'd need to pass color to Proposal or fetch old project. 
      // Simple fix: if editing, find old project color.
      ...(editingProjectId ? { color: projects.find(p => p.id === editingProjectId)?.color || getRandomColor() } : {}),
      attachments: finalAttachmentUrls,
      description: planToUse.description,
      isExternal: planToUse.isExternal,
      location: planToUse.location
    };
    
    // Sanitize
    const projectToSave = sanitizeForFirestore(projectData);

    let newPhases: ProjectPhase[] = [];

    // --- Phase Generation Logic ---
    if (planToUse.recurrence?.isRecurring && planToUse.recurrence.weekDays && !editingProjectId) {
      // Recurrence (Only on creation usually, or reset on edit if re-triggered)
      const recurringDates = generateRecurringDates(
        planToUse.startDate || formatDate(new Date()),
        planToUse.deadline,
        planToUse.recurrence.weekDays
      );
      let templatePhase = planToUse.phases[0] || { name: 'Meeting', hours: 1, rationale: 'Recurring' };
      if (recurringDates.length > 1 && templatePhase.hours === planToUse.totalHours) {
         const calculatedSplit = planToUse.totalHours / recurringDates.length;
         if (calculatedSplit >= 0.25 || templatePhase.hours < 0.5) {
             templatePhase = { ...templatePhase, hours: Math.round(calculatedSplit * 100) / 100 };
         }
      }
      newPhases = recurringDates.map(dateStr => {
        const dateWithTime = planToUse.recurrence?.time ? `${dateStr}T${planToUse.recurrence.time}` : dateStr;
        return {
          id: generateId(),
          projectId: projectId,
          name: templatePhase.name,
          hours: templatePhase.hours,
          suggestedDate: dateWithTime,
          status: 'scheduled' 
        };
      });
      projectToSave.totalHours = newPhases.reduce((acc, p) => acc + p.hours, 0);

    } else {
      // Standard or Edit Logic
      const hasSpecificDates = planToUse.phases.every(p => p.suggestedDate);

      if (hasSpecificDates) {
          newPhases = planToUse.phases.map((phase) => ({
            id: phase.id || generateId(), // Keep ID if editing, else gen new
            projectId: projectId,
            name: phase.name,
            hours: phase.hours,
            suggestedDate: phase.suggestedDate!,
            status: phase.status || 'pending'
          }));
      } else {
          // Scheduling needed
          const busyDates = dailyCapacityData
            .filter(d => d.totalHoursBooked >= DAILY_CAPACITY_HOURS)
            .map(d => d.date);

          const scheduledPoints = await suggestSchedule(
            planToUse.phases,
            planToUse.startDate || formatDate(new Date()),
            planToUse.deadline,
            busyDates
          );

          newPhases = planToUse.phases.map((phase, index) => {
            let targetDate = planToUse.deadline;
            if (phase.suggestedDate) {
                targetDate = phase.suggestedDate;
            } else {
                const scheduled = scheduledPoints.find(sp => sp.phaseIndex === index);
                if (scheduled) targetDate = scheduled.date;
            }
            return {
              id: phase.id || generateId(),
              projectId: projectId,
              name: phase.name,
              hours: phase.hours,
              suggestedDate: targetDate,
              status: phase.status || 'pending'
            };
          });
      }
    }

    try {
      const batch = db.batch();
      
      const projectRef = db.collection('projects').doc(projectId);
      batch.set(projectRef, projectToSave);

      // If Editing: Delete old phases that are NOT in the new list (or delete all and recreate)
      // To ensure clean slate and handle removed phases, we delete all old phases for this project first
      if (editingProjectId) {
           const querySnapshot = await db.collection('phases').where('projectId', '==', projectId).get();
           querySnapshot.forEach((doc) => {
               batch.delete(doc.ref);
           });
      }

      // Add new phases
      newPhases.forEach(phase => {
        const phaseRef = db.collection('phases').doc(phase.id);
        batch.set(phaseRef, phase);
      });

      await batch.commit();
      triggerSuccessEffect();
      resetProposalState();
    } catch (error) {
      console.error("Error saving to Firestore:", error);
      alert("Fehler beim Speichern. Bitte Konsole prüfen.");
    } finally {
      setIsLoading(false);
    }
  };

  const resetProposalState = () => {
      setProposal(null);
      setEditingProjectId(null);
      setActiveGhostIndex(null);
      setCurrentPrompt('');
      setPendingFiles([]);
      setPendingRawFiles([]);
      setProposalDragDropCmd(null);
  };

  const handleMovePhase = async (phaseId: string, newDate: string) => {
    const phase = phases.find(p => p.id === phaseId);
    if (!phase) return;

    const originalTime = phase.suggestedDate.includes('T') ? phase.suggestedDate.split('T')[1] : '';
    const newDateTime = originalTime ? `${newDate}T${originalTime}` : newDate;

    if (isSafeMode) {
        setMockData(prev => {
            if (!prev) return null;
            const updatedPhases = prev.phases.map(p => p.id === phaseId ? { ...p, suggestedDate: newDateTime } : p);
            return { ...prev, phases: updatedPhases };
        });
        return;
    }

    try {
       const batch = db.batch();
       const phaseRef = db.collection('phases').doc(phaseId);
       batch.update(phaseRef, { suggestedDate: newDateTime });

       const project = projects.find(p => p.id === phase.projectId);
       if (project) {
          const otherPhases = phases.filter(p => p.projectId === project.id && p.id !== phaseId);
          const timestamps = otherPhases.map(p => new Date(p.suggestedDate.split('T')[0]).getTime());
          timestamps.push(new Date(newDate).getTime());
          
          const maxTimestamp = Math.max(...timestamps);
          const newDeadline = formatDate(new Date(maxTimestamp));

          if (newDeadline !== project.deadline) {
             const projectRef = db.collection('projects').doc(project.id);
             batch.update(projectRef, { deadline: newDeadline });
          }
       }

       await batch.commit();
    } catch(e) {
        console.error("Move failed", e);
    }
  };

  const handleMoveProjectDeadline = async (projectId: string, newDate: string) => {
      const project = projects.find(p => p.id === projectId);
      if (!project) return;
      
      if (isSafeMode) {
          setMockData(prev => {
              if(!prev) return null;
              const updatedProjects = prev.projects.map(p => p.id === projectId ? { ...p, deadline: newDate } : p);
              return { ...prev, projects: updatedProjects };
          });
          return;
      }

      try {
          await db.collection('projects').doc(projectId).update({ deadline: newDate });
      } catch(e) {
          console.error("Failed to move deadline", e);
      }
  };

  const handleDeletePhase = async (phaseId: string) => {
    if (!phaseId) return;
    if (isSafeMode) {
        setMockData(prev => prev ? { ...prev, phases: prev.phases.filter(p => p.id !== phaseId) } : null);
        return;
    }
    try {
      await db.collection('phases').doc(phaseId).delete();
    } catch (error) {
      console.error("Error deleting phase:", error);
    }
  };

  const handleQuickEditSave = async (updates: { phaseId: string, hours: number, isExternal?: boolean }[]) => {
    if (isSafeMode) {
        setMockData(prev => {
            if (!prev) return null;
            let newPhases = [...prev.phases];
            updates.forEach(u => {
                const idx = newPhases.findIndex(p => p.id === u.phaseId);
                if (idx !== -1) {
                    newPhases[idx] = { 
                        ...newPhases[idx], 
                        hours: u.hours,
                        ...(u.isExternal !== undefined ? { isExternal: u.isExternal } : {}) 
                    };
                }
            });
            return { ...prev, phases: newPhases };
        });
        setQuickEditDate(null);
        return;
    }
    try {
      const batch = db.batch();
      updates.forEach(update => {
        const ref = db.collection('phases').doc(update.phaseId);
        const data: any = { hours: update.hours };
        if (update.isExternal !== undefined) {
            data.isExternal = update.isExternal;
        }
        batch.update(ref, data);
      });
      await batch.commit();
      setQuickEditDate(null);
    } catch (e) {
      console.error("Quick edit save failed", e);
    }
  };

  // --- NEW: Open Project For Editing (Unified with Proposal) ---
  const handleOpenProject = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const projectPhases = phases.filter(p => p.projectId === projectId);
    
    // Convert to AIPlanResponse format
    const editingProposal: AIPlanResponse = {
        title: project.title,
        description: project.description,
        totalHours: project.totalHours,
        startDate: project.startDate || project.deadline, // Fallback
        deadline: project.deadline,
        confidenceScore: 100, // Manually created/existing is 100%
        rationale: "Bearbeitung eines bestehenden Projekts.",
        isExternal: project.isExternal,
        location: project.location,
        attachments: project.attachments,
        phases: projectPhases.map(p => ({
            id: p.id,
            name: p.name,
            hours: p.hours,
            rationale: "", // No rationale for existing manual tasks usually
            suggestedDate: p.suggestedDate,
            status: p.status
        }))
    };

    setEditingProjectId(projectId);
    setProposal(editingProposal);
  };

  const triggerSuccessEffect = () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: isSafeMode ? ['#10b981', '#34d399', '#f0fdf4'] : ['#6366f1', '#a855f7', '#ec4899', '#ffffff']
    });
  };

  const handleDiscardProposal = () => {
    resetProposalState();
  };

  const handleDeleteRequest = (projectId: string) => setProjectToDelete(projectId);

  const handleConfirmDelete = async () => {
    if (!projectToDelete) return;
    const projectId = projectToDelete;
    setProjectToDelete(null);

    if (isSafeMode) {
        setMockData(prev => prev ? ({
            projects: prev.projects.filter(p => p.id !== projectId),
            phases: prev.phases.filter(p => p.projectId !== projectId)
        }) : null);
        return;
    }

    setIsLoading(true);
    try {
      const batch = db.batch();
      const projectRef = db.collection('projects').doc(projectId);
      batch.delete(projectRef);
      const querySnapshot = await db.collection('phases').where('projectId', '==', projectId).get();
      querySnapshot.forEach((phaseDoc) => batch.delete(phaseDoc.ref));
      await batch.commit();
    } catch (error) {
      console.error("App: Error deleting from Firestore:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Proposal Drop Handler (Bridge) ---
  const handleProposalPhaseDrop = (phaseIndex: number, date: string) => {
      setProposalDragDropCmd({ index: phaseIndex, date, timestamp: Date.now() });
  };

  const getSelectedDayDetails = () => {
    if(!selectedDate) return null;
    return dailyCapacityData.find(d => d.date === selectedDate);
  };
  const selectedDayData = getSelectedDayDetails();
  const getStatusLabel = (status: DayCapacity['status']) => {
    switch (status) {
      case 'overloaded': return 'Überlast';
      case 'busy': return 'Gut ausgelastet';
      case 'optimal': return 'Optimal';
      default: return 'Frei';
    }
  };
  const getFormattedTime = (isoString: string) => {
    if (isoString.includes('T')) {
      const timePart = isoString.split('T')[1];
      if (timePart) return timePart.substring(0, 5); 
    }
    return null;
  };

  return (
    <div className={`relative min-h-screen text-slate-100 pb-20 selection:bg-indigo-500/30 font-sans transition-colors duration-700 ${isSafeMode ? 'bg-slate-900 border-x-[12px] border-emerald-500/10' : ''}`}>
      <div className="mesh-bg">
      </div>
      <header className={`fixed top-0 w-full z-40 glass-panel border-b-0 border-b-slate-700/50 transition-colors duration-300 ${isSafeMode ? 'border-b-emerald-500/30 bg-emerald-950/20' : ''}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer select-none">
            <div className="relative group">
               <div className={`absolute -inset-1 bg-gradient-to-r rounded-lg blur opacity-40 group-hover:opacity-75 transition duration-500 ${isSafeMode ? 'from-emerald-500 to-teal-600' : 'from-indigo-500 to-blue-600'}`}></div>
               <div className="relative bg-slate-900 text-white p-2 rounded-lg ring-1 ring-slate-700">
                  <LayoutDashboard className={`w-5 h-5 ${isSafeMode ? 'text-emerald-400' : 'text-indigo-400'}`} />
               </div>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-300 flex items-baseline">
              <span className={`text-transparent bg-clip-text bg-gradient-to-r font-black text-2xl ${isSafeMode ? 'from-emerald-400 to-teal-400' : 'from-indigo-400 to-purple-400'}`}>G</span>rossartige
              <span className={`text-transparent bg-clip-text bg-gradient-to-r font-black text-2xl ${isSafeMode ? 'from-emerald-400 to-teal-400' : 'from-indigo-400 to-purple-400'}`}>Z</span>eit
              <span className={`text-transparent bg-clip-text bg-gradient-to-r font-black text-2xl ${isSafeMode ? 'from-emerald-400 to-teal-400' : 'from-indigo-400 to-purple-400'}`}>P</span>lanung
            </h1>
          </div>
          
          <div className="flex items-center gap-6">
             <div className="relative">
                 <button 
                     onClick={() => setIsBugTrackerOpen(true)}
                     className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors relative"
                     title="Bug Tracker"
                 >
                     <Bug className="w-5 h-5" />
                     {hasBugNotifications && (
                         <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-slate-900 animate-pulse"></span>
                     )}
                 </button>
             </div>

             <div className="flex items-center gap-2">
                 {isSafeMode && (
                     <div className="hidden sm:flex flex-col items-end mr-2 animate-in fade-in slide-in-from-right">
                         <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Safe Mode Active</span>
                         <span className="text-[9px] text-emerald-600">Changes are local only</span>
                     </div>
                 )}
                 <button 
                    onClick={handleToggleSafeMode}
                    className={`relative flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all duration-300 ${isSafeMode 
                        ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/20' 
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:border-slate-500'}`}
                    title={isSafeMode ? "Exit Safe Mode" : "Enter Safe Mode"}
                 >
                    {isSafeMode ? <ShieldCheck className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                    <span className="text-xs font-bold">{isSafeMode ? 'SAFE ON' : 'SAFE OFF'}</span>
                 </button>
             </div>

             <div className="h-6 w-px bg-white/10 mx-1"></div>

             <div className="flex items-center gap-3">
                <button 
                    onClick={() => setIsShareModalOpen(true)}
                    className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors"
                    title="Plan teilen"
                >
                    <Share2 className="w-5 h-5" />
                </button>

                <div className="relative">
                    <button 
                        onClick={() => setIsInboxOpen(true)}
                        className={`p-2 rounded-lg transition-colors ${inboundRequests.length > 0 ? 'text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20' : 'text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10'}`}
                        title="Eingang / Anfragen"
                    >
                        <Inbox className="w-5 h-5" />
                        {inboundRequests.length > 0 && (
                            <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-slate-900 animate-pulse"></span>
                        )}
                    </button>
                </div>

                <button className="p-2 text-slate-400 hover:text-white transition-all hover:bg-white/5 rounded-lg"><Settings className="w-5 h-5" /></button>
                
                <div className="relative" ref={userMenuRef}>
                    <button 
                      onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                      className={`relative w-8 h-8 rounded-full bg-gradient-to-tr border border-white/10 flex items-center justify-center text-xs font-bold text-white shadow-lg transition-transform active:scale-95 ${currentUser.color} ${isSafeMode ? 'shadow-emerald-500/20' : 'shadow-indigo-500/20'}`}
                      title={currentUser.name}
                    >
                       {currentUser.initials}
                       <div className="absolute -bottom-1 -right-1 bg-slate-900 rounded-full p-0.5 border border-slate-700">
                          <ChevronDown className="w-2 h-2 text-slate-400" />
                       </div>
                    </button>

                    {isUserMenuOpen && (
                      <div className="absolute right-0 mt-3 w-56 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 z-50 ring-1 ring-white/5">
                         <div className="px-4 py-3 border-b border-slate-800 bg-slate-950/50">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Aktueller Nutzer</p>
                            <p className="text-sm font-medium text-white truncate">{currentUser.name}</p>
                         </div>
                         <div className="p-1">
                            {USERS.map(user => (
                               <button 
                                 key={user.id}
                                 onClick={() => {
                                    setCurrentUser(user);
                                    setIsUserMenuOpen(false);
                                    if(isSafeMode) {
                                       triggerSuccessEffect();
                                    }
                                 }}
                                 className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${currentUser.id === user.id ? 'bg-indigo-500/10 text-indigo-300' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                               >
                                  <div className={`w-6 h-6 rounded-full bg-gradient-to-tr flex items-center justify-center text-[10px] font-bold text-white ${user.color}`}>
                                    {user.initials}
                                  </div>
                                  <span className="flex-grow text-left">{user.name}</span>
                                  {currentUser.id === user.id && <Check className="w-3.5 h-3.5" />}
                               </button>
                            ))}
                         </div>
                         <div className="border-t border-slate-800 p-1">
                            <button className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                               <LogOut className="w-3.5 h-3.5" /> Abmelden
                            </button>
                         </div>
                      </div>
                    )}
                </div>

             </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-28">
        <section className="mb-8 animate-in slide-in-from-top-4 duration-700 fade-in">
           <FocusMode 
              todaysPhases={todaysPhases} 
              projects={projects} 
              onTogglePhaseStatus={handleTogglePhaseStatus}
            />
        </section>
        <section className="mb-16 relative">
          <div className="text-center mb-10">
            <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4 tracking-tight leading-tight">Was ist deine <span className={`text-transparent bg-clip-text bg-gradient-to-r ${isSafeMode ? 'from-emerald-400 to-teal-400' : 'from-indigo-400 to-purple-400'}`}>Mission</span>?</h2>
            <p className="text-slate-400 max-w-xl mx-auto text-lg leading-relaxed">
              Hallo <span className="text-slate-200 font-semibold">{currentUser.name.split(' ')[0]}</span>! Kopiere E-Mails, lade Skizzen hoch oder beschreibe dein Ziel. <br/>Oder trage deinen Urlaub ein – die KI regelt den Rest.
            </p>
          </div>
          <MagicInput 
            onSubmit={handleAIRequest} 
            isLoading={isLoading} 
            externalText={incomingRequestText} 
          />
        </section>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 relative">
          <div className="lg:col-span-8 space-y-6 relative z-20">
            <HeatmapCalendar 
              days={dailyCapacityData}
              projects={projects}
              startDate={calendarStartDate}
              ghostPhases={ghostPhases} 
              activeGhostIndex={activeGhostIndex}
              onSelectDay={setSelectedDate} 
              selectedDate={selectedDate}
              onMovePhase={handleMovePhase}
              onMoveDeadline={handleMoveProjectDeadline}
              onQuickEdit={setQuickEditDate}
              onOpenProject={handleOpenProject} // Updated handler
              onDeletePhase={handleDeletePhase}
              onPrevRange={handlePrevRange}
              onNextRange={handleNextRange}
              onSetStartDate={handleSetStartDate}
              isLoading={isDataLoading}
              zoomLevel={zoomLevel} 
              onZoomChange={handleZoomChange} 
              highlightedProjectId={highlightedProjectId}
              onProposalDrop={handleProposalPhaseDrop} // NEW: Handle Drop from Proposal 
            />
            
            {selectedDate && selectedDayData && (
              <div className="glass-card rounded-2xl p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold flex items-center gap-3 text-slate-200">
                    <CalendarIcon className={`w-6 h-6 ${isSafeMode ? 'text-emerald-400' : 'text-indigo-400'}`} />
                    {new Date(selectedDate).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </h3>
                  <span className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide border shadow-sm ${selectedDayData.status === 'overloaded' ? 'bg-red-500/10 border-red-500/20 text-red-400 shadow-red-500/10' : selectedDayData.status === 'busy' ? 'bg-orange-500/10 border-orange-500/20 text-orange-400 shadow-orange-500/10' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-emerald-500/10'}`}>{getStatusLabel(selectedDayData.status)}</span>
                </div>
                <div className="space-y-4">
                  {selectedDayData.deadlines && selectedDayData.deadlines.length > 0 && (
                     <div className="mb-6 space-y-3">
                       <h4 className="text-xs font-mono text-slate-500 uppercase tracking-widest pl-1">Fällige Deadlines</h4>
                       {selectedDayData.deadlines.map(project => (
                         <div key={project.id} className="p-4 bg-gradient-to-r from-indigo-500/10 to-transparent border-l-4 border-indigo-500 rounded-r-lg flex items-center justify-between group hover:from-indigo-500/20 transition-all">
                            <div className="flex items-center gap-3">
                               <div className={`w-3 h-3 rounded-full ${project.color} shadow-[0_0_12px_currentColor]`}></div>
                               <span className="font-semibold text-indigo-100 text-lg">{project.title}</span>
                            </div>
                            <span className="text-xs font-mono text-indigo-300 bg-indigo-500/20 px-2 py-1 rounded">DEADLINE</span>
                         </div>
                       ))}
                     </div>
                  )}
                  {selectedDayData.phases.length === 0 && (!selectedDayData.deadlines || selectedDayData.deadlines.length === 0) ? (
                    <div className="text-center py-12 text-slate-500 text-sm border-2 border-dashed border-slate-800/50 rounded-xl bg-slate-900/30"><p className="font-medium text-slate-400 mb-1">Alles ruhig.</p><p>Keine Aufgaben für diesen Tag geplant.</p></div>
                  ) : (
                    selectedDayData.phases.map((phase) => {
                      const project = projects.find(p => p.id === phase.projectId);
                      const time = getFormattedTime(phase.suggestedDate);
                      const isExternal = phase.isExternal !== undefined ? phase.isExternal : project?.isExternal;
                      
                      const isHighlighted = highlightedProjectId === phase.projectId;
                      const isDimmed = highlightedProjectId && !isHighlighted;

                      return (
                        <div 
                            key={phase.id} 
                            onClick={() => setHighlightedProjectId(prev => prev === phase.projectId ? null : phase.projectId)}
                            className={`group relative overflow-hidden flex items-center justify-between p-4 rounded-xl border transition-all duration-300 cursor-pointer
                                ${isHighlighted ? 'bg-indigo-900/30 border-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.2)]' : isExternal ? 'bg-slate-900 border-cyan-500/30' : 'bg-slate-800/40 border-slate-700/50'}
                                ${isDimmed ? 'opacity-40 grayscale blur-[0.5px] scale-[0.98]' : 'hover:bg-slate-800/60 hover:border-indigo-500/30 hover:shadow-lg hover:shadow-black/20'}
                            `}
                        >
                          {isExternal && <div className="absolute inset-0 bg-cyan-500/5 pointer-events-none"></div>}
                          <div className={`absolute left-0 top-0 bottom-0 w-1 ${project?.color || 'bg-slate-500'}`}></div>
                          <div className="flex items-center gap-4 pl-3 relative z-10">
                            <div>
                              <div className="font-semibold text-slate-200 flex items-center gap-2">
                                  {project?.title} 
                                  {isExternal && <Car className="w-3.5 h-3.5 text-cyan-400" />}
                                  {time && <span className="text-[10px] font-mono font-normal text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-1.5 py-0.5 rounded ml-2">{time}</span>}
                              </div>
                              <div className="flex items-center gap-2 text-sm text-slate-400 group-hover:text-slate-300 transition-colors">
                                  <span>{phase.name}</span>
                                  {project?.location && (
                                     <span className="text-[9px] bg-slate-700/50 px-1.5 rounded flex items-center gap-1"><MapPin className="w-2.5 h-2.5" /> {project.location}</span>
                                  )}
                              </div>
                            </div>
                          </div>
                          <div className="text-sm font-bold font-mono text-slate-300 bg-black/20 px-3 py-1.5 rounded-lg border border-white/5 relative z-10">{phase.hours}h</div>
                        </div>
                      );
                    })
                  )}
                </div>
                <div className="mt-8 pt-4 border-t border-slate-700/50 flex justify-between text-xs font-mono text-slate-500 uppercase tracking-wide">
                  <span>Kapazität: {DAILY_CAPACITY_HOURS}h</span>
                  <span>Gebucht: {selectedDayData.totalHoursBooked.toFixed(1)}h</span>
                </div>
              </div>
            )}
          </div>
          <div className="lg:col-span-4 space-y-6 relative z-10">
            <CapacityTrend days={dailyCapacityData} />
            <TimelineWidget projects={projects.filter(p => !p.isTimeOff)} onOpenProject={handleOpenProject} />
            <ProjectList 
              projects={projects.filter(p => !p.isTimeOff)} 
              phases={phases} 
              onDelete={handleDeleteRequest} 
              onEdit={(p) => handleOpenProject(p.id)} 
            />
            <NewsWidget />
          </div>
        </div>
      </main>
      
      <PlanProposal 
        proposal={proposal} 
        originalPrompt={currentPrompt} 
        onAccept={handleAcceptProposal} 
        onDiscard={handleDiscardProposal} 
        onHoverPhase={setActiveGhostIndex}
        onRefineSplit={handleRefineLiquidSplit}
        isEditing={!!editingProjectId} // Pass Editing Flag
        externalUpdateCmd={proposalDragDropCmd} // NEW: Pass the update bridge
      />

      {projectToDelete && (
        <DeleteConfirmModal
          onConfirm={handleConfirmDelete}
          onCancel={() => setProjectToDelete(null)}
        />
      )}
      {quickEditDate && (
        <QuickEditModal
            date={quickEditDate}
            phases={phases.filter(p => p.suggestedDate.split('T')[0] === quickEditDate)}
            projects={projects}
            onSave={handleQuickEditSave}
            onClose={() => setQuickEditDate(null)}
            onDelete={handleDeletePhase}
            onDeleteProject={(projectId) => {
               setQuickEditDate(null);
               handleDeleteRequest(projectId);
            }}
        />
      )}
      {isBugTrackerOpen && (
        <BugTrackerModal 
            currentUser={currentUser} 
            onClose={() => setIsBugTrackerOpen(false)} 
        />
      )}
      {isShareModalOpen && (
        <ShareModal 
            currentUser={currentUser} 
            projects={projects} 
            onClose={() => setIsShareModalOpen(false)} 
        />
      )}
      {isInboxOpen && (
        <InboxModal 
            requests={inboundRequests} 
            onClose={() => setIsInboxOpen(false)} 
            onTakeover={(text) => setIncomingRequestText(text)}
        />
      )}
    </div>
  );
};

export default App;
