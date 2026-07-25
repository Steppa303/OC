/**
 * Builders for the P7-02 right-click menus. Pure functions returning
 * ContextMenuState item lists, so they can be unit-tested without React.
 */
import type { ModuleInstance } from '@amy/patchdoc';
import type { ContextMenuItem, ContextMenuState } from './ContextMenu';
import { compatibleModules } from './routing';
import { COLOR_TAGS, colorCss } from './colorTags';

export interface ModuleMenuActions {
  rename: (id: string) => void;
  replace: (id: string, newType: string) => void;
  setColor: (id: string, color: string | undefined) => void;
  copyParams: (id: string) => void;
  pasteParams: (id: string) => void;
  /** Re-open the menu at the same spot with new items (submenus). */
  reopen: (items: ContextMenuItem[], title: string) => void;
}

/** Menu for a jack: disconnect its cables / highlight them. */
export function jackMenu(
  pos: { x: number; y: number },
  moduleId: string,
  jackId: string,
  jackLabel: string,
  hasCables: boolean,
  actions: { disconnect: (m: string, j: string) => void; highlight: (m: string, j: string) => void },
): ContextMenuState {
  return {
    ...pos,
    title: jackLabel,
    items: [
      { label: 'Disconnect', disabled: !hasCables, onClick: () => actions.disconnect(moduleId, jackId) },
      { label: 'Highlight cables', disabled: !hasCables, onClick: () => actions.highlight(moduleId, jackId) },
    ],
  };
}

/** Top-level module menu (rename / replace / color / copy-paste params). */
export function moduleMenu(
  pos: { x: number; y: number },
  module: ModuleInstance,
  canPaste: boolean,
  actions: ModuleMenuActions,
): ContextMenuState {
  const compatible = compatibleModules(module.type);
  const items: ContextMenuItem[] = [
    { label: 'Rename…', onClick: () => actions.rename(module.id) },
    {
      label: `Replace with…${compatible.length === 0 ? ' (none)' : ''}`,
      disabled: compatible.length === 0,
      keepOpen: true,
      onClick: () =>
        actions.reopen(
          compatible.map((m) => ({ label: m.name, onClick: () => actions.replace(module.id, m.id) })),
          'Replace with',
        ),
    },
    {
      label: 'Color tag…',
      keepOpen: true,
      onClick: () =>
        actions.reopen(
          [
            { label: 'None', swatch: '', onClick: () => actions.setColor(module.id, undefined) },
            ...COLOR_TAGS.map((c) => ({
              label: c.label,
              swatch: c.css,
              onClick: () => actions.setColor(module.id, c.key),
            })),
          ],
          'Color tag',
        ),
    },
    { label: 'Copy params', onClick: () => actions.copyParams(module.id) },
    { label: 'Paste params', disabled: !canPaste, onClick: () => actions.pasteParams(module.id) },
  ];
  return { ...pos, title: module.label, items };
}

/** Exposed for the color swatch on the current tag (used in tests/UI). */
export { colorCss };
