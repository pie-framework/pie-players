import type { Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { extname, join, resolve, sep } from "node:path";

export const workspace = resolve(import.meta.dirname, "../../..");

/**
 * The published multiple-choice the generated-package specs build with. A
 * preloaded build takes elements on `@pie-element/shared-math-rendering-mathjax`
 * 0.1.3 or later.
 */
export const MULTIPLE_CHOICE_VERSION = "14.0.1-next.20261003161149";

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
  const server = await serveDirectory(served, (pathname) =>
    pathname.startsWith("/host-copy/") ? `/package/dist/${pathname.slice("/host-copy/".length)}` : pathname,
  );
  return {
    ...server,
    served,
    async close() {
      await server.close();
      await rm(scratch, { recursive: true, force: true });
    },
  };
}

/**
 * Bundles a host page that imports the package extracted at `served` with Vite,
 * as a host's own build would, and serves the output alone. The page sets
 * `window.hostReady` once the import resolves.
 */
export async function serveHostBundle(served: string): Promise<{ origin: string; close(): Promise<void> }> {
  const scratch = await mkdtemp(join(tmpdir(), "pie-host-bundle-"));
  const root = join(scratch, "host");
  const outDir = join(scratch, "dist");
  await mkdir(join(root, "node_modules", "@pie-players"), { recursive: true });
  await symlink(join(served, "package"), join(root, "node_modules", "@pie-players", "pie-preloaded-player"));
  await writeFile(join(root, "index.html"), `<!doctype html><html lang="en"><meta charset="utf-8">
    <title>Host bundle</title><link rel="icon" href="data:,">
    <script type="module" src="./main.js"></script><h1>Host bundle</h1></html>`);
  await writeFile(join(root, "main.js"), `import "@pie-players/pie-preloaded-player";
window.hostReady = true;
`);
  execFileSync("bun", ["-e", `
    import { build } from "vite";
    await build(${JSON.stringify({
      root,
      configFile: false,
      logLevel: "error",
      build: { outDir, emptyOutDir: true, target: "es2022" },
    })});
  `], { cwd: workspace, timeout: 150_000, maxBuffer: 32 * 1024 * 1024 });
  const server = await serveDirectory(outDir, (pathname) => (pathname === "/" ? "/index.html" : pathname));
  return {
    origin: server.origin,
    async close() {
      await server.close();
      await rm(scratch, { recursive: true, force: true });
    },
  };
}

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".woff2": "font/woff2",
};

/**
 * Serves the files under `root`, each request's path mapped by `toFile`, and a
 * blank page at `/` unless `toFile` maps it.
 */
async function serveDirectory(
  root: string,
  toFile: (pathname: string) => string,
): Promise<{ origin: string; close(): Promise<void> }> {
  const server: Server = createServer((request, response) => {
    void (async () => {
      const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
      const filePath = toFile(pathname);
      if (filePath === "/") {
        response.writeHead(200, { "content-type": "text/html" });
        response.end(`<!doctype html><html lang="en"><meta charset="utf-8">
          <title>Generated preloaded package</title><link rel="icon" href="data:,">
          <h1>Generated preloaded package</h1></html>`);
        return;
      }
      const filename = resolve(root, `.${decodeURIComponent(filePath)}`);
      if (!filename.startsWith(`${root}${sep}`)) {
        response.writeHead(404).end();
        return;
      }
      try {
        const data = await readFile(filename);
        response.writeHead(200, { "content-type": MIME_TYPES[extname(filename)] ?? "application/octet-stream" });
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
    close: () => new Promise<void>((done) => server.close(() => done())),
  };
}

/**
 * Executable modules, player assets, and MathJax with its fonts and speech data
 * must come entirely from the tarball.
 */
export const serveFromTarballOnly = (page: Page, origin: string) =>
  page.route("**/*", (route) =>
    new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
