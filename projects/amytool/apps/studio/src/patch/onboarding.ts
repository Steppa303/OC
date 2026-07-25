import { create } from 'zustand';

/**
 * Onboarding tour steps (P7-03) — plain data so the sequence is unit-testable
 * and the copy lives in one place.
 */
export interface TourStep {
  title: string;
  body: string;
}

export const TOUR_STEPS: readonly TourStep[] = [
  {
    title: 'Four workspaces',
    body: 'Use the tabs up top: build visually in Patch, read the generated Python in Code, browse modules in Library, and add your OpenRouter key in Settings.',
  },
  {
    title: 'Generate from a prompt',
    body: 'Hit ✨ (or press ⌘K → “Generate”) and describe a sound in plain words — the AI builds a patch you can tweak.',
  },
  {
    title: 'Patch with cables',
    body: 'Drag from a module’s output jack onto another’s input to route signal. Right-click a jack or a module for quick actions.',
  },
  {
    title: 'Hear it',
    body: 'Press ▶ Audio to play the patch in your browser, switch Sim/Board output, and use the on-screen keyboard to play notes.',
  },
];

/**
 * Reactive flag so the StarterGallery (P7-01) can wait for the tour to finish
 * instead of stacking two first-run overlays. Set by the tour while it is open.
 */
interface OnboardingState {
  tourActive: boolean;
  setTourActive: (active: boolean) => void;
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  tourActive: false,
  setTourActive: (tourActive) => set({ tourActive }),
}));
