import { Link } from 'react-router-dom';
import { useBoardStore } from './boardStore';
import './board.css';

/** Extract a `line N` reference from a Python traceback, if present. */
function firstLine(traceback: string): number | null {
  const m = /line (\d+)/i.exec(traceback);
  return m ? Number(m[1]) : null;
}

/**
 * Board error surface (P3-03): when the board reports an `X` traceback (e.g. an
 * uploaded sketch failed on import), show it pretty-printed with a jump to the
 * code view. Dismissible.
 */
export function TracebackPanel() {
  const boardTraceback = useBoardStore((s) => s.traceback);
  const simTraceback = useBoardStore((s) => s.simTraceback);
  const clearBoard = useBoardStore((s) => s.clearTraceback);
  const clearSim = useBoardStore((s) => s.setSimTraceback);
  const traceback = boardTraceback ?? simTraceback;
  const clear = () => {
    clearBoard();
    clearSim(null);
  };
  if (!traceback) return null;

  const line = firstLine(traceback);
  const source = boardTraceback ? 'Board' : 'Simulator';

  return (
    <div className="board-traceback" role="alert" data-testid="board-traceback">
      <div className="board-traceback-head">
        <span>{source} reported a sketch error{line !== null ? ` (line ${line})` : ''}</span>
        <div className="board-traceback-actions">
          <Link className="board-traceback-link" to="/code" onClick={clear} data-testid="traceback-open-code">
            View code
          </Link>
          <button type="button" onClick={clear} aria-label="dismiss traceback">
            ✕
          </button>
        </div>
      </div>
      <pre className="board-traceback-body">{traceback}</pre>
    </div>
  );
}
