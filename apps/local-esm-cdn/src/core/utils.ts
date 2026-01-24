import { stat } from 'node:fs/promises';

/**
 * Add CORS headers to a headers object
 */
export function withCors(headers: HeadersInit = {}): Headers {
  const h = new Headers(headers);
  h.set('Access-Control-Allow-Origin', '*');
  h.set('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS');
  h.set('Access-Control-Allow-Headers', '*');
  return h;
}

/**
 * Create a JSON response with CORS headers
 */
export function json(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data, null, 2), {
    ...init,
    headers: withCors({
      'content-type': 'application/json; charset=utf-8',
      ...(init.headers ?? {}),
    }),
  });
}

/**
 * Create a text response with CORS headers
 */
export function text(data: string, init: ResponseInit = {}): Response {
  return new Response(data, {
    ...init,
    headers: withCors({
      'content-type': 'text/plain; charset=utf-8',
      ...(init.headers ?? {}),
    }),
  });
}

/**
 * Create a JavaScript response with CORS headers
 */
export function js(data: string, init: ResponseInit = {}): Response {
  return new Response(data, {
    ...init,
    headers: withCors({
      'content-type': 'application/javascript; charset=utf-8',
      'cache-control': 'no-store',
      ...(init.headers ?? {}),
    }),
  });
}

/**
 * Check if a file exists on disk
 */
export async function fileExists(p: string): Promise<boolean> {
  try {
    const s = await stat(p);
    return s.isFile();
  } catch {
    return false;
  }
}
