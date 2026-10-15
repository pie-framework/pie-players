/**
 * `<pie-item-player>` answers `sessionCommitContext` for the elements it renders,
 * from its `idleSaveDelayMs` (ADR 0005).
 *
 * The request is dispatched from inside the rendered element, as an element's own
 * bundled copy of `@pie-players/pie-context` would, so this holds whether or not
 * the published element reads the context yet.
 */

import { expect, test } from "@playwright/test";

const DELIVERY_PATH =
	"/demo/extended-text-entry-default/delivery?mode=gather&role=student";

test("the player answers sessionCommitContext with its idle-save delay", async ({
	page,
}) => {
	await page.goto(DELIVERY_PATH, { waitUntil: "domcontentloaded" });
	const editable = page
		.locator('pie-item-player [contenteditable="true"]')
		.first();
	await expect(editable).toBeVisible({ timeout: 30_000 });

	const seen = await editable.evaluate(async (node) => {
		const values: unknown[] = [];
		const request = Object.assign(
			new Event("context-request", { bubbles: true, composed: true }),
			{
				context: Symbol.for("pie.sessionCommit"),
				contextTarget: node,
				subscribe: true,
				callback: (value: unknown) => values.push(value),
			},
		);
		node.dispatchEvent(request);

		const player = document.querySelector("pie-item-player") as {
			idleSaveDelayMs?: number;
		};
		player.idleSaveDelayMs = 0;
		await new Promise((resolve) => setTimeout(resolve, 100));
		player.idleSaveDelayMs = undefined;
		await new Promise((resolve) => setTimeout(resolve, 100));
		return values;
	});

	expect(seen).toEqual([{}, { idleSaveDelayMs: 0 }, {}]);
});
