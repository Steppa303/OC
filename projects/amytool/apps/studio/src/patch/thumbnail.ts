/**
 * Canvas thumbnail snapshots (P7-01) — a pure projection of a PatchDoc onto a
 * tiny schematic: one rect per module (width from the manifest's hp), one line
 * per cable between module centers, kind-colored. Rendered as inline SVG by
 * <PatchThumb>; no rasterization, so it works on stored docs without mounting
 * the canvas.
 */
import type { JackKind, PatchDoc } from '@amy/patchdoc';
import { DEVICE_MODULE_TYPE, deviceFromState, deviceHp, registry } from '@amy/modules';

/** One rack row of the mini-map, in HP units (matches ROW_HP=8 grid steps). */
const ROW_H = 7;
const FALLBACK_HP = 8;
const PAD = 2;

export interface ThumbModule {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ThumbCable {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  kind: JackKind;
}

export interface ThumbData {
  /** viewBox size in HP units, padding included. */
  w: number;
  h: number;
  modules: ThumbModule[];
  cables: ThumbCable[];
}

function moduleHp(doc: PatchDoc, moduleId: string): number {
  const mod = doc.modules.find((m) => m.id === moduleId);
  if (!mod) return FALLBACK_HP;
  if (mod.type === DEVICE_MODULE_TYPE) {
    const device = deviceFromState(mod.state);
    if (device) return deviceHp(device);
  }
  return registry.byId(mod.type)?.hp ?? FALLBACK_HP;
}

export function thumbnailData(doc: PatchDoc): ThumbData {
  const modules: ThumbModule[] = doc.modules.map((m) => ({
    x: m.pos.x,
    y: m.pos.y,
    w: moduleHp(doc, m.id),
    h: ROW_H,
  }));

  const centers = new Map<string, { cx: number; cy: number }>();
  doc.modules.forEach((m, i) => {
    const rect = modules[i];
    if (rect) centers.set(m.id, { cx: rect.x + rect.w / 2, cy: rect.y + rect.h / 2 });
  });

  const cables: ThumbCable[] = [];
  for (const c of doc.cables) {
    const from = centers.get(c.from.module);
    const to = centers.get(c.to.module);
    if (from && to) cables.push({ x1: from.cx, y1: from.cy, x2: to.cx, y2: to.cy, kind: c.kind });
  }

  // Normalize into a padded viewBox anchored at the top-left module.
  const minX = Math.min(0, ...modules.map((m) => m.x));
  const minY = Math.min(0, ...modules.map((m) => m.y));
  const maxX = Math.max(FALLBACK_HP, ...modules.map((m) => m.x + m.w));
  const maxY = Math.max(ROW_H, ...modules.map((m) => m.y + m.h));
  const dx = PAD - minX;
  const dy = PAD - minY;
  for (const m of modules) {
    m.x += dx;
    m.y += dy;
  }
  for (const c of cables) {
    c.x1 += dx;
    c.y1 += dy;
    c.x2 += dx;
    c.y2 += dy;
  }

  return { w: maxX - minX + PAD * 2, h: maxY - minY + PAD * 2, modules, cables };
}
