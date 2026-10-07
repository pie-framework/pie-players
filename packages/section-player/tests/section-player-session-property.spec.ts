import { expect, type Page, test } from "@playwright/test";
import {
	MC_ELEMENT_ID,
	MC_REF,
	MC_TAG,
	openPreloadedBase,
	PRELOADED_SECTION,
} from "./fixtures/preloaded-section";

// Each test replaces the preloaded demo's player with a fresh layout element
// that owns its coordinator, so the default `localStorage` strategy is the one
// a supplied session has to win over.
const LAYOUT_TAGS = [
	"pie-section-player-splitpane",
	"pie-section-player-vertical",
	"pie-section-player-tabbed",
	"pie-section-player-kernel-host",
] as const;
const ASSESSMENT_ID = "session-property-assessment";
const SECTION_ID = "session-property-section";
const CORRECT_CHOICE = "config.elements";
const OTHER_CHOICE = "assessmentItemRefs.required";

type SessionElement = HTMLElement & {
	runtime?: unknown;
	section?: unknown;
	session?: unknown;
	waitForSectionController?: (timeoutMs?: number) => Promise<{
		subscribe?: (listener: (event: { type: string }) => void) => () => void;
	} | null>;
};

type MountOptions = {
	tag: string;
	/** Which of `section` and `session` is assigned first; `none` assigns no session. */
	order: "section-first" | "session-first" | "none";
	session?: unknown;
	/** A snapshot seeded into the default strategy's key before mount. */
	stored?: unknown;
};

declare global {
	interface Window {
		__sessionProperty?: {
			assignedBeforeAppend: boolean;
			appliedEvents: number;
		};
	}
}

function mcSession(value: string | null) {
	return {
		currentItemIndex: 0,
		itemSessions: {
			[MC_REF]: {
				id: "mc-session",
				data: [
					value === null
						? { id: MC_ELEMENT_ID, element: MC_TAG }
						: { id: MC_ELEMENT_ID, element: MC_TAG, value: [value] },
				],
			},
		},
	};
}

async function mount(page: Page, options: MountOptions): Promise<void> {
	await page.evaluate(
		({ tag, order, session, stored, section, assessmentId, sectionId }) => {
			const existing = document.querySelector("pie-section-player-splitpane");
			if (!existing?.parentElement) {
				throw new Error("demo section player not found");
			}
			const parent = existing.parentElement;
			existing.remove();

			const attemptId = `session-property-${Date.now()}`;
			if (stored) {
				window.localStorage.setItem(
					`pie:section-controller:v1:${assessmentId}:${sectionId}:${attemptId}`,
					JSON.stringify(stored),
				);
			}
			const fresh = document.createElement(tag) as SessionElement;
			fresh.setAttribute("section-id", sectionId);
			fresh.setAttribute("attempt-id", attemptId);
			fresh.runtime = {
				assessmentId,
				playerType: "preloaded",
				env: { mode: "gather", role: "student" },
			};
			if (order === "session-first") fresh.session = session;
			fresh.section = section;
			if (order === "section-first") fresh.session = session;
			window.__sessionProperty = {
				assignedBeforeAppend: order === "none" || fresh.session === session,
				appliedEvents: 0,
			};
			parent.appendChild(fresh);
		},
		{
			tag: options.tag,
			order: options.order,
			session: options.session ?? null,
			stored: options.stored ?? null,
			section: PRELOADED_SECTION,
			assessmentId: ASSESSMENT_ID,
			sectionId: SECTION_ID,
		},
	);
}

/** Counts `section-session-applied` from here on. */
async function countAppliedEvents(page: Page, tag: string): Promise<void> {
	await page.evaluate(async (layoutTag) => {
		const element = document.querySelector(layoutTag) as SessionElement;
		const controller = await element.waitForSectionController?.(20_000);
		controller?.subscribe?.((event) => {
			if (event.type === "section-session-applied" && window.__sessionProperty) {
				window.__sessionProperty.appliedEvents += 1;
			}
		});
	}, tag);
}

function readSession(page: Page, tag: string): Promise<unknown> {
	return page.evaluate(
		(layoutTag) =>
			(document.querySelector(layoutTag) as SessionElement | null)?.session ??
			null,
		tag,
	);
}

function assignSession(page: Page, tag: string, session: unknown) {
	return page.evaluate(
		({ layoutTag, value }) => {
			(document.querySelector(layoutTag) as SessionElement).session = value;
		},
		{ layoutTag: tag, value: session },
	);
}

function choice(page: Page, tag: string, name: string) {
	return page.locator(tag).getByRole("radio", { name });
}

