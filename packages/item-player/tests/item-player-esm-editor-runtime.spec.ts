import { expect, test, type Page } from "@playwright/test";
import categorizeMath from "../../../apps/item-demos/src/lib/content/categorize-math-equations";
import ebsr from "../../../apps/item-demos/src/lib/content/ebsr-default";
import explicitConstructedResponse from "../../../apps/item-demos/src/lib/content/explicit-constructed-response-default";
import extendedTextEntry from "../../../apps/item-demos/src/lib/content/extended-text-entry-default";
import multipleChoiceMath from "../../../apps/item-demos/src/lib/content/multiple-choice-math-algebra-quadratic";
import multipleChoice from "../../../apps/item-demos/src/lib/content/multiple-choice-radio-simple";
import type { DemoInfo } from "../../../apps/item-demos/src/lib/content/types";

// Exact versions: npm `latest` of these names is the legacy line, which ships
// no browser ESM. Each declares the shared editor runtime unless noted.
const RUNTIME = "@pie-element/shared-editor-runtime@0.1.1-next.0";
const MC = "@pie-element/multiple-choice@13.4.0-next.15";
const CATEGORIZE = "@pie-element/categorize@13.2.0-next.19";
const EBSR = "@pie-element/ebsr@14.2.2-next.20";
const ETE = "@pie-element/extended-text-entry@15.1.2-next.19";
const ECR = "@pie-element/explicit-constructed-response@11.1.2-next.20";
const CLOZE = "@pie-element/simple-cloze@0.1.4-next.12";
const VENN = "@pie-element/venn-classification@0.1.1-next.11";
/** Published before the editor runtime, so it declares none. */
const MC_BEFORE_RUNTIME = "@pie-element/multiple-choice@13.4.0-next.14";

const JSDELIVR = "https://cdn.jsdelivr.net/npm";
/** jsDelivr under another host: a CDN base URL that gets a backend of its own. */
const MIRROR = "https://fastly.jsdelivr.net/npm";

// match-list declares no editor runtime, so the page maps none until a test
// mounts a player of its own.
const HOST_PATH =
	"/demo/match-list-default/delivery?mode=gather&role=student&player=esm";

type Model = Record<string, unknown> & { id: string; element: string };
type ItemConfig = {
	id: string;
	markup: string;
	elements: Record<string, string>;
	models: Model[];
};

const CLOZE_MODEL: Model = {
	id: "cloze",
	element: "simple-cloze",
	prompt: "<p>What is 2 + 2?</p>",
	correctAnswer: "4",
};
const VENN_MODEL: Model = {
	id: "venn",
	element: "venn-classification",
	prompt: "<p>Sort each animal into the Venn diagram.</p>",
	promptEnabled: true,
	circles: [{ label: "Reptile" }, { label: "Egg-layer" }],
	tiles: [
		{ id: "turtle", label: "Turtle", correctRegion: [0, 1] },
		{ id: "frog", label: "Frog", correctRegion: [1] },
	],
	scoringPolicy: "partialPerTile",
};

function demoModel(demo: DemoInfo, id: string, element: string): Model {
	const [model] = demo.item.config?.models ?? [];
	return { ...(model as Record<string, unknown>), id, element };
}

/** One item holding every model, each rendered by its element's package. */
function item(id: string, packages: Record<string, string>, models: Model[]) {
	const config: ItemConfig = {
		id,
		markup: models
			.map((model) => `<${model.element} id="${model.id}"></${model.element}>`)
			.join(""),
		elements: {},
		models,
	};
	for (const model of models) {
		config.elements[model.element] = packages[model.element];
	}
	return config;
}

type MountOptions = {
	id: string;
	config: ItemConfig;
	mode?: "author";
	loaderOptions?: Record<string, unknown>;
};

