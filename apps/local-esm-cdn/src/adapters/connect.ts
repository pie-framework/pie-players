import type { IncomingMessage, ServerResponse } from 'node:http';
import type { LocalEsmCdnConfig } from '../core/config.js';
import { createLocalEsmCdn } from '../embedded.js';

/**
 * Express/Connect middleware function type
 */
export type ConnectMiddleware = (
  req: IncomingMessage,
  res: ServerResponse,
  next: (err?: any) => void
) => void;

/**
 * Create Express/Connect middleware that serves local PIE packages as ESM modules
 *
 * @param config - Configuration for the local ESM CDN
 * @returns Express/Connect middleware function
 *
 * @example
 * ```typescript
 * // Express
 * import express from 'express';
 * import { createConnectMiddleware } from '@pie-elements-ng/local-esm-cdn/adapters/connect';
 *
 * const app = express();
 *
 * app.use(createConnectMiddleware({
 *   repoRoot: '/path/to/pie-elements-ng',
 *   esmShBaseUrl: 'https://esm.sh',
 * }));
 *
 * app.listen(3000);
 * ```
 *
 * @example
 * ```typescript
 * // Connect
 * import connect from 'connect';
 * import { createConnectMiddleware } from '@pie-elements-ng/local-esm-cdn/adapters/connect';
 *
 * const app = connect();
 *
 * app.use(createConnectMiddleware({
 *   repoRoot: '/path/to/pie-elements-ng',
 *   esmShBaseUrl: 'https://esm.sh',
 * }));
 *
 * app.listen(3000);
 * ```
 */
export function createConnectMiddleware(config: Partial<LocalEsmCdnConfig>): ConnectMiddleware {
  const cdn = createLocalEsmCdn(config);

  return (req, res, next) => {
    // Only handle PIE package requests
    if (!req.url?.startsWith('/@pie-')) {
      return next();
    }

    // Convert Node.js request to Web Request
    const protocol = (req.socket as any).encrypted ? 'https' : 'http';
    const host = req.headers.host || 'localhost';
    const url = `${protocol}://${host}${req.url}`;

    const request = new Request(url, {
      method: req.method,
      headers: req.headers as HeadersInit,
    });

    // Handle the request
    cdn
      .handler(request)
      .then((response) => {
        // Convert Web Response to Node.js response
        res.statusCode = response.status;
        response.headers.forEach((value, key) => {
          res.setHeader(key, value);
        });

        return response.text();
      })
      .then((text) => {
        res.end(text);
      })
      .catch((error) => {
        // eslint-disable-next-line no-console
        console.error('[local-esm-cdn] Error:', error);
        next(error);
      });
  };
}
