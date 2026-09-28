/**
 * es-module-shims, for a document that rejects the import maps the ESM backend
 * adds once modules have loaded. Firefox accepts one import map, and only
 * before the page's first module load.
 *
 * This file only gives the module its declarations: the build writes the
 * bundled `es-module-shims` to its `dist` file (see
 * `scripts/bundle-vendored-modules.mjs`), so hosts install nothing for it. The
 * ESM backend imports it only in such a document, after setting
 * `esmsInitOptions`, which es-module-shims reads when it evaluates.
 */
export {};
