import { expect, type Page, test } from "@playwright/test";

// The demo registers these versions from one PITS bundle before mounting its
// section player, and authors the same versions, so it never exercises drift.
// Each test mounts a fresh section player over the demo's registrations with
// authored versions that differ from them.
const DEMO_PATH = "/preloaded-fixed-elements?mode=candidate&layout=splitpane";
const REGISTERED_SPECS = {
	"@pie-element/multiple-choice": "@pie-element/multiple-choice@11.4.3",
	"@pie-element/categorize": "@pie-element/categorize@11.3.2",
	"@pie-element/passage": "@pie-element/passage@5.3.3",
};
const MC_PROMPT = "Which field fixes the multiple-choice package version";
const LOADING_SECTION = "Loading section content";

type Recorded = {
	type: string;
	stage?: string;
	kind?: string;
	recoverable?: boolean;
};

declare global {
	interface Window {
		__pieDriftEvents?: Recorded[];
	}
}

async function mountFreshSplitpane(
	page: Page,
	options: {
		elementOverrides: Record<string, Record<string, string>>;
		missingItem?: boolean;
	},
): Promise<void> {
	await page.goto(DEMO_PATH, { waitUntil: "networkidle" });
	await expect(page.getByText(MC_PROMPT)).toBeVisible({ timeout: 30_000 });

	await page.evaluate(
		({ registeredSpecs, elementOverrides, missingItem }) => {
			const existing = document.querySelector("pie-section-player-splitpane") as
				| (HTMLElement & { section?: unknown })
				| null;
			if (!existing?.parentElement) {
				throw new Error("demo section player not found");
			}
			const section = JSON.parse(JSON.stringify(existing.section)) as {
				assessmentItemRefs: Array<{
					identifier: string;
					item: { config: { elements: Record<string, string> } };
				}>;
			};
			for (const ref of section.assessmentItemRefs) {
				Object.assign(
					ref.item.config.elements,
					elementOverrides[ref.identifier] ?? {},
				);
			}
			if (missingItem) {
				section.assessmentItemRefs.push({
					identifier: "drift-missing-ref",
					required: true,
					item: {
						id: "drift-missing-item",
						baseId: "drift-missing-item",
						version: { major: 1, minor: 0, patch: 0 },
						name: "Unregistered element",
						config: {
							markup: '<hotspot-element id="drift-missing"></hotspot-element>',
							elements: { "hotspot-element": "@pie-element/hotspot@1.0.0" },
							models: [{ id: "drift-missing", element: "hotspot-element" }],
						},
					},
				} as never);
			}

			(
				window as unknown as { PIE_PRELOADED_ELEMENTS?: Record<string, string> }
			).PIE_PRELOADED_ELEMENTS = { ...registeredSpecs };

			const events: Recorded[] = [];
			window.__pieDriftEvents = events;
			const parent = existing.parentElement;
			existing.remove();

			const fresh = document.createElement(
				"pie-section-player-splitpane",
			) as HTMLElement & { runtime?: unknown; section?: unknown };
			fresh.setAttribute("assessment-id", "drift-assessment");
			fresh.setAttribute("section-id", "drift-section");
			fresh.setAttribute("attempt-id", `drift-${Date.now()}`);
			fresh.addEventListener("pie-stage-change", (event) => {
				const detail = (event as CustomEvent<{ stage?: string }>).detail;
				events.push({ type: "pie-stage-change", stage: detail?.stage });
			});
			fresh.addEventListener("pie-loading-complete", () => {
				events.push({ type: "pie-loading-complete" });
			});
			fresh.addEventListener("framework-error", (event) => {
				const detail = (
					event as CustomEvent<{ kind?: string; recoverable?: boolean }>
				).detail;
				events.push({
					type: "framework-error",
					kind: detail?.kind,
					recoverable: detail?.recoverable,
				});
			});
			fresh.runtime = {
				playerType: "preloaded",
				env: { mode: "gather", role: "student" },
				onFrameworkError: (model: { kind?: string }) => {
					events.push({ type: "onFrameworkError", kind: model?.kind });
				},
			};
			fresh.section = section;
			parent.appendChild(fresh);
		},
		{
			registeredSpecs: REGISTERED_SPECS,
			elementOverrides: options.elementOverrides,
			missingItem: options.missingItem === true,
		},
	);
}

function recordedEvents(page: Page): Promise<Recorded[]> {
	return page.evaluate(() => window.__pieDriftEvents ?? []);
}

test.describe("section player preloaded version drift", () => {
	test("renders items whose authored version differs from the registered one", async ({
		page,
	}) => {
		await mountFreshSplitpane(page, {
			elementOverrides: {
				"preloaded-fixed-multiple-choice-ref": {
					"multiple-choice": "@pie-element/multiple-choice@11.4.2",
				},
			},
		});

		const fresh = page.locator("pie-section-player-splitpane");
		await expect(fresh.getByText(MC_PROMPT)).toBeVisible({ timeout: 30_000 });
		await expect(fresh.getByText(LOADING_SECTION)).toHaveCount(0);
		await expect(fresh.locator("multiple-choice--version-11-4-3")).toHaveCount(
			1,
		);
		await expect
			.poll(async () =>
				(await recordedEvents(page)).map((event) => event.stage ?? event.type),
			)
			.toContain("pie-loading-complete");

		const events = await recordedEvents(page);
		expect(events.filter((event) => event.type === "framework-error")).toEqual(
			[],
		);
		expect(events.map((event) => event.stage)).toContain("interactive");
		// Alignment rewrites the runtime copy only.
		const authoredSpec = await fresh.evaluate(
			(element) =>
				(
					element as HTMLElement & {
						section?: {
							assessmentItemRefs: Array<{
								identifier: string;
								item: { config: { elements: Record<string, string> } };
							}>;
						};
					}
				).section?.assessmentItemRefs.find(
					(ref) => ref.identifier === "preloaded-fixed-multiple-choice-ref",
				)?.item.config.elements["multiple-choice"],
		);
		expect(authoredSpec).toBe("@pie-element/multiple-choice@11.4.2");
	});

	test("reports an unregistered element as a framework error and holds readiness", async ({
		page,
	}) => {
		await mountFreshSplitpane(page, {
			elementOverrides: {},
			missingItem: true,
		});

		await expect
			.poll(
				async () =>
					(await recordedEvents(page)).filter(
						(event) => event.type === "onFrameworkError",
					),
				{ timeout: 30_000 },
			)
			.toEqual([{ type: "onFrameworkError", kind: "element-preload" }]);

		// Give a premature `interactive` or `pie-loading-complete` time to show.
		await page.waitForTimeout(1_000);
		const events = await recordedEvents(page);
		const frameworkErrors = events.filter(
			(event) => event.type === "framework-error",
		);
		expect(frameworkErrors.length).toBeGreaterThan(0);
		for (const event of frameworkErrors) {
			expect(event).toEqual({
				type: "framework-error",
				kind: "element-preload",
				recoverable: false,
			});
		}
		expect(
			events.filter((event) => event.type === "onFrameworkError"),
		).toHaveLength(1);
		expect(events.map((event) => event.stage)).not.toContain("interactive");
		expect(events.map((event) => event.type)).not.toContain(
			"pie-loading-complete",
		);
		await expect(
			page.locator("pie-section-player-splitpane pie-item-player"),
		).toHaveCount(0);
	});
});
