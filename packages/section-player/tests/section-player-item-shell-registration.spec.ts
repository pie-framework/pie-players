import { expect, test, type Page } from "@playwright/test";

/**
 * E2E guards on registration dispatch from `<pie-item-shell>` and
 * `<pie-passage-shell>`.
 *
 * Registration is a statement of fact to the runtime, and the runtime answers a
 * `pie-register` by rebuilding the content's accessibility catalog registrations
 * and re-notifying the section controller. Both shells dispatch it from an
 * effect whose inputs include the `item` prop — and Svelte re-applies
 * custom-element properties on every parent template update, unchanged values
 * included, so an unconditional dispatch turns every card re-render into a
 * teardown and rebuild of runtime state that did not move.
 *
 * It is also the far half of a cycle: any reader that re-renders on a
 * catalog-change signal re-applies this shell's props, which re-registers, which
 * signals again. That shipped once, at roughly a thousand rounds per item,
 * ending in Svelte abandoning the update at its depth limit with the DOM
 * half-applied.
 *
 * These tests count the events rather than reading the DOM, because the DOM was
 * not what was wrong: registration churn is invisible to any assertion about
 * rendered output until the moment it becomes an aborted update.
 */

/**
 * `kind` as well as the id, because both shells dispatch the same two events on
 * the same page: an item assertion that ignored `kind` would be satisfied by a
 * passage's registration, and vice versa.
 */
type RegistrationLog = {
	register: Array<{ kind: string; itemId: string }>;
	unregister: Array<{ kind: string; itemId: string }>;
};

declare global {
	interface Window {
		__pieShellRegistrations?: RegistrationLog;
	}
}

async function countRegistrations(page: Page) {
	await page.addInitScript(() => {
		const log: RegistrationLog = { register: [], unregister: [] };
		window.__pieShellRegistrations = log;
		const record =
			(bucket: Array<{ kind: string; itemId: string }>) => (event: Event) => {
				const detail = (
					event as CustomEvent<{ kind?: string; itemId?: string }>
				).detail;
				bucket.push({
					kind: detail?.kind || "__no-kind__",
					itemId: detail?.itemId || "__no-item-id__",
				});
			};
		window.addEventListener("pie-register", record(log.register), true);
		window.addEventListener("pie-unregister", record(log.unregister), true);
	});
}

async function readRegistrations(page: Page): Promise<RegistrationLog> {
	return page.evaluate(
		() => window.__pieShellRegistrations ?? { register: [], unregister: [] },
	);
}

function tallyKind(
	entries: Array<{ kind: string; itemId: string }>,
	kind: "item" | "passage",
): Record<string, number> {
	const counts: Record<string, number> = {};
	for (const entry of entries) {
		if (entry.kind !== kind) continue;
		counts[entry.itemId] = (counts[entry.itemId] || 0) + 1;
	}
	return counts;
}

/** The ids the mounted shells of one kind claim, in DOM order. */
async function mountedShellIds(
	page: Page,
	tag: "pie-item-shell" | "pie-passage-shell",
): Promise<string[]> {
	return page
		.locator(tag)
		.evaluateAll((shells) =>
			shells.map((shell) => shell.getAttribute("data-item-id") || ""),
		);
}

/**
 * Replace a shell's `item` with a new object carrying the same content — what a
 * host or an upstream derivation produces when it rebuilds content. It is a real
 * change as far as the shell can tell, since the catalogs inside may differ, so
 * it has to register again; what it must not do is unregister first, which would
 * leave content the learner is looking at with no accessibility catalogs.
 */
async function replaceShellItem(
	page: Page,
	tag: "pie-item-shell" | "pie-passage-shell",
): Promise<string> {
	return page.evaluate((shellTag) => {
		const shell = document.querySelector(shellTag) as HTMLElement & {
			item?: unknown;
		};
		// Shallow: a new top-level identity is the whole point, and content is not
		// structured-cloneable — it carries functions.
		shell.item = { ...(shell.item as Record<string, unknown>) };
		return shell.getAttribute("data-item-id") || "";
	}, tag);
}

