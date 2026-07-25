import type { CSSProperties, MouseEvent, ReactNode } from 'react';

export interface PanelProps {
  name: string;
  hp: number;
  children?: ReactNode;
  /** Input jacks, rendered bottom-left. */
  jacksIn?: ReactNode;
  /** Output jacks, rendered bottom-right. */
  jacksOut?: ReactNode;
  onMenu?: () => void;
  /** Optional CSS color for a cosmetic accent stripe on the header (P7-02). */
  accent?: string;
  /** Right-click handler on the whole panel (P7-02 module context menu). */
  onPanelContext?: (e: MouseEvent) => void;
  /** Close the module — renders an × in the header (Stufe 1). */
  onClose?: () => void;
  /** Blender-style node layout: vertical rows with edge pins, no jack field (Stufe 2). */
  node?: boolean;
}

/** Eurorack module panel: header / controls / jack field (docs/04 §2). */
export function Panel({ name, hp, children, jacksIn, jacksOut, onMenu, accent, onPanelContext, onClose, node }: PanelProps) {
  const style = { '--panel-hp': hp, ...(accent ? { '--panel-accent': accent } : {}) } as CSSProperties;
  const classes = ['ui-panel', node ? 'ui-panel-node' : '', accent ? 'ui-panel-accented' : '']
    .filter(Boolean)
    .join(' ');
  return (
    <section
      className={classes}
      style={style}
      aria-label={name}
      data-hp={hp}
      onContextMenu={onPanelContext}
    >
      <header className="ui-panel-header">
        <span className="ui-panel-name">{name}</span>
        <span className="ui-panel-header-actions">
          {onMenu && (
            <button type="button" className="ui-panel-menu" aria-label={`${name} menu`} onClick={onMenu}>
              ⋮
            </button>
          )}
          {onClose && (
            <button
              type="button"
              className="ui-panel-close nodrag"
              aria-label={`Close ${name}`}
              onClick={onClose}
            >
              ×
            </button>
          )}
        </span>
      </header>
      <div className="ui-panel-controls">{children}</div>
      {(jacksIn ?? jacksOut) && (
        <footer className="ui-panel-jackfield">
          <div className="ui-panel-jacks-in">{jacksIn}</div>
          <div className="ui-panel-jacks-out">{jacksOut}</div>
        </footer>
      )}
    </section>
  );
}
