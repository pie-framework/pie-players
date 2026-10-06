import { expect, test, type Page } from "@playwright/test";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import mathDemo from "../../../apps/item-demos/src/lib/content/multiple-choice-math-algebra-quadratic";
import {
  MULTIPLE_CHOICE_VERSION,
  type ServedPackage,
  serveFromTarballOnly,
  serveGeneratedPackage,
  serveHostBundle,
} from "./generated-preloaded-package";

// The element bundles its MathJax 4 and reads no page MathJax. It and the item
// player load the fonts and speech the build ships, each from the URL the
// entry gives it.
const packageName = "@pie-element/multiple-choice";
const packageSpec = `${packageName}@${MULTIPLE_CHOICE_VERSION}`;
const npm = "/package/dist/mathjax/npm/";
const math = "pie-item-player mjx-container";
const speechWorker = /(?:^|\/)mathjax@[^/]+\/sre\/speech-worker\.js$/;
const englishRules = /(?:^|\/)mathjax@[^/]+\/sre\/mathmaps\/en\.json$/;
let built: ServedPackage;

test.beforeAll(async () => {
  test.setTimeout(180_000);
  built = await serveGeneratedPackage([packageSpec], { [packageName]: "pie-element-multiple-choice" });
});

test.afterAll(async () => {
  await built?.close();
});

/** Records what a page reaching only `origin` fetches, and what it reports. */
async function watch(page: Page, origin: string) {
  const failedRequests: string[] = [];
  const browserErrors: string[] = [];
  const mathWarnings: string[] = [];
  const fetched: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
    if (message.type() === "warning" && message.text().startsWith("[math-rendering]")) mathWarnings.push(message.text());
  });
  page.context().on("requestfailed", (request) => failedRequests.push(request.url()));
  page.context().on("response", (response) => {
    if (response.status() >= 400) failedRequests.push(`${response.status()} ${response.url()}`);
    if (response.ok()) fetched.push(new URL(response.url()).pathname);
  });
  await serveFromTarballOnly(page, origin);
  return { failedRequests, browserErrors, mathWarnings, fetched };
}

/** Imports the build into a page that reaches only the tarball. */
async function openBuild(page: Page) {
  const watched = await watch(page, built.origin);
  await page.goto(built.origin, { waitUntil: "networkidle" });
  await page.evaluate(async () => {
    const entry = "/package/dist/index.js";
    await import(entry);
  });
  const mathjaxFiles = () => watched.fetched.filter((file) => file.startsWith("/package/dist/mathjax/"));
  return { ...watched, mathjaxFiles };
}

async function mount(page: Page, config: unknown, id: string) {
  await page.evaluate(({ config, id }) => {
    const player = document.createElement("pie-item-player") as any;
    player.strategy = "preloaded";
    player.hosted = true;
    player.config = config;
    player.env = { mode: "gather", role: "student" };
    player.session = { id, data: [] };
    document.body.appendChild(player);
  }, { config, id });
}

const enableEnrichment = (page: Page) =>
  page.addInitScript(() => localStorage.setItem("PIE-MathJax-Menu-Settings", JSON.stringify({ enrich: true })));

const withMarkupMath = () => {
  const config = structuredClone(mathDemo.item.config);
  config.markup = String.raw`<p class="stem">Solve \(ax^2 + bx + c = 0\).</p>${config.markup}`;
  return config;
};

test("lists each MathJax file it ships in the entry", async () => {
  const dist = join(built.served, "package/dist");
  const shipped = (await readdir(join(dist, "mathjax/npm"), { recursive: true, withFileTypes: true }))
    .filter((entry) => entry.isFile() && !["package.json", "LICENSE"].includes(entry.name))
    .map((entry) => join(entry.parentPath, entry.name).slice(join(dist, "mathjax/npm/").length));
  const listed = [...(await readFile(join(dist, "index.js"), "utf-8")).matchAll(
    /new URL\("\.\/mathjax\/npm\/([^"]+)", import\.meta\.url\)/g,
  )].map((match) => match[1]);
  expect(listed.sort()).toEqual(shipped.sort());
  expect(listed).toEqual(expect.arrayContaining([expect.stringMatching(speechWorker), expect.stringMatching(englishRules)]));
});

test("renders math with the element's own MathJax, its fonts from the build, and no page MathJax", async ({ page }) => {
  const loaded = await openBuild(page);
  await mount(page, structuredClone(mathDemo.item.config), "math-attempt");
  await expect(page.locator(math).first()).toBeVisible();
  await expect.poll(() => loaded.mathjaxFiles().some((file) => file.startsWith(`${npm}@mathjax/mathjax-newcm-font@`))).toBe(true);
  expect(loaded.mathjaxFiles().filter((file) => !file.startsWith(npm))).toEqual([]);
  expect(await page.evaluate(() => "MathJax" in window)).toBe(false);
  await expect(page.locator("pie-item-player mjx-merror")).toHaveCount(0);
  expect(loaded.failedRequests).toEqual([]);
  expect(loaded.browserErrors).toEqual([]);
  expect(loaded.mathWarnings).toEqual([]);
});

