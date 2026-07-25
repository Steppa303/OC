import { useEffect, useRef, useState } from 'react';
import { EditorState, Annotation, type Extension } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { python } from '@codemirror/lang-python';
import { compileToSketch, parseSketch, type ParseResult } from '@amy/patchdoc';
import { usePatchStore } from '../patch/patchStore';
import { moduleInfoProvider } from '../patch/routing';
import { GeneratePanel } from '../llm/GeneratePanel';
import './code.css';

/** Marks a transaction as a doc→sketch projection (not a user edit). */
const projection = Annotation.define<boolean>();

/** Compute the read-only ranges of a sketch: the leading header comment block
 *  and the trailing `# amypatch:` snapshot line (docs/03 §5). */
function protectedRanges(text: string): [number, number][] {
  const ranges: [number, number][] = [];
  const lines = text.split('\n');
  // Leading contiguous comment/blank header.
  let offset = 0;
  let headerEnd = 0;
  for (const line of lines) {
    const isHeader = line.trim() === '' || line.trimStart().startsWith('#');
    if (!isHeader) break;
    offset += line.length + 1;
    headerEnd = offset;
  }
  // Protect through the char before the first editable line, so an insertion at
  // the start of that line is still allowed.
  if (headerEnd > 0) ranges.push([0, headerEnd - 1]);
  // Trailing snapshot block (from the newline that precedes it).
  const idx = text.indexOf('\n# amypatch:v1:');
  if (idx >= 0) ranges.push([idx, text.length]);
  return ranges;
}

/**
 * Code workspace (P2-04). The editor is a projection of the PatchDoc: any change
 * to the doc (e.g. a knob turn in the patch view) re-renders the sketch here.
 * Pasting or editing code parses it back (Level A/B, no execution) and syncs the
 * canvas. Generated header + snapshot are read-only.
 */
export function CodeWorkspace() {
  const doc = usePatchStore((s) => s.doc);
  const loadDoc = usePatchStore((s) => s.loadDoc);

  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const dirtyRef = useRef(false);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [dirty, setDirty] = useState(false);

  // Apply the editor's current text back into the store (parse → canvas sync).
  const applyNow = useRef<() => void>(() => {});
  applyNow.current = () => {
    const view = viewRef.current;
    if (!view) return;
    const parsed = parseSketch(view.state.doc.toString());
    setResult(parsed);
    dirtyRef.current = false;
    setDirty(false);
    loadDoc(parsed.doc);
  };

  // Mount the editor once.
  useEffect(() => {
    if (!hostRef.current) return;
    const initial = compileToSketch(usePatchStore.getState().doc, moduleInfoProvider).source;

    const guardReadOnly = EditorState.transactionFilter.of((tr) => {
      if (!tr.docChanged || tr.annotation(projection)) return tr;
      const ranges = protectedRanges(tr.startState.doc.toString());
      let blocked = false;
      // Inclusive overlap so a zero-length insertion *at* a protected boundary
      // (e.g. position 0, the start of the header) is caught too.
      tr.changes.iterChangedRanges((fromA, toA) => {
        for (const [s, e] of ranges) if (fromA <= e && toA >= s) blocked = true;
      });
      return blocked ? [] : tr;
    });

    const onChange = EditorView.updateListener.of((u) => {
      if (!u.docChanged) return;
      if (u.transactions.some((t) => t.annotation(projection))) return;
      dirtyRef.current = true;
      setDirty(true);
      // Live warnings while typing, without touching the canvas yet.
      setResult(parseSketch(u.state.doc.toString()));
    });

    const extensions: Extension[] = [
      lineNumbers(),
      highlightActiveLine(),
      history(),
      python(),
      guardReadOnly,
      onChange,
      keymap.of([
        {
          key: 'Mod-Enter',
          run: () => {
            applyNow.current();
            return true;
          },
        },
        ...defaultKeymap,
        ...historyKeymap,
      ]),
      EditorView.theme({ '&': { height: '100%' }, '.cm-scroller': { fontFamily: 'var(--font-mono)' } }),
      EditorView.domEventHandlers({
        paste: (event, view) => {
          // A paste is an "import this sketch" gesture: replace the whole buffer
          // (bypassing the read-only guard) and sync the canvas. This keeps paste
          // working even though the header + snapshot are otherwise read-only.
          const text = event.clipboardData?.getData('text/plain');
          if (text == null) return false;
          event.preventDefault();
          view.dispatch({
            changes: { from: 0, to: view.state.doc.length, insert: text },
            annotations: projection.of(true),
          });
          applyNow.current();
          return true;
        },
      }),
    ];

    const view = new EditorView({
      state: EditorState.create({ doc: initial, extensions }),
      parent: hostRef.current,
    });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  // Project doc → editor whenever the doc changes and the user has no pending edits.
  useEffect(() => {
    const view = viewRef.current;
    if (!view || dirtyRef.current) return;
    const next = compileToSketch(doc, moduleInfoProvider).source;
    if (next === view.state.doc.toString()) return;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: next },
      annotations: projection.of(true),
    });
  }, [doc]);

  const warnings = result?.warnings ?? [];

  return (
    <div className="code-workspace">
      <GeneratePanel />
      <div className="code-bar">
        <span className="code-title">sketch.py</span>
        <span className={`code-sync ${dirty ? 'code-sync-dirty' : 'code-sync-ok'}`}>
          {dirty ? 'edited — not applied' : 'in sync with canvas'}
        </span>
        <button
          type="button"
          className="code-apply-btn"
          disabled={!dirty}
          onClick={() => applyNow.current()}
        >
          Apply to canvas (⌘↵)
        </button>
      </div>
      <div className="code-editor" ref={hostRef} data-testid="code-editor" />
      <div className="code-warnings" data-testid="code-warnings">
        {warnings.length === 0 ? (
          <span className="code-warn-none">
            {result?.lossy ? 'Imported with residue.' : 'No parse warnings.'}
          </span>
        ) : (
          <ul>
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
