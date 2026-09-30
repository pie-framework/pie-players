/**
 * What an element's load and one learner response put on each section channel:
 * the toolkit's `session-changed` and the shells' `item-session-changed` on the
 * layout element, and the controller's item events through the coordinator.
 *
 * Each test replaces the demo's player with a fresh one that records from its
 * first render, and counts each call of an element controller's
 * `updateSession` as a write-back.
 */

import { createRequire } from "node:module";
import { expect, type Page, test } from "@playwright/test";

const LAYOUT = "pie-section-player-splitpane";
// The version section-demos installs, which its preloaded demo registers.
const { version: BLANK_VERSION } = createRequire(
	new URL("../../../apps/section-demos/package.json", import.meta.url),
)("@pie-element/mc-populated-blank/package.json") as { version: string };
const BLANK_TAG = `mc-populated-blank--version-${BLANK_VERSION.replace(/[.+]/g, "-")}`;
const BLANK_SPEC = `@pie-element/mc-populated-blank@${BLANK_VERSION}`;
const MC_PROMPT = "Which field fixes the multiple-choice package version";

type Entry = {
	channel: "host" | "controller";
	type: string;
	elementId: string | null;
	complete: unknown;
	session: {
		data?: Array<{ id?: string; shuffledValues?: string[] }>;
	} | null;
};

type Recording = { entries: Entry[]; writeBacks: number; lastAt: number };

declare global {
	interface Window {
		__pieCardinality?: Recording;
	}
}

function populatedBlank(id: string, lockChoiceOrder: boolean) {
	return {
		id,
		element: "mc-populated-blank",
		prompt: `<p>Complete sentence ${id}.</p>`,
		promptEnabled: true,
		interactionMode: "populate_blank",
		layoutProfile: "inline_sentence",
		choiceLayout: "vertical",
		template: "<p>He will heat up the water in the {{blank}}.</p>",
		choiceMode: "text",
		choices: [
			{ id: "teapot", labelHtml: "teapot" },
			{ id: "flytrap", labelHtml: "flytrap" },
			{ id: "coffee", labelHtml: "coffee" },
			{ id: "freezer", labelHtml: "freezer" },
		],
		correctChoiceId: "teapot",
		hasAudio: false,
		lockChoiceOrder,
	};
}

// One item with two populated blanks; blank-a's controller shuffles its
// choices and writes the order back.
const TWO_BLANKS_SECTION = {
	identifier: "cardinality-section",
	title: "Two blanks",
	keepTogether: true,
	assessmentItemRefs: [
		{
			identifier: "two-blanks-ref",
			required: true,
			item: {
				id: "two-blanks",
				name: "Two populated blanks",
				baseId: "two-blanks",
				version: { major: 1, minor: 0, patch: 0 },
				config: {
					markup:
						'<mc-populated-blank id="blank-a"></mc-populated-blank>' +
						'<mc-populated-blank id="blank-b"></mc-populated-blank>',
					elements: { "mc-populated-blank": BLANK_SPEC },
					models: [
						populatedBlank("blank-a", false),
						populatedBlank("blank-b", true),
					],
				},
			},
		},
	],
};

/**
 * Installs the recorders, then replaces the demo's player with a fresh one
 * rendering `section`, or a copy of the demo's section.
 */
