import { expect, test } from "@playwright/test";

test("every scheme is reachable in the picker", async ({ page }) => {
	await page.setViewportSize({ width: 1400, height: 900 });
	await page.goto("/tts-ssml?mode=candidate&layout=splitpane", {
		waitUntil: "networkidle",
	});
	await expect(page.getByRole("link", { name: "Student" })).toBeVisible();
	await page
		.getByRole("button", { name: "Theme - Change colors and contrast" })
		.first()
		.click();
	const themeTool = page.locator("pie-tool-theme").first();
	await themeTool.getByRole("button", { name: "Select theme" }).click();

	const count = await themeTool.getByRole("menuitem").count();
	console.log(`menu items: ${count}`);

	// The last scheme is the hardest to reach — scroll to it and click it.
	const last = themeTool.getByRole("menuitem", {
		name: "Yellow on Navy",
		exact: true,
	});
	await last.scrollIntoViewIfNeeded();
	await expect(last).toBeVisible();
	await last.click();

	const applied = await page.evaluate(async () => {
		await new Promise((r) =>
			requestAnimationFrame(() => requestAnimationFrame(r)),
		);
		const probe = document.createElement("div");
		probe.style.backgroundColor = "var(--pie-background)";
		probe.style.color = "var(--pie-text)";
		document.body.appendChild(probe);
		const cs = getComputedStyle(probe);
		const out = { bg: cs.backgroundColor, text: cs.color };
		probe.remove();
		return out;
	});
	console.log(`after clicking last item: bg=${applied.bg} text=${applied.text}`);
	expect(applied.bg).toBe("rgb(51, 80, 138)");

	// And the whole demo really repaints under it.
	await page.screenshot({ path: "zz-applied.png" });
});