test.describe("item shell registration", () => {
	test("registers each mounted item exactly once and unregisters none", async ({
		page,
	}) => {
		await countRegistrations(page);
		const pageErrors: string[] = [];
		page.on("pageerror", (error) => pageErrors.push(error.message));

		await page.goto("/three-questions?mode=candidate&layout=splitpane", {
			waitUntil: "networkidle",
		});
		await expect(page.locator("pie-item-player").first()).toBeVisible({
			timeout: 30_000,
		});
		// Registration is driven by mount, and re-registration by re-render; both
		// have long since happened by the time the players are visible. The wait is
		// for anything still arriving afterwards.
		await page.waitForTimeout(3_000);

		const shellIds = await mountedShellIds(page, "pie-item-shell");
		expect(shellIds.length).toBeGreaterThan(1);

		const log = await readRegistrations(page);
		// Exactly one per shell, by item: a total would let one item's extra
		// registration hide behind another item that never registered.
		expect(tallyKind(log.register, "item")).toEqual(
			Object.fromEntries(shellIds.map((itemId) => [itemId, 1])),
		);
		// Nothing has been torn down — every shell counted above is still mounted.
		expect(log.unregister).toEqual([]);
		expect(
			pageErrors.filter((message) =>
				message.includes("effect_update_depth_exceeded"),
			),
		).toEqual([]);
	});

	test("replacing an item's content re-registers without unregistering first", async ({
		page,
	}) => {
		await countRegistrations(page);

		await page.goto("/three-questions?mode=candidate&layout=splitpane", {
			waitUntil: "networkidle",
		});
		await expect(page.locator("pie-item-player").first()).toBeVisible({
			timeout: 30_000,
		});
		await page.waitForTimeout(2_000);
		const before = await readRegistrations(page);

		const shellItemId = await replaceShellItem(page, "pie-item-shell");
		expect(shellItemId).not.toBe("");
		await page.waitForTimeout(1_000);

		const after = await readRegistrations(page);
		expect(tallyKind(after.register, "item")[shellItemId]).toBe(
			(tallyKind(before.register, "item")[shellItemId] || 0) + 1,
		);
		expect(after.unregister).toEqual([]);
	});

	test("survives repeated card re-renders without re-registering", async ({
		page,
	}) => {
		await countRegistrations(page);

		// The signing demo, because its divider is the one in-card control that
		// re-renders a card on demand: the whole card body sits inside
		// `<pie-item-shell>`, so each keystroke re-applies the shell's `item` prop
		// with the same object — the exact churn the dispatch has to absorb.
		await page.goto(
			"/sign-language?page=signing-granted&mode=candidate&layout=splitpane",
			{ waitUntil: "networkidle" },
		);
		const card = page.locator(
			'pie-section-player-item-card [data-canonical-item-id="asl-q1-inline"]',
		);
		const divider = card.getByRole("separator", {
			name: "Resize question and media panels",
		});
		await expect(divider).toBeVisible({ timeout: 30_000 });
		await page.waitForTimeout(2_000);

		const before = await readRegistrations(page);
		const valueBefore = Number(await divider.getAttribute("aria-valuenow"));
		await divider.focus();
		for (let press = 0; press < 8; press += 1) {
			await page.keyboard.press("ArrowLeft");
		}
		// Waiting on the divider's own value waits on the re-renders themselves:
		// each keystroke writes card state, and the attribute is written by the
		// update that re-applies the shell's props.
		await expect
			.poll(async () => Number(await divider.getAttribute("aria-valuenow")))
			.toBeGreaterThan(valueBefore);
		await page.waitForTimeout(1_000);

		const after = await readRegistrations(page);
		expect(after.register).toEqual(before.register);
		expect(after.unregister).toEqual([]);
	});
});

/**
 * The passage shell registers the same way and answers to the same runtime, so
 * it gets the same two guarantees. Worth stating separately rather than folding
 * into the item tests: a passage is registered once per section while items are
 * registered per card, so the two have different mount counts and different
 * reasons to re-render.
 */
test.describe("passage shell registration", () => {
	const PASSAGES_PATH = "/two-passages?mode=candidate&layout=splitpane";

	test("registers each mounted passage exactly once and unregisters none", async ({
		page,
	}) => {
		await countRegistrations(page);
		const pageErrors: string[] = [];
		page.on("pageerror", (error) => pageErrors.push(error.message));

		await page.goto(PASSAGES_PATH, { waitUntil: "networkidle" });
		await expect(page.locator("pie-passage-shell").first()).toBeAttached({
			timeout: 30_000,
		});
		await page.waitForTimeout(3_000);

		const shellIds = await mountedShellIds(page, "pie-passage-shell");
		expect(shellIds.length).toBeGreaterThan(0);

		const log = await readRegistrations(page);
		expect(tallyKind(log.register, "passage")).toEqual(
			Object.fromEntries(shellIds.map((itemId) => [itemId, 1])),
		);
		expect(log.unregister).toEqual([]);
		expect(
			pageErrors.filter((message) =>
				message.includes("effect_update_depth_exceeded"),
			),
		).toEqual([]);
	});

	test("replacing a passage's content re-registers without unregistering first", async ({
		page,
	}) => {
		await countRegistrations(page);

		await page.goto(PASSAGES_PATH, { waitUntil: "networkidle" });
		await expect(page.locator("pie-passage-shell").first()).toBeAttached({
			timeout: 30_000,
		});
		await page.waitForTimeout(2_000);
		const before = await readRegistrations(page);

		const shellItemId = await replaceShellItem(page, "pie-passage-shell");
		expect(shellItemId).not.toBe("");
		await page.waitForTimeout(1_000);

		const after = await readRegistrations(page);
		expect(tallyKind(after.register, "passage")[shellItemId]).toBe(
			(tallyKind(before.register, "passage")[shellItemId] || 0) + 1,
		);
		expect(after.unregister).toEqual([]);
	});
});
