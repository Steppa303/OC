import { BaseEdge, type EdgeProps } from '@xyflow/react';
import type { JackKind } from '@amy/patchdoc';
import { usePatchStore } from './patchStore';

/**
 * Patch cable rendered as a hanging bezier (VCV-style): the control points are
 * pulled straight down so the cable droops into the rack space *below* the
 * modules, staying visible without elevating the edge above the panels (which
 * would let its hit area intercept jack connections).
 *
 * The "tidy" toggle (P7-02) flattens the droop into a short, near-straight
 * bezier for users who prefer a clean schematic look.
 */
export function CableEdge({ sourceX, sourceY, targetX, targetY, data, selected }: EdgeProps) {
  const tidy = usePatchStore((s) => s.cableTidy);
  const dx = Math.abs(targetX - sourceX);
  const sag = tidy ? 24 : 120 + dx * 0.2;
  const path = `M ${sourceX},${sourceY} C ${sourceX},${sourceY + sag} ${targetX},${targetY + sag} ${targetX},${targetY}`;
  const kind = (data?.['kind'] as JackKind | undefined) ?? 'audio';
  return (
    <BaseEdge
      path={path}
      style={{
        stroke: `var(--jack-${kind})`,
        strokeWidth: selected ? 4 : 3,
        opacity: selected ? 1 : 0.9,
      }}
    />
  );
}
