import type { LocalEsmCdnConfig } from './core/config.js';
import { createContext, mergeConfig } from './core/config.js';
import { handleRequest } from './core/handler.js';
import { getHealth, type Health } from './core/health.js';

/**
 * Local ESM CDN instance for embedding in web applications
 */
export interface LocalEsmCdnInstance {
  /**
   * Handle an HTTP request
   * @param request - The incoming Web Request
   * @returns The Web Response
   */
  handler: (request: Request) => Promise<Response>;

  /**
   * Get the health status of the CDN
   * @returns The current health status
   */
  getHealth: () => Promise<Health>;

  /**
   * Update the configuration at runtime
   * @param newConfig - Partial configuration to merge
   */
  updateConfig: (newConfig: Partial<LocalEsmCdnConfig>) => void;
}

/**
 * Create a local ESM CDN instance for embedding in web applications
 *
 * @param config - Configuration for the local ESM CDN
 * @returns A local ESM CDN instance
 *
 * @example
 * ```typescript
 * import { createLocalEsmCdn } from '@pie-framework/local-esm-cdn/embedded';
 *
 * const cdn = createLocalEsmCdn({
 *   pieElementsNgRoot: '/path/to/pie-elements-ng',
 *   piePlayersRoot: '/path/to/pie-players',
 *   esmShBaseUrl: 'https://esm.sh',
 * });
 *
 * // Use in any request handler
 * const response = await cdn.handler(request);
 * ```
 */
export function createLocalEsmCdn(config: Partial<LocalEsmCdnConfig>): LocalEsmCdnInstance {
  const finalConfig = mergeConfig(config);
  const context = createContext(finalConfig);

  return {
    handler: (request: Request) => handleRequest(request, context),
    getHealth: () => getHealth(context.config.pieElementsNgRoot),
    updateConfig: (newConfig: Partial<LocalEsmCdnConfig>) => {
      Object.assign(context.config, newConfig);
    },
  };
}

// Re-export types for convenience
export type { LocalEsmCdnConfig } from './core/config.js';
export type { Health } from './core/health.js';
