import { expect, type Page, test } from "@playwright/test";

// Each test mounts a fresh layout element over the preloaded demo's element
// registrations and counts, per event, what the toolkit dispatched against what
// a listener on the layout element and a bubbling listener on `document`
// received. The demo's own player is removed first, so the fresh player's
// toolkit is the only one on the page.
const DEMO_PATH = "/preloaded-fixed-elements?mode=candidate&layout=splitpane";
const HOST_COORDINATOR_DEMO_PATH =
	"/three-questions?mode=candidate&layout=splitpane";
const REGISTERED_SPECS = {
	"@pie-element/multiple-choice": "@pie-element/multiple-choice@11.4.3",
	"@pie-element/categorize": "@pie-element/categorize@11.3.2",
	"@pie-element/passage": "@pie-element/passage@5.3.3",
};
const MC_PROMPT = "Which field fixes the multiple-choice package version";
const LAYOUT_TAGS = [
	"pie-section-player-splitpane",
	"pie-section-player-vertical",
	"pie-section-player-tabbed",
	"pie-section-player-kernel-host",
] as const;
// Published by the toolkit and bubbling out of the section player.
const TOOLKIT_EVENTS = [
	"session-changed",
	"composition-changed",
	"runtime-owned",
	"runtime-inherited",
	"toolkit-ready",
	"section-ready",
] as const;
// Dispatched by the shells and cards for the toolkit alone.
const INTERNAL_EVENTS = [
	"pie-register",
	"pie-unregister",
	"pie-item-session-changed",
	"pie-content-loaded",
	"pie-item-player-error",
	"pie-formative-action",
	"pie-media-time-source",
] as const;
const OBSERVED_EVENTS = [
	...TOOLKIT_EVENTS,
	...INTERNAL_EVENTS,
	"framework-error",
	"pie-loading-complete",
	"element-preload-error",
];

type Counts = Record<string, number>;
type DeliveryLog = {
	// Dispatches whose target is the toolkit element.
	source: Counts;
	// Listener on the layout element.
	host: Counts;
	// Bubbling listener on `document`, for events from inside the layout.
	document: Counts;
	// Capturing listener on `window`: proves an event was dispatched at all.
	window: Counts;
	onFrameworkError: number;
};

declare global {
	interface Window {
		__pieDelivery?: DeliveryLog;
		__pieDeliveryCoordinator?: {
			reportFrameworkError?: (model: unknown) => void;
			setHooks?: (hooks: Record<string, unknown>) => void;
		};
		__pieCoordinatorHookCalls?: number;
	}
}

const PROBE_ERROR = {
	kind: "provider-init",
	severity: "warning",
	source: "section-player-event-delivery-spec",
	message: "probe framework error",
	details: [],
	recoverable: true,
};

/**
 * Installs the counters, then replaces the demo's player with a fresh `tag`.
 * `hostCoordinator` reuses the demo player's runtime, coordinator included;
 * otherwise the fresh player owns its coordinator.
 */
