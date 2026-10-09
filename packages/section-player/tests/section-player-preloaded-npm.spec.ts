/**
 * The preloaded strategy as a host runs it: section-demos installs every
 * element the generated `@pie-players/pie-preloaded-player` builds carried from
 * one pie-elements-ng release, its bundler resolves their `./browser/*` builds,
 * and `/preloaded-npm-elements` registers all of them before the section
 * mounts. Nothing the players do may fetch element code.
 *
 * Runs in Chromium, Firefox and WebKit, in both layouts.
 */

import { expect, type Locator, type Page, test } from "@playwright/test";

const PATH = "/preloaded-npm-elements";
const LAYOUTS = ["splitpane", "vertical"] as const;
type Layout = (typeof LAYOUTS)[number];

// The base tag each package registers under, as configs/preloaded-player/*.json
// give it.
const REGISTERED_TAGS = {
	"@pie-element/categorize": "pie-element-categorize",
	"@pie-element/drag-in-the-blank": "drag-in-the-blank",
	"@pie-element/hotspot": "hotspot",
	"@pie-element/image-cloze-association": "image-cloze-association",
	"@pie-element/multiple-choice": "pie-element-multiple-choice",
	"@pie-element/mc-populated-blank": "mc-populated-blank",
	"@pie-element/passage": "pie-element-passage",
	"@pie-element/ebsr": "pie-esbr",
} as const;
type PackageName = keyof typeof REGISTERED_TAGS;

// Each item's element, by the id the content gives it, and its package.
const ITEMS: Record<string, PackageName> = {
	"npm-multiple-choice": "@pie-element/multiple-choice",
	"npm-ebsr": "@pie-element/ebsr",
	"npm-categorize": "@pie-element/categorize",
	"npm-drag-in-the-blank": "@pie-element/drag-in-the-blank",
	"npm-hotspot": "@pie-element/hotspot",
	"npm-image-cloze-association": "@pie-element/image-cloze-association",
	"npm-mc-populated-blank": "@pie-element/mc-populated-blank",
	"npm-other-base-tag": "@pie-element/multiple-choice",
	"npm-older-version": "@pie-element/categorize",
	"npm-newer-version": "@pie-element/drag-in-the-blank",
};
const PASSAGE_ELEMENT = "npm-passage-element";

// What element code and controllers would come from, were the page not
// carrying them: PITS bundles, and npm packages on a CDN or through the local
// ESM CDN's routes.
const ELEMENT_CODE_REQUEST =
	/\/bundles\/|\/(?:npm\/)?@pie-(?:element|lib|elements-ng)\/|esm\.sh\/|unpkg\.com\//;
// MathJax 3, or the players' renderer module that installs it.
const LEGACY_MATH_REQUEST =
	/mathjax@3|mathjax-full|math-rendering-module|\/es5\/tex-/;
const MATHJAX_4_SCRIPT = /mathjax@4[^/]*\/tex-mml-chtml\.js/;

type HostLogEntry = {
	channel: string;
	itemId?: string;
	elementId?: string;
	sectionId?: string;
	component?: unknown;
	complete?: unknown;
	reason?: unknown;
	at: number;
};

type Recorded = {
	controllerCalls: Array<{ tag: string; method: string }>;
	frameworkErrors: Array<{ kind?: string }>;
	stages: string[];
	mathJaxConflicts: unknown[];
};

declare global {
	interface Window {
		__hostLog?: HostLogEntry[];
		__pieNpmRecorded?: Recorded;
	}
}

/**
 * Before any page script: count every controller call the players make
 * through `window.PIE_REGISTRY`, and record framework errors, stages and
 * MathJax conflicts wherever they are dispatched.
 */
