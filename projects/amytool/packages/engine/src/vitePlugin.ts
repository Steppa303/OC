/**
 * Vite plugin: serve /amy/* from packages/engine/vendor and set the COOP/COEP
 * headers the AMY wasm-worker build needs (BUILD.md §Hosting requirements).
 * In production builds the vendor files are emitted into dist/amy/.
 */
import { createReadStream, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

const vendorDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'vendor');
const FILES: Record<string, string> = {
  'amy.js': 'text/javascript',
  'amy.wasm': 'application/wasm',
  'enable-threads.js': 'text/javascript',
};

const ISOLATION_HEADERS = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
} as const;

export function amyEnginePlugin(): Plugin {
  return {
    name: 'amy-engine',
    config() {
      return {
        server: { headers: { ...ISOLATION_HEADERS } },
        preview: { headers: { ...ISOLATION_HEADERS } },
      };
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const name = req.url?.startsWith('/amy/') ? req.url.slice('/amy/'.length) : null;
        const type = name ? FILES[name] : undefined;
        if (!name || !type) {
          next();
          return;
        }
        res.setHeader('Content-Type', type);
        createReadStream(join(vendorDir, name)).pipe(res);
      });
    },
    generateBundle() {
      for (const name of Object.keys(FILES)) {
        this.emitFile({
          type: 'asset',
          fileName: `amy/${name}`,
          source: readFileSync(join(vendorDir, name)),
        });
      }
    },
  };
}
