import { describe, expect, it, vi } from 'vitest';
import type { ModuleInstance } from '@amy/patchdoc';
import { jackMenu, moduleMenu } from './moduleMenu';
import { compatibleModules } from './routing';
import { colorCss, COLOR_TAGS } from './colorTags';

const noopActions = {
  rename: vi.fn(),
  replace: vi.fn(),
  setColor: vi.fn(),
  copyParams: vi.fn(),
  pasteParams: vi.fn(),
  reopen: vi.fn(),
};

function inst(type: string): ModuleInstance {
  return { id: 'm1', type, label: 'M1', pos: { x: 0, y: 0 }, params: {}, advanced: false, state: {} };
}

describe('compatibleModules', () => {
  it('returns same-role library modules, excluding itself and internals', () => {
    const compat = compatibleModules('core.vco');
    expect(compat.length).toBeGreaterThan(0);
    expect(compat.every((m) => m.role === 'vco')).toBe(true);
    expect(compat.some((m) => m.id === 'core.vco')).toBe(false);
    expect(compat.some((m) => m.id === 'core.customcode' || m.id === 'core.device')).toBe(false);
  });

  it('is empty for internal / unknown types', () => {
    expect(compatibleModules('core.device')).toEqual([]);
    expect(compatibleModules('core.nope')).toEqual([]);
  });
});

describe('jackMenu', () => {
  it('disables actions when the jack has no cables', () => {
    const menu = jackMenu({ x: 5, y: 6 }, 'm1', 'out', 'OUT', false, {
      disconnect: vi.fn(),
      highlight: vi.fn(),
    });
    expect(menu.title).toBe('OUT');
    expect(menu.items.every((i) => i.disabled)).toBe(true);
  });

  it('wires disconnect/highlight when cables exist', () => {
    const disconnect = vi.fn();
    const highlight = vi.fn();
    const menu = jackMenu({ x: 0, y: 0 }, 'm1', 'in', 'IN', true, { disconnect, highlight });
    menu.items[0]!.onClick();
    menu.items[1]!.onClick();
    expect(disconnect).toHaveBeenCalledWith('m1', 'in');
    expect(highlight).toHaveBeenCalledWith('m1', 'in');
  });
});

describe('moduleMenu', () => {
  it('has rename/replace/color/copy/paste; paste disabled when clipboard type differs', () => {
    const menu = moduleMenu({ x: 0, y: 0 }, inst('core.vco'), false, noopActions);
    const labels = menu.items.map((i) => i.label);
    expect(labels[0]).toBe('Rename…');
    expect(labels.some((l) => l.startsWith('Replace with'))).toBe(true);
    expect(labels).toContain('Color tag…');
    expect(labels).toContain('Copy params');
    const paste = menu.items.find((i) => i.label === 'Paste params')!;
    expect(paste.disabled).toBe(true);
  });

  it('enables paste when clipboard matches the module type', () => {
    const menu = moduleMenu({ x: 0, y: 0 }, inst('core.vco'), true, noopActions);
    expect(menu.items.find((i) => i.label === 'Paste params')!.disabled).toBe(false);
  });

  it('color submenu offers None + every palette tag', () => {
    const actions = { ...noopActions, reopen: vi.fn() };
    const menu = moduleMenu({ x: 0, y: 0 }, inst('core.vco'), false, actions);
    menu.items.find((i) => i.label === 'Color tag…')!.onClick();
    const [items] = actions.reopen.mock.calls[0]!;
    expect(items).toHaveLength(COLOR_TAGS.length + 1);
    expect(items[0].label).toBe('None');
  });

  it('replace is disabled for modules with no compatible siblings', () => {
    const menu = moduleMenu({ x: 0, y: 0 }, inst('core.device'), false, noopActions);
    expect(menu.items.find((i) => i.label.startsWith('Replace with'))!.disabled).toBe(true);
  });
});

describe('colorCss', () => {
  it('resolves known keys to a token and undefined otherwise', () => {
    expect(colorCss('green')).toBe('var(--ok)');
    expect(colorCss(undefined)).toBeUndefined();
    expect(colorCss('bogus')).toBeUndefined();
  });
});
