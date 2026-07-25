import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const srcDir = __dirname;
const tokensCss = readFileSync(join(srcDir, 'tokens.css'), 'utf8');

const REQUIRED_TOKENS = [
  '--bg-app',
  '--bg-rack',
  '--bg-panel',
  '--bg-panel-raised',
  '--border-panel',
  '--text-primary',
  '--text-secondary',
  '--text-dim',
  '--accent',
  '--jack-audio',
  '--jack-cv',
  '--jack-gate',
  '--jack-midi',
  '--display-bg',
  '--display-fg',
  '--danger',
  '--warn',
  '--ok',
  '--font-ui',
  '--font-mono',
  '--hp',
  '--panel-h',
  '--radius-panel',
  '--radius-control',
];

describe('design tokens', () => {
  it('defines every token from docs/04 §1', () => {
    for (const token of REQUIRED_TOKENS) {
      expect(tokensCss).toContain(`${token}:`);
    }
  });

  it('no hard-coded colors outside tokens.css (CLAUDE.md rule 8)', () => {
    const offenders: string[] = [];
    for (const file of readdirSync(srcDir)) {
      if (file === 'tokens.css' || file.endsWith('.test.ts') || file.endsWith('.test.tsx')) continue;
      const text = readFileSync(join(srcDir, file), 'utf8');
      if (/#[0-9a-fA-F]{3,8}\b|rgb\(|hsl\(/.test(text)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });
});