/** The tabbed layout opens on its passage; the item is on the Questions tab. */
async function showQuestions(page: Page, tag: string): Promise<void> {
	if (tag !== "pie-section-player-tabbed") return;
	await page
		.locator(tag)
		.getByRole("tab", { name: "Questions" })
		.click({ timeout: 30_000 });
}

function selectedValue(session: unknown): unknown {
	const entry = (session as { itemSessions?: Record<string, unknown> })
		?.itemSessions?.[MC_REF] as
		| { session?: { data?: Array<{ value?: unknown }> } }
		| { data?: Array<{ value?: unknown }> }
		| undefined;
	const data =
		(entry as { session?: { data?: Array<{ value?: unknown }> } })?.session
			?.data ?? (entry as { data?: Array<{ value?: unknown }> })?.data;
	return data?.[0]?.value ?? null;
}

test.describe("section player session property", () => {
	for (const tag of LAYOUT_TAGS) {
		for (const order of ["section-first", "session-first"] as const) {
			test(`${tag} applies a session assigned ${order === "section-first" ? "after" : "before"} its section at creation`, async ({
				page,
			}) => {
				await openPreloadedBase(page);
				const session = mcSession("a");
				await mount(page, {
					tag,
					order,
					session,
					stored: mcSession("b"),
				});
				expect(
					await page.evaluate(() => window.__sessionProperty?.assignedBeforeAppend),
				).toBe(true);
				await showQuestions(page, tag);
				await expect(choice(page, tag, CORRECT_CHOICE)).toBeChecked({
					timeout: 30_000,
				});
				await expect(choice(page, tag, OTHER_CHOICE)).not.toBeChecked();
				expect(selectedValue(await readSession(page, tag))).toEqual(["a"]);
			});
		}
	}

	test("without a session the controller hydrates from the strategy", async ({
		page,
	}) => {
		const tag = "pie-section-player-splitpane";
		await openPreloadedBase(page);
		await mount(page, { tag, order: "none", stored: mcSession("b") });
		await expect(choice(page, tag, OTHER_CHOICE)).toBeChecked({
			timeout: 30_000,
		});
		expect(selectedValue(await readSession(page, tag))).toEqual(["b"]);
	});

	test("a cohort change without a session assignment hydrates the new controller", async ({
		page,
	}) => {
		const tag = "pie-section-player-splitpane";
		await openPreloadedBase(page);
		await mount(page, { tag, order: "section-first", session: mcSession("a") });
		await expect(choice(page, tag, CORRECT_CHOICE)).toBeChecked({
			timeout: 30_000,
		});
		await page.evaluate(
			({ layoutTag, stored, section, assessmentId, sectionId }) => {
				const element = document.querySelector(layoutTag) as SessionElement;
				const attemptId = `${element.getAttribute("attempt-id")}-next`;
				window.localStorage.setItem(
					`pie:section-controller:v1:${assessmentId}:${sectionId}:${attemptId}`,
					JSON.stringify(stored),
				);
				element.setAttribute("attempt-id", attemptId);
				element.section = structuredClone(section);
			},
			{
				layoutTag: tag,
				stored: mcSession("b"),
				section: PRELOADED_SECTION,
				assessmentId: ASSESSMENT_ID,
				sectionId: SECTION_ID,
			},
		);
		await expect(choice(page, tag, OTHER_CHOICE)).toBeChecked({
			timeout: 30_000,
		});
		expect(selectedValue(await readSession(page, tag))).toEqual(["b"]);
	});

	test("after publication a new session applies, an equal one does not, and a response-free one keeps responses", async ({
		page,
	}) => {
		const tag = "pie-section-player-splitpane";
		await openPreloadedBase(page);
		await mount(page, { tag, order: "section-first", session: mcSession("a") });
		await expect(choice(page, tag, CORRECT_CHOICE)).toBeChecked({
			timeout: 30_000,
		});
		await countAppliedEvents(page, tag);
		const appliedEvents = () =>
			page.evaluate(() => window.__sessionProperty?.appliedEvents ?? 0);

		await assignSession(page, tag, await readSession(page, tag));
		await page.waitForTimeout(500);
		expect(await appliedEvents()).toBe(0);

		await assignSession(page, tag, mcSession("b"));
		await expect(choice(page, tag, OTHER_CHOICE)).toBeChecked({
			timeout: 10_000,
		});
		expect(await appliedEvents()).toBe(1);
		expect(selectedValue(await readSession(page, tag))).toEqual(["b"]);

		await assignSession(page, tag, mcSession(null));
		await page.waitForTimeout(500);
		expect(await appliedEvents()).toBe(1);
		await expect(choice(page, tag, OTHER_CHOICE)).toBeChecked();
		expect(selectedValue(await readSession(page, tag))).toEqual(["b"]);
	});
});
