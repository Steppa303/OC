/**
 * Rack geometry. PatchDoc positions are in HP units (x) and rack-row index (y)
 * — clean integers (docs/03 §1). React Flow works in pixels, so these helpers
 * convert between the two. One HP = 24px (docs/04 --hp); one row = panel height
 * (380px) + a gap, so modules line up in tidy rows.
 */
export const HP_PX = 24;
export const PANEL_H = 380;
export const ROW_GAP = 24;
export const ROW_PX = PANEL_H + ROW_GAP;

export interface Vec2 {
  x: number;
  y: number;
}

export function hpToPx(pos: Vec2): Vec2 {
  return { x: pos.x * HP_PX, y: pos.y * ROW_PX };
}

export function pxToHp(px: Vec2): Vec2 {
  return { x: Math.round(px.x / HP_PX), y: Math.max(0, Math.round(px.y / ROW_PX)) };
}

/** React Flow snap grid so dragging lands on the HP/row lattice. */
export const SNAP_GRID: [number, number] = [HP_PX, ROW_PX];
