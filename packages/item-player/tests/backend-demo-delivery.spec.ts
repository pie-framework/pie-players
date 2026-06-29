import { expect, test } from "@playwright/test";

function hasCorrectKey(value: unknown): boolean {
	if (Array.isArray(value)) return value.some((entry) => hasCorrectKey(entry));
	if (!value || typeof value !== "object") return false;
	return Object.entries(value as Record<string, unknown>).some(
		([key, nested]) => key === "correct" || hasCorrectKey(nested),
	);
}

test("backend demo loads, autosaves, and server-scores a delivery session", async ({
	page,
}) => {
	const testSessionId = `backend-delivery-planets-session-${Date.now()}`;
	await page.goto(
		`/delivery/backend-delivery-planets?sessionId=${encodeURIComponent(testSessionId)}&tools=session,events&info=1`,
		{ waitUntil: "networkidle" },
	);
	await expect(page).toHaveURL(/\/delivery\/backend-delivery-planets/);
	await expect(
		page.getByRole("heading", { name: "Delivery backend integration" }),
	).toBeVisible();
	await expect(
		page.getByRole("heading", { name: "What this backend demo proves" }),
	).toBeVisible();
	await page
		.getByRole("dialog", { name: "What this backend demo proves" })
		.getByRole("button", { name: "Close demo info dialog" })
		.click();
	await expect(
		page.getByText(
			"Backend demo: which is the largest planet in our solar system?",
			{ exact: true },
		),
	).toBeVisible({ timeout: 30_000 });
	await expect(page.getByLabel("Session ID")).toHaveValue(testSessionId);
	const backendStateWindow = page.locator(".backend-tool-window", {
		hasText: "Backend state",
	});
	await expect(backendStateWindow).toBeVisible();
	const backendStateBoxBeforeDrag = await backendStateWindow.boundingBox();
	expect(backendStateBoxBeforeDrag).not.toBeNull();
	const backendStateHeader = backendStateWindow.locator(":scope > header");
	await backendStateHeader.hover();
	await page.mouse.down();
	await page.mouse.move(
		(backendStateBoxBeforeDrag?.x ?? 0) - 120,
		(backendStateBoxBeforeDrag?.y ?? 0) + 80,
		{ steps: 8 },
	);
	await page.mouse.up();
	const backendStateBoxAfterDrag = await backendStateWindow.boundingBox();
	expect(backendStateBoxAfterDrag).not.toBeNull();
	expect(Math.abs((backendStateBoxAfterDrag?.x ?? 0) - (backendStateBoxBeforeDrag?.x ?? 0))).toBeGreaterThan(40);

	const rawState = await (await page.request.get("/api/player/state")).json();
	expect(JSON.stringify(rawState.items)).toContain('"correct":true');
	const loadResponse = await (
		await page.request.post("/api/player/load", {
			data: {
				itemId: "backend-delivery-planets",
				sessionId: `${testSessionId}-load-api`,
				env: { mode: "evaluate", role: "instructor" },
			},
		})
	).json();
	expect(hasCorrectKey(loadResponse.item?.models)).toBe(false);
	const processedModels = await (
		await page.request.post("/api/player/model", {
			data: {
				itemId: "backend-delivery-planets",
				sessionId: testSessionId,
				env: { mode: "evaluate", role: "instructor" },
			},
		})
	).json();
	expect(hasCorrectKey(processedModels)).toBe(false);

	await page.getByRole("button", { name: "Load current session" }).click();
	await expect(page.getByLabel("Session ID")).toHaveValue(testSessionId);

	await page.request.post("/api/player/save", {
		data: {
			itemId: "backend-delivery-planets",
			sessionId: testSessionId,
			data: [
				{
					id: "planet-choice",
					element: "multiple-choice--version-latest",
					value: ["mars"],
					selector: "Test",
				},
			],
		},
	});
	await page.getByRole("button", { name: "Load current session" }).click();
	await expect(page.getByTestId("client-session")).toContainText("mars", {
		timeout: 10_000,
	});
	await expect(page.getByRole("radio", { name: /Mars/ })).toBeChecked();
	const trafficWindow = page.locator(".backend-tool-window", {
		hasText: "Backend traffic",
	});
	await expect(trafficWindow).toBeVisible();
	const saveResponsePromise = page.waitForResponse(
		(response) =>
			response.url().includes("/api/player/save") &&
			response.request().method() === "POST",
	);
	await page.getByRole("button", { name: "saveSession()" }).click();
	await saveResponsePromise;
	await expect(page.getByTestId("stored-session")).toContainText("mars", {
		timeout: 10_000,
	});
	await expect(trafficWindow).toContainText("POST /api/player/save", {
		timeout: 10_000,
	});
	await expect(trafficWindow).toContainText('"value": [');
	await expect(trafficWindow).toContainText('"mars"');
	const savedBeforeScore = await (
		await page.request.get(
			`/api/player/state?sessionId=${encodeURIComponent(testSessionId)}`,
		)
	).json();
	expect(JSON.stringify(savedBeforeScore.session?.data)).toContain("mars");

	const scoreResponsePromise = page.waitForResponse(
		(response) =>
			response.url().includes("/api/player/score") &&
			response.request().method() === "POST",
	);
	await page.getByRole("button", { name: "server score()" }).click();
	const scoreResponse = await scoreResponsePromise;
	const scorePayload = await scoreResponse.json();
	expect(scorePayload).toEqual(
		expect.arrayContaining([expect.objectContaining({ score: 0 })]),
	);
	await expect(page.getByTestId("backend-outcome")).toContainText('"score": 0');
	await expect(trafficWindow).toContainText("POST /api/player/score", {
		timeout: 10_000,
	});

});

