import { describe, expect, it } from 'vitest';
import { TOUR_STEPS, useOnboardingStore } from './onboarding';

describe('onboarding', () => {
  it('has four steps covering the core surfaces, each with title + body', () => {
    expect(TOUR_STEPS).toHaveLength(4);
    for (const step of TOUR_STEPS) {
      expect(step.title.length).toBeGreaterThan(0);
      expect(step.body.length).toBeGreaterThan(0);
    }
    const titles = TOUR_STEPS.map((s) => s.title.toLowerCase()).join(' ');
    expect(titles).toContain('workspace');
    expect(titles).toContain('generate');
    expect(titles).toContain('cable');
  });

  it('tourActive flag is reactive', () => {
    useOnboardingStore.getState().setTourActive(true);
    expect(useOnboardingStore.getState().tourActive).toBe(true);
    useOnboardingStore.getState().setTourActive(false);
    expect(useOnboardingStore.getState().tourActive).toBe(false);
  });
});
