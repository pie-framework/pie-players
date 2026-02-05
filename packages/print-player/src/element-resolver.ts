/**
 * Element Resolution
 *
 * Handles resolving element package names to CDN URLs and loading print modules.
 * Ported from pie-print-support/src/pie-print.ts
 */

import { define, status, whenDefined } from './ce-registry.js';
import type { PkgResolution, ResolverFn, LoadResolutionResult } from './types.js';

/**
 * Default resolver - resolves package names to jsdelivr CDN URLs
 *
 * @param tagName - Element tag name
 * @param pkg - Package identifier (e.g., '@pie-element/multiple-choice@12.0.0')
 * @returns Package resolution with CDN URL
 */
export const defaultResolve: ResolverFn = (tagName: string, pkg: string): Promise<PkgResolution> => {
  return Promise.resolve({
    tagName,
    pkg,
    url: `https://cdn.jsdelivr.net/npm/${pkg}/dist/print/index.js`,
    module: true,
  });
};

/**
 * Verify that a CDN URL exists by making a HEAD request
 *
 * @param url - URL to check
 * @returns True if URL exists and is accessible
 */
const verifyCdnExists = async (url: string): Promise<boolean> => {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
};

/**
 * Default resolution loader - loads and registers print modules
 *
 * @param r - Package resolution to load
 * @returns Result indicating success or failure
 */
export const defaultLoadResolution = async (r: PkgResolution): Promise<LoadResolutionResult> => {
  if (!r.printTagName) {
    throw new Error(`printTagName must be defined`);
  }

  const s = status(r.printTagName);

  if (s === 'inProgress' || s === 'inRegistry') {
    console.log('[element-resolver] Tag already defined - skip', r.printTagName);
    return whenDefined(r.printTagName).then(() => ({ success: true, pkg: r }));
  }

  const existPrintModule = await verifyCdnExists(r.url);

  if (!existPrintModule) {
    return {
      success: false,
      pkg: r,
      message: 'Print module is not configured for this item type',
    };
  }

  if (r.module) {
    try {
      const mod = await import(/* @vite-ignore */ r.url);
      const ElementClass = mod.default || mod;
      define(r.printTagName, ElementClass);
      return whenDefined(r.printTagName).then(() => ({ success: true, pkg: r }));
    } catch (e: any) {
      console.error('[element-resolver] Failed to load module', r.url, e);
      return { success: false, pkg: r, message: e.message };
    }
  }

  if (!r.module) {
    throw new Error('only loading modules!');
  }

  return { success: false, pkg: r };
};

/**
 * Generate a hash code from a string (for unique tag names)
 *
 * @param s - String to hash
 * @returns 32-bit integer hash
 */
export const hashCode = (s: string): number => {
  let hash = 0;
  let i: number;
  let chr: number;
  if (s.length === 0) return hash;
  for (i = 0; i < s.length; i++) {
    chr = s.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
};
