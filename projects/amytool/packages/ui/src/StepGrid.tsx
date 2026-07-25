/**
 * StepGrid — the drum/step sequencer grid primitive (docs/04 §2). A rows×cols
 * matrix of toggle cells with optional per-row labels, a bar-grouped look, and a
 * playhead column highlight. Purely presentational; state lives in the module.
 */
export interface StepGridProps {
  rows: number;
  cols: number;
  /** cells[row][col] = step on/off. */
  cells: readonly (readonly boolean[])[];
  onToggle: (row: number, col: number) => void;
  rowLabels?: readonly string[];
  /** Currently-sounding column, highlighted (optional). */
  playhead?: number;
  /** Cells to render with an accent style (e.g. accented steps). */
  accents?: readonly (readonly boolean[])[];
}

export function StepGrid({ rows, cols, cells, onToggle, rowLabels, playhead, accents }: StepGridProps) {
  return (
    <div className="ui-stepgrid nodrag" role="grid">
      {Array.from({ length: rows }).map((_, r) => (
        <div className="ui-stepgrid-row" role="row" key={r}>
          {rowLabels && <span className="ui-stepgrid-label">{rowLabels[r]}</span>}
          <div className="ui-stepgrid-cells">
            {Array.from({ length: cols }).map((__, c) => {
              const on = cells[r]?.[c] ?? false;
              const accent = accents?.[r]?.[c] ?? false;
              const cls = [
                'ui-stepgrid-cell',
                on ? 'on' : '',
                accent ? 'accent' : '',
                playhead === c ? 'playhead' : '',
                c % 4 === 0 ? 'beat' : '',
              ]
                .filter(Boolean)
                .join(' ');
              return (
                <button
                  key={c}
                  type="button"
                  role="gridcell"
                  aria-label={`row ${r + 1} step ${c + 1}`}
                  aria-pressed={on}
                  className={cls}
                  onClick={() => onToggle(r, c)}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
