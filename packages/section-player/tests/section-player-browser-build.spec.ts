/**
 * The self-contained browser build (`./browser`) as a page loads it from a CDN:
 * the packed packages served from one origin, a host page on another, no import
 * map and no bundler. Cortex is outside the packaged set, so the page composes
 * it in through the build's `createCalculatorToolRegistration` and loads it from
 * its own package. A browser refuses a worker script from another origin, so
 * Cortex starts its worker from a same-origin `blob:` module that imports the
 * real file; the calculator evaluating here is the proof that both hold.
 */

import { expect, type Page, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { extname, join, resolve, sep } from "node:path";

const workspace = resolve(import.meta.dirname, "../../..");
const SECTION_ENTRY = "/section-player/dist/browser/pie-section-player.js";
// The same build's files under a second path, which the browser loads as
// separate modules: a second copy of the section player.
const SECTION_COPY_ENTRY = "/section-player-copy/dist/browser/pie-section-player.js";
const ITEM_PLAYER_ENTRY = "/item-player/dist/pie-item-player.js";
const CORTEX_ENTRY = "/calculator-cortex/dist/index.js";

const SECTION_TAGS = [
  "pie-section-player-splitpane",
  "pie-section-player-vertical",
  "pie-section-player-tabbed",
  "pie-section-player-shell",
  "pie-section-player-item-card",
  "pie-section-player-passage-card",
  "pie-section-player-items-pane",
  "pie-section-player-passages-pane",
  "pie-section-player-kernel-host",
];

// Markup only, so the page needs no PIE element code. The basic calculator is
// asked for through the item's tool metadata, as the section demos do.
const calculatorItem = (id: string, name: string, prompt: string) => ({
  identifier: id,
  required: true,
  toolMetadata: { calculator: "basic" },
  item: {
    id,
    name,
    baseId: id,
    version: { major: 1, minor: 0, patch: 0 },
    toolMetadata: { calculator: "basic" },
    config: { markup: `<p>${prompt}</p>`, elements: {}, models: [] },
  },
});

const section = {
  identifier: "browser-build-section",
  title: "Browser build",
  keepTogether: true,
  rubricBlocks: [
    {
      identifier: "browser-build-passage",
      view: ["candidate"],
      class: "stimulus",
      passage: {
        id: "browser-build-passage",
        name: "Passage",
        baseId: "browser-build-passage",
        version: { major: 1, minor: 0, patch: 0 },
        config: { markup: "<p>Read the passage before answering.</p>", elements: {}, models: [] },
      },
    },
  ],
  assessmentItemRefs: [calculatorItem("browser-build-q1", "Question 1", "What is 7 × 8?")],
};

const runtime = {
  assessmentId: "browser-build",
  playerType: "iife",
  tools: {
    placement: { section: [], item: ["calculator"], passage: [] },
  },
};

let scratch: string;
let packageServer: Server;
let hostServer: Server;
let packageOrigin: string;
let hostOrigin: string;

const listen = async (server: Server) => {
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Static server did not bind");
  return `http://127.0.0.1:${address.port}`;
};

const pack = (packageDir: string, into: string) => {
  const tarball = join(scratch, `${packageDir}.tgz`);
  execFileSync("bun", ["pm", "pack", "--filename", tarball], {
    cwd: join(workspace, "packages", packageDir),
    maxBuffer: 32 * 1024 * 1024,
  });
  execFileSync("tar", ["-xzf", tarball, "-C", into]);
};

test.beforeAll(async () => {
  test.setTimeout(180_000);
  scratch = await mkdtemp(join(tmpdir(), "pie-section-browser-build-"));
  const served = join(scratch, "served");
  await mkdir(served);
  for (const [packageDir, as] of [
    ["section-player", "section-player"],
    ["item-player", "item-player"],
    ["calculator-cortex", "calculator-cortex"],
  ] as const) {
    const extracted = join(scratch, `extract-${as}`);
    await mkdir(extracted);
    pack(packageDir, extracted);
    execFileSync("mv", [join(extracted, "package"), join(served, as)]);
  }
  execFileSync("cp", ["-R", join(served, "section-player"), join(served, "section-player-copy")]);

  // jsDelivr serves every file with `access-control-allow-origin: *`.
  packageServer = createServer((request, response) => {
    void (async () => {
      const pathname = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
      const filename = resolve(served, `.${pathname}`);
      if (!filename.startsWith(`${served}${sep}`)) {
        response.writeHead(404).end();
        return;
      }
      try {
        const data = await readFile(filename);
        const mime: Record<string, string> = { ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };
        response.writeHead(200, {
          "content-type": mime[extname(filename)] ?? "application/octet-stream",
          "access-control-allow-origin": "*",
        });
        response.end(data);
      } catch {
        response.writeHead(404).end();
      }
    })().catch(() => response.writeHead(500).end());
  });
  packageOrigin = await listen(packageServer);

  hostServer = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/html" });
    response.end(`<!doctype html><html lang="en"><meta charset="utf-8">
      <title>Browser build host</title><link rel="icon" href="data:,">
      <body><main id="host" style="height: 80vh"></main></body></html>`);
  });
  hostOrigin = await listen(hostServer);
});