async function mountRecordingLayout(
	page: Page,
	section?: unknown,
): Promise<void> {
	await page.evaluate(
		({ layout, section }) => {
			const recording: Recording = { entries: [], writeBacks: 0, lastAt: 0 };
			window.__pieCardinality = recording;
			const record = (entry: Entry) => {
				recording.entries.push(entry);
				recording.lastAt = performance.now();
			};
			const snapshot = (value: unknown) =>
				JSON.parse(JSON.stringify(value ?? null));

			type Controller = { model?: (...args: unknown[]) => unknown };
			const registry = ((window as { PIE_REGISTRY?: unknown }).PIE_REGISTRY ??
				{}) as Record<string, { controller?: Controller }>;
			for (const entry of Object.values(registry)) {
				const controller = entry.controller;
				const model = controller?.model;
				if (!controller || typeof model !== "function") continue;
				entry.controller = {
					...controller,
					model: (question, session, env, updateSession) =>
						model.call(
							controller,
							question,
							session,
							env,
							typeof updateSession === "function"
								? (...args: unknown[]) => {
										recording.writeBacks += 1;
										return updateSession(...args);
									}
								: updateSession,
						),
				};
			}

			const existing = document.querySelector(layout) as
				| (HTMLElement & { section?: unknown })
				| null;
			if (!existing?.parentElement) {
				throw new Error(`demo section player ${layout} not found`);
			}
			const parent = existing.parentElement;
			const rendered = section ?? snapshot(existing.section);
			existing.remove();
			const fresh = document.createElement(layout) as HTMLElement & {
				runtime?: unknown;
				section?: unknown;
			};
			fresh.setAttribute("assessment-id", "cardinality-assessment");
			fresh.setAttribute("section-id", "cardinality-section");
			fresh.setAttribute("attempt-id", `cardinality-${Date.now()}`);
			for (const type of ["session-changed", "item-session-changed"]) {
				fresh.addEventListener(type, (event) => {
					const detail = ((event as CustomEvent).detail ?? {}) as Record<
						string,
						unknown
					>;
					record({
						channel: "host",
						type,
						elementId: null,
						complete: detail.complete ?? null,
						session: snapshot(detail.session),
					});
				});
			}
			fresh.addEventListener("toolkit-ready", (event) => {
				const coordinator = (
					event as CustomEvent<{
						coordinator?: {
							subscribeItemEvents?: (args: {
								listener: (event: Record<string, unknown>) => void;
							}) => () => void;
						};
					}>
				).detail?.coordinator;
				coordinator?.subscribeItemEvents?.({
					listener: (itemEvent) => {
						if (itemEvent.type === "content-loaded") return;
						record({
							channel: "controller",
							type: String(itemEvent.type),
							elementId:
								typeof itemEvent.elementId === "string"
									? itemEvent.elementId
									: null,
							complete: itemEvent.complete ?? null,
							session: snapshot(itemEvent.session),
						});
					},
				});
			});
			fresh.runtime = {
				playerType: "preloaded",
				env: { mode: "gather", role: "student" },
			};
			fresh.section = rendered;
			parent.appendChild(fresh);
		},
		{ layout: LAYOUT, section: section ?? null },
	);
}

function recording(page: Page): Promise<Recording> {
	return page.evaluate(
		() => window.__pieCardinality ?? { entries: [], writeBacks: 0, lastAt: 0 },
	);
}

/**
 * The entries recorded after the first `from`, once there is one and a second
 * passes quietly. An IIFE element dispatches its response a task after the
 * click, so quiet alone can be the quiet before it.
 */
async function settledSince(page: Page, from = 0): Promise<Entry[]> {
	await page.waitForFunction(
		(from) => {
			const recording = window.__pieCardinality;
			return (
				!!recording &&
				recording.entries.length > from &&
				performance.now() - recording.lastAt > 1_000
			);
		},
		from,
		{ timeout: 30_000 },
	);
	return (await recording(page)).entries.slice(from);
}

/** Entries by channel and type, e.g. `{ "host session-changed": 1 }`. */
function tally(entries: Entry[]): Record<string, number> {
	const counts: Record<string, number> = {};
	for (const { channel, type } of entries) {
		const key = `${channel} ${type}`;
		counts[key] = (counts[key] ?? 0) + 1;
	}
	return counts;
}

/** Each controller session event's element and `complete`, by element id. */
function reports(entries: Entry[]) {
	return entries
		.filter(
			({ channel, type }) =>
				channel === "controller" && type.startsWith("item-session-"),
		)
		.map(({ elementId, complete }) => ({ elementId, complete }))
		.sort((left, right) =>
			String(left.elementId).localeCompare(String(right.elementId)),
		);
}

function choiceOrder(entry: Entry | undefined, elementId: string) {
	return entry?.session?.data?.find(({ id }) => id === elementId)
		?.shuffledValues;
}

