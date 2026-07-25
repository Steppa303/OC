export type DisplayProps =
  | { kind: 'value'; value: string | number; label?: string }
  | { kind: 'text'; lines: readonly string[] }
  | { kind: 'scope'; samples: readonly number[]; width?: number; height?: number };

/** Green-on-black instrument display: numeric readout, text lines, or a waveform scope. */
export function Display(props: DisplayProps) {
  if (props.kind === 'value') {
    return (
      <div className="ui-display ui-display-value" role="status" aria-label={props.label}>
        {props.value}
      </div>
    );
  }
  if (props.kind === 'text') {
    return <div className="ui-display ui-display-text">{props.lines.join('\n')}</div>;
  }
  const width = props.width ?? 120;
  const height = props.height ?? 48;
  const n = props.samples.length;
  const points =
    n > 1
      ? props.samples
          .map((s, i) => {
            const x = (i / (n - 1)) * width;
            const y = height / 2 - Math.max(-1, Math.min(1, s)) * (height / 2 - 2);
            return `${x.toFixed(1)},${y.toFixed(1)}`;
          })
          .join(' ')
      : `0,${height / 2} ${width},${height / 2}`;
  return (
    <div className="ui-display ui-display-scope">
      <svg width={width} height={height} role="img" aria-label="oscilloscope">
        <polyline points={points} />
      </svg>
    </div>
  );
}
