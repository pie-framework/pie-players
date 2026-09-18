/**
 * The section player's commit wiring, end to end.
 *
 * `SectionController` calls a commit it is handed; the unit tests pin that it
 * calls it at the right moments, against a spy. What they cannot show is that
 * the spy is connected to anything: the chain from
 * `PieSectionPlayerBaseElement`'s controller factory through the item shells
 * and the nested item players down to the delivery elements only exists in a
 * browser.
 */

import { expect, test, type Page } from "@playwright/test";

const DEMO = "/three-questions?mode=candidate&layout=splitpane";
const HOST = "pie-section-player-splitpane";

type SectionHost = HTMLElement & {
	navigateNext?: () => boolean;
	getSectionController?: () => { getSession?: () => unknown } | null;
	waitForSectionController?: (
		timeoutMs?: number,
	) => Promise<{ getSession?: () => unknown } | null>;
};

/**
 * Write a response the way a delivery element does - session synchronously,
 * dispatch deferred - and leave the dispatch pending. That window is what the
 * element's own `debounce` opens and the commit exists to close.
 */
async function stagePendingResponse(page: Page, value: string) {
	return page.evaluate((choice) => {
		const collect = (root: ParentNode, out: Element[]) => {
			const shadow = (root as Element & { shadowRoot?: ShadowRoot | null })
				.shadowRoot;
			if (shadow) collect(shadow, out);
			for (const child of Array.from(root.children ?? [])) {
				if (
					child.tagName.includes("-") &&
					"session" in child &&
					"model" in child
				) {
					out.push(child);
				}
				collect(child, out);
			}
		};
		const candidates: Element[] = [];
		collect(document.body, candidates);
		const element = candidates.find((candidate) => {
			const session = (candidate as { session?: unknown }).session;
			return Boolean(session && typeof session === "object");
		}) as (Element & { session: Record<string, unknown> }) | undefined;
		if (!element) return null;
		element.session.value = [choice];
		return {
			tag: element.tagName.toLowerCase(),
			id: (element as { id?: string }).id ?? "",
		};
	}, value);
}

test.describe("section player session commit", () => {
	test("navigating away commits the pending response into the section session", async ({
		page,
	}) => {
		await page.goto(DEMO, { waitUntil: "networkidle" });
		await expect(page.locator(HOST)).toBeVisible({ timeout: 30_000 });
		await page.waitForFunction(
			() =>
				Boolean(
					(document.querySelector("pie-section-player-splitpane") as {
						getSectionController?: () => unknown;
					} | null)?.getSectionController?.(),
				),
			undefined,
			{ timeout: 30_000 },
		);
		// The first item's elements have to be mounted before a session can be
		// staged on one.
		await page.waitForFunction(
			() => document.querySelectorAll("pie-item-player").length > 0,
			undefined,
			{ timeout: 30_000 },
		);

		const staged = await stagePendingResponse(page, "commit-probe");
		expect(staged, "no delivery element exposed a session to stage").not.toBeNull();

		const session = await page.evaluate(async () => {
			const host = document.querySelector(
				"pie-section-player-splitpane",
			) as SectionHost | null;
			host?.navigateNext?.();
			await new Promise((resolve) => setTimeout(resolve, 500));
			const controller =
				host?.getSectionController?.() ??
				(await host?.waitForSectionController?.(5_000)) ??
				null;
			try {
				return JSON.stringify(controller?.getSession?.() ?? null);
			} catch {
				return null;
			}
		});

		expect(
			session,
			"the controller exposed no session after navigation",
		).not.toBeNull();
		expect(
			session,
			`the staged response never reached the section session: ${session}`,
		).toContain("commit-probe");
	});
});