test("backend demo accepts answer input after directly refreshing an existing session", async ({
	page,
}) => {
	const testSessionId = `backend-delivery-planets-session-${Date.now()}`;
	await page.request.post("/api/player/save", {
		data: {
			itemId: "backend-delivery-planets",
			sessionId: testSessionId,
			data: [
				{
					id: "planet-choice",
					element: "multiple-choice--version-latest",
					value: ["mars"],
					selector: "Test",
				},
			],
		},
	});
	await page.goto(
		`/delivery/backend-delivery-planets?sessionId=${encodeURIComponent(testSessionId)}&tools=events`,
		{ waitUntil: "networkidle" },
	);
	await expect(
		page.getByText(
			"Backend demo: which is the largest planet in our solar system?",
			{ exact: true },
		),
	).toBeVisible({ timeout: 30_000 });

	const answerGroup = page.getByRole("radiogroup", {
		name: /largest planet in our solar system/,
	});
	await expect(answerGroup.getByRole("radio", { name: /Mars/ })).toBeChecked({
		timeout: 10_000,
	});
	await answerGroup.locator("label", { hasText: "Jupiter" }).click();
	await expect(answerGroup.getByRole("radio", { name: /Jupiter/ })).toBeChecked({
		timeout: 2_000,
	});
	const trafficWindow = page.locator(".backend-tool-window", {
		hasText: "Backend traffic",
	});
	await expect(trafficWindow).toContainText("POST /api/player/save", {
		timeout: 10_000,
	});
	await expect(trafficWindow).toContainText('"jupiter"');
});

test("backend demo keeps the first selected answer in a fresh backend session", async ({
	page,
}) => {
	const testSessionId = `backend-delivery-planets-session-${Date.now()}`;
	await page.goto(
		`/delivery/backend-delivery-planets?sessionId=${encodeURIComponent(testSessionId)}&tools=events`,
		{ waitUntil: "networkidle" },
	);
	await expect(
		page.getByText(
			"Backend demo: which is the largest planet in our solar system?",
			{ exact: true },
		),
	).toBeVisible({ timeout: 30_000 });

	const answerGroup = page.getByRole("radiogroup", {
		name: /largest planet in our solar system/,
	});
	await answerGroup.locator("label", { hasText: "Jupiter" }).click();
	await expect(answerGroup.getByRole("radio", { name: /Jupiter/ })).toBeChecked({
		timeout: 2_000,
	});
	await page.waitForTimeout(1_000);
	await expect(answerGroup.getByRole("radio", { name: /Jupiter/ })).toBeChecked();

	const trafficWindow = page.locator(".backend-tool-window", {
		hasText: "Backend traffic",
	});
	await expect(trafficWindow).toContainText("POST /api/player/save", {
		timeout: 10_000,
	});
	await expect(trafficWindow).toContainText('"jupiter"');
});

