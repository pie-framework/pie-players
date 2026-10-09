import { expect, type Page, test } from "@playwright/test";
import {
	MC_PROMPT,
	MC_REF,
	MC_SPEC,
	MC_TAG,
	openPreloadedBase,
	PRELOADED_SECTION,
	REGISTERED_SPECS,
	versionedTag,
} from "./fixtures/preloaded-section";

// The fixture authors the registered versions, so it never exercises drift.
// Each test mounts a fresh section player over the demo's registrations with
// authored versions that differ from them.
const REGISTERED_MC_TAG = versionedTag(MC_TAG, MC_SPEC);
const OTHER_MC_TAG = "multiple-choice";
const LOADING_SECTION = "Loading section content";

type Recorded = {
	type: string;
	stage?: string;
	status?: string;
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
		/** Per item ref, authored base tags to rename: `{ [from]: to }`. */
		authoredTags?: Record<string, Record<string, string>>;
		missingItem?: boolean;
	},
): Promise<void> {
	await openPreloadedBase(page);

	await page.evaluate(
		({ registeredSpecs, elementOverrides, authoredTags, missingItem, fixture }) => {
			const existing = document.querySelector("pie-section-player-splitpane");
			if (!existing?.parentElement) {
				throw new Error("demo section player not found");
			}
			const section = fixture as {
				assessmentItemRefs: Array<{
					identifier: string;
					item: {
						config: {
							elements: Record<string, string>;
							markup: string;
							models: Array<{ element: string }>;
						};
					};
				}>;
			};
			for (const ref of section.assessmentItemRefs) {
				const config = ref.item.config;
				Object.assign(config.elements, elementOverrides[ref.identifier] ?? {});
				for (const [from, to] of Object.entries(
					authoredTags[ref.identifier] ?? {},
				)) {
					config.elements[to] = config.elements[from];
					delete config.elements[from];
					config.markup = config.markup
						.replaceAll(`<${from} `, `<${to} `)
						.replaceAll(`</${from}>`, `</${to}>`);
					for (const model of config.models) {
						if (model.element === from) model.element = to;
					}
				}
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
			fresh.setAttribute("section-id", "drift-section");
			fresh.setAttribute("attempt-id", `drift-${Date.now()}`);
			fresh.addEventListener("pie-stage-change", (event) => {
				const detail = (event as CustomEvent<{ stage?: string; status?: string }>)
					.detail;
				events.push({
					type: "pie-stage-change",
					stage: detail?.stage,
					status: detail?.status,
				});
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
				assessmentId: "drift-assessment",
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
			authoredTags: options.authoredTags ?? {},
			missingItem: options.missingItem === true,
			fixture: PRELOADED_SECTION,
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
				[MC_REF]: {
					[MC_TAG]: "@pie-element/multiple-choice@11.4.2",
				},
			},
		});

		const fresh = page.locator("pie-section-player-splitpane");
		await expect(fresh.getByText(MC_PROMPT)).toBeVisible({ timeout: 30_000 });
		await expect(fresh.getByText(LOADING_SECTION)).toHaveCount(0);
		await expect(fresh.locator(REGISTERED_MC_TAG)).toHaveCount(1);
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
			(element, { ref, tag }) =>
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
					(candidate) => candidate.identifier === ref,
				)?.item.config.elements[tag],
			{ ref: MC_REF, tag: MC_TAG },
		);
		expect(authoredSpec).toBe("@pie-element/multiple-choice@11.4.2");
	});

	test("renders an item authoring another base tag than the registered one", async ({
		page,
	}) => {
		await mountFreshSplitpane(page, {
			elementOverrides: {},
			authoredTags: { [MC_REF]: { [MC_TAG]: OTHER_MC_TAG } },
		});

		const fresh = page.locator("pie-section-player-splitpane");
		await expect(fresh.getByText(MC_PROMPT)).toBeVisible({ timeout: 30_000 });
		const otherTag = versionedTag(OTHER_MC_TAG, MC_SPEC);
		await expect(fresh.locator(otherTag)).toHaveCount(1);
		await expect(fresh.locator(REGISTERED_MC_TAG)).toHaveCount(0);
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
		// The section's items are not hosted, so the registration's controller
		// comes along with the tag.
		const controllers = await page.evaluate(
			({ registeredTag, otherTag }) => {
				const registry = (
					window as unknown as {
						PIE_REGISTRY: Record<string, { controller?: unknown }>;
					}
				).PIE_REGISTRY;
				return {
					registered: !!registry[registeredTag]?.controller,
					same: registry[otherTag]?.controller === registry[registeredTag]?.controller,
				};
			},
			{ registeredTag: REGISTERED_MC_TAG, otherTag },
		);
		expect(controllers).toEqual({ registered: true, same: true });
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
		expect(events.filter((event) => event.type === "framework-error")).toEqual([
			{ type: "framework-error", kind: "element-preload", recoverable: false },
		]);
		expect(
			events.filter((event) => event.type === "onFrameworkError"),
		).toHaveLength(1);
		// The error ends the stage chain: `interactive` arrives only as `failed` or `skipped`.
		expect(
			events
				.filter((event) => event.stage === "interactive")
				.map((event) => event.status),
		).not.toContain("entered");
		expect(events.map((event) => event.type)).not.toContain(
			"pie-loading-complete",
		);
		await expect(
			page.locator("pie-section-player-splitpane pie-item-player"),
		).toHaveCount(0);
		const pane = page.locator("pie-section-player-splitpane");
		await expect(pane.getByText(LOADING_SECTION)).toHaveCount(0);
		await expect(
			pane.getByText("Section content could not be loaded."),
		).toBeVisible();
	});
});