test("typesets mhchem chemistry with the font extension the build ships", async ({ page }) => {
  const loaded = await openBuild(page);
  const config = structuredClone(mathDemo.item.config);
  config.models[0].prompt = "<p>Equilibrium: \\(\\ce{A <=> B}\\).</p>";
  await mount(page, config, "chemistry-attempt");
  await expect(page.locator(math).first()).toBeVisible();
  await expect.poll(() => loaded.mathjaxFiles().some((file) => file.startsWith(`${npm}@mathjax/mathjax-mhchem-font-extension@`))).toBe(true);
  await expect(page.locator("pie-item-player mjx-merror")).toHaveCount(0);
  expect(loaded.failedRequests).toEqual([]);
  expect(loaded.browserErrors).toEqual([]);
});

test("typesets the item's own markup on the player's MathJax, its fonts from the build", async ({ page }) => {
  const loaded = await openBuild(page);
  await mount(page, withMarkupMath(), "markup-attempt");
  await expect(page.locator("pie-item-player .stem mjx-container")).toBeVisible();
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  expect(await page.evaluate(() => ["MathJax", "@pie-lib/math-rendering"].filter((key) => key in window))).toEqual([]);
  expect(loaded.mathjaxFiles().filter((file) => !file.startsWith(npm))).toEqual([]);
  expect(loaded.failedRequests).toEqual([]);
  expect(loaded.browserErrors).toEqual([]);
  expect(loaded.mathWarnings).toEqual([]);
});

test("speaks math from the speech worker and English rules the build ships once a student turns enrichment on", async ({ page }) => {
  await enableEnrichment(page);
  const loaded = await openBuild(page);
  await mount(page, structuredClone(mathDemo.item.config), "speech-attempt");
  await expect(page.locator(math).first()).toHaveAttribute("data-semantic-speech-none", /.+/);
  expect(loaded.mathjaxFiles()).toEqual(
    expect.arrayContaining([expect.stringMatching(speechWorker), expect.stringMatching(englishRules)]),
  );
  expect(loaded.failedRequests).toEqual([]);
  expect(loaded.browserErrors).toEqual([]);
});

test("speaks the item's own markup from the files the build ships, in the locales it ships", async ({ page }) => {
  await enableEnrichment(page);
  const loaded = await openBuild(page);
  await mount(page, withMarkupMath(), "markup-speech-attempt");
  await expect(page.locator("pie-item-player .stem mjx-container")).toHaveAttribute("data-semantic-speech-none", /.+/);
  expect(loaded.mathjaxFiles()).toEqual(expect.arrayContaining([expect.stringMatching(speechWorker)]));
  expect(await page.evaluate(() => (window as any)["@pie-lib/math-rendering@2"]?.opts?.speechLocales)).toEqual(["en"]);
  expect(loaded.failedRequests).toEqual([]);
  expect(loaded.browserErrors).toEqual([]);
});

test.describe("bundled into a host's build", () => {
  let host: { origin: string; close(): Promise<void> };

  test.beforeAll(async () => {
    test.setTimeout(180_000);
    host = await serveHostBundle(built.served);
  });

  test.afterAll(async () => {
    await host?.close();
  });

  test("renders and speaks math from the files the host's bundler emitted", async ({ page }) => {
    await enableEnrichment(page);
    const loaded = await watch(page, host.origin);
    await page.goto(host.origin);
    await page.waitForFunction(() => (window as any).hostReady === true);
    await mount(page, withMarkupMath(), "host-attempt");
    await expect(page.locator(math).first()).toHaveAttribute("data-semantic-speech-none", /.+/);
    await expect(page.locator("pie-item-player .stem mjx-container")).toHaveAttribute("data-semantic-speech-none", /.+/);
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    expect(await page.evaluate(() => [...document.fonts].filter((font) => font.status === "loaded").length)).toBeGreaterThan(0);
    expect(loaded.fetched).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^\/assets\/mjx-ncm-[^/]+\.woff2$/),
        expect.stringMatching(/^\/assets\/speech-worker-[^/]+\.js$/),
        expect.stringMatching(/^\/assets\/en-[^/]+\.json$/),
      ]),
    );
    expect(loaded.fetched.filter((file) => file.includes("/mathjax/"))).toEqual([]);
    expect(loaded.failedRequests).toEqual([]);
    expect(loaded.browserErrors).toEqual([]);
    expect(loaded.mathWarnings).toEqual([]);
  });
});
