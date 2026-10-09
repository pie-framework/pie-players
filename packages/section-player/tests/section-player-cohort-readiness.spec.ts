/**
 * Readiness across cohort changes on one player element: a new attempt or a
 * new section starts from that cohort's own warmup, and a failure belongs to
 * the cohort or coordinator it was reported for. Each test mounts a player
 * that owns its coordinator over the preloaded demo's element registrations.
 */

import { expect, type Page, test } from "@playwright/test";
import {
	openPreloadedBase,
	PRELOADED_SECTION,
	REGISTERED_SPECS,
} from "./fixtures/preloaded-section";

type CohortPlayer = HTMLElement & { section?: unknown; runtime?: unknown };

declare global {
	interface Window {
		__cohortEvents?: string[];
	}
}

const BASE_RUNTIME = {
	assessmentId: "cohort-readiness",
	playerType: "preloaded",
	env: { mode: "gather", role: "student" },
};

/** The fixture with its item's model naming an element the item does not declare. */
function brokenSection(identifier: string) {
	const section = structuredClone(PRELOADED_SECTION) as typeof PRELOADED_SECTION;
	section.identifier = identifier;
	section.assessmentItemRefs[0].item.config.models[0].element = "pie-element-undeclared";
	return section;
}

/**
 * Replaces the demo's player with a fresh one. Stage changes record as
 * `<stage>:<status>`, loading completion as `loading-complete`.
 */
async function mountPlayer(
	page: Page,
	options: { section?: unknown; runtime?: Record<string, unknown> } = {},
): Promise<void> {
	await openPreloadedBase(page);
	await page.evaluate(
		({ specs, section, runtime }) => {
			const existing = document.querySelector("pie-section-player-splitpane");
			if (!existing?.parentElement) throw new Error("demo section player not found");
			(
				window as unknown as { PIE_PRELOADED_ELEMENTS?: Record<string, string> }
			).PIE_PRELOADED_ELEMENTS = { ...specs };
			const parent = existing.parentElement;
			existing.remove();
			const events: string[] = [];
			window.__cohortEvents = events;
			const player = document.createElement("pie-section-player-splitpane") as CohortPlayer;
			player.id = "cohort-player";
			player.setAttribute("section-id", "cohort-first-section");
			player.setAttribute("attempt-id", "cohort-first-attempt");
			player.runtime = runtime;
			player.section = section;
			player.addEventListener("pie-stage-change", (event) => {
				const { stage, status } = (event as CustomEvent<{ stage: string; status: string }>)
					.detail;
				events.push(`${stage}:${status}`);
			});
			player.addEventListener("pie-loading-complete", () => events.push("loading-complete"));
			parent.appendChild(player);
		},
		{
			specs: REGISTERED_SPECS,
			section: options.section ?? PRELOADED_SECTION,
			runtime: { ...BASE_RUNTIME, ...options.runtime },
		},
	);
}

const events = (page: Page, from = 0) =>
	page.evaluate((start) => (window.__cohortEvents ?? []).slice(start), from);
const eventCount = async (page: Page) => (await events(page)).length;
const chainEnded = (entries: string[]) =>
	entries.some((entry) => entry.endsWith(":failed") || entry === "interactive:entered");
const stages = (entries: string[]) => entries.filter((entry) => entry !== "loading-complete");

async function untilChainEnds(page: Page, from = 0): Promise<void> {
	await expect.poll(async () => chainEnded(await events(page, from)), { timeout: 30_000 }).toBe(true);
}

const setPlayerAttribute = (page: Page, name: string, value: string) =>
	page.evaluate(
		([attribute, next]) => document.getElementById("cohort-player")?.setAttribute(attribute, next),
		[name, value],
	);

test("a new attempt on a section whose element warmup failed fails too", async ({ page }) => {
	await mountPlayer(page, { section: brokenSection("cohort-first-section") });
	await untilChainEnds(page);
	expect(await events(page)).toContain("interactive:failed");

	const from = await eventCount(page);
	await setPlayerAttribute(page, "attempt-id", "cohort-second-attempt");
	await untilChainEnds(page, from);
	await page.waitForTimeout(1_000);
	expect(await events(page, from)).toEqual([
		"disposed:entered",
		"composed:entered",
		"engine-ready:entered",
		"interactive:failed",
	]);
});

test("a warmup failure reported after the section changed leaves the next section alone", async ({
	page,
}) => {
	await mountPlayer(page);
	await expect.poll(async () => (await events(page)).includes("loading-complete")).toBe(true);

	const from = await eventCount(page);
	await page.evaluate(
		({ section }) => {
			const player = document.getElementById("cohort-player") as CohortPlayer;
			// The outgoing section's warmup rejecting once the cohort has rolled.
			const find = (root: ParentNode): Element | null => {
				for (const element of Array.from(root.querySelectorAll("*"))) {
					if (element.localName === "pie-assessment-toolkit") return element;
					const nested = element.shadowRoot && find(element.shadowRoot);
					if (nested) return nested;
				}
				return null;
			};
			const toolkit = find(player.shadowRoot ?? player) ?? find(player);
			if (!toolkit) throw new Error("the player's toolkit was not found");
			const onStage = (event: Event) => {
				const { stage } = (event as CustomEvent<{ stage: string }>).detail;
				if (stage !== "composed") return;
				player.removeEventListener("pie-stage-change", onStage);
				toolkit.dispatchEvent(
					new CustomEvent("framework-error", {
						bubbles: true,
						composed: true,
						detail: {
							kind: "element-preload",
							severity: "error",
							source: "section-player-cohort-readiness-spec",
							message: "The previous section's elements failed to load",
							details: [],
							recoverable: false,
							scope: "cohort",
						},
					}),
				);
			};
			player.addEventListener("pie-stage-change", onStage);
			player.setAttribute("section-id", "cohort-next-section");
			player.section = { ...section, identifier: "cohort-next-section" };
		},
		{ section: PRELOADED_SECTION },
	);
	await untilChainEnds(page, from);
	await expect.poll(async () => (await events(page, from)).includes("loading-complete")).toBe(true);
	expect(stages(await events(page, from))).toEqual([
		"disposed:entered",
		"composed:entered",
		"engine-ready:entered",
		"interactive:entered",
	]);
});

test("a toolkit that rebuilds after a bootstrap failure lets the next attempt run", async ({
	page,
}) => {
	await mountPlayer(page, {
		runtime: { tools: { placement: { section: ["cohort-no-such-tool"] } } },
	});
	await untilChainEnds(page);
	expect(await events(page)).toContain("engine-ready:failed");

	await page.evaluate((runtime) => {
		(document.getElementById("cohort-player") as CohortPlayer).runtime = runtime;
	}, BASE_RUNTIME);
	await expect(page.locator("#cohort-player").getByRole("radio").first()).toBeVisible({
		timeout: 30_000,
	});
	const from = await eventCount(page);
	await setPlayerAttribute(page, "attempt-id", "cohort-after-rebuild");
	await untilChainEnds(page, from);
	expect(await events(page, from)).toContain("interactive:entered");
});
