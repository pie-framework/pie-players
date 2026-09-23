import { expect, test, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { extname, join, resolve, sep } from "node:path";
import demo from "../../../apps/item-demos/src/lib/content/multiple-choice-radio-simple";

const workspace = resolve(import.meta.dirname, "../../..");
const packageName = "@pie-element/multiple-choice";
const packageSpec = `${packageName}@11.4.3`;
const runtimeTag = "multiple-choice--version-11-4-3";
let scratch: string;
let server: Server;
let origin: string;

// Executable modules and player assets must come entirely from the tarball. The
// existing math renderer fetches these two data files separately.
const serveFromTarballOnly = (page: Page) =>
  page.route("**/*", (route) => {
    const url = route.request().url();
    const mathMap = /^https:\/\/cdn\.jsdelivr\.net\/npm\/speech-rule-engine@4\.1\.2\/lib\/mathmaps\/(base|en)\.json$/;
    return new URL(url).origin === origin || mathMap.test(url) ? route.continue() : route.abort();
  });

test.beforeAll(async () => {
  test.setTimeout(180_000);
  scratch = await mkdtemp(join(tmpdir(), "pie-generated-preload-"));
  const generated = join(scratch, "generated");
  const packed = join(scratch, "preloaded.tgz");
  const served = join(scratch, "served");
  // Exercise the production generator, including its actual PITS bundle fetch
  // and package build. The browser will receive only the extracted tarball.
  execFileSync("bun", ["-e", `
    import { buildPreloadedPlayerStaticPackage } from "./tools/cli/src/utils/pie-packages/fixed-static.ts";
    await buildPreloadedPlayerStaticPackage(${JSON.stringify({
      elements: [packageSpec],
      elementTags: { [packageName]: "multiple-choice" },
      monorepoDir: workspace,
      outputDir: generated,
      iteration: 1,
    })});
  `], { cwd: workspace, timeout: 150_000, maxBuffer: 32 * 1024 * 1024 });
  execFileSync("bun", ["pm", "pack", "--filename", packed], { cwd: generated });
  await mkdir(served);
  execFileSync("tar", ["-xzf", packed, "-C", served]);
  server = createServer((request, response) => {
    void (async () => {
      const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
      if (pathname === "/") {
        response.writeHead(200, { "content-type": "text/html" });
        response.end(`<!doctype html><html lang="en"><meta charset="utf-8">
          <title>Generated preloaded package</title><link rel="icon" href="data:,">
          <h1>Generated preloaded package</h1></html>`);
        return;
      }
      // The build's files again under a second path, which the browser loads as
      // separate modules: a second copy of the item player, as a page running
      // the section player holds one.
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
        const mime: Record<string, string> = { ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };
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
  origin = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async () => {
  if (server) await new Promise<void>((done) => server.close(() => done()));
  if (scratch) await rm(scratch, { recursive: true, force: true });
});

test("packed preloaded output registers authored tags, loads chunks, and records a real answer", async ({ page }) => {
  const failedRequests: string[] = [];
  const browserErrors: string[] = [];
  const loadedChunks: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") browserErrors.push(message.text()); });
  page.on("requestfailed", (request) => failedRequests.push(request.url()));
  page.on("response", (response) => {
    if (response.status() >= 400) failedRequests.push(`${response.status()} ${response.url()}`);
    if (response.ok() && response.url().includes("/dist/chunks/")) loadedChunks.push(response.url());
  });
  await serveFromTarballOnly(page);
  await page.goto(origin, { waitUntil: "networkidle" });
  const readyAtImport = await page.evaluate(async () => {
    const entry = "/package/dist/index.js";
    const loadStates: unknown[] = [];
    (window as any).loadStates = loadStates;
    document.addEventListener("PiePlayerLoadEvent", (event) => loadStates.push((event as CustomEvent).detail));
    await import(entry);
    return !!customElements.get("pie-item-player");
  });
  expect(readyAtImport).toBe(true);
  // The load signal @pie-framework/pie-fixed-player-static emitted, which Star and Quiz Engine listen for.
  expect(await page.evaluate(() => (window as any).loadStates)).toEqual(["PIE-Fixed-Player-Load-Complete"]);
  expect(await page.evaluate(() => (window as any).pieFixedPlayerLoaded)).toBe(true);
  expect(await page.evaluate(() => performance.getEntriesByName("PIE-Fixed-Player-Load-Complete").length)).toBe(1);
  expect(await page.evaluate((tag) => !!customElements.get(tag), runtimeTag)).toBe(true);
  expect(await page.evaluate(() => (window as any).PIE_PRELOADED_ELEMENTS)).toEqual({ [packageName]: packageSpec });

  const staleTag = "multiple-choice--version-0-0-1";
  const authored = structuredClone(demo.item.config);
  authored.elements = { [staleTag]: `${packageName}@0.0.1` };
  authored.markup = `<${staleTag} id="2"></${staleTag}>`;
  authored.models = authored.models.map((model) => ({ ...model, element: staleTag }));
  await page.evaluate((config) => {
    const player = document.createElement("pie-item-player") as any;
    (window as any).authoredConfig = config;
    player.strategy = "preloaded";
    player.config = config;
    player.env = { mode: "gather", role: "student" };
    player.session = (window as any).hostSession = { id: "generated-package-attempt", data: [] };
    player.addEventListener("session-changed", (event: CustomEvent) => { (window as any).savedSession = event.detail.session; });
    document.body.appendChild(player);
  }, authored);
  await expect(page.getByText("Which is the largest planet in our solar system?")).toBeVisible();
  await expect(page.locator(runtimeTag)).toBeVisible();
  await expect(page.locator(staleTag)).toHaveCount(0);
  // `<pie-player>` created an entry per model as the item rendered, then kept the
  // host's own container current. Both halves hold here.
  await expect.poll(() => page.evaluate(() => (window as any).hostSession?.data?.map((entry: any) => entry.id))).toEqual(["2"]);
  await page.locator('input[type="radio"][value="jupiter"]').click();
  await expect(page.locator('input[type="radio"][value="jupiter"]')).toBeChecked();
  await expect.poll(() => page.evaluate(() => (window as any).savedSession?.data?.find((entry: any) => entry.id === "2")?.value)).toEqual(["jupiter"]);
  await expect.poll(() => page.evaluate(() => (window as any).hostSession?.data?.find((entry: any) => entry.id === "2")?.value)).toEqual(["jupiter"]);
  expect(await page.evaluate(() => (window as any).authoredConfig)).toEqual(authored);

  // A second copy of the entry executes registration again with cached bundles.
  const unchanged = await page.evaluate(async (tag) => {
    const initial = customElements.get(tag);
    const entry = "/package/dist/index.js?second-entry";
    await import(entry);
    return initial === customElements.get(tag);
  }, runtimeTag);
  await page.waitForLoadState("networkidle");
  expect(unchanged).toBe(true);
  await page.locator('input[type="radio"][value="mars"]').click();
  await expect(page.locator('input[type="radio"][value="mars"]')).toBeChecked();
  await expect.poll(() => page.evaluate(() => (window as any).savedSession?.data?.find((entry: any) => entry.id === "2")?.value)).toEqual(["mars"]);
  expect(loadedChunks.length).toBeGreaterThan(0);
  expect(failedRequests).toEqual([]);
  expect(browserErrors).toEqual([]);
});

test("imports into a page whose own item player holds pie-item-player, and renders through that copy", async ({ page }) => {
  const browserErrors: string[] = [];
  const requested: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") browserErrors.push(message.text()); });
  page.on("request", (request) => requested.push(new URL(request.url()).pathname));
  await serveFromTarballOnly(page);
  await page.goto(origin, { waitUntil: "networkidle" });

  // What a host running the section player presents: its own item player holds
  // `pie-item-player` before the build loads.
  const imported = await page.evaluate(async () => {
    const hostCopy = "/host-copy/pie-item-player.js";
    await import(hostCopy);
    const hostPlayer = customElements.get("pie-item-player");
    const loadStates: unknown[] = [];
    document.addEventListener("PiePlayerLoadEvent", (event) => loadStates.push((event as CustomEvent).detail));
    const entry = "/package/dist/index.js";
    await import(entry);
    return { loadStates, hostCopyKept: !!hostPlayer && customElements.get("pie-item-player") === hostPlayer };
  });
  expect(imported.loadStates).toEqual(["PIE-Fixed-Player-Load-Complete"]);
  expect(imported.hostCopyKept).toBe(true);
  // The build's own copy would only find the tag taken, so it is never fetched.
  expect(requested).not.toContain("/package/dist/pie-item-player.js");

  const authored = structuredClone(demo.item.config);
  authored.elements = { [runtimeTag]: packageSpec };
  authored.markup = `<${runtimeTag} id="2"></${runtimeTag}>`;
  authored.models = authored.models.map((model) => ({ ...model, element: runtimeTag }));
  await page.evaluate((config) => {
    const player = document.createElement("pie-item-player") as any;
    player.strategy = "preloaded";
    player.config = config;
    player.env = { mode: "gather", role: "student" };
    player.session = (window as any).hostSession = { id: "host-copy-attempt", data: [] };
    document.body.appendChild(player);
  }, authored);
  await expect(page.getByText("Which is the largest planet in our solar system?")).toBeVisible();
  await expect(page.locator(runtimeTag)).toBeVisible();
  await page.locator('input[type="radio"][value="jupiter"]').click();
  await expect(page.locator('input[type="radio"][value="jupiter"]')).toBeChecked();
  await expect.poll(() => page.evaluate(() => (window as any).hostSession?.data?.find((entry: any) => entry.id === "2")?.value)).toEqual(["jupiter"]);
  expect(browserErrors).toEqual([]);
});

test("a second item-player copy loading after the build leaves the build's copy registered", async ({ page }) => {
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") browserErrors.push(message.text()); });
  await serveFromTarballOnly(page);
  await page.goto(origin, { waitUntil: "networkidle" });

  // A host that imports the build before the section player: the build's copy
  // takes `pie-item-player`, and the section player's own copy loads after it.
  const result = await page.evaluate(async () => {
    const entry = "/package/dist/index.js";
    await import(entry);
    const buildPlayer = customElements.get("pie-item-player");
    try {
      const hostCopy = "/host-copy/pie-item-player.js";
      await import(hostCopy);
      return { message: "resolved", buildCopyKept: !!buildPlayer && customElements.get("pie-item-player") === buildPlayer };
    } catch (error) {
      return { message: error instanceof Error ? error.message : String(error), buildCopyKept: false };
    }
  });
  expect(result).toEqual({ message: "resolved", buildCopyKept: true });
  expect(browserErrors).toEqual([]);
});

test("import rejects when the fetched bundle is missing its promised element", async ({ page }) => {
  await page.route("**/pie-elements-bundle-*.js", (route) => route.fulfill({
    contentType: "text/javascript",
    body: "window.pie = { default: {} };",
  }));
  await page.goto(origin);
  const result = await page.evaluate(async () => {
    const loadStates: unknown[] = [];
    document.addEventListener("PiePlayerLoadEvent", (event) => loadStates.push((event as CustomEvent).detail));
    try {
      const entry = "/package/dist/index.js";
      await import(entry);
      return { message: "resolved", loadStates };
    } catch (error) {
      return { message: error instanceof Error ? error.message : String(error), loadStates };
    }
  });
  expect(result.message).toContain("No element class found in bundle for @pie-element/multiple-choice");
  // The legacy package reported a failed load on the same event.
  expect(result.loadStates).toEqual(["PIE-Fixed-Player-Load-Failed"]);
  expect(await page.evaluate(() => !!customElements.get("pie-item-player"))).toBe(false);
});
