import type { ComponentPropsWithoutRef } from 'react';

export type JackKind = 'audio' | 'cv' | 'gate' | 'midi';
export type JackDir = 'in' | 'out';

export interface JackProps extends Omit<ComponentPropsWithoutRef<'button'>, 'children'> {
  kind: JackKind;
  dir: JackDir;
  label: string;
  connected?: boolean;
}

export function Jack({ kind, dir, label, connected = false, className, ...rest }: JackProps) {
  const classes = ['ui-jack', `ui-jack-${kind}`, connected ? 'ui-jack-connected' : '', className]
    .filter(Boolean)
    .join(' ');
  return (
    <button
      type="button"
      className={classes}
      aria-label={`${label} (${kind} ${dir}${connected ? ', connected' : ''})`}
      data-kind={kind}
      data-dir={dir}
      {...rest}
    >
      <span className="ui-jack-ring" aria-hidden="true" />
      <span className="ui-jack-label">{label}</span>
    </button>
  );
}