test.afterAll(async () => {
  if (packageServer) await new Promise<void>((done) => packageServer.close(() => done()));
  if (hostServer) await new Promise<void>((done) => hostServer.close(() => done()));
  if (scratch) await rm(scratch, { recursive: true, force: true });
});

const watch = (page: Page) => {
  const failures: string[] = [];
  const thirdPartyOrigins = new Set<string>();
  const workerUrls: string[] = [];
  const workerScriptRequests: string[] = [];
  page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") failures.push(`console.error: ${message.text()}`);
  });
  page.on("requestfailed", (request) => failures.push(`requestfailed: ${request.url()}`));
  page.on("response", (response) => {
    if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`);
  });
  page.on("request", (request) => {
    // `data:` and `blob:` requests load nothing.
    if (!/^https?:\/\//.test(request.url())) return;
    const { origin } = new URL(request.url());
    if (/\/evaluation-worker-[\w-]+\.js$/.test(request.url())) workerScriptRequests.push(request.url());
    if (origin !== hostOrigin && origin !== packageOrigin) thirdPartyOrigins.add(origin);
  });
  page.on("worker", (worker) => workerUrls.push(worker.url()));
  return { failures, thirdPartyOrigins, workerUrls, workerScriptRequests };
};

const loadModule = (page: Page, path: string) =>
  page.evaluate((url) => import(/* @vite-ignore */ url).then(() => true), `${packageOrigin}${path}`);

// With `cortex`, the page builds the packaged set from the build's exports with
// Cortex composed into the calculator registration and selects it; `hostTool`
// adds a toolbar tool of the host's own to that set. `playerRuntime` replaces
// the default runtime and `attributes` are set on the player element.
const mountSection = (
  page: Page,
  {
    cortex = false,
    hostTool = false,
    playerRuntime = runtime,
    attributes = {},
  }: {
    cortex?: boolean;
    hostTool?: boolean;
    playerRuntime?: typeof runtime & { player?: object };
    attributes?: Record<string, string>;
  } = {},
) =>
  page.evaluate(
    async ({ sectionUrl, cortexUrl, runtime, section, hostTool, attributes }) => {
      const player = document.createElement("pie-section-player-splitpane") as HTMLElement & {
        runtime: unknown;
        section: unknown;
        toolRegistry: unknown;
      };
      player.setAttribute("show-toolbar", "true");
      let tools: Record<string, unknown> = runtime.tools;
      if (cortexUrl) {
        const build = await import(/* @vite-ignore */ sectionUrl);
        const toolRegistry = build.createPackagedToolRegistry({
          overrides: {
            calculator: build.createCalculatorToolRegistration({
              providers: {
                "calculator-cortex": {
                  providerName: "PIE Open-Source Calculator",
                  version: "1",
                  requiresAuth: false,
                  backend: "cortex",
                  load: async () => (await import(/* @vite-ignore */ cortexUrl)).CortexCalculatorProvider,
                  initializationErrorMessage: "Failed to initialize the Cortex calculator provider.",
                },
              },
            }),
          },
        });
        const item = ["calculator"];
        if (hostTool) {
          const icon = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="6"/></svg>';
          toolRegistry.register({
            toolId: "hostTool",
            name: "Host tool",
            description: "A toolbar tool the host registers",
            icon,
            supportedLevels: ["item"],
            isVisibleInContext: () => true,
            renderToolbar: () => ({
              toolId: "hostTool",
              button: { toolId: "hostTool", label: "Host tool", ariaLabel: "Host tool", icon, onClick() {} },
            }),
          });
          item.push("hostTool");
        }
        player.toolRegistry = toolRegistry;
        tools = {
          providers: { calculator: { provider: { id: "calculator-cortex" } } },
          placement: { ...runtime.tools.placement, item },
        };
      }
      for (const [name, value] of Object.entries(attributes)) player.setAttribute(name, value);
      player.runtime = { ...runtime, tools };
      player.section = section;
      document.getElementById("host")?.appendChild(player);
    },
    {
      sectionUrl: `${packageOrigin}${SECTION_ENTRY}`,
      cortexUrl: cortex ? `${packageOrigin}${CORTEX_ENTRY}` : null,
      runtime: playerRuntime,
      section,
      hostTool,
      attributes,
    },
  );

const calculatorButton = (page: Page) =>
  page
    .locator("pie-section-player-item-card")
    .first()
    .getByRole("button", { name: /^(basic |scientific )?calculator$/i });

test("a page on another origin loads the browser build with no import map, renders the section and evaluates in the Cortex calculator it composes in", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const { failures, thirdPartyOrigins, workerUrls, workerScriptRequests } = watch(page);
  // The math renderer fetches speech-rule-engine's locale maps from jsDelivr as
  // it first speaks a formula. Stubbed, so the spec needs no network.
  await page.route(/^https:\/\/cdn\.jsdelivr\.net\/npm\/speech-rule-engine@[^/]+\/lib\/mathmaps\/[\w-]+\.json$/, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "{}" }),
  );
  await page.goto(hostOrigin);
  expect(await page.locator('script[type="importmap"]').count()).toBe(0);

  await loadModule(page, SECTION_ENTRY);
  for (const tag of SECTION_TAGS) {
    expect(await page.evaluate((name) => !!customElements.get(name), tag), tag).toBe(true);
  }

  await mountSection(page, { cortex: true });
  await expect(page.getByText("Read the passage before answering.")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("What is 7 × 8?")).toBeVisible();

  await expect(calculatorButton(page)).toBeVisible({ timeout: 60_000 });
  expect(workerUrls).toEqual([]);
  await calculatorButton(page).click();
  const calculator = page.locator('[data-pie-tool-shell="calculator"]').first();
  await expect(calculator).toBeVisible();

  for (const key of ["digit-7", "multiply", "digit-8"]) {
    await calculator.locator(`[data-key-id="${key}"]`).click();
  }
  await expect
    .poll(() =>
      calculator.locator("math-field").evaluate((element) => (element as HTMLElement & { value: string }).value),
    )
    .toBe("7\\times8");
  await calculator.locator('[data-key-id="commit"]').click();
  await expect(calculator.locator(".pie-cortex-tape__result").first()).toHaveText("56", { timeout: 30_000 });

  // The page's own `blob:` wrapper starts the worker, which then imports the
  // worker file from the package origin.
  expect(workerUrls.length).toBeGreaterThan(0);
  expect(workerUrls.every((url) => url.startsWith("blob:"))).toBe(true);
  expect(workerScriptRequests).toEqual([
    expect.stringMatching(/\/calculator-cortex\/dist\/assets\/evaluation-worker-[\w-]+\.js$/),
  ]);
  expect(failures).toEqual([]);
  // The origins a host's CSP has to allow beyond the one that served the build:
  // jsDelivr for the math renderer's speech maps, a `connect-src` entry.
  expect([...thirdPartyOrigins]).toEqual(["https://cdn.jsdelivr.net"]);
});

test("a configured ESM CDN serves the math renderer's speech maps and the toolbar's FontAwesome in place of jsDelivr", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const { failures, thirdPartyOrigins } = watch(page);
  const mirror = "https://mirror.example";
  await page.route(/^https:\/\/mirror\.example\/esm\/speech-rule-engine@[^/]+\/lib\/mathmaps\/[\w-]+\.json$/, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "{}" }),
  );
  await page.route(/^https:\/\/mirror\.example\/esm\/@fortawesome\/fontawesome-free@[^/]+\/css\/all\.min\.css$/, (route) =>
    route.fulfill({ status: 200, contentType: "text/css", body: "" }),
  );
  // The NDS button links Roboto from ui.renaissance.com itself.
  await page.route("https://ui.renaissance.com/**", (route) =>
    route.fulfill({ status: 200, contentType: "text/css", body: "" }),
  );
  await page.goto(hostOrigin);
  await loadModule(page, SECTION_ENTRY);
  await mountSection(page, {
    playerRuntime: { ...runtime, player: { loaderOptions: { esmCdnUrl: `${mirror}/esm` } } },
    attributes: { "nds-icons": "" },
  });
  await expect(page.getByText("What is 7 × 8?")).toBeVisible({ timeout: 60_000 });
  await expect
    .poll(() =>
      page.evaluate(() =>
        Array.from(document.head.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'))
          .map((link) => link.href)
          .filter((href) => href.includes("fontawesome-free")),
      ),
    )
    .toEqual([`${mirror}/esm/@fortawesome/fontawesome-free@6.5.2/css/all.min.css`]);
  await expect
    .poll(() => [...thirdPartyOrigins].sort(), { timeout: 30_000 })
    .toEqual(["https://mirror.example", "https://ui.renaissance.com"]);
  expect(failures).toEqual([]);
});

test("a CDN item player loaded first, or a second section player copy, leaves the page working", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const { failures } = watch(page);
  await page.goto(hostOrigin);

  await loadModule(page, ITEM_PLAYER_ENTRY);
  await loadModule(page, SECTION_ENTRY);
  const definedBefore = await page.evaluate(
    (tags) => tags.map((tag) => customElements.get(tag)),
    SECTION_TAGS,
  );
  // The same tags from a second copy of the build: every define is a no-op, and
  // the first registration stays.
  await loadModule(page, SECTION_COPY_ENTRY);
  expect(
    await page.evaluate(
      (tags) => tags.map((tag) => customElements.get(tag)),
      SECTION_TAGS,
    ),
  ).toEqual(definedBefore);

  await mountSection(page);
  await expect(page.getByText("What is 7 × 8?")).toBeVisible({ timeout: 60_000 });
  expect(failures).toEqual([]);
});

test("a host adds its own tool and a calculator backend to the packaged set from the build's exports, and the packaged tools still load from the build", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const { failures } = watch(page);
  const packageRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().startsWith(`${packageOrigin}/`)) packageRequests.push(request.url());
  });
  await page.goto(hostOrigin);

  await mountSection(page, { cortex: true, hostTool: true });

  const itemCard = page.locator("pie-section-player-item-card").first();
  await expect(itemCard.getByRole("button", { name: "Host tool" })).toBeVisible({ timeout: 60_000 });
  await expect(calculatorButton(page)).toBeVisible();
  await calculatorButton(page).click();
  await expect(page.locator('[data-pie-tool-shell="calculator"]').first()).toBeVisible();

  // The calculator's packaged loader imports this module on first use, and the
  // composed backend is the only package code from outside the build.
  expect(packageRequests).toContainEqual(
    expect.stringMatching(/\/section-player\/dist\/browser\/chunks\/calculator-element-\w+\.js$/),
  );
  expect(
    packageRequests.filter(
      (url) => !url.includes("/section-player/dist/browser/") && !url.includes("/calculator-cortex/dist/"),
    ),
  ).toEqual([]);
  expect(failures).toEqual([]);
});

test("the npm entry is byte-identical with and without the browser build", async () => {
  test.setTimeout(120_000);
  const outDir = join(scratch, "npm-only");
  execFileSync("bunx", ["vite", "build", "--config", "vite.config.ts", "--outDir", outDir, "--emptyOutDir"], {
    cwd: join(workspace, "packages", "section-player"),
    maxBuffer: 32 * 1024 * 1024,
  });
  const digest = async (file: string) => createHash("sha256").update(await readFile(file)).digest("hex");
  expect(await digest(join(outDir, "pie-section-player.js"))).toBe(
    await digest(join(scratch, "served", "section-player", "dist", "pie-section-player.js")),
  );
});
