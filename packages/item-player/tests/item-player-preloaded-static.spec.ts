import { expect, test, type Page } from "@playwright/test";

const DEMO_ID = "multiple-choice-radio-simple";
const PRELOADED_DELIVERY_PATH =
	`/demo/${DEMO_ID}/delivery?mode=gather&role=student&player=preloaded`;
const IIFE_DELIVERY_PATH =
	`/demo/${DEMO_ID}/delivery?mode=gather&role=student&player=iife`;
const ESM_DELIVERY_PATH =
	`/demo/${DEMO_ID}/delivery?mode=gather&role=student&player=esm`;
const DELIVERY_PROMPT = "Which is the largest planet in our solar system?";
const SESSION_ENTRY_ID = "2";

type SessionSnapshot = {
	data?: Array<{
		id?: string;
		value?: string[];
	}>;
};

async function readSessionState(page: Page): Promise<SessionSnapshot> {
	const panel = page.locator("pie-item-player-session-debugger");
	const sessionTab = page.getByRole("tab", { name: "Session" });
	if (!(await sessionTab.isVisible().catch(() => false))) {
		await page.getByRole("button", { name: "Toggle item session panel" }).click();
	}
	await expect(sessionTab).toBeVisible();
	await sessionTab.click();
	const sessionJson = panel
		.locator(".pie-item-player-session-debugger__card")
		.filter({ hasText: "Session Data" })
		.locator("pre")
		.first();
	await expect(sessionJson).toBeVisible();
	for (let attempt = 0; attempt < 30; attempt += 1) {
		const text = (await sessionJson.textContent()) || "";
		try {
			return JSON.parse(text) as SessionSnapshot;
		} catch {
			await page.waitForTimeout(150);
		}
	}
	throw new Error("Session JSON did not become parseable in time");
}

async function assertMediaRetryBridge(page: Page, deliveryPath: string): Promise<void> {
	await page.goto(deliveryPath, { waitUntil: "networkidle" });
	await expect(page.getByText(DELIVERY_PROMPT)).toBeVisible({ timeout: 20_000 });

	await page.evaluate(() => {
		(window as any).__pieMediaRetryReady = false;
		const playerHost = document.querySelector("pie-item-player");
		if (!(playerHost instanceof HTMLElement)) {
			throw new Error("pie-item-player host not found");
		}
		const playerRoot = playerHost.querySelector(".pie-item-player");
		const rendererRoot = playerHost.querySelector(
			".pie-player-item-container .pie-item-player",
		);
		if (!(playerRoot instanceof HTMLElement)) {
			throw new Error("pie-item-player root not found");
		}
		if (!(rendererRoot instanceof HTMLElement)) {
			throw new Error("inner renderer root not found");
		}

		const fixture = document.createElement("div");
		fixture.id = "pie-audio-retry-fixture";

		const audioButton = document.createElement("button");
		audioButton.type = "button";
		audioButton.textContent = "Play audio";
		audioButton.dataset.testid = "audio-retry-button";
		audioButton.disabled = true;

		const audio = document.createElement("audio");
		audio.src = "/synthetic-retry-audio.wav";
		audio.preload = "auto";
		audio.addEventListener("pie-media-retry-ready", () => {
			audioButton.disabled = false;
			(window as any).__pieMediaRetryReady = true;
		});

		fixture.append(audioButton, audio);
		rendererRoot.appendChild(fixture);
		// Simulate a failed first load before retry recovery is announced.
		audio.dispatchEvent(new Event("error"));
	});

	await page.evaluate(() => {
		const playerRoot = document.querySelector(
			"pie-item-player .pie-player-item-container .pie-item-player",
		) as HTMLElement | null;
		const audio = document.querySelector(
			"#pie-audio-retry-fixture audio",
		) as HTMLAudioElement | null;
		if (!playerRoot || !audio) {
			throw new Error("Unable to dispatch retry-success bridge event");
		}
		playerRoot.dispatchEvent(
			new CustomEvent("pie-resource-retry-success", {
				detail: {
					url: audio.currentSrc || audio.src,
					resourceType: "audio",
					retryCount: 1,
					maxRetries: 3,
				},
				bubbles: true,
				composed: true,
			}),
		);
	});
	await page.waitForFunction(() => (window as any).__pieMediaRetryReady === true);

	const disabledAfterRetry = await page.evaluate(() => {
		const button = document.querySelector(
			"#pie-audio-retry-fixture [data-testid='audio-retry-button']",
		);
		return button instanceof HTMLButtonElement ? button.disabled : true;
	});

	expect(disabledAfterRetry).toBe(false);
}

