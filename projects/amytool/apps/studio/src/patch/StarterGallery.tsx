import { useEffect, useMemo, useState } from 'react';
import { usePatchStore } from './patchStore';
import { getLastOpened, getWelcomed, listPatches, setWelcomed } from './storage';
import { STARTER_TEMPLATES, type StarterTemplate } from './templates';
import { thumbnailData } from './thumbnail';
import { PatchThumb } from './PatchThumb';
import { useOnboardingStore } from './onboarding';

/**
 * First-run starter gallery (P7-01): a non-blocking panel over the empty rack,
 * shown once when there is nothing to restore — pick a ready-to-play template
 * or start with an empty rack. Disappears as soon as the rack has modules, so
 * it never gets in the way of someone who just starts patching.
 */
export function StarterGallery() {
  const loadDoc = usePatchStore((s) => s.loadDoc);
  const rackEmpty = usePatchStore((s) => s.doc.modules.length === 0);
  const tourActive = useOnboardingStore((s) => s.tourActive);
  const [firstRun, setFirstRun] = useState(false);

  useEffect(() => {
    if (getWelcomed() || getLastOpened() !== null) return;
    void listPatches().then((saved) => {
      if (saved.length === 0) setFirstRun(true);
    });
  }, []);

  // Hold back while the onboarding tour is showing so the two never stack.
  const show = firstRun && rackEmpty && !tourActive;

  // Build each template once for its thumbnail preview.
  const previews = useMemo(
    () => (show ? STARTER_TEMPLATES.map((t) => ({ template: t, thumb: thumbnailData(t.build()) })) : []),
    [show],
  );

  if (!show) return null;

  const dismiss = () => {
    setWelcomed();
    setFirstRun(false);
  };
  const choose = (template: StarterTemplate) => {
    loadDoc(template.build());
    dismiss();
  };

  return (
    <div className="starter-overlay" data-testid="starter-gallery">
      <div className="starter-panel" role="dialog" aria-label="Starter templates">
        <h2 className="starter-title">Welcome to AmyPatch Studio</h2>
        <p className="starter-sub">Pick a starter patch to explore, or start from scratch.</p>
        <div className="starter-cards">
          {previews.map(({ template, thumb }) => (
            <button
              key={template.id}
              type="button"
              className="starter-card"
              data-testid={`starter-${template.id}`}
              onClick={() => choose(template)}
            >
              <PatchThumb data={thumb} className="starter-card-thumb" />
              <span className="starter-card-name">{template.name}</span>
              <span className="starter-card-desc">{template.description}</span>
            </button>
          ))}
        </div>
        <button type="button" className="patch-bar-btn" data-testid="starter-empty" onClick={dismiss}>
          Start empty
        </button>
      </div>
    </div>
  );
}