/** Mount an esm player and resolve with how its load ended. */
function mountPlayer(page: Page, options: MountOptions): Promise<string> {
	return page.evaluate(({ id, config, mode, loaderOptions }) => {
		const player = document.createElement("pie-item-player") as any;
		player.id = id;
		player.strategy = "esm";
		if (mode) player.mode = mode;
		if (loaderOptions) player.loaderOptions = loaderOptions;
		player.env =
			mode === "author"
				? { mode: "author", role: "instructor" }
				: { mode: "gather", role: "student" };
		player.session = { id: `${id}-session`, data: [] };
		document.body.appendChild(player);
		return new Promise<string>((resolve) => {
			player.addEventListener("load-complete", () => resolve("load-complete"), {
				once: true,
			});
			player.addEventListener(
				"player-error",
				(event: CustomEvent) =>
					resolve(`player-error: ${event.detail?.message ?? ""}`),
				{ once: true },
			);
			player.config = config;
		});
	}, options);
}

/** Give a mounted player its next item, as a single-page host does. */
function loadNextItem(page: Page, id: string, config: ItemConfig) {
	return page.evaluate(
		({ id, config }) => {
			const player = document.getElementById(id) as any;
			return new Promise<string>((resolve) => {
				player.addEventListener(
					"load-complete",
					() => resolve("load-complete"),
					{ once: true },
				);
				player.addEventListener(
					"player-error",
					(event: CustomEvent) =>
						resolve(`player-error: ${event.detail?.message ?? ""}`),
					{ once: true },
				);
				player.config = config;
			});
		},
		{ id, config },
	);
}

function track(page: Page) {
	const requests: string[] = [];
	const messages: string[] = [];
	page.on("request", (request) => requests.push(request.url()));
	page.on("console", (message) =>
		messages.push(`${message.type()}: ${message.text()}`),
	);
	return { requests, messages };
}

async function openHost(page: Page) {
	await page.goto(HOST_PATH, { waitUntil: "networkidle" });
	await expect(page.getByText("Boston Tea Party").first()).toBeVisible({
		timeout: 30_000,
	});
}

/**
 * Make a package declare another runtime version, on every base URL. The
 * page fetches the manifest, so the browser's certificate store applies.
 */
async function declareRuntimeVersion(
	page: Page,
	packageVersion: string,
	runtimeVersion: string,
) {
	const manifest = `/${packageVersion}/package.json`;
	const json = await page.evaluate(
		async (url) => (await fetch(url)).json(),
		`${JSDELIVR}${manifest}`,
	);
	json.pie.browserEditorRuntime.version = runtimeVersion;
	await page.route(
		(url) => url.pathname.endsWith(manifest),
		(route) =>
			route.fulfill({ json, headers: { "access-control-allow-origin": "*" } }),
	);
}

/** The editor runtimes this page's import maps record. */
function mappedRuntimes(page: Page) {
	return page.evaluate(() =>
		[
			...document.querySelectorAll(
				'script[type="importmap"][data-pie-editor-runtime]',
			),
		].map((script) => script.getAttribute("data-pie-editor-runtime")),
	);
}

/**
 * The ProseMirror editors on the page, per element tag, and how many
 * ProseMirror copies drive them.
 */
function editors(page: Page) {
	return page.evaluate(() => {
		const found: Element[] = [];
		const walk = (root: Document | ShadowRoot) => {
			found.push(...root.querySelectorAll(".ProseMirror"));
			for (const node of root.querySelectorAll("*")) {
				if (node.shadowRoot) walk(node.shadowRoot);
			}
		};
		walk(document);
		const copies: unknown[] = [];
		const hosts: Record<string, number> = {};
		for (const editor of found) {
			const viewDesc = (editor as any).pmViewDesc;
			if (viewDesc && !copies.includes(viewDesc.constructor)) {
				copies.push(viewDesc.constructor);
			}
			let node: any = editor;
			while (node && !node.localName?.includes("--version-")) {
				node = node.parentNode ?? node.host ?? null;
			}
			const tag = String(node?.localName ?? "none").replace(
				/--version-.*?(-config)?$/,
				"$1",
			);
			hosts[tag] = (hosts[tag] ?? 0) + 1;
		}
		return { copies: copies.length, hosts };
	});
}

