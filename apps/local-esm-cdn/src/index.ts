import { loadConfigFromEnv, mergeConfig } from './core/config.js';
import { createStandaloneServer, type StandaloneServerOptions } from './runtime/bun.js';

// Re-export types for public API
export type { LocalEsmCdnConfig, LocalEsmCdnContext, BuildScope } from './core/config.js';
export type { Health } from './core/health.js';
export type { PackageRequest } from './core/resolver.js';
export type { StandaloneServerOptions } from './runtime/bun.js';

/**
 * Start the local ESM CDN server
 */
export async function serve(options: StandaloneServerOptions = {}) {
  // Merge env config with provided options
  const envConfig = loadConfigFromEnv();
  const finalConfig = mergeConfig(envConfig, options.config ?? {});

  return createStandaloneServer({
    ...options,
    config: finalConfig,
  });
}

// CLI entry point
if (import.meta.main) {
  const DEFAULT_PORT = 5179;

  const port = Number(process.env.LOCAL_ESM_CDN_PORT ?? DEFAULT_PORT);
  const allowRandomPortFallback = !(
    (process.env.LOCAL_ESM_CDN_ALLOW_RANDOM_PORT_FALLBACK ?? '').toLowerCase() === 'false' ||
    process.env.LOCAL_ESM_CDN_ALLOW_RANDOM_PORT_FALLBACK === '0'
  );
  const selfTest =
    (process.env.LOCAL_ESM_CDN_SELF_TEST ?? '').toLowerCase() === 'true' ||
    process.env.LOCAL_ESM_CDN_SELF_TEST === '1';

  const envConfig = loadConfigFromEnv();

  await serve({
    port,
    allowRandomPortFallback,
    selfTest,
    config: {
      ...envConfig,
      preBuild: true, // Enable pre-build for CLI usage
    },
  });
}
