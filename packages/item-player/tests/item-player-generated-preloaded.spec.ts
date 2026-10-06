import { expect, test } from "@playwright/test";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import demo from "../../../apps/item-demos/src/lib/content/multiple-choice-radio-simple";
import mathDemo from "../../../apps/item-demos/src/lib/content/multiple-choice-math-algebra-quadratic";
import { type ServedPackage, serveFromTarballOnly, serveGeneratedPackage, workspace } from "./generated-preloaded-package";

const packageName = "@pie-element/multiple-choice";
const packageSpec = `${packageName}@14.0.0`;
// The build registers the base tag the published configs give the package, and
// the items author `multiple-choice`, so each player defines the tag it renders.
const registeredTag = "pie-element-multiple-choice--version-14-0-0";
const runtimeTag = "multiple-choice--version-14-0-0";
let built: ServedPackage;
let origin: string;

test.beforeAll(async () => {
  test.setTimeout(180_000);
  built = await serveGeneratedPackage([packageSpec], { [packageName]: "pie-element-multiple-choice" });
  origin = built.origin;
});

test.afterAll(async () => {
  await built?.close();
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
  await serveFromTarballOnly(page, origin);
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
  expect(await page.evaluate((tag) => !!customElements.get(tag), registeredTag)).toBe(true);
  expect(await page.evaluate((tag) => !!customElements.get(tag), runtimeTag)).toBe(false);
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

test("renders math with the MathJax the build ships, its fonts included", async ({ page }) => {
  const failedRequests: string[] = [];
  const browserErrors: string[] = [];
  const mathjaxFiles: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") browserErrors.push(message.text()); });
  page.on("requestfailed", (request) => failedRequests.push(request.url()));
  page.on("response", (response) => {
    if (response.status() >= 400) failedRequests.push(`${response.status()} ${response.url()}`);
    const { pathname } = new URL(response.url());
    if (response.ok() && pathname.startsWith("/package/dist/mathjax/")) mathjaxFiles.push(pathname);
  });
  await serveFromTarballOnly(page, origin);
  await page.goto(origin, { waitUntil: "networkidle" });
  await page.evaluate(async () => {
    const entry = "/package/dist/index.js";
    await import(entry);
  });

  await page.evaluate((config) => {
    const player = document.createElement("pie-item-player") as any;
    player.strategy = "preloaded";
    player.hosted = true;
    player.config = config;
    player.env = { mode: "gather", role: "student" };
    player.session = { id: "math-attempt", data: [] };
    document.body.appendChild(player);
  }, structuredClone(mathDemo.item.config));
  await expect(page.locator(`${runtimeTag} mjx-container`).first()).toBeVisible();
  await expect.poll(() => mathjaxFiles.some((file) => file.startsWith("/package/dist/mathjax/fonts/mathjax-newcm-font/chtml/"))).toBe(true);
  expect(mathjaxFiles).toContain("/package/dist/mathjax/load.js");
  expect(mathjaxFiles).toContain("/package/dist/mathjax/tex-mml-chtml.js");
  expect(await page.evaluate(() => (window as any).MathJax?.version)).toMatch(/^4\./);
  expect(failedRequests).toEqual([]);
  expect(browserErrors).toEqual([]);
});

test("typesets mhchem chemistry with the font extension the build ships", async ({ page }) => {
  const failedRequests: string[] = [];
  const browserErrors: string[] = [];
  const mathjaxFiles: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") browserErrors.push(message.text()); });
  page.on("requestfailed", (request) => failedRequests.push(request.url()));
  page.on("response", (response) => {
    if (response.status() >= 400) failedRequests.push(`${response.status()} ${response.url()}`);
    const { pathname } = new URL(response.url());
    if (response.ok() && pathname.startsWith("/package/dist/mathjax/")) mathjaxFiles.push(pathname);
  });
  await serveFromTarballOnly(page, origin);
  await page.goto(origin, { waitUntil: "networkidle" });
  await page.evaluate(async () => {
    const entry = "/package/dist/index.js";
    await import(entry);
  });

  const config = structuredClone(mathDemo.item.config);
  config.models[0].prompt = "<p>Water is \\(\\ce{H2O}\\).</p>";
  await page.evaluate((config) => {
    const player = document.createElement("pie-item-player") as any;
    player.strategy = "preloaded";
    player.hosted = true;
    player.config = config;
    player.env = { mode: "gather", role: "student" };
    player.session = { id: "chemistry-attempt", data: [] };
    document.body.appendChild(player);
  }, config);
  const water = page.locator(`${runtimeTag} mjx-container`, { has: page.locator("mjx-msub") }).first();
  await expect(water).toBeVisible();
  await expect.poll(() => mathjaxFiles).toContain("/package/dist/mathjax/fonts/mathjax-mhchem-font-extension/chtml.js");
  await expect(page.locator(`${runtimeTag} mjx-merror`)).toHaveCount(0);
  expect(failedRequests).toEqual([]);
  expect(browserErrors).toEqual([]);
});

test("ships every item-player module with its whitespace stripped", async () => {
  const playerDist = join(workspace, "packages/item-player/dist");
  const shipped = join(built.served, "package/dist");
  const modules = (await readdir(playerDist, { recursive: true })).filter((file) => file.endsWith(".js"));
  expect(modules).toContain("pie-item-player.js");
  for (const file of modules) {
    const [source, output] = await Promise.all([
      readFile(join(playerDist, file), "utf-8"),
      readFile(join(shipped, file), "utf-8"),
    ]);
    expect(output.length, file).toBeLessThan(source.length);
  }
});

test("renders an item authoring another base tag than the build, hosted and not hosted", async ({ page }) => {
  const browserErrors: string[] = [];
  const warnings: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
    if (message.type() === "warning" && message.text().includes("without a controller")) warnings.push(message.text());
  });
  await serveFromTarballOnly(page, origin);
  await page.goto(origin, { waitUntil: "networkidle" });
  await page.evaluate(async () => {
    const entry = "/package/dist/index.js";
    await import(entry);
  });

  // The demo item authors `multiple-choice` at `latest`.
  const authored = structuredClone(demo.item.config);
  for (const hosted of [true, false]) {
    const id = hosted ? "hosted-player" : "client-player";
    await page.evaluate(({ config, id, hosted }) => {
      document.querySelector("pie-item-player")?.remove();
      const player = document.createElement("pie-item-player") as any;
      player.id = id;
      player.strategy = "preloaded";
      player.hosted = hosted;
      player.config = config;
      player.env = { mode: "gather", role: "student" };
      player.session = { id: `${id}-attempt`, data: [] };
      player.addEventListener("session-changed", (event: CustomEvent) => { (window as any).savedSession = event.detail.session; });
      document.body.appendChild(player);
    }, { config: authored, id, hosted });
    await expect(page.locator(`#${id} ${runtimeTag}`)).toBeVisible();
    await page.locator(`#${id} input[type="radio"][value="jupiter"]`).click();
    await expect.poll(() => page.evaluate(() => (window as any).savedSession?.data?.find((entry: any) => entry.id === "2")?.value)).toEqual(["jupiter"]);
  }
  expect(await page.evaluate((tag) => {
    const { package: spec, status, tagName, bundleType } = (window as any).PIE_REGISTRY[tag];
    return { spec, status, tagName, bundleType };
  }, runtimeTag)).toEqual({ spec: packageSpec, status: "loaded", tagName: runtimeTag, bundleType: "player.js" });
  // The build registers no controllers, so the player that is not hosted warns once.
  expect(warnings).toHaveLength(1);
  expect(warnings[0]).toContain(runtimeTag);
  expect(browserErrors).toEqual([]);
});

test("imports into a page whose own item player holds pie-item-player, and renders through that copy", async ({ page }) => {
  const browserErrors: string[] = [];
  const requested: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") browserErrors.push(message.text()); });
  page.on("request", (request) => requested.push(new URL(request.url()).pathname));
  await serveFromTarballOnly(page, origin);
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
  await serveFromTarballOnly(page, origin);
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

test("import rejects when the element module is missing its promised element", async ({ page }) => {
  await page.route("**/dist/elements/index.js", (route) => route.fulfill({
    contentType: "text/javascript",
    body: "export const elements = {}; export function startMathRendering() {}",
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
  expect(result.message).toContain("No element class found in build for @pie-element/multiple-choice");
  // The legacy package reported a failed load on the same event.
  expect(result.loadStates).toEqual(["PIE-Fixed-Player-Load-Failed"]);
  expect(await page.evaluate(() => !!customElements.get("pie-item-player"))).toBe(false);
});
