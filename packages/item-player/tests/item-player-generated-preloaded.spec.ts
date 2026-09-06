import { expect, test } from "@playwright/test";
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
      const filename = resolve(served, `.${decodeURIComponent(pathname)}`);
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
  await page.route("**/*", (route) => {
    const url = route.request().url();
    // The existing math renderer fetches these data files separately. Executable
    // modules and player assets must still come entirely from the tarball.
    const mathMap = /^https:\/\/cdn\.jsdelivr\.net\/npm\/speech-rule-engine@4\.1\.2\/lib\/mathmaps\/(base|en)\.json$/;
    return new URL(url).origin === origin || mathMap.test(url) ? route.continue() : route.abort();
  });
  await page.goto(origin, { waitUntil: "networkidle" });
  const readyAtImport = await page.evaluate(async () => {
    const entry = "/package/dist/index.js";
    await import(entry);
    return !!customElements.get("pie-item-player");
  });
  expect(readyAtImport).toBe(true);
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
    player.session = { id: "generated-package-attempt", data: [] };
    player.addEventListener("session-changed", (event: CustomEvent) => { (window as any).savedSession = event.detail.session; });
    document.body.appendChild(player);
  }, authored);
  await expect(page.getByText("Which is the largest planet in our solar system?")).toBeVisible();
  await expect(page.locator(runtimeTag)).toBeVisible();
  await expect(page.locator(staleTag)).toHaveCount(0);
  await page.locator('input[type="radio"][value="jupiter"]').click();
  await expect(page.locator('input[type="radio"][value="jupiter"]')).toBeChecked();
  await expect.poll(() => page.evaluate(() => (window as any).savedSession?.data?.find((entry: any) => entry.id === "2")?.value)).toEqual(["jupiter"]);
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

test("import rejects when the fetched bundle is missing its promised element", async ({ page }) => {
  await page.route("**/pie-elements-bundle-*.js", (route) => route.fulfill({
    contentType: "text/javascript",
    body: "window.pie = { default: {} };",
  }));
  await page.goto(origin);
  const result = await page.evaluate(async () => {
    try {
      const entry = "/package/dist/index.js";
      await import(entry);
      return "resolved";
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  });
  expect(result).toContain("No element class found in bundle for @pie-element/multiple-choice");
  expect(await page.evaluate(() => !!customElements.get("pie-item-player"))).toBe(false);
});
