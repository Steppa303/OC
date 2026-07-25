import type { ThumbData } from './thumbnail';

/** Inline-SVG mini-map of a patch (P7-01). Colors come from design tokens. */
export function PatchThumb({ data, className }: { data: ThumbData; className?: string }) {
  return (
    <svg
      className={className ?? 'patch-thumb'}
      viewBox={`0 0 ${data.w} ${data.h}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Patch thumbnail"
      data-testid="patch-thumb"
    >
      <rect x={0} y={0} width={data.w} height={data.h} className="patch-thumb-bg" />
      {data.modules.map((m, i) => (
        <rect key={i} x={m.x} y={m.y} width={m.w} height={m.h} rx={0.8} className="patch-thumb-module" />
      ))}
      {data.cables.map((c, i) => (
        <line key={i} x1={c.x1} y1={c.y1} x2={c.x2} y2={c.y2} className={`patch-thumb-cable patch-thumb-cable-${c.kind}`} />
      ))}
    </svg>
  );
}