test.describe("section player response cardinality", () => {
	test("two elements in one item: each loads once, each response reaches each channel once, and the item completes with its last element", async ({
		page,
	}) => {
		await page.goto(
			"/preloaded-npm-elements?mode=candidate&layout=splitpane",
			{ waitUntil: "networkidle" },
		);
		await expect(
			page
				.locator(`${BLANK_TAG}#npm-mc-populated-blank-element`)
				.getByRole("radio", { name: "teapot" }),
		).toBeVisible({ timeout: 30_000 });
		await mountRecordingLayout(page, TWO_BLANKS_SECTION);
		const choice = (elementId: string, name: string) =>
			page
				.locator(`${LAYOUT} ${BLANK_TAG}#${elementId}`)
				.getByRole("radio", { name });
		await expect(choice("blank-a", "teapot")).toBeVisible({ timeout: 30_000 });
		await expect(choice("blank-b", "teapot")).toBeVisible();

		const load = await settledSince(page);
		expect(reports(load)).toEqual([
			{ elementId: "blank-a", complete: false },
			{ elementId: "blank-b", complete: false },
		]);
		// The first load event carries blank-a's write-back, and is the only one
		// that changed the item session.
		expect(tally(load)).toEqual({
			"controller item-session-data-changed": 1,
			"controller item-session-meta-changed": 1,
			"host session-changed": 2,
			"host item-session-changed": 1,
		});
		const loaded = load.find(
			({ type }) => type === "item-session-data-changed",
		);
		const order = choiceOrder(loaded, "blank-a");
		expect(order).toHaveLength(4);
		expect(choiceOrder(loaded, "blank-b")).toBeUndefined();
		// The renderer's placeholder pass and its session pass each run blank-a's
		// controller.
		expect((await recording(page)).writeBacks).toBe(2);

		await choice("blank-a", "teapot").click();
		const first = await settledSince(page, load.length);
		expect(tally(first)).toEqual({
			"controller item-session-data-changed": 1,
			"host session-changed": 1,
			"host item-session-changed": 1,
		});
		expect(reports(first)).toEqual([{ elementId: "blank-a", complete: true }]);

		await choice("blank-b", "coffee").click();
		const second = await settledSince(page, load.length + first.length);
		expect(tally(second)).toEqual({
			"controller item-session-data-changed": 1,
			"controller item-complete-changed": 1,
			"host session-changed": 1,
			"host item-session-changed": 1,
		});
		expect(reports(second)).toEqual([{ elementId: "blank-b", complete: true }]);
		expect(
			second.find(({ type }) => type === "item-complete-changed")?.complete,
		).toBe(true);
		expect(
			choiceOrder(
				second.find(({ type }) => type === "item-session-data-changed"),
				"blank-a",
			),
		).toEqual(order);
		expect((await recording(page)).writeBacks).toBe(2);
	});

	test("an element from an IIFE bundle: it loads once, and one response reaches each channel once", async ({
		page,
	}) => {
		await page.goto(
			"/preloaded-fixed-elements?mode=candidate&layout=splitpane",
			{ waitUntil: "networkidle" },
		);
		await expect(page.getByText(MC_PROMPT)).toBeVisible({ timeout: 30_000 });
		await mountRecordingLayout(page);
		const fresh = page.locator(LAYOUT);
		await expect(fresh.getByText(MC_PROMPT)).toBeVisible({ timeout: 30_000 });

		const load = await settledSince(page);
		expect(reports(load)).toEqual([
			{ elementId: "preloaded-mc", complete: false },
		]);
		expect(tally(load)).toEqual({
			"controller item-session-meta-changed": 1,
			"host session-changed": 1,
		});

		await fresh.locator('input[type="radio"]').first().click();
		const answer = await settledSince(page, load.length);
		expect(tally(answer)).toEqual({
			"controller item-session-data-changed": 1,
			"controller item-complete-changed": 1,
			"host session-changed": 1,
			"host item-session-changed": 1,
		});
		expect(reports(answer)).toEqual([
			{ elementId: "preloaded-mc", complete: true },
		]);
		expect((await recording(page)).writeBacks).toBe(0);
	});
});
