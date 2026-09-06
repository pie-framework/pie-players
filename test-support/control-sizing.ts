import { expect, type Locator } from "@playwright/test";

/** Check the rendered target, including scaling inherited from its ancestors. */
export async function expectUsableTarget(control: Locator) {
	await expect(control).toBeVisible();
	const label = await control.getAttribute("aria-label") ?? await control.textContent();
	await expect.poll(async () => {
		const rect = await control.boundingBox();
		return rect ? Math.min(rect.width, rect.height) : 0;
	}, { message: `${label}: target should be at least 24 CSS pixels on both axes` }).toBeGreaterThanOrEqual(24);
	await expect.poll(async () => {
		const rect = await control.boundingBox();
		const viewport = await control.evaluate(() => ({ width: innerWidth, height: innerHeight }));
		return rect ? Math.max(-rect.x, -rect.y,
			rect.x + rect.width - viewport.width,
			rect.y + rect.height - viewport.height) : Infinity;
	}, { message: `${label}: target should fit inside the viewport` }).toBeLessThanOrEqual(1);
	await expect.poll(() => control.evaluate(element => {
		const rect = element.getBoundingClientRect();
		return [[0.1, 0.5], [0.5, 0.5], [0.9, 0.5]].every(([x, y]) => {
			const pointX = rect.x + rect.width * x;
			const pointY = rect.y + rect.height * y;
			let hit = document.elementFromPoint(pointX, pointY);
			while (hit?.shadowRoot) {
				const inner = hit.shadowRoot.elementFromPoint(pointX, pointY);
				if (!inner || inner === hit) break;
				hit = inner;
			}
			return hit !== null && element.contains(hit);
		});
	}), { message: `${label}: target should not be covered by another control` }).toBe(true);
}
