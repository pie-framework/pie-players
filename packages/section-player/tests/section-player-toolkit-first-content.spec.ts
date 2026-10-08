import { expect, test, type Page } from "@playwright/test";

/**
 * A toolkit's first content is its section, or without one the first item scope
 * that registers. Its coordinator starts there, and the inputs it was built from
 * are fixed there: a change before is rebuilt into it, a change after is
 * reported, and a registry given to a toolkit that had none is adopted in place.
 * Toolkits without a section are built on the calculator-pnp page, which defines
 * the elements, with its toolkit's registry. Their readiness is the coordinator's:
 * the toolkit emits no stage events.
 */

const LATE_INPUTS_WARNING = "changed after an item registered";
const EMPTY_REGISTRY_WARNING = "[pie-item-toolbar]";

type ProbeLog = { coordinators: unknown[]; stages: string[] };

declare global {
	interface Window {
		__probe?: ProbeLog;
		__appendProbeScope?: () => void;
		__bindProbeSection?: () => void;
	}
}

function collectWarnings(page: Page, fragment: string): string[] {
	const warnings: string[] = [];
	page.on("console", (message) => {
		if (message.type() === "warning" && message.text().includes(fragment)) {
			warnings.push(message.text());
		}
	});
	return warnings;
}

async function gotoPage(page: Page, options: { clock?: boolean } = {}) {
	// The clock runs naturally until a test jumps it forward.
	if (options.clock) await page.clock.install();
	await page.goto("/calculator-pnp", { waitUntil: "networkidle" });
	await page.evaluate(() => {
		const log: ProbeLog = { coordinators: [], stages: [] };
		window.__probe = log;
		const fromProbe = (event: Event) =>
			(event.composedPath()[0] as HTMLElement).dataset?.probe === "toolkit";
		document.addEventListener("runtime-ready", (event) => {
			if (!fromProbe(event)) return;
			log.coordinators.push((event as CustomEvent<{ coordinator: unknown }>).detail.coordinator);
		});
		document.addEventListener("pie-stage-change", (event) => {
			if (!fromProbe(event)) return;
			const { stage, status } = (event as CustomEvent<{ stage: string; status: string }>)
				.detail;
			log.stages.push(`${stage}:${status}`);
		});
		window.__appendProbeScope = () => {
			const pageScope = document.querySelector("pie-item-scope") as unknown as {
				item: unknown;
			};
			const scope = document.createElement("pie-item-scope") as HTMLElement & {
				item: unknown;
			};
			scope.dataset.probe = "scope";
			scope.setAttribute("item-id", "first-content-item");
			scope.item = pageScope.item;
			scope.innerHTML =
				'<pie-item-toolbar></pie-item-toolbar><div data-region="content"><p>Words to read.</p></div>';
			document.querySelector('[data-probe="toolkit"]')?.append(scope);
		};
	});
}

/** Appends a toolkit without a section, its scope too when `scope` is set. */
function mountToolkit(
	page: Page,
	options: { tools?: unknown; registry?: boolean; scope?: boolean },
) {
	return page.evaluate(({ tools, registry, scope }) => {
		const pageToolkit = document.querySelector("pie-assessment-toolkit") as unknown as {
			toolRegistry: unknown;
		};
		const toolkit = document.createElement("pie-assessment-toolkit") as HTMLElement & {
			tools: unknown;
			toolRegistry: unknown;
		};
		toolkit.dataset.probe = "toolkit";
		toolkit.setAttribute("assessment-id", "first-content");
		if (tools) toolkit.tools = tools;
		if (registry) toolkit.toolRegistry = pageToolkit.toolRegistry;
		document.body.append(toolkit);
		if (scope) window.__appendProbeScope?.();
	}, options);
}

const setProbeInput = (page: Page, name: "tools" | "toolRegistry", value?: unknown) =>
	page.evaluate(
		({ name, value }) => {
			const toolkit = document.querySelector('[data-probe="toolkit"]') as unknown as Record<
				string,
				unknown
			>;
			toolkit[name] =
				name === "toolRegistry"
					? (document.querySelector("pie-assessment-toolkit") as unknown as {
							toolRegistry: unknown;
						}).toolRegistry
					: value;
		},
		{ name, value },
	);

const probeLog = (page: Page) =>
	page.evaluate(() => ({
		coordinators: window.__probe?.coordinators.length ?? 0,
		stages: window.__probe?.stages ?? [],
	}));

const coordinatorReady = (page: Page) =>
	page.evaluate(() => {
		const coordinator = window.__probe?.coordinators.at(-1) as
			| { isReady(): boolean }
			| undefined;
		return coordinator?.isReady() ?? false;
	});

const ttsStarted = (page: Page) =>
	page.evaluate(() => {
		const coordinator = window.__probe?.coordinators.at(-1) as
			| { getInitStatus(): { tts: boolean } }
			| undefined;
		return coordinator?.getInitStatus().tts ?? null;
	});

const playReading = (page: Page) =>
	page
		.locator('[data-probe="scope"] pie-item-toolbar')
		.getByRole("button", { name: "Play reading" });

