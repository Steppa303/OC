interface ChainLinkProps {
  from: { x: number; y: number }
  to: { x: number; y: number }
  color?: string
  animated?: boolean
  strokeWidth?: number
}

/**
 * SVG bezier curve connection between two chain nodes.
 * Draws a cubic bezier path with slight upward arc.
 * Supports animated dash when audio is flowing.
 */
export function ChainLink({
  from,
  to,
  color = 'var(--color-primary)',
  animated = false,
  strokeWidth = 2,
}: ChainLinkProps) {
  const dx = Math.abs(to.x - from.x)
  const controlOffsetX = Math.max(40, dx * 0.4)

  // Build a gentle S-curve bezier
  const path = `M ${from.x} ${from.y} C ${from.x + controlOffsetX} ${from.y}, ${to.x - controlOffsetX} ${to.y}, ${to.x} ${to.y}`

  return (
    <g>
      {/* Glow / wide underlay for visual depth */}
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth + 4}
        strokeLinecap="round"
        opacity={0.12}
      />
      {/* Main line */}
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={animated ? '6 4' : 'none'}
        className={animated ? 'chain-link-animated' : ''}
      />
      {/* Arrow head */}
      <ArrowHead from={from} to={to} color={color} />
    </g>
  )
}

function ArrowHead({
  from,
  to,
  color,
}: {
  from: { x: number; y: number }
  to: { x: number; y: number }
  color: string
}) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x)
  const size = 6
  const x = to.x
  const y = to.y

  const x1 = x - size * Math.cos(angle - Math.PI / 6)
  const y1 = y - size * Math.sin(angle - Math.PI / 6)
  const x2 = x - size * Math.cos(angle + Math.PI / 6)
  const y2 = y - size * Math.sin(angle + Math.PI / 6)

  return (
    <polygon
      points={`${x},${y} ${x1},${y1} ${x2},${y2}`}
      fill={color}
      opacity={0.8}
    />
  )
}