async function recordPage(page: Page) {
	await page.addInitScript(() => {
		const recorded: Recorded = {
			controllerCalls: [],
			frameworkErrors: [],
			stages: [],
			mathJaxConflicts: [],
		};
		window.__pieNpmRecorded = recorded;
		const WRAPPED = Symbol.for("pie-npm-spec/wrapped");
		type Controller = Record<string | symbol, unknown>;
		const wrap = (tag: string, controller: Controller): Controller => {
			if (controller[WRAPPED]) return controller;
			const counted: Controller = { ...controller, [WRAPPED]: true };
			for (const method of ["model", "outcome"]) {
				const original = controller[method];
				if (typeof original !== "function") continue;
				counted[method] = (...args: unknown[]) => {
					recorded.controllerCalls.push({ tag, method });
					return (original as (...a: unknown[]) => unknown).apply(controller, args);
				};
			}
			return counted;
		};
		(window as unknown as { PIE_REGISTRY: unknown }).PIE_REGISTRY = new Proxy(
			{} as Record<string, { controller?: Controller }>,
			{
				set(target, tag, entry) {
					target[tag as string] =
						entry?.controller && typeof tag === "string"
							? { ...entry, controller: wrap(tag, entry.controller) }
							: entry;
					return true;
				},
			},
		);
		const dispatch = EventTarget.prototype.dispatchEvent;
		EventTarget.prototype.dispatchEvent = function (event: Event) {
			const detail = (event as CustomEvent).detail;
			if (event.type === "framework-error") {
				recorded.frameworkErrors.push({ kind: detail?.kind });
			} else if (event.type === "pie-stage-change") {
				recorded.stages.push(String(detail?.stage));
			} else if (event.type === "pie-mathjax-version-conflict") {
				recorded.mathJaxConflicts.push(detail ?? true);
			}
			return dispatch.call(this, event);
		};
	});
}

type Traffic = {
	elementCode: string[];
	legacyMath: string[];
	mathJax4Scripts: string[];
	pageModules: string[];
	consoleErrors: string[];
	reactWarnings: string[];
};

function watchTraffic(page: Page, baseURL: string): Traffic {
	const traffic: Traffic = {
		elementCode: [],
		legacyMath: [],
		mathJax4Scripts: [],
		pageModules: [],
		consoleErrors: [],
		reactWarnings: [],
	};
	page.on("request", (request) => {
		const url = request.url();
		if (LEGACY_MATH_REQUEST.test(url)) traffic.legacyMath.push(url);
		if (MATHJAX_4_SCRIPT.test(url)) traffic.mathJax4Scripts.push(url);
		if (url.startsWith(`${baseURL}/`)) {
			// The dev server serves the app's own modules, the bundled elements
			// among them; only the local ESM CDN's routes start at the package.
			const { pathname } = new URL(url);
			if (/^\/@pie-(?:element|lib|elements-ng)\/|\/bundles\//.test(pathname)) {
				traffic.elementCode.push(url);
			} else if (/@pie-element[_/+]/.test(pathname)) {
				traffic.pageModules.push(url);
			}
		} else if (ELEMENT_CODE_REQUEST.test(url)) {
			traffic.elementCode.push(url);
		}
	});
	page.on("console", (message) => {
		if (message.type() !== "error") return;
		const text = message.text();
		// React's development build reports component warnings through
		// console.error; they come from the element builds and are tallied
		// separately so a real error stays visible.
		if (text.startsWith("Warning: ")) traffic.reactWarnings.push(text.split("\n")[0]);
		else traffic.consoleErrors.push(text);
	});
	page.on("pageerror", (error) => traffic.consoleErrors.push(`pageerror: ${error.message}`));
	return traffic;
}

function recorded(page: Page): Promise<Recorded> {
	return page.evaluate(() => window.__pieNpmRecorded as Recorded);
}

function hostLog(page: Page): Promise<HostLogEntry[]> {
	return page.evaluate(() => window.__hostLog ?? []);
}

function layoutTag(layout: Layout) {
	return `pie-section-player-${layout}`;
}

/** The versioned tag the players define for a package's registered version. */
async function registeredVersionedTags(page: Page): Promise<Record<PackageName, string>> {
	const specs = await page.evaluate(
		() => (window as unknown as { PIE_PRELOADED_ELEMENTS: Record<string, string> }).PIE_PRELOADED_ELEMENTS,
	);
	const tags = {} as Record<PackageName, string>;
	for (const [name, base] of Object.entries(REGISTERED_TAGS) as Array<[PackageName, string]>) {
		const version = String(specs[name] ?? "").slice(name.length + 1);
		expect(version, `${name} is not registered`).not.toBe("");
		tags[name] = `${base}--version-${version.replace(/[.+]/g, "-")}`;
	}
	return tags;
}