async function mountFreshLayout(
	page: Page,
	options: {
		tag: string;
		existingTag?: string;
		hostCoordinator?: boolean;
		missingItem?: boolean;
	},
): Promise<void> {
	await page.evaluate(
		({ tag, existingTag, hostCoordinator, missingItem, observed, specs }) => {
			const existing = document.querySelector(existingTag) as
				| (HTMLElement & {
						section?: unknown;
						runtime?: Record<string, unknown>;
				  })
				| null;
			if (!existing?.parentElement) {
				throw new Error(`demo section player ${existingTag} not found`);
			}
			const log: DeliveryLog = {
				source: {},
				host: {},
				document: {},
				window: {},
				onFrameworkError: 0,
			};
			window.__pieDelivery = log;
			const bump = (bucket: Counts, type: string) => {
				bucket[type] = (bucket[type] || 0) + 1;
			};
			const observedSet = new Set(observed);
			const originalDispatch = EventTarget.prototype.dispatchEvent;
			EventTarget.prototype.dispatchEvent = function countedDispatch(
				event: Event,
			) {
				if (
					observedSet.has(event.type) &&
					this instanceof Element &&
					this.localName.startsWith("pie-assessment-toolkit")
				) {
					bump(log.source, event.type);
				}
				return originalDispatch.call(this, event);
			};

			const section = hostCoordinator
				? existing.section
				: (JSON.parse(JSON.stringify(existing.section)) as {
						assessmentItemRefs: unknown[];
					});
			if (missingItem) {
				(section as { assessmentItemRefs: unknown[] }).assessmentItemRefs.push({
					identifier: "delivery-missing-ref",
					required: true,
					item: {
						id: "delivery-missing-item",
						baseId: "delivery-missing-item",
						version: { major: 1, minor: 0, patch: 0 },
						name: "Unregistered element",
						config: {
							markup:
								'<hotspot-element id="delivery-missing"></hotspot-element>',
							elements: { "hotspot-element": "@pie-element/hotspot@1.0.0" },
							models: [{ id: "delivery-missing", element: "hotspot-element" }],
						},
					},
				});
			}
			if (!hostCoordinator) {
				(
					window as unknown as {
						PIE_PRELOADED_ELEMENTS?: Record<string, string>;
					}
				).PIE_PRELOADED_ELEMENTS = { ...specs };
			}
			const existingRuntime = existing.runtime ?? {};
			const parent = existing.parentElement;
			existing.remove();

			const fresh = document.createElement(tag) as HTMLElement & {
				runtime?: unknown;
				section?: unknown;
			};
			fresh.setAttribute("assessment-id", "delivery-assessment");
			fresh.setAttribute(
				"section-id",
				existing.getAttribute("section-id") || "delivery-section",
			);
			fresh.setAttribute("attempt-id", `delivery-${Date.now()}`);
			for (const type of observed) {
				fresh.addEventListener(type, () => bump(log.host, type));
				document.addEventListener(type, (event) => {
					if (event.composedPath().includes(fresh)) bump(log.document, type);
				});
				window.addEventListener(type, () => bump(log.window, type), true);
			}
			fresh.addEventListener("toolkit-ready", (event) => {
				window.__pieDeliveryCoordinator = (
					event as CustomEvent<{
						coordinator?: Window["__pieDeliveryCoordinator"];
					}>
				).detail?.coordinator;
			});
			const onFrameworkError = () => {
				log.onFrameworkError += 1;
			};
			fresh.runtime = hostCoordinator
				? { ...existingRuntime, onFrameworkError }
				: {
						playerType: "preloaded",
						env: { mode: "gather", role: "student" },
						onFrameworkError,
					};
			if (hostCoordinator) {
				window.__pieDeliveryCoordinator = existingRuntime.coordinator as
					| Window["__pieDeliveryCoordinator"]
					| undefined;
			}
			fresh.section = section;
			parent.appendChild(fresh);
		},
		{
			tag: options.tag,
			existingTag: options.existingTag ?? "pie-section-player-splitpane",
			hostCoordinator: options.hostCoordinator === true,
			missingItem: options.missingItem === true,
			observed: OBSERVED_EVENTS,
			specs: REGISTERED_SPECS,
		},
	);
}

/** `bucket`'s count for each of `types`, zero included. */
function countsOf(bucket: Counts, types: readonly string[]): Counts {
	return Object.fromEntries(types.map((type) => [type, bucket[type] || 0]));
}

function deliveryLog(page: Page): Promise<DeliveryLog> {
	return page.evaluate(
		() =>
			window.__pieDelivery ?? {
				source: {},
				host: {},
				document: {},
				window: {},
				onFrameworkError: 0,
			},
	);
}

async function waitForCount(
	page: Page,
	bucket: "source" | "host" | "window",
	type: string,
	minimum = 1,
): Promise<void> {
	await expect
		.poll(async () => (await deliveryLog(page))[bucket][type] || 0, {
			timeout: 30_000,
			message: `${bucket} never saw ${type}`,
		})
		.toBeGreaterThanOrEqual(minimum);
}