test.describe("a toolkit without a section", () => {
	test("starts its coordinator at the first item scope that registers", async ({ page }) => {
		await gotoPage(page);
		await mountToolkit(page, { registry: true });
		await expect.poll(async () => (await probeLog(page)).coordinators).toBe(1);
		await page.waitForTimeout(500);
		expect(await coordinatorReady(page)).toBe(false);
		expect(await ttsStarted(page)).toBe(false);

		await page.evaluate(() => window.__appendProbeScope?.());

		await expect.poll(() => coordinatorReady(page)).toBe(true);
		expect(await ttsStarted(page)).toBe(true);
		expect(await probeLog(page)).toEqual({ coordinators: 1, stages: [] });
	});

	test("binds its first item to a coordinator built from inputs changed before it", async ({
		page,
	}) => {
		const late = collectWarnings(page, LATE_INPUTS_WARNING);
		await gotoPage(page);
		await mountToolkit(page, { registry: true, tools: { placement: { item: [] } } });
		await expect.poll(async () => (await probeLog(page)).coordinators).toBe(1);

		await setProbeInput(page, "tools", { placement: { item: ["textToSpeech"] } });
		await page.evaluate(() => window.__appendProbeScope?.());

		await expect(playReading(page)).toBeVisible({ timeout: 30_000 });
		await expect.poll(() => coordinatorReady(page)).toBe(true);
		expect(late).toEqual([]);
	});

	test("adopts a registry set after its first item in place", async ({ page }) => {
		const empty = collectWarnings(page, EMPTY_REGISTRY_WARNING);
		const late = collectWarnings(page, LATE_INPUTS_WARNING);
		await gotoPage(page, { clock: true });
		await mountToolkit(page, {
			tools: { placement: { item: ["textToSpeech"] } },
			scope: true,
		});
		await expect.poll(() => coordinatorReady(page)).toBe(true);
		await expect(playReading(page)).toHaveCount(0);

		await setProbeInput(page, "toolRegistry");

		await expect(playReading(page)).toBeVisible({ timeout: 30_000 });
		await page.clock.fastForward(11_000);
		await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 0)));
		expect(empty).toEqual([]);
		expect(late).toEqual([]);
		expect((await probeLog(page)).coordinators).toBe(1);
	});

	test("warns about an empty registry once, after 10 s", async ({ page }) => {
		const empty = collectWarnings(page, EMPTY_REGISTRY_WARNING);
		await gotoPage(page, { clock: true });
		await mountToolkit(page, {
			tools: { placement: { item: ["textToSpeech"] } },
			scope: true,
		});
		await expect.poll(() => coordinatorReady(page)).toBe(true);

		await page.clock.fastForward(8_000);
		expect(empty).toEqual([]);
		await page.clock.fastForward(3_000);
		await expect.poll(() => empty.length).toBe(1);
		expect(empty[0]).toContain("textToSpeech");
	});

	test("reports a tools change after its first item once", async ({ page }) => {
		const late = collectWarnings(page, LATE_INPUTS_WARNING);
		await gotoPage(page);
		await mountToolkit(page, {
			registry: true,
			tools: { placement: { item: ["textToSpeech"] } },
			scope: true,
		});
		await expect(playReading(page)).toBeVisible({ timeout: 30_000 });

		await setProbeInput(page, "tools", { placement: { item: [] } });
		await setProbeInput(page, "tools", {
			placement: { item: ["textToSpeech", "answerEliminator"] },
		});

		await expect.poll(() => late.length).toBe(1);
		expect(late[0]).toContain("tools");
		await page.waitForTimeout(250);
		expect(late).toHaveLength(1);
		expect((await probeLog(page)).coordinators).toBe(1);
		await expect(playReading(page)).toBeVisible();
	});
});

test("a section player mounted before its section starts text-to-speech at the first composition", async ({
	page,
}) => {
	await page.goto("/shadow-reading?mode=candidate&layout=splitpane", {
		waitUntil: "networkidle",
	});
	await expect(page.getByText("Words inside a shadow root.")).toBeVisible({
		timeout: 30_000,
	});
	await page.evaluate(() => {
		const existing = document.querySelector("pie-section-player-splitpane") as HTMLElement & {
			runtime: Record<string, unknown>;
			section: unknown;
		};
		const parent = existing.parentElement;
		if (!parent) throw new Error("demo section player not found");
		// The demo passes its own coordinator, which starts read-aloud lazily. A host
		// that passes neither has the player build one that starts it at readiness.
		const {
			coordinator: _coordinator,
			lazyInit: _lazyInit,
			...runtime
		} = existing.runtime;
		const section = existing.section;
		existing.remove();

		const log: ProbeLog = { coordinators: [], stages: [] };
		window.__probe = log;
		document.addEventListener("runtime-ready", (event) => {
			log.coordinators.push((event as CustomEvent<{ coordinator: unknown }>).detail.coordinator);
		});
		const fresh = document.createElement("pie-section-player-splitpane") as HTMLElement & {
			runtime: unknown;
			section: unknown;
		};
		fresh.runtime = runtime;
		parent.append(fresh);
		window.__bindProbeSection = () => {
			fresh.section = section;
		};
	});
	await expect.poll(async () => (await probeLog(page)).coordinators).toBeGreaterThan(0);
	await page.waitForTimeout(1_000);
	expect(await ttsStarted(page)).toBe(false);

	await page.evaluate(() => window.__bindProbeSection?.());

	await expect.poll(() => ttsStarted(page), { timeout: 30_000 }).toBe(true);
});
