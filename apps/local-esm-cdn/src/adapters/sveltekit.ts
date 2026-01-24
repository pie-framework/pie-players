import type { Handle } from '@sveltejs/kit';
import type { LocalEsmCdnConfig } from '../core/config.js';
import { createLocalEsmCdn } from '../embedded.js';

/**
 * Create a SvelteKit handle function that serves local PIE packages as ESM modules
 *
 * @param config - Configuration for the local ESM CDN
 * @returns A SvelteKit handle function
 *
 * @example
 * ```typescript
 * // src/hooks.server.ts
 * import { createSvelteKitHandle } from '@pie-elements-ng/local-esm-cdn/adapters/sveltekit';
 *
 * export const handle = createSvelteKitHandle({
 *   repoRoot: '/path/to/pie-elements-ng',
 *   esmShBaseUrl: 'https://esm.sh',
 * });
 * ```
 *
 * @example
 * ```typescript
 * // src/hooks.server.ts (with other hooks)
 * import { createSvelteKitHandle } from '@pie-elements-ng/local-esm-cdn/adapters/sveltekit';
 * import { sequence } from '@sveltejs/kit/hooks';
 *
 * const localEsmCdn = createSvelteKitHandle({
 *   repoRoot: '/path/to/pie-elements-ng',
 *   esmShBaseUrl: 'https://esm.sh',
 * });
 *
 * export const handle = sequence(localEsmCdn, myOtherHandle);
 * ```
 */
export function createSvelteKitHandle(config: Partial<LocalEsmCdnConfig>): Handle {
  const cdn = createLocalEsmCdn(config);

  return async ({ event, resolve }) => {
    // Only handle PIE package requests
    if (event.url.pathname.startsWith('/@pie-')) {
      return cdn.handler(event.request);
    }

    // Pass through to SvelteKit for other routes
    return resolve(event);
  };
}