async function openDemo(
	page: Page,
	layout: Layout,
	query: Record<string, string> = {},
) {
	const params = new URLSearchParams({ mode: "candidate", layout, ...query });
	await page.goto(`${PATH}?${params}`, { waitUntil: "domcontentloaded" });
	const player = page.locator(layoutTag(layout));
	await expect(player).toBeVisible({ timeout: 45_000 });
	for (const id of Object.keys(ITEMS)) {
		await expect(player.locator(`#${id}-element`)).toBeVisible({ timeout: 45_000 });
	}
	await expect(player.locator(`#${PASSAGE_ELEMENT}`)).toBeVisible();
	await expect
		.poll(async () => (await recorded(page)).stages, { timeout: 30_000 })
		.toContain("interactive");
	return player;
}

/**
 * A pointer drag in small steps, which @dnd-kit's pointer sensor follows in
 * every engine. It measures the drop targets once the drag activates, so the
 * pointer waits there, and over the target before the drop.
 */
async function drag(page: Page, source: Locator, target: Locator) {
	// The source and the target centred in their scroll pane together: a
	// pointer near the pane's edge starts @dnd-kit's auto-scroll, which moves
	// the target away mid-drag.
	await source.evaluate((element) => element.scrollIntoView({ block: "center" }));
	const sourceBox = await source.boundingBox();
	const targetBox = await target.boundingBox();
	if (sourceBox && targetBox) {
		const middle = (sourceBox.y + sourceBox.height / 2 + targetBox.y + targetBox.height / 2) / 2;
		const offset = middle - (page.viewportSize()?.height ?? 720) / 2;
		if (Math.abs(offset) > 20) {
			await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
			await page.mouse.wheel(0, offset);
			await page.waitForTimeout(200);
		}
	}
	const box = await source.boundingBox();
	if (!box) throw new Error("drag source has no box");
	// Near the chip's edge, off any formula it holds: MathJax handles the
	// pointer on its own output.
	const from = { x: box.x + Math.min(6, box.width / 4), y: box.y + box.height / 2 };
	await page.mouse.move(from.x, from.y);
	await page.mouse.down();
	await page.mouse.move(from.x + 12, from.y + 12, { steps: 4 });
	await page.waitForTimeout(200);
	const to = await target.boundingBox();
	if (!to) throw new Error("drop target has no box");
	await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
	await page.mouse.move(to.x + to.width / 2 + 1, to.y + to.height / 2 + 1, { steps: 2 });
	await page.waitForTimeout(200);
	await page.mouse.up();
}

const draggables = (element: Locator) => element.locator('[aria-roledescription="draggable"]');
// A button that is not a draggable, or, in a categorize build that groups its
// drop zones instead, a category's group.
const dropTargets = (element: Locator) =>
	element.locator(
		'[role="button"]:not([aria-roledescription="draggable"]), [data-category-id] > [role="group"]',
	);

/** Click a choice, then wait for the element's re-render to check it. */
async function choose(choice: Locator) {
	await choice.click();
	await expect(choice).toBeChecked();
}

/** One response on each item, the way a learner gives it. */
const ANSWER: Record<string, (page: Page, element: Locator) => Promise<void>> = {
	"npm-multiple-choice": (_page, element) => choose(element.getByRole("radio").nth(1)),
	"npm-ebsr": async (_page, element) => {
		await choose(element.getByRole("checkbox", { name: /Blue/ }));
		await choose(element.getByRole("checkbox", { name: /Purple/ }));
	},
	"npm-categorize": (page, element) =>
		drag(page, draggables(element).first(), dropTargets(element).first()),
	"npm-drag-in-the-blank": (page, element) =>
		drag(
			page,
			draggables(element).filter({ hasText: "Jupiter" }),
			dropTargets(element).first(),
		),
	// Each shape's button sits under the canvas, for keyboard users.
	"npm-hotspot": async (page, element) => {
		await element.locator('span[role="button"]').first().focus();
		await page.keyboard.press("Enter");
	},
	"npm-image-cloze-association": (page, element) =>
		drag(page, draggables(element).first(), dropTargets(element).first()),
	"npm-mc-populated-blank": (_page, element) => choose(element.getByRole("radio", { name: "teapot" })),
	"npm-other-base-tag": (_page, element) => choose(element.getByRole("radio", { name: /Jupiter/ })),
	"npm-older-version": (page, element) =>
		drag(page, draggables(element).first(), dropTargets(element).first()),
	"npm-newer-version": (page, element) =>
		drag(page, draggables(element).first(), dropTargets(element).first()),
};

