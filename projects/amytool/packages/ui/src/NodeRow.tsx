import type { ReactNode } from 'react';

export interface NodeRowProps {
  /** Input pin slot at the row's left edge (a jack + React Flow handle). */
  leftPin?: ReactNode;
  /** Output pin slot at the row's right edge. */
  rightPin?: ReactNode;
  /** The control (slider/select/toggle) or custom body. */
  children?: ReactNode;
  /** Extra class (e.g. for a full-width widget row). */
  className?: string;
}

/**
 * A single row of a Blender-style node module (Stufe 2): an optional input pin
 * hugging the left edge, the control body in the middle, an optional output pin
 * hugging the right edge. Pins carry the actual `<Jack>` + React Flow `<Handle>`;
 * this component only lays them out.
 */
export function NodeRow({ leftPin, rightPin, children, className }: NodeRowProps) {
  return (
    <div className={className ? `ui-noderow ${className}` : 'ui-noderow'}>
      <span className="ui-noderow-pin ui-noderow-pin-left">{leftPin}</span>
      <div className="ui-noderow-body">{children}</div>
      <span className="ui-noderow-pin ui-noderow-pin-right">{rightPin}</span>
    </div>
  );
}