const editorRuntimeWarnings = (messages: string[]) =>
	messages.filter(
		(message) =>
			message.includes("[pie-esm]") ||
			message.includes("prosemirror-model is loaded more than once"),
	);

test.describe("esm strategy — shared editor runtime", () => {
	test.describe.configure({ timeout: 120_000 });

	test("React and Svelte editor elements share one runtime across views", async ({
		page,
	}) => {
		const { requests, messages } = track(page);
		await openHost(page);

		const authored = item(
			"editor-runtime-author",
			{
				"multiple-choice": MC,
				"extended-text-entry": ETE,
				"simple-cloze": CLOZE,
				"venn-classification": VENN,
			},
			[
				demoModel(multipleChoice, "mc", "multiple-choice"),
				demoModel(extendedTextEntry, "ete", "extended-text-entry"),
				CLOZE_MODEL,
				VENN_MODEL,
			],
		);
		expect(
			await mountPlayer(page, {
				id: "author",
				mode: "author",
				config: authored,
			}),
		).toBe("load-complete");
		for (const pkg of [MC, ETE, CLOZE, VENN]) {
			expect(requests).toContain(
				`${JSDELIVR}/${pkg}/dist/browser/editor-runtime/author/index.js`,
			);
			expect(requests).not.toContain(
				`${JSDELIVR}/${pkg}/dist/browser/author/index.js`,
			);
		}

		// The delivery view is a second backend on the same page.
		const delivered = item(
			"editor-runtime-delivery",
			{
				"extended-text-entry": ETE,
				"explicit-constructed-response": ECR,
			},
			[
				demoModel(extendedTextEntry, "ete", "extended-text-entry"),
				demoModel(
					explicitConstructedResponse,
					"ecr",
					"explicit-constructed-response",
				),
			],
		);
		expect(await mountPlayer(page, { id: "delivery", config: delivered })).toBe(
			"load-complete",
		);
		for (const pkg of [ETE, ECR]) {
			expect(requests).toContain(
				`${JSDELIVR}/${pkg}/dist/browser/editor-runtime/delivery/index.js`,
			);
		}

		await expect
			.poll(async () => Object.keys((await editors(page)).hosts).sort(), {
				timeout: 30_000,
			})
			.toEqual([
				"explicit-constructed-response",
				"extended-text-entry",
				"extended-text-entry-config",
				"multiple-choice-config",
				"simple-cloze-config",
				"venn-classification-config",
			]);
		expect((await editors(page)).copies).toBe(1);

		expect(
			requests.filter((url) => url.endsWith(`/${RUNTIME}/package.json`)),
		).toHaveLength(1);
		const runtimeModules = requests.filter((url) =>
			url.startsWith(`${JSDELIVR}/${RUNTIME}/dist/browser/`),
		);
		expect(runtimeModules.length).toBeGreaterThan(0);
		expect(new Set(runtimeModules).size).toBe(runtimeModules.length);
		expect(await mappedRuntimes(page)).toEqual([RUNTIME]);
		expect(editorRuntimeWarnings(messages)).toEqual([]);
	});

	test("elements published before the editor runtime render beside ones that declare it", async ({
		page,
	}) => {
		const { requests, messages } = track(page);
		await openHost(page);

		const mixed = item(
			"editor-runtime-mixed",
			{
				"multiple-choice": MC_BEFORE_RUNTIME,
				"extended-text-entry": ETE,
			},
			[
				demoModel(multipleChoice, "mc", "multiple-choice"),
				demoModel(extendedTextEntry, "ete", "extended-text-entry"),
			],
		);
		expect(await mountPlayer(page, { id: "mixed", config: mixed })).toBe(
			"load-complete",
		);

		expect(requests).toContain(
			`${JSDELIVR}/${MC_BEFORE_RUNTIME}/dist/browser/delivery/index.js`,
		);
		expect(requests).toContain(
			`${JSDELIVR}/${ETE}/dist/browser/editor-runtime/delivery/index.js`,
		);
		const player = page.locator("#mixed");
		await expect(player.getByRole("radio").first()).toBeVisible();
		await expect(player.locator(".ProseMirror").first()).toBeVisible();
		await expect(page.getByText("Boston Tea Party").first()).toBeVisible();
		expect(editorRuntimeWarnings(messages)).toEqual([]);
	});

	test("an element needing a newer runtime than the page maps loads ./browser/*", async ({
		page,
	}) => {
		const NEWER = "0.1.1-next.1";
		const { requests, messages } = track(page);
		await openHost(page);
		await declareRuntimeVersion(page, ECR, NEWER);
		await declareRuntimeVersion(page, EBSR, NEWER);

		// The first item maps the runtime its element declares.
		expect(
			await mountPlayer(page, {
				id: "spa",
				config: item("first", { "extended-text-entry": ETE }, [
					demoModel(extendedTextEntry, "ete", "extended-text-entry"),
				]),
			}),
		).toBe("load-complete");
		expect(await mappedRuntimes(page)).toEqual([RUNTIME]);

		// The next item, through the same backend, needs a newer runtime.
		expect(
			await loadNextItem(
				page,
				"spa",
				item("second", { "explicit-constructed-response": ECR }, [
					demoModel(
						explicitConstructedResponse,
						"ecr",
						"explicit-constructed-response",
					),
				]),
			),
		).toBe("load-complete");
		expect(requests).toContain(
			`${JSDELIVR}/${ECR}/dist/browser/delivery/index.js`,
		);
		expect(requests).not.toContain(
			`${JSDELIVR}/${ECR}/dist/browser/editor-runtime/delivery/index.js`,
		);
		await expect(
			page.locator("#spa").getByText("Complete the sentence"),
		).toBeVisible();

		// Another CDN base URL gets a backend of its own, which reads the
		// runtime the page maps: it serves one element and not the other.
		expect(
			await mountPlayer(page, {
				id: "mirror",
				loaderOptions: { esmCdnUrl: MIRROR },
				config: item("third", { "multiple-choice": MC, "ebsr-element": EBSR }, [
					demoModel(multipleChoice, "mc", "multiple-choice"),
					demoModel(ebsr, "ebsr", "ebsr-element"),
				]),
			}),
		).toBe("load-complete");
		expect(requests).toContain(
			`${MIRROR}/${MC}/dist/browser/editor-runtime/delivery/index.js`,
		);
		expect(requests).toContain(
			`${MIRROR}/${EBSR}/dist/browser/delivery/index.js`,
		);
		await expect(
			page.locator("#mirror").getByRole("radio").first(),
		).toBeVisible();

		expect(await mappedRuntimes(page)).toEqual([RUNTIME]);
		expect(
			requests.filter((url) =>
				url.includes("/@pie-element/shared-editor-runtime@"),
			),
		).not.toContainEqual(expect.stringContaining(NEWER));
		expect(
			requests.filter(
				(url) =>
					url.includes("/@pie-element/shared-editor-runtime@") &&
					url.endsWith("/package.json"),
			),
		).toEqual([`${JSDELIVR}/${RUNTIME}/package.json`]);
		const cannotServe = `the page maps ${RUNTIME}, which cannot serve @pie-element/shared-editor-runtime@${NEWER}`;
		expect(editorRuntimeWarnings(messages)).toEqual([
			expect.stringContaining(
				`[pie-esm] ${ECR} loads ./browser/* in place of its editor-runtime variant: ${cannotServe}`,
			),
			expect.stringContaining(
				`[pie-esm] ${EBSR} loads ./browser/* in place of its editor-runtime variant: ${cannotServe}`,
			),
		]);
	});

	test("a runtime that cannot be fetched falls back to ./browser/*", async ({
		page,
	}) => {
		await page.route(`${JSDELIVR}/${RUNTIME}/dist/browser/**`, (route) =>
			route.abort(),
		);
		const { requests, messages } = track(page);
		await openHost(page);

		expect(
			await mountPlayer(page, {
				id: "author",
				mode: "author",
				config: item("unreachable-runtime", { "multiple-choice": MC }, [
					demoModel(multipleChoice, "mc", "multiple-choice"),
				]),
			}),
		).toBe("load-complete");
		expect(requests).toContain(
			`${JSDELIVR}/${MC}/dist/browser/editor-runtime/author/index.js`,
		);
		expect(requests).toContain(
			`${JSDELIVR}/${MC}/dist/browser/author/index.js`,
		);
		await expect
			.poll(async () => (await editors(page)).hosts, { timeout: 30_000 })
			.toHaveProperty("multiple-choice-config");
		expect(editorRuntimeWarnings(messages)).toEqual([
			expect.stringContaining(
				`[pie-esm] ${MC} loads ./browser/* in place of its editor-runtime variant: its editor-runtime author view failed to load`,
			),
		]);
	});

	test("import-map resolution keeps loading ./browser/*", async ({ page }) => {
		const { requests, messages } = track(page);
		await openHost(page);

		expect(
			await mountPlayer(page, {
				id: "import-map",
				loaderOptions: { moduleResolution: "import-map" },
				config: item("import-map", { "extended-text-entry": ETE }, [
					demoModel(extendedTextEntry, "ete", "extended-text-entry"),
				]),
			}),
		).toBe("load-complete");
		expect(requests).toContain(
			`${JSDELIVR}/${ETE}/dist/browser/delivery/index.js`,
		);
		expect(
			requests.filter((url) => url.includes("/dist/browser/editor-runtime/")),
		).toEqual([]);
		expect(
			requests.filter((url) =>
				url.includes("/@pie-element/shared-editor-runtime@"),
			),
		).toEqual([]);
		expect(await mappedRuntimes(page)).toEqual([]);
		expect(editorRuntimeWarnings(messages)).toEqual([]);
	});
});