for (const layout of LAYOUTS) {
	test.describe(`preloaded npm elements, ${layout}`, () => {
		// Ten items and a passage, each answered by a real pointer or keyboard.
		test.describe.configure({ timeout: 120_000 });
		// Tall enough for an image-cloze item's drop zones and chips together: the
		// pointer cannot reach a target scrolled out of the window mid-drag.
		test.use({ viewport: { width: 1280, height: 1100 } });

		test("renders every item and the passage from the page's own modules, each typesetting with its own MathJax 4", async ({
			page,
			baseURL,
		}) => {
			await recordPage(page);
			const traffic = watchTraffic(page, String(baseURL));
			const player = await openDemo(page, layout);
			const tags = await registeredVersionedTags(page);

			// Each item renders through its package's registered element: the
			// other-base-tag, older-version and newer-version items included.
			for (const [id, name] of Object.entries(ITEMS)) {
				const base = id === "npm-other-base-tag" ? "multiple-choice" : REGISTERED_TAGS[name];
				const versioned = tags[name].replace(REGISTERED_TAGS[name], base);
				await expect(player.locator(`${versioned}#${id}-element`), id).toBeVisible();
			}
			await expect(player.locator(`${tags["@pie-element/passage"]}#${PASSAGE_ELEMENT}`)).toBeVisible();
			// The players define the authored tag from the registered one.
			const otherBaseTag = await page.evaluate(
				({ authored, registered }) => {
					const other = customElements.get(authored);
					const own = customElements.get(registered);
					return !!other && !!own && Object.getPrototypeOf(other) === own;
				},
				{
					authored: tags["@pie-element/multiple-choice"].replace("pie-element-multiple-choice", "multiple-choice"),
					registered: tags["@pie-element/multiple-choice"],
				},
			);
			expect(otherBaseTag, "the other base tag is not defined from the registered element").toBe(true);

			// Each element typesets with the MathJax 4 its build carries: none is
			// fetched or installed on the page, and nothing loads MathJax 3.
			await expect(player.locator("#npm-multiple-choice-element mjx-container").first()).toBeVisible({
				timeout: 30_000,
			});
			await expect(player.locator("#npm-categorize-element mjx-container").first()).toBeVisible();
			expect(await page.evaluate(() => typeof (window as Record<string, unknown>).MathJax)).toBe("undefined");
			expect(await page.evaluate(() => typeof (window as Record<string, unknown>)["@pie-lib/math-rendering"])).toBe(
				"undefined",
			);
			expect(traffic.mathJax4Scripts).toEqual([]);
			expect(
				await page.locator('script[src*="tex-mml-chtml"]').count(),
				"an element added MathJax to the page",
			).toBe(0);
			expect(traffic.legacyMath).toEqual([]);

			// Past networkidle, so a late element load would have been seen.
			await page.waitForLoadState("networkidle");
			const { controllerCalls, frameworkErrors, mathJaxConflicts } = await recorded(page);
			expect(traffic.elementCode).toEqual([]);
			for (const name of Object.keys(REGISTERED_TAGS)) {
				expect(
					traffic.pageModules.some((url) => url.includes(name.replace("@pie-element/", ""))),
					`${name} did not come with the page's modules`,
				).toBe(true);
			}
			// Not hosted: the players built each model with its controller.
			expect(new Set(controllerCalls.filter((call) => call.method === "model").map((call) => call.tag)).size).toBeGreaterThanOrEqual(8);
			expect(frameworkErrors).toEqual([]);
			expect(mathJaxConflicts).toEqual([]);
			expect(traffic.consoleErrors).toEqual([]);
		});

		test("each answer reaches the host with its component and completeness, and a section switch leaves none behind", async ({
			page,
		}) => {
			await recordPage(page);
			const player = await openDemo(page, layout);

			for (const [id, answer] of Object.entries(ANSWER)) {
				const element = player.locator(`#${id}-element`);
				const before = (await hostLog(page)).length;
				await element.scrollIntoViewIfNeeded();
				await answer(page, element);
				await expect
					.poll(
						async () =>
							(await hostLog(page))
								.slice(before)
								.filter(
									(entry) =>
										entry.channel === "section:session-changed" &&
										entry.elementId === `${id}-element`,
								)
								.map((entry) => [typeof entry.component, typeof entry.complete]),
						{ message: `${id} announced no session-changed`, timeout: 15_000 },
					)
					.toContainEqual(["string", "boolean"]);
				const announced = (await hostLog(page))
					.slice(before)
					.filter((entry) => entry.elementId === `${id}-element` && entry.channel === "section:session-changed");
				expect(announced.every((entry) => entry.component !== ""), id).toBe(true);
			}

			// Answer the last item and navigate at once, as a learner who moves on.
			const lastItem = player.locator("#npm-other-base-tag-element");
			await choose(lastItem.getByRole("radio", { name: /Mars/ }));
			await page.locator("#host-next-section").click();
			await expect(page.getByTestId("host-current-section")).toHaveText("preloaded-npm-elements-next");
			// Past the old section's teardown, so a late event for the leaving item is caught.
			await page.waitForTimeout(2_000);

			const log = await hostLog(page);
			const sectionInputAt = log.findIndex((entry) => entry.channel === "host:section-input");
			expect(sectionInputAt, JSON.stringify(log)).toBeGreaterThan(0);
			const isLeaving = (entry: HostLogEntry) =>
				!entry.channel.startsWith("host:") &&
				(entry.elementId === "npm-other-base-tag-element" ||
					String(entry.itemId ?? "").startsWith("npm-other-base-tag"));
			expect(
				log.slice(0, sectionInputAt).filter((entry) => isLeaving(entry) && entry.channel === "section:session-changed"),
				"the last response had not reached the host when it navigated",
			).not.toHaveLength(0);
			expect(
				log.slice(sectionInputAt).filter(isLeaving),
				"the leaving item was announced after the section changed",
			).toEqual([]);
			expect(
				log.filter((entry) => isLeaving(entry) && entry.reason !== null),
				"a commit found the response still pending",
			).toEqual([]);
		});

		// Remount-and-hydrate: the host persists the section it leaves and mounts
		// a new player for the next, which restores a section's answers on return.
		test("the host's navigation mounts a player per section and restores answers on return", async ({
			page,
		}) => {
			await recordPage(page);
			const player = await openDemo(page, layout);
			const multipleChoice = () => player.locator("#npm-multiple-choice-element").getByRole("radio").nth(1);
			const blank = () =>
				player.locator("#npm-mc-populated-blank-element").getByRole("radio", { name: "teapot" });
			await choose(multipleChoice());
			await choose(blank());
			const first = await player.elementHandle();

			await page.locator("#host-next-section").click();
			await expect(page.getByTestId("host-current-section")).toHaveText("preloaded-npm-elements-next");
			await expect(player.locator("#npm-next-multiple-choice-element")).toBeVisible({ timeout: 30_000 });
			await expect(player.locator("#npm-multiple-choice-element")).toHaveCount(0);
			expect(await first?.evaluate((element) => element.isConnected), "the first section's player stayed mounted").toBe(false);

			await page.locator("#host-previous-section").click();
			await expect(page.getByTestId("host-current-section")).toHaveText("preloaded-npm-elements");
			await expect(player.locator("#npm-next-multiple-choice-element")).toHaveCount(0);
			await expect(multipleChoice()).toBeChecked({ timeout: 30_000 });
			await expect(blank()).toBeChecked();
			expect((await recorded(page)).frameworkErrors).toEqual([]);
		});

		test("hosted runs no controller in the browser", async ({ page }) => {
			await recordPage(page);
			await openDemo(page, layout, { hosted: "1" });
			await page.waitForLoadState("networkidle");
			const player = page.locator(layoutTag(layout));
			await choose(player.locator("#npm-mc-populated-blank-element").getByRole("radio", { name: "teapot" }));
			await page.waitForTimeout(1_000);
			const { controllerCalls, frameworkErrors } = await recorded(page);
			expect(controllerCalls).toEqual([]);
			expect(frameworkErrors).toEqual([]);
		});

		test("not hosted, an instructor sees each item's correct answer", async ({ page }) => {
			await recordPage(page);
			const player = await openDemo(page, layout, { mode: "scorer" });
			for (const id of Object.keys(ITEMS)) {
				await expect(
					player.locator(`#${id}-element`).getByText("Show correct answer").first(),
					id,
				).toBeVisible({ timeout: 15_000 });
			}
			// The controller's correct response, shown on request.
			const multipleChoice = player.locator("#npm-multiple-choice-element");
			await multipleChoice.getByText("Show correct answer").first().click();
			await expect(multipleChoice.getByRole("radio").nth(1)).toBeChecked();
			const { controllerCalls, frameworkErrors } = await recorded(page);
			expect(controllerCalls.some((call) => call.method === "model")).toBe(true);
			expect(frameworkErrors).toEqual([]);
		});

		test("content naming an unregistered element reports element-preload and holds readiness", async ({
			page,
		}) => {
			await recordPage(page);
			await openDemo(page, layout);
			await page.evaluate((tag) => {
				const existing = document.querySelector(tag) as (HTMLElement & { section?: unknown }) | null;
				if (!existing?.parentElement) throw new Error("demo section player not found");
				const section = JSON.parse(JSON.stringify(existing.section)) as {
					identifier: string;
					assessmentItemRefs: unknown[];
				};
				section.identifier = "npm-unregistered";
				section.assessmentItemRefs.push({
					identifier: "npm-unregistered-ref",
					required: true,
					item: {
						id: "npm-unregistered-item",
						baseId: "npm-unregistered-item",
						version: { major: 1, minor: 0, patch: 0 },
						name: "Unregistered element",
						config: {
							markup: '<match-element id="npm-unregistered"></match-element>',
							elements: { "match-element": "@pie-element/match@1.0.0" },
							models: [{ id: "npm-unregistered", element: "match-element" }],
						},
					},
				});
				const events: Array<{ type: string; kind?: string; stage?: string; status?: string }> = [];
				(window as unknown as { __npmFreshEvents: typeof events }).__npmFreshEvents = events;
				const parent = existing.parentElement;
				existing.remove();
				const fresh = document.createElement(tag) as HTMLElement & {
					runtime?: unknown;
					section?: unknown;
				};
				fresh.setAttribute("section-id", section.identifier);
				fresh.setAttribute("attempt-id", `npm-${Date.now()}`);
				fresh.addEventListener("pie-stage-change", (event) =>
					events.push({
						type: "pie-stage-change",
						stage: (event as CustomEvent).detail?.stage,
						status: (event as CustomEvent).detail?.status,
					}),
				);
				fresh.addEventListener("pie-loading-complete", () => events.push({ type: "pie-loading-complete" }));
				fresh.addEventListener("framework-error", (event) =>
					events.push({ type: "framework-error", kind: (event as CustomEvent).detail?.kind }),
				);
				fresh.runtime = {
					assessmentId: "npm-unregistered-assessment",
					playerType: "preloaded",
					env: { mode: "gather", role: "student" },
				};
				fresh.section = section;
				parent.appendChild(fresh);
			}, layoutTag(layout));

			const events = () =>
				page.evaluate(
					() =>
						(
							window as unknown as {
								__npmFreshEvents: Array<{ type: string; kind?: string; stage?: string; status?: string }>;
							}
						)
							.__npmFreshEvents,
				);
			await expect
				.poll(async () => (await events()).filter((event) => event.type === "framework-error"), {
					timeout: 30_000,
				})
				.toEqual([{ type: "framework-error", kind: "element-preload" }]);
			// Give a premature `interactive` or `pie-loading-complete` time to show.
			await page.waitForTimeout(1_000);
			const all = await events();
			// The error ends the stage chain: `interactive` arrives only as `failed` or `skipped`.
			expect(
				all.filter((event) => event.stage === "interactive").map((event) => event.status),
			).not.toContain("entered");
			expect(all.map((event) => event.type)).not.toContain("pie-loading-complete");
		});
	});
}

// An element's MathJax 4 is its own, so a page already running MathJax 3 is
// left as it is: no conflict is reported and the elements still typeset.
test("a page already running MathJax 3 keeps it, and the elements still typeset", async ({ page }) => {
	await recordPage(page);
	await page.addInitScript(() => {
		(window as unknown as { MathJax: unknown }).MathJax = { version: "3.2.2" };
	});
	const player = await openDemo(page, "splitpane");
	await expect(player.locator("#npm-multiple-choice-element mjx-container").first()).toBeVisible({
		timeout: 30_000,
	});
	await page.waitForLoadState("networkidle");
	expect(await page.evaluate(() => (window as { MathJax?: { version?: string } }).MathJax?.version)).toBe("3.2.2");
	expect((await recorded(page)).mathJaxConflicts).toEqual([]);
});
