
export interface User {
  id: string;
  name: string;
  initials: string;
  color: string;
}

export interface Project {
  id: string;
  userId?: string; // NEW: Ownership
  title: string;
  totalHours: number;
  startDate?: string; // NEW: ISO Date string (Optional, defaults to created date)
  deadline: string; // ISO Date string
  color: string;
  attachments?: string[]; // Base64 strings or URLs
  description?: string; // Markdown supported
  isTimeOff?: boolean; // Marks this project as a time-off/vacation blocker
  isExternal?: boolean; // NEW: Marks this as an external appointment (field work)
  location?: string; // NEW: Location of the appointment (e.g. "Hannover")
}

export interface ProjectPhase {
  id: string;
  projectId: string;
  name: string;
  hours: number;
  suggestedDate: string; // ISO Date string
  status: 'pending' | 'scheduled' | 'completed';
  isGhost?: boolean; // NEW: Marks this phase as a temporary preview (Liquid Task Flow)
  isExternal?: boolean; // NEW: Allows overriding external status per phase
}

export interface DayCapacity {
  date: string; // ISO Date string (YYYY-MM-DD)
  totalHoursBooked: number;
  phases: ProjectPhase[];
  deadlines: Project[];
  status: 'free' | 'optimal' | 'busy' | 'overloaded';
}

export interface RecurrenceConfig {
  isRecurring: boolean;
  weekDays?: number[]; // 0=Sun, 1=Mon, etc.
  time?: string; // HH:MM
}

export interface AIPlanResponse {
  title: string;
  description?: string;
  totalHours: number;
  startDate?: string; // NEW: Extracted start date
  deadline: string;
  confidenceScore: number; // 0 to 100
  phases: {
    id?: string; // Optional: To track existing phases during edit
    name: string;
    hours: number;
    rationale: string;
    suggestedDate?: string; // Optional specific date for this phase
    status?: 'pending' | 'scheduled' | 'completed'; // Optional: To preserve status during edit
  }[];
  rationale: string;
  recurrence?: RecurrenceConfig;
  isExternal?: boolean; // NEW
  location?: string; // NEW
  attachments?: string[]; // NEW: Carry attachments through proposal
}

export interface TimeOffDetails {
  title: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  reason: string;
}

// --- BUG TRACKER TYPES ---
export type BugPriority = 'low' | 'medium' | 'high' | 'critical';
export type BugStatus = 'open' | 'in_progress' | 'resolved' | 'wont_fix';

export interface BugComment {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  createdAt: string; // ISO Date
  isSystemMessage?: boolean; 
}

export interface BugTicket {
  id: string;
  reporterId: string;
  reporterName: string;
  title: string;
  description: string;
  priority: BugPriority;
  status: BugStatus;
  createdAt: string; // ISO Date
  updatedAt: string; // ISO Date
  attachmentUrl?: string;
  hasUnreadUpdate: boolean; // True if updated by someone other than reporter
  comments: BugComment[];
}

// --- SHARED VIEW TYPES (Phase 1) ---
export interface SharedView {
  id: string;
  creatorId: string;
  config: {
    projectId?: string; // If defined, only share this project. If undefined, share full calendar.
    allowRequests: boolean; // Enables the "Request Task" button for guests
    showDetails: boolean; // If false, hides rationale and sensitive descriptions
    expiresAt?: string; // ISO Date string
  };
  createdAt: string;
}

export interface InboundRequest {
  id: string;
  shareViewId: string;
  creatorId: string;
  guestName: string;
  requestText: string;
  priority: 'normal' | 'high';
  createdAt: string;
  status: 'pending' | 'processed' | 'dismissed';
}

export const DAILY_CAPACITY_HOURS = 8;
