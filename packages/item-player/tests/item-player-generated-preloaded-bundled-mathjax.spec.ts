import { expect, test, type Page } from "@playwright/test";
import mathDemo from "../../../apps/item-demos/src/lib/content/multiple-choice-math-algebra-quadratic";
import { type ServedPackage, serveFromTarballOnly, serveGeneratedPackage } from "./generated-preloaded-package";

// An element whose MathJax 4 is bundled into it: it reads no page MathJax, and
// loads its fonts and speech worker from the build.
const packageName = "@pie-element/multiple-choice";
const packageSpec = `${packageName}@14.0.1-next.20261003161149`;
const assets = "/package/dist/mathjax/npm/@mathjax/";
const math = "pie-item-player mjx-container";
let built: ServedPackage;

test.beforeAll(async () => {
  test.setTimeout(180_000);
  built = await serveGeneratedPackage([packageSpec], { [packageName]: "pie-element-multiple-choice" });
});

test.afterAll(async () => {
  await built?.close();
});

/** Imports the build into a page that reaches only the tarball, and records what the page fetched. */
async function openBuild(page: Page) {
  const failedRequests: string[] = [];
  const browserErrors: string[] = [];
  const mathjaxFiles: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") browserErrors.push(message.text()); });
  page.context().on("requestfailed", (request) => failedRequests.push(request.url()));
  page.context().on("response", (response) => {
    if (response.status() >= 400) failedRequests.push(`${response.status()} ${response.url()}`);
    const { pathname } = new URL(response.url());
    if (response.ok() && pathname.startsWith("/package/dist/mathjax/")) mathjaxFiles.push(pathname);
  });
  await serveFromTarballOnly(page, built.origin);
  await page.goto(built.origin, { waitUntil: "networkidle" });
  await page.evaluate(async () => {
    const entry = "/package/dist/index.js";
    await import(entry);
  });
  return { failedRequests, browserErrors, mathjaxFiles };
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

test("renders math with the element's own MathJax, its fonts from the build, and no page MathJax", async ({ page }) => {
  const loaded = await openBuild(page);
  await mount(page, structuredClone(mathDemo.item.config), "math-attempt");
  await expect(page.locator(math).first()).toBeVisible();
  await expect.poll(() => loaded.mathjaxFiles.some((file) => file.startsWith(`${assets}mathjax-newcm-font@`))).toBe(true);
  expect(loaded.mathjaxFiles.filter((file) => !file.startsWith(assets))).toEqual([]);
  expect(await page.evaluate(() => "MathJax" in window)).toBe(false);
  await expect(page.locator("pie-item-player mjx-merror")).toHaveCount(0);
  expect(loaded.failedRequests).toEqual([]);
  expect(loaded.browserErrors).toEqual([]);
});

test("typesets mhchem chemistry with the font extension the build ships", async ({ page }) => {
  const loaded = await openBuild(page);
  const config = structuredClone(mathDemo.item.config);
  config.models[0].prompt = "<p>Equilibrium: \\(\\ce{A <=> B}\\).</p>";
  await mount(page, config, "chemistry-attempt");
  await expect(page.locator(math).first()).toBeVisible();
  await expect.poll(() => loaded.mathjaxFiles.some((file) => file.startsWith(`${assets}mathjax-mhchem-font-extension@`))).toBe(true);
  await expect(page.locator("pie-item-player mjx-merror")).toHaveCount(0);
  expect(loaded.failedRequests).toEqual([]);
  expect(loaded.browserErrors).toEqual([]);
});

test("speaks math from the speech worker the build ships once a student turns enrichment on", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("PIE-MathJax-Menu-Settings", JSON.stringify({ enrich: true })));
  const loaded = await openBuild(page);
  await mount(page, structuredClone(mathDemo.item.config), "speech-attempt");
  await expect(page.locator(math).first()).toHaveAttribute("data-semantic-speech-none", /.+/);
  expect(loaded.mathjaxFiles.some((file) => file.startsWith(`${assets}src@`) && file.includes("/bundle/sre/"))).toBe(true);
  expect(loaded.failedRequests).toEqual([]);
  expect(loaded.browserErrors).toEqual([]);
});
