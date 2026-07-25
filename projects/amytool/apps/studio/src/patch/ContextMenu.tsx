import { createContext, useContext, useEffect, useRef } from 'react';

export interface ContextMenuItem {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  /** Optional leading swatch color (used by the color-tag submenu). */
  swatch?: string;
  /** Keep the menu open after click — for items that open a submenu. */
  keepOpen?: boolean;
}

export interface ContextMenuState {
  x: number;
  y: number;
  items: ContextMenuItem[];
  /** Optional heading shown at the top of the menu. */
  title?: string;
}

/**
 * Lightweight right-click menu (P7-02). Positioned at viewport coords, closes on
 * outside click, Escape, scroll or resize. Rendered by whoever owns the menu
 * state; pass `null` to hide.
 */
export function ContextMenu({ state, onClose }: { state: ContextMenuState | null; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!state) return;
    const close = () => onClose();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onDown);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [state, onClose]);

  if (!state) return null;

  return (
    <div
      ref={ref}
      className="ctx-menu"
      role="menu"
      data-testid="context-menu"
      style={{ left: state.x, top: state.y }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {state.title && <div className="ctx-menu-title">{state.title}</div>}
      {state.items.map((item, i) => (
        <button
          key={i}
          type="button"
          role="menuitem"
          className="ctx-menu-item"
          disabled={item.disabled}
          onClick={() => {
            item.onClick();
            if (!item.keepOpen) onClose();
          }}
        >
          {item.swatch !== undefined && (
            <span
              className="ctx-menu-swatch"
              style={{ background: item.swatch === '' ? 'transparent' : item.swatch }}
              aria-hidden="true"
            />
          )}
          {item.label}
        </button>
      ))}
    </div>
  );
}

/** Lets deep children (module nodes, jacks) open a menu owned by the canvas. */
const MenuContext = createContext<(state: ContextMenuState) => void>(() => {});
export const MenuProvider = MenuContext.Provider;
export function useOpenMenu(): (state: ContextMenuState) => void {
  return useContext(MenuContext);
}
