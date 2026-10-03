import type { Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { extname, join, resolve, sep } from "node:path";

export const workspace = resolve(import.meta.dirname, "../../..");

export interface ServedPackage {
  origin: string;
  /** The extracted tarball, its files under `package/`. */
  served: string;
  close(): Promise<void>;
}

/**
 * Builds a preloaded package from `elements` with the production generator,
 * including its install and bundling of the published elements, packs it, and
 * serves the extracted tarball: the browser receives nothing else. The build's
 * `dist/` is served again under `/host-copy/`, which the browser loads as
 * separate modules: a second copy of the item player, as a page running the
 * section player holds one.
 */
export async function serveGeneratedPackage(
  elements: string[],
  elementTags: Record<string, string>,
): Promise<ServedPackage> {
  const scratch = await mkdtemp(join(tmpdir(), "pie-generated-preload-"));
  const generated = join(scratch, "generated");
  const packed = join(scratch, "preloaded.tgz");
  const served = join(scratch, "served");
  execFileSync("bun", ["-e", `
    import { buildPreloadedPlayerStaticPackage } from "./tools/cli/src/utils/pie-packages/preloaded-static.ts";
    await buildPreloadedPlayerStaticPackage(${JSON.stringify({
      elements,
      elementTags,
      monorepoDir: workspace,
      outputDir: generated,
      iteration: 1,
    })});
  `], { cwd: workspace, timeout: 150_000, maxBuffer: 32 * 1024 * 1024 });
  execFileSync("bun", ["pm", "pack", "--filename", packed], { cwd: generated });
  await mkdir(served);
  execFileSync("tar", ["-xzf", packed, "-C", served]);
  const server: Server = createServer((request, response) => {
    void (async () => {
      const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
      if (pathname === "/") {
        response.writeHead(200, { "content-type": "text/html" });
        response.end(`<!doctype html><html lang="en"><meta charset="utf-8">
          <title>Generated preloaded package</title><link rel="icon" href="data:,">
          <h1>Generated preloaded package</h1></html>`);
        return;
      }
      const servedPath = pathname.startsWith("/host-copy/")
        ? `/package/dist/${pathname.slice("/host-copy/".length)}`
        : pathname;
      const filename = resolve(served, `.${decodeURIComponent(servedPath)}`);
      if (!filename.startsWith(`${served}${sep}`)) {
        response.writeHead(404).end();
        return;
      }
      try {
        const data = await readFile(filename);
        const mime: Record<string, string> = {
          ".js": "text/javascript",
          ".css": "text/css",
          ".json": "application/json",
          ".woff2": "font/woff2",
        };
        response.writeHead(200, { "content-type": mime[extname(filename)] ?? "application/octet-stream" });
        response.end(data);
      } catch {
        response.writeHead(404).end();
      }
    })().catch(() => response.writeHead(500).end());
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Static server did not bind");
  return {
    origin: `http://127.0.0.1:${address.port}`,
    served,
    async close() {
      await new Promise<void>((done) => server.close(() => done()));
      await rm(scratch, { recursive: true, force: true });
    },
  };
}

/**
 * Executable modules, player assets, and MathJax with its fonts and speech data
 * must come entirely from the tarball.
 */
export const serveFromTarballOnly = (page: Page, origin: string) =>
  page.route("**/*", (route) =>
    new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
