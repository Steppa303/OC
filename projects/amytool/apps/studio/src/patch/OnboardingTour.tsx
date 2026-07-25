import { useEffect, useState } from 'react';
import { usePatchStore } from './patchStore';
import { getLastOpened, getTourDone, getWelcomed, listPatches, setTourDone } from './storage';
import { TOUR_STEPS, useOnboardingStore } from './onboarding';

/**
 * First-run onboarding tour (P7-03). A non-blocking coach card over the empty
 * rack that walks through the four things worth knowing (workspaces, generate,
 * cables, simulator). Shown once — dismissed permanently on finish or skip. It
 * shares the first-run gate with the StarterGallery via `tourActive` so the two
 * never stack; the gallery waits until the tour is done.
 */
export function OnboardingTour() {
  const rackEmpty = usePatchStore((s) => s.doc.modules.length === 0);
  const setTourActive = useOnboardingStore((s) => s.setTourActive);
  const [firstRun, setFirstRun] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (getTourDone() || getWelcomed() || getLastOpened() !== null) return;
    void listPatches().then((saved) => {
      if (saved.length === 0) setFirstRun(true);
    });
  }, []);

  const show = firstRun && rackEmpty;

  // Mirror visibility into the shared flag so the gallery holds back.
  useEffect(() => {
    setTourActive(show);
    return () => setTourActive(false);
  }, [show, setTourActive]);

  const current = TOUR_STEPS[step];
  if (!show || !current) return null;

  const finish = () => {
    setTourDone();
    setFirstRun(false);
    setTourActive(false);
  };
  const isLast = step === TOUR_STEPS.length - 1;

  return (
    <div className="tour-overlay" data-testid="onboarding-tour">
      <div className="tour-card" role="dialog" aria-label="Getting started">
        <div className="tour-step-count">
          Step {step + 1} of {TOUR_STEPS.length}
        </div>
        <h2 className="tour-title">{current.title}</h2>
        <p className="tour-body">{current.body}</p>
        <div className="tour-dots" aria-hidden="true">
          {TOUR_STEPS.map((_, i) => (
            <span key={i} className={`tour-dot${i === step ? ' tour-dot-active' : ''}`} />
          ))}
        </div>
        <div className="tour-actions">
          <button type="button" className="tour-skip" data-testid="tour-skip" onClick={finish}>
            Skip
          </button>
          <div className="tour-nav">
            {step > 0 && (
              <button type="button" className="patch-bar-btn" onClick={() => setStep((s) => s - 1)}>
                Back
              </button>
            )}
            {isLast ? (
              <button type="button" className="tour-next" data-testid="tour-done" onClick={finish}>
                Got it
              </button>
            ) : (
              <button
                type="button"
                className="tour-next"
                data-testid="tour-next"
                onClick={() => setStep((s) => s + 1)}
              >
                Next
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
