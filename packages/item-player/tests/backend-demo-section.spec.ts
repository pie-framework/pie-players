import { expect, test } from "@playwright/test";

type LoadPayload = {
	itemId?: string;
	sessionId?: string;
	assignmentId?: string;
};

function hasKey(value: unknown, keyName: string): boolean {
	if (Array.isArray(value)) return value.some((entry) => hasKey(entry, keyName));
	if (!value || typeof value !== "object") return false;
	return Object.entries(value as Record<string, unknown>).some(
		([key, nested]) => key === keyName || hasKey(nested, keyName),
	);
}

test("section backend demo derives per-item delivery calls from one section config", async ({
	page,
}) => {
	const attemptId = `section-backend-attempt-${Date.now()}`;
	const loadPayloads: LoadPayload[] = [];
	const browserErrors: string[] = [];

	page.on("pageerror", (error) => {
		browserErrors.push(error.message);
	});
	page.on("console", (message) => {
		const text = message.text();
		if (message.type() === "error" && text.includes("Script error")) {
			browserErrors.push(text);
		}
	});
	await page.addInitScript(() => {
		type CapturedScriptError = {
			message: string;
			filename: string;
			lineno: number;
			colno: number;
		};
		(window as unknown as { __backendDemoScriptErrors?: CapturedScriptError[] }).__backendDemoScriptErrors =
			[];
		window.addEventListener(
			"error",
			(event) => {
				if (event.message === "Script error.") {
					(
						window as unknown as { __backendDemoScriptErrors?: CapturedScriptError[] }
					).__backendDemoScriptErrors?.push({
						message: event.message,
						filename: event.filename,
						lineno: event.lineno,
						colno: event.colno,
					});
				}
			},
			true,
		);
	});

	await page.route("**/api/player/load", async (route) => {
		const payload = route.request().postDataJSON() as LoadPayload;
		loadPayloads.push(payload);
		await route.continue();
	});

	await page.goto(
		`/section/backend-section-basic?attemptId=${encodeURIComponent(attemptId)}&tools=session&info=1`,
		{ waitUntil: "networkidle" },
	);

	await expect(page).toHaveURL(/\/section\/backend-section-basic/);
	await expect(
		page.getByRole("heading", { name: "Section backend integration" }),
	).toBeVisible();

	const dialog = page.getByRole("dialog", {
		name: "What this section backend demo proves",
	});
	await expect(dialog).toBeVisible();
	await expect
		.poll(() =>
			dialog.evaluate(
				(dialogElement) =>
					!!(
						document.activeElement &&
						dialogElement.contains(document.activeElement)
					),
			),
		)
		.toBe(true);
	await page.keyboard.press("Escape");
	await expect(dialog).toHaveCount(0);
	await expect(
		page.getByRole("button", { name: "Toggle section demo info dialog" }),
	).toBeFocused();

	await expect(
		page.getByText("Backend demo: which is the largest planet in our solar system?", {
			exact: true,
		}),
	).toBeVisible({ timeout: 30_000 });
	await expect(page.getByRole("dialog", { name: "Backend state" })).toBeVisible();
	await page.getByRole("button", { name: "Close Backend state" }).click();
	await page.getByRole("button", { name: "Scroll down" }).click();
	await expect(
		page.getByText("Backend demo: what is 3 + 5?", { exact: true }),
	).toBeVisible({ timeout: 30_000 });
	await page.getByRole("button", { name: "Toggle backend state tool" }).click();
	await expect(page.getByRole("dialog", { name: "Backend state" })).toBeVisible();

	await expect
		.poll(() => loadPayloads.length, { timeout: 30_000 })
		.toBeGreaterThanOrEqual(2);

	const byItemId = new Map(loadPayloads.map((payload) => [payload.itemId, payload]));
	const planets = byItemId.get("backend-delivery-planets");
	const arithmetic = byItemId.get("backend-delivery-arithmetic");
	expect(planets).toEqual(
		expect.objectContaining({
			itemId: "backend-delivery-planets",
			sessionId: `${attemptId}-backend-delivery-planets`,
			assignmentId: attemptId,
		}),
	);
	expect(arithmetic).toEqual(
		expect.objectContaining({
			itemId: "backend-delivery-arithmetic",
			sessionId: `${attemptId}-backend-delivery-arithmetic`,
			assignmentId: attemptId,
		}),
	);
	expect(loadPayloads).not.toContainEqual(
		expect.objectContaining({
			itemId: "shared-static-item",
		}),
	);
	expect(loadPayloads).not.toContainEqual(
		expect.objectContaining({
			sessionId: "shared-static-session",
		}),
	);

	const sectionSeed = await page.getByTestId("section-seed").textContent();
	const parsedSeed = JSON.parse(sectionSeed || "null");
	expect(hasKey(parsedSeed, "correct")).toBe(false);
	expect(hasKey(parsedSeed, "feedback")).toBe(false);

	await expect(page.getByTestId("section-backend-calls")).toContainText(
		`${attemptId}-backend-delivery-planets`,
	);
	await expect(page.getByTestId("section-backend-calls")).toContainText(
		`${attemptId}-backend-delivery-arithmetic`,
	);
	const rawScriptErrors = await page.evaluate(
		() =>
			(window as unknown as { __backendDemoScriptErrors?: unknown[] })
				.__backendDemoScriptErrors || [],
	);
	expect(rawScriptErrors).toEqual([]);
	expect(browserErrors).not.toContain("Script error.");
});