test.describe("item-player strategy regressions", () => {
	test("renders and updates session using preloaded bundles", async ({ page }) => {
		const bundleRequests: string[] = [];
		const esmRequests: string[] = [];
		page.on("request", (request) => {
			const url = request.url();
			if (url.includes("/bundles/")) bundleRequests.push(url);
			if (url.includes("esm.sh")) esmRequests.push(url);
		});

		await page.goto(PRELOADED_DELIVERY_PATH, { waitUntil: "networkidle" });

		await expect(page.getByText(DELIVERY_PROMPT)).toBeVisible({ timeout: 20_000 });

		await page
			.locator('label[for^="choice-"]')
			.filter({ hasText: "Mars" })
			.first()
			.click();

		const session = await readSessionState(page);
		const entry = session.data?.find((item) => item.id === SESSION_ENTRY_ID);
		expect(entry?.value?.[0]).toBeTruthy();
		expect(bundleRequests.length).toBeGreaterThan(0);
		expect(esmRequests.length).toBe(0);
	});

	test("preloaded emits media-retry-ready after first audio load failure", async ({
		page,
	}) => {
		await assertMediaRetryBridge(page, PRELOADED_DELIVERY_PATH);
	});

	test("preloaded rewrites stale content element versions to bundled versions", async ({
		page,
	}) => {
		await page.goto(PRELOADED_DELIVERY_PATH, { waitUntil: "networkidle" });
		await expect(page.getByText(DELIVERY_PROMPT)).toBeVisible({ timeout: 20_000 });

		await page.evaluate(() => {
			(window as any).PIE_PRELOADED_ELEMENTS = {
				"@pie-element/multiple-choice": "@pie-element/multiple-choice@11.4.3",
			};
			const fixture = document.createElement("div");
			fixture.id = "pie-preloaded-version-normalization-fixture";
			document.body.appendChild(fixture);

			const player = document.createElement("pie-item-player") as any;
			player.strategy = "preloaded";
			player.env = { mode: "gather", role: "student" };
			player.session = { id: "normalize-test", data: [] };
			player.config = {
				elements: {
					"pie-multiple-choice": "@pie-element/multiple-choice@0.0.1",
				},
				models: [
					{
						id: "normalize-mc",
						element: "pie-multiple-choice",
						prompt: "Normalization prompt",
						choiceMode: "radio",
						choices: [
							{ value: "a", label: "A", correct: false },
							{ value: "b", label: "B", correct: true },
						],
					},
				],
				markup: '<pie-multiple-choice id="normalize-mc"></pie-multiple-choice>',
			};
			fixture.appendChild(player);
		});

		await page.waitForFunction(() => {
			const fixture = document.getElementById(
				"pie-preloaded-version-normalization-fixture",
			);
			if (!fixture) return false;
			const hasBundledVersionTag = !!fixture.querySelector(
				"pie-multiple-choice--version-11-4-3",
			);
			const hasStaleVersionTag = !!fixture.querySelector(
				"pie-multiple-choice--version-0-0-1",
			);
			return hasBundledVersionTag && !hasStaleVersionTag;
		});
	});

	test("preloaded falls back to runtime loading when preloaded metadata is present but tags are missing", async ({
		page,
	}) => {
		const bundleRequests: string[] = [];
		page.on("request", (request) => {
			const url = request.url();
			if (url.includes("/bundles/")) bundleRequests.push(url);
		});

		await page.addInitScript(() => {
			(window as any).PIE_PRELOADED_ELEMENTS = {
				"@pie-element/unrelated": "@pie-element/unrelated@1.0.0",
			};
		});

		await page.goto(PRELOADED_DELIVERY_PATH, { waitUntil: "networkidle" });
		await expect(page.getByText(DELIVERY_PROMPT)).toBeVisible({ timeout: 20_000 });
		expect(bundleRequests.length).toBeGreaterThan(0);
	});

	test("iife emits media-retry-ready after first audio load failure", async ({ page }) => {
		await assertMediaRetryBridge(page, IIFE_DELIVERY_PATH);
	});

test.skip("esm emits media-retry-ready after first audio load failure", async ({ page }) => {
		await assertMediaRetryBridge(page, ESM_DELIVERY_PATH);
	});
});