// A variant bundles math rendering, as `./browser/*` does.
test.describe("esm strategy — math rendering", () => {
	test("editor-runtime variants typeset their LaTeX", async ({ page }) => {
		const { messages } = track(page);
		page.on("pageerror", (error) =>
			messages.push(`pageerror: ${error.message}`),
		);
		await openHost(page);

		expect(
			await mountPlayer(page, {
				id: "math",
				config: item(
					"math",
					{ "multiple-choice": MC, "categorize-element": CATEGORIZE },
					[
						demoModel(multipleChoiceMath, "mc", "multiple-choice"),
						demoModel(categorizeMath, "categorize", "categorize-element"),
					],
				),
			}),
		).toBe("load-complete");
		for (const id of ["mc", "categorize"]) {
			await expect(
				page.locator(`#math [id="${id}"] mjx-container`).first(),
			).toBeVisible({ timeout: 30_000 });
		}
		expect(
			messages.filter((message) => message.includes("ASSISTIVEMML")),
		).toEqual([]);
	});
});

test.describe("esm strategy — views a package does not publish", () => {
	test("a missing author view is reported as missing", async ({ page }) => {
		const { messages } = track(page);
		await page.goto("/demo/match-list-default/author?player=esm", {
			waitUntil: "networkidle",
		});

		await expect
			.poll(() => messages, { timeout: 30_000 })
			.toContain(
				"error: [pie-esm] @pie-element/match-list@7.1.2-next.18 does not publish browser ESM export ./browser/author; use IIFE/preloaded mode or publish browser ESM artifacts first",
			);
		expect(
			messages.filter((message) =>
				message.includes("Shared dependency resolution failed"),
			),
		).toEqual([]);
	});
});