async function openPreloadedDemo(page: Page): Promise<void> {
	await page.goto(DEMO_PATH, { waitUntil: "networkidle" });
	await expect(page.getByText(MC_PROMPT)).toBeVisible({ timeout: 30_000 });
}

/** Selects the first choice of the fresh player's multiple-choice item. */
async function answerFirstChoice(page: Page, tag: string): Promise<void> {
	const fresh = page.locator(tag);
	const itemsTab = fresh.locator('[role="tab"][id$="-tab-items"]');
	if ((await itemsTab.count()) > 0) await itemsTab.click();
	await expect(fresh.getByText(MC_PROMPT)).toBeVisible({ timeout: 30_000 });
	await fresh.locator('input[type="radio"]').first().click();
}

function reportProbeError(
	page: Page,
	model: object = PROBE_ERROR,
): Promise<void> {
	return page.evaluate((reported) => {
		const coordinator = window.__pieDeliveryCoordinator;
		if (typeof coordinator?.reportFrameworkError !== "function") {
			throw new Error("coordinator with reportFrameworkError not captured");
		}
		coordinator.reportFrameworkError(reported);
	}, model);
}

test.describe("section player event delivery", () => {
	for (const tag of LAYOUT_TAGS) {
		test(`delivers each toolkit event to ${tag} once`, async ({ page }) => {
			await openPreloadedDemo(page);
			await mountFreshLayout(page, { tag });
			await waitForCount(page, "host", "pie-loading-complete");

			await answerFirstChoice(page, tag);
			await waitForCount(page, "source", "session-changed");
			await reportProbeError(page);
			await waitForCount(page, "source", "framework-error");
			// Nothing on this page makes a toolkit inherit a runtime, so the
			// delivery path is driven with a dispatch from the toolkit itself.
			await page.evaluate((layoutTag) => {
				const base = document
					.querySelector(layoutTag)
					?.querySelector("pie-section-player-base");
				const toolkit = base?.shadowRoot?.querySelector(
					"pie-assessment-toolkit",
				);
				if (!toolkit) throw new Error("toolkit element not found");
				toolkit.dispatchEvent(
					new CustomEvent("runtime-inherited", {
						bubbles: true,
						composed: true,
						detail: { probe: true },
					}),
				);
			}, tag);
			// Room for a late duplicate to land.
			await page.waitForTimeout(500);

			const log = await deliveryLog(page);
			const dispatched = countsOf(log.source, TOOLKIT_EVENTS);
			for (const type of TOOLKIT_EVENTS) {
				expect(dispatched[type], `${type} dispatched`).toBeGreaterThan(0);
			}
			expect({
				host: countsOf(log.host, TOOLKIT_EVENTS),
				document: countsOf(log.document, TOOLKIT_EVENTS),
			}).toEqual({ host: dispatched, document: dispatched });
			// A framework error is published once on the layout element and does not
			// bubble past it.
			const errors = log.source["framework-error"] || 0;
			expect(errors).toBeGreaterThan(0);
			expect({
				host: log.host["framework-error"] || 0,
				onFrameworkError: log.onFrameworkError,
				document: log.document["framework-error"] || 0,
			}).toEqual({ host: errors, onFrameworkError: errors, document: 0 });
			// The probe error is recoverable, so readiness does not latch to `error`.
			const phase = await page.evaluate(
				(layoutTag) =>
					(
						document.querySelector(layoutTag) as
							| (HTMLElement & { selectReadiness?: () => { phase?: string } })
							| null
					)?.selectReadiness?.()?.phase,
				tag,
			);
			expect(phase).toBe("ready");
		});
	}

	test("delivers a host coordinator's framework errors on the layout element", async ({
		page,
	}) => {
		await page.goto(HOST_COORDINATOR_DEMO_PATH, { waitUntil: "networkidle" });
		await expect(page.locator("pie-item-player").first()).toBeVisible({
			timeout: 30_000,
		});
		await mountFreshLayout(page, {
			tag: "pie-section-player-splitpane",
			hostCoordinator: true,
		});
		await waitForCount(page, "host", "pie-loading-complete");
		// The host's own hook on its coordinator, as a host sets it.
		await page.evaluate(() => {
			window.__pieCoordinatorHookCalls = 0;
			window.__pieDeliveryCoordinator?.setHooks?.({
				onFrameworkError: () => {
					window.__pieCoordinatorHookCalls =
						(window.__pieCoordinatorHookCalls || 0) + 1;
				},
			});
		});

		await reportProbeError(page);
		await expect
			.poll(async () => (await deliveryLog(page)).host["framework-error"] || 0)
			.toBe(1);
		await page.waitForTimeout(500);

		const log = await deliveryLog(page);
		expect({
			host: log.host["framework-error"] || 0,
			onFrameworkError: log.onFrameworkError,
			document: log.document["framework-error"] || 0,
			coordinatorHook: await page.evaluate(
				() => window.__pieCoordinatorHookCalls,
			),
		}).toEqual({
			host: 1,
			onFrameworkError: 1,
			document: 0,
			coordinatorHook: 1,
		});
	});

	test("keeps the section on screen when a host coordinator fails to initialize", async ({
		page,
	}) => {
		const tag = "pie-section-player-splitpane";
		await page.goto(HOST_COORDINATOR_DEMO_PATH, { waitUntil: "networkidle" });
		await expect(page.locator("pie-item-player").first()).toBeVisible({
			timeout: 30_000,
		});
		await mountFreshLayout(page, { tag, hostCoordinator: true });
		await waitForCount(page, "host", "pie-loading-complete");

		await reportProbeError(page, {
			...PROBE_ERROR,
			kind: "coordinator-init",
			severity: "error",
			recoverable: false,
		});
		await expect
			.poll(async () => (await deliveryLog(page)).host["framework-error"] || 0)
			.toBe(1);
		await page.waitForTimeout(500);

		const log = await deliveryLog(page);
		expect({
			host: log.host["framework-error"] || 0,
			onFrameworkError: log.onFrameworkError,
		}).toEqual({ host: 1, onFrameworkError: 1 });
		await expect(page.locator(".pie-assessment-toolkit-error")).toHaveCount(0);
		await expect(page.locator(`${tag} pie-item-player`).first()).toBeVisible();
	});

	test("keeps the runtime's internal events inside the section player", async ({
		page,
	}) => {
		const tag = "pie-section-player-splitpane";
		await openPreloadedDemo(page);
		await mountFreshLayout(page, { tag });
		await waitForCount(page, "host", "pie-loading-complete");
		await answerFirstChoice(page, tag);
		await waitForCount(page, "window", "pie-item-session-changed");
		await page.waitForTimeout(500);

		const log = await deliveryLog(page);
		for (const type of [
			"pie-register",
			"pie-content-loaded",
			"pie-item-session-changed",
		]) {
			expect(log.window[type] || 0, `${type} dispatched`).toBeGreaterThan(0);
		}
		const none = countsOf({}, INTERNAL_EVENTS);
		expect({
			host: countsOf(log.host, INTERNAL_EVENTS),
			document: countsOf(log.document, INTERNAL_EVENTS),
		}).toEqual({ host: none, document: none });
	});

	test("answering does not re-register the item shells", async ({ page }) => {
		const tag = "pie-section-player-splitpane";
		await openPreloadedDemo(page);
		await mountFreshLayout(page, { tag });
		await waitForCount(page, "host", "pie-loading-complete");
		await page.waitForTimeout(1_000);
		const before = await deliveryLog(page);
		expect(before.window["pie-register"] || 0).toBeGreaterThan(0);

		await answerFirstChoice(page, tag);
		await waitForCount(page, "source", "session-changed");
		// The answer republishes the composition; registration must not follow it.
		await waitForCount(
			page,
			"source",
			"composition-changed",
			(before.source["composition-changed"] || 0) + 1,
		);
		await page.waitForTimeout(1_000);

		const after = await deliveryLog(page);
		const registration = ["pie-register", "pie-unregister"];
		expect(countsOf(after.window, registration)).toEqual(
			countsOf(before.window, registration),
		);
	});

	test("reports a rejected element warmup once", async ({ page }) => {
		const tag = "pie-section-player-splitpane";
		await openPreloadedDemo(page);
		await mountFreshLayout(page, { tag, missingItem: true });
		await expect
			.poll(async () => (await deliveryLog(page)).onFrameworkError, {
				timeout: 30_000,
			})
			.toBe(1);
		// Re-applying the same runtime and a copy of the same section re-renders
		// the items pane without changing anything the warmup depends on.
		await page.evaluate((layoutTag) => {
			const fresh = document.querySelector(layoutTag) as HTMLElement & {
				runtime?: Record<string, unknown>;
				section?: unknown;
			};
			fresh.runtime = { ...(fresh.runtime ?? {}) };
			fresh.section = JSON.parse(JSON.stringify(fresh.section));
		}, tag);
		await page.waitForTimeout(1_000);

		const log = await deliveryLog(page);
		expect({
			onFrameworkError: log.onFrameworkError,
			"framework-error": log.host["framework-error"] || 0,
			"element-preload-error": log.host["element-preload-error"] || 0,
		}).toEqual({
			onFrameworkError: 1,
			"framework-error": 1,
			"element-preload-error": 1,
		});
	});

	test("forwards the same answer from two players rendering the same item", async ({
		page,
	}) => {
		await openPreloadedDemo(page);
		await page.evaluate((specs) => {
			const existing = document.querySelector("pie-section-player-splitpane") as
				| (HTMLElement & { section?: unknown })
				| null;
			if (!existing?.parentElement) {
				throw new Error("demo section player not found");
			}
			(
				window as unknown as { PIE_PRELOADED_ELEMENTS?: Record<string, string> }
			).PIE_PRELOADED_ELEMENTS = { ...specs };
			const parent = existing.parentElement;
			const section = JSON.stringify(existing.section);
			existing.remove();
			const answers: Record<string, number> = { first: 0, second: 0 };
			(window as unknown as { __pieTwinAnswers?: Counts }).__pieTwinAnswers =
				answers;
			for (const name of ["first", "second"]) {
				const player = document.createElement(
					"pie-section-player-splitpane",
				) as HTMLElement & { runtime?: unknown; section?: unknown };
				player.id = `delivery-${name}`;
				player.setAttribute("assessment-id", `delivery-${name}`);
				player.setAttribute("section-id", "delivery-section");
				player.setAttribute("attempt-id", `delivery-${name}-${Date.now()}`);
				player.runtime = {
					playerType: "preloaded",
					env: { mode: "gather", role: "student" },
				};
				player.section = JSON.parse(section);
				player.addEventListener("item-session-changed", (event) => {
					const session = (event as CustomEvent<{ session?: unknown }>).detail
						?.session;
					if (JSON.stringify(session ?? null).includes('"value"')) {
						answers[name] += 1;
					}
				});
				parent.appendChild(player);
			}
		}, REGISTERED_SPECS);
		const first = page.locator("#delivery-first");
		const second = page.locator("#delivery-second");
		await expect(first.getByText(MC_PROMPT)).toBeVisible({ timeout: 30_000 });
		await expect(second.getByText(MC_PROMPT)).toBeVisible({ timeout: 30_000 });

		// Identical answers in quick succession: a page-wide window keyed by item
		// id once dropped the second player's.
		await first.locator('input[type="radio"]').first().click();
		await second.locator('input[type="radio"]').first().click();
		await page.waitForTimeout(1_000);

		expect(
			await page.evaluate(
				() =>
					(window as unknown as { __pieTwinAnswers?: Counts }).__pieTwinAnswers,
			),
		).toEqual({ first: 1, second: 1 });
	});
});
