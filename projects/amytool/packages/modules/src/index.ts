export * from './schema';
export { CORE_MANIFESTS } from './core';
export { ModuleRegistry, registry } from './registry';
export * from './groups';
export * from './device';

/** Internal module types the user never places directly (hidden from palette,
 *  library and the LLM catalog): import residue and generated devices. */
export const INTERNAL_MODULE_IDS: ReadonlySet<string> = new Set(['core.customcode', 'core.device']);
