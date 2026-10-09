import { expect, type Page, test } from "@playwright/test";

// Hosts reveal the item on `load-complete`, so its elements have rendered by
// then. Recorded from the page's first script, ahead of the demo's player.
const STRATEGIES = ["iife", "esm", "preloaded"] as const;

type AtLoadComplete = {
	/** The player's model elements, and how many had rendered. */
	elements: number;
	rendered: number;
	/** ms from mount to `load-complete`, for the player `mount` creates. */
	elapsed: number | null;
	/** ms after `load-complete` that the last element rendered: 0 if before. */
	renderLag: number | null;
};

async function recordLoadComplete(page: Page) {
	await page.addInitScript(() => {
		const hasContent = (element: Element) =>
			Boolean(
				element.firstElementChild ||
					element.shadowRoot?.firstChild ||
					element.textContent?.trim(),
			);
		// An element and every custom element it painted, as an ebsr paints
		// its parts, hold content.
		const rendered = (element: Element) =>
			hasContent(element) &&
			[...element.querySelectorAll("*")].every(
				(nested) =>
					!customElements.get(nested.localName) || hasContent(nested),
			);
		const records: Record<string, AtLoadComplete> = {};
		(window as any).__atLoadComplete = records;
		document.addEventListener(
			"load-complete",
			(event) => {
				const player = (event.target as Element).closest(
					"pie-item-player",
				) as (HTMLElement & { config?: any }) | null;
				if (!player) return;
				const at = performance.now();
				const key = player.id || "demo";
				if (records[key]) return;
				const models: Array<{ id: string }> = player.config?.models ?? [];
				const elements = models
					.map(({ id }) => player.querySelector(`[id="${id}"]`))
					.filter((element): element is Element => element !== null);
				const record: AtLoadComplete = {
					elements: elements.length,
					rendered: elements.filter(rendered).length,
					elapsed: (window as any).__mountedAt
						? at - (window as any).__mountedAt
						: null,
					renderLag: null,
				};
				records[key] = record;
				const settle = () => {
					if (!elements.every(rendered)) return false;
					record.renderLag = performance.now() - at;
					return true;
				};
				if (settle()) return;
				const observer = new MutationObserver(() => {
					if (settle()) observer.disconnect();
				});
				observer.observe(player, { childList: true, subtree: true });
			},
			true,
		);
	});
}

async function atLoadComplete(page: Page, key: string) {
	await expect
		.poll(
			() => page.evaluate((key) => (window as any).__atLoadComplete[key], key),
			{ message: `load-complete emitted by ${key}`, timeout: 30_000 },
		)
		.toBeTruthy();
	return page.evaluate(
		(key) => (window as any).__atLoadComplete[key] as AtLoadComplete,
		key,
	);
}

/** The record once the player's elements have rendered, whenever that was. */
async function onceRendered(page: Page, key: string) {
	await atLoadComplete(page, key);
	await expect
		.poll(
			() =>
				page.evaluate(
					(key) => (window as any).__atLoadComplete[key].renderLag,
					key,
				),
			{ message: `elements of ${key} rendered` },
		)
		.not.toBeNull();
	return atLoadComplete(page, key);
}

async function openDemo(page: Page, demoId: string, strategy: string) {
	await recordLoadComplete(page);
	await page.goto(
		`/demo/${demoId}/delivery?mode=gather&role=student&player=${strategy}`,
		{ waitUntil: "domcontentloaded" },
	);
}

/** A second player with the demo's config, once the demo's player has loaded. */
async function mount(page: Page, strategy: string) {
	await atLoadComplete(page, "demo");
	await page.evaluate((strategy) => {
		const source = document.querySelector("pie-item-player") as any;
		const player = document.createElement("pie-item-player") as any;
		player.id = "mounted";
		player.strategy = strategy;
		player.env = { mode: "gather", role: "student" };
		player.session = { id: "mounted", data: [] };
		player.config = source.config;
		(window as any).__mountedAt = performance.now();
		document.body.appendChild(player);
	}, strategy);
}

for (const strategy of STRATEGIES) {
	for (const demoId of ["multiple-choice-radio-simple", "ebsr-default"]) {
		test(`${strategy} emits load-complete once the elements of ${demoId} have rendered`, async ({
			page,
		}) => {
			const errors: string[] = [];
			page.on("pageerror", (error) => errors.push(error.message));
			await openDemo(page, demoId, strategy);
			// On first load, and again with every bundle already loaded.
			const first = await onceRendered(page, "demo");
			await mount(page, strategy);
			const again = await onceRendered(page, "mounted");
			console.log(`[${strategy}] ${demoId}`, { first, again });
			for (const atLoad of [first, again]) {
				expect(atLoad.elements).toBe(1);
				expect(atLoad.rendered).toBe(1);
			}
			expect(errors).toEqual([]);
		});
	}

	// A rubric renders nothing for a student, which holds `load-complete` for
	// the quiet window and not for the bound.
	test(`${strategy} does not hold load-complete for an element that renders nothing`, async ({
		page,
	}) => {
		await openDemo(page, "rubric-default", strategy);
		await mount(page, strategy);
		const atLoad = await atLoadComplete(page, "mounted");
		console.log(`[${strategy}] rubric-default`, atLoad);
		expect(atLoad.elements).toBe(1);
		expect(atLoad.rendered).toBe(0);
		expect(atLoad.elapsed).toBeLessThan(1000);
	});
}
