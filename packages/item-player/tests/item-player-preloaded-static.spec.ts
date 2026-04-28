import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

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
	const audioFixturePath = join(
		import.meta.dirname,
		"../../../apps/section-demos/static/demo-assets/resource-observability/signal-chime.wav",
	);
	const audioFixtureBuffer = readFileSync(audioFixturePath);
	let requestCount = 0;
	await page.route("**/synthetic-retry-audio.wav*", async (route) => {
		requestCount += 1;
		if (requestCount === 1) {
			await route.abort("failed");
			return;
		}
		await route.fulfill({
			status: 200,
			contentType: "audio/wav",
			body: audioFixtureBuffer,
		});
	});

	await page.goto(deliveryPath, { waitUntil: "networkidle" });
	await expect(page.getByText(DELIVERY_PROMPT)).toBeVisible({ timeout: 20_000 });

	await page.evaluate(() => {
		(window as any).__pieMediaRetryReadyCount = 0;
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
			(window as any).__pieMediaRetryReadyCount += 1;
		});

		fixture.append(audioButton, audio);
		rendererRoot.appendChild(fixture);
		audio.load();
	});

	await page.waitForFunction(
		() => (window as any).__pieMediaRetryReadyCount === 1,
		undefined,
		{ timeout: 20_000 },
	);

	const stateAfterRetry = await page.evaluate(() => {
		const button = document.querySelector(
			"#pie-audio-retry-fixture [data-testid='audio-retry-button']",
		);
		return {
			disabled:
				button instanceof HTMLButtonElement ? button.disabled : true,
			readyCount: Number((window as any).__pieMediaRetryReadyCount || 0),
		};
	});

	expect(stateAfterRetry.disabled).toBe(false);
	expect(stateAfterRetry.readyCount).toBe(1);
}

test.describe("item-player strategy regressions", () => {
	test("ignores stale iife failures after newer iife config succeeds", async ({
		page,
	}) => {
		await page.goto(PRELOADED_DELIVERY_PATH, { waitUntil: "networkidle" });
		await expect(page.getByText(DELIVERY_PROMPT)).toBeVisible({ timeout: 20_000 });

		await page.route("**/bundles/**", async (route) => {
			const url = route.request().url();
			if (!url.includes("not-a-real-element")) {
				await route.fallback();
				return;
			}
			await new Promise((resolve) => setTimeout(resolve, 600));
			await route.fulfill({
				status: 404,
				contentType: "application/javascript",
				body: "window.__pie_stale_load_failure__ = true; throw new Error('stale load failed');",
			});
		});

		const freshPrompt = "Fresh iife config should win";
		await page.evaluate((prompt) => {
			const fixture = document.createElement("div");
			fixture.id = "pie-stale-load-order-fixture";
			document.body.appendChild(fixture);

			const player = document.createElement("pie-item-player") as any;
			player.strategy = "iife";
			player.env = { mode: "gather", role: "student" };
			player.session = { id: "stale-load-order", data: [] };
			player.config = {
				elements: {
					"pie-not-a-real-element": "@pie-element/not-a-real-element@1.0.0",
				},
				models: [
					{
						id: "stale-load-order-model",
						element: "pie-not-a-real-element",
						prompt: "Stale iife config",
					},
				],
				markup:
					'<pie-not-a-real-element id="stale-load-order-model"></pie-not-a-real-element>',
			};
			fixture.appendChild(player);

			queueMicrotask(() => {
				player.config = {
					elements: {
						"pie-multiple-choice": "@pie-element/multiple-choice@11.4.0",
					},
					models: [
						{
							id: "stale-load-order-model",
							element: "pie-multiple-choice",
							prompt,
							choiceMode: "radio",
							choices: [
								{ value: "a", label: "A", correct: false },
								{ value: "b", label: "B", correct: true },
							],
						},
					],
					markup:
						'<pie-multiple-choice id="stale-load-order-model"></pie-multiple-choice>',
				};
			});
		}, freshPrompt);

		const fixture = page.locator("#pie-stale-load-order-fixture");
		await expect(fixture.getByText(freshPrompt)).toBeVisible({ timeout: 20_000 });
		await page.waitForTimeout(800);

		const staleState = await page.evaluate(() => {
			const host = document.querySelector(
				"#pie-stale-load-order-fixture pie-item-player",
			) as HTMLElement | null;
			if (!host) {
				return { errorText: "missing-host", renderedPrompt: null };
			}
			const errorText = host.querySelector(".pie-player-error p")?.textContent || null;
			const renderedPrompt = host.textContent?.includes("Fresh iife config should win")
				? "fresh"
				: host.textContent?.includes("Stale iife config")
					? "stale"
					: null;
			return { errorText, renderedPrompt };
		});

		expect(staleState.errorText).toBeNull();
		expect(staleState.renderedPrompt).toBe("fresh");
	});

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

		const bundledVersionTag = await page.evaluate(() => {
			const preloadedElements = (window as any).PIE_PRELOADED_ELEMENTS as
				| Record<string, string>
				| undefined;
			const bundledSpec = preloadedElements?.["@pie-element/multiple-choice"];
			if (!bundledSpec) {
				throw new Error("Expected preloaded mapping for @pie-element/multiple-choice");
			}
			const match = bundledSpec.match(/@(\d+\.\d+\.\d+)$/);
			if (!match?.[1]) {
				throw new Error(`Unexpected preloaded mapping format: ${bundledSpec}`);
			}
			return `multiple-choice--version-${match[1].replaceAll(".", "-")}`;
		});

		await page.evaluate(() => {
			const fixture = document.createElement("div");
			fixture.id = "pie-preloaded-version-normalization-fixture";
			document.body.appendChild(fixture);

			const player = document.createElement("pie-item-player") as any;
			player.strategy = "preloaded";
			player.env = { mode: "gather", role: "student" };
			player.session = { id: "normalize-test", data: [] };
			player.config = {
				elements: {
					"multiple-choice": "@pie-element/multiple-choice@0.0.1",
				},
				models: [
					{
						id: "normalize-mc",
						element: "multiple-choice",
						prompt: "Normalization prompt",
						choiceMode: "radio",
						choices: [
							{ value: "a", label: "A", correct: false },
							{ value: "b", label: "B", correct: true },
						],
					},
				],
				markup: '<multiple-choice id="normalize-mc"></multiple-choice>',
			};
			fixture.appendChild(player);
		});

		const versionRewriteState = await page.evaluate((expectedBundledTag) => {
			const fixture = document.getElementById(
				"pie-preloaded-version-normalization-fixture",
			);
			if (!fixture) {
				return {
					hasBundledVersionTag: false,
					hasStaleVersionTag: false,
					errorText: "missing-fixture",
				};
			}
			const host = fixture.querySelector("pie-item-player");
			const errorText = host?.querySelector(".pie-player-error p")?.textContent || null;
			return {
				hasBundledVersionTag: !!fixture.querySelector(expectedBundledTag),
				hasStaleVersionTag: !!fixture.querySelector(
					"multiple-choice--version-0-0-1",
				),
				errorText,
			};
		}, bundledVersionTag);

		expect(versionRewriteState.errorText).toBeNull();
		expect(versionRewriteState.hasBundledVersionTag).toBe(true);
		expect(versionRewriteState.hasStaleVersionTag).toBe(false);
	});

	test("preloaded does not autonomously fallback to runtime loading when tags are missing", async ({
		page,
	}) => {
		const bundleRequests: string[] = [];
		page.on("request", (request) => {
			const url = request.url();
			if (url.includes("/bundles/")) bundleRequests.push(url);
		});

		await page.goto(PRELOADED_DELIVERY_PATH, { waitUntil: "networkidle" });
		await expect(page.getByText(DELIVERY_PROMPT)).toBeVisible({ timeout: 20_000 });
		const baselineCount = bundleRequests.length;

		await page.evaluate(() => {
			const fixture = document.createElement("div");
			fixture.id = "pie-preloaded-no-fallback-fixture";
			document.body.appendChild(fixture);
			const player = document.createElement("pie-item-player") as any;
			player.strategy = "preloaded";
			player.env = { mode: "gather", role: "student" };
			player.session = { id: "missing-tags", data: [] };
			player.config = {
				elements: {
					"pie-runtime-missing": "@pie-element/multiple-choice@11.4.3",
				},
				models: [
					{
						id: "missing-tags-model",
						element: "pie-runtime-missing",
						prompt: "Missing tags prompt",
						choiceMode: "radio",
						choices: [
							{ value: "a", label: "A", correct: false },
							{ value: "b", label: "B", correct: true },
						],
					},
				],
				markup: '<pie-runtime-missing id="missing-tags-model"></pie-runtime-missing>',
			};
			fixture.appendChild(player);
		});

		await expect(page.getByText("Error loading elements (preloaded-readiness):")).toBeVisible(
			{ timeout: 20_000 },
		);
		expect(bundleRequests.length).toBe(baselineCount);
	});

	// NOTE: the previous "preloaded fallback can be explicitly opted in" test
	// was deleted together with the `allowPreloadedFallbackLoad` escape hatch.
	// `preloaded` now means "host pre-registered these elements; assert
	// loudly or throw" — there is no autonomous runtime fallback to load.
	// Hosts that want runtime loading should use `strategy="iife"` or
	// `strategy="esm"` instead.

	test("surfaces validate-config contract errors for invalid PIE references", async ({
		page,
	}) => {
		await page.goto(PRELOADED_DELIVERY_PATH, { waitUntil: "networkidle" });
		await expect(page.getByText(DELIVERY_PROMPT)).toBeVisible({ timeout: 20_000 });

		await page.evaluate(() => {
			const fixture = document.createElement("div");
			fixture.id = "pie-invalid-contract-fixture";
			document.body.appendChild(fixture);
			const player = document.createElement("pie-item-player") as any;
			player.strategy = "preloaded";
			player.env = { mode: "gather", role: "student" };
			player.session = { id: "invalid-contract", data: [] };
			player.config = {
				elements: {
					"pie-valid": "@pie-element/multiple-choice@11.4.3",
				},
				models: [
					{
						id: "invalid-model",
						element: "pie-missing",
					},
				],
				markup: '<pie-valid id="invalid-model"></pie-valid>',
			};
			fixture.appendChild(player);
		});

		await expect(page.getByText("Error loading elements (validate-config):")).toBeVisible({
			timeout: 20_000,
		});
	});

	test("iife emits media-retry-ready after first audio load failure", async ({ page }) => {
		await assertMediaRetryBridge(page, IIFE_DELIVERY_PATH);
	});

	test("iife uses client-player for standalone and player bundle for hosted mode", async ({
		page,
	}) => {
		const bundleRequests: string[] = [];
		page.on("request", (request) => {
			const url = request.url();
			if (url.includes("/bundles/")) bundleRequests.push(url);
		});

		await page.goto(IIFE_DELIVERY_PATH, { waitUntil: "networkidle" });
		await expect(page.getByText(DELIVERY_PROMPT)).toBeVisible({ timeout: 20_000 });

		await page.evaluate(() => {
			const fixture = document.createElement("div");
			fixture.id = "pie-hosted-bundle-type-fixture";
			document.body.appendChild(fixture);

			const sharedConfig = {
				elements: {
					"pie-multiple-choice": "@pie-element/multiple-choice@11.4.3",
				},
				models: [
					{
						id: "hosted-mode-check",
						element: "pie-multiple-choice",
						prompt: "Hosted mode bundle check",
						choiceMode: "radio",
						choices: [
							{ value: "a", label: "A", correct: false },
							{ value: "b", label: "B", correct: true },
						],
					},
				],
				markup: '<pie-multiple-choice id="hosted-mode-check"></pie-multiple-choice>',
			};

			const standalone = document.createElement("pie-item-player") as any;
			standalone.strategy = "iife";
			standalone.hosted = false;
			standalone.env = { mode: "gather", role: "student" };
			standalone.session = { id: "standalone-session", data: [] };
			standalone.config = sharedConfig;
			fixture.appendChild(standalone);

			const hosted = document.createElement("pie-item-player") as any;
			hosted.strategy = "iife";
			hosted.hosted = true;
			hosted.env = { mode: "gather", role: "student" };
			hosted.session = { id: "hosted-session", data: [] };
			hosted.config = sharedConfig;
			fixture.appendChild(hosted);
		});

		await expect
			.poll(() => bundleRequests.some((url) => url.includes("/client-player")))
			.toBe(true);
		await expect
			.poll(() => bundleRequests.some((url) => url.includes("/player")))
			.toBe(true);
	});

test.skip("esm emits media-retry-ready after first audio load failure", async ({ page }) => {
		await assertMediaRetryBridge(page, ESM_DELIVERY_PATH);
	});

	test("on runtime support check does not fail when metadata is missing", async ({
		page,
	}) => {
		await page.route("**/runtime-support*", async (route) => {
			await route.fulfill({
				status: 404,
				contentType: "application/javascript",
				body: "export default {};",
			});
		});

		// Use the IIFE strategy so the loader actually fetches a bundle
		// when `runtimeSupportCheck: "on"` is active. (Previously this test
		// relied on `allowPreloadedFallbackLoad` to coerce preloaded into
		// fetching a bundle; that escape hatch no longer exists.)
		await page.goto(IIFE_DELIVERY_PATH, { waitUntil: "networkidle" });
		await expect(page.getByText(DELIVERY_PROMPT)).toBeVisible({ timeout: 20_000 });

		await page.evaluate(() => {
			const fixture = document.createElement("div");
			fixture.id = "pie-runtime-support-strict-fixture";
			document.body.appendChild(fixture);
			const player = document.createElement("pie-item-player") as any;
			player.strategy = "iife";
			player.loaderOptions = {
				runtimeSupportCheck: "on",
			};
			player.env = { mode: "gather", role: "student" };
			player.session = { id: "strict-runtime-support", data: [] };
			player.config = {
				elements: {
					"pie-multiple-choice": "@pie-element/multiple-choice@11.4.3",
				},
				models: [
					{
						id: "strict-runtime-support-model",
						element: "pie-multiple-choice",
						prompt: "Strict runtime support prompt",
						choiceMode: "radio",
						choices: [
							{ value: "a", label: "A", correct: false },
							{ value: "b", label: "B", correct: true },
						],
					},
				],
				markup:
					'<pie-multiple-choice id="strict-runtime-support-model"></pie-multiple-choice>',
			};
			fixture.appendChild(player);
		});

		await expect(page.getByText("Strict runtime support prompt")).toBeVisible({
			timeout: 20_000,
		});
		await expect(page.getByText("Missing runtime-support metadata")).not.toBeVisible();
	});

	test("off runtime support check does not request metadata", async ({ page }) => {
		let runtimeSupportRequests = 0;
		await page.route("**/runtime-support*", async (route) => {
			runtimeSupportRequests += 1;
			await route.fallback();
		});

		// Use the IIFE strategy so the loader actually touches runtime-support
		// when the option is active. (See the "strict" test above for why.)
		await page.goto(IIFE_DELIVERY_PATH, { waitUntil: "networkidle" });
		await expect(page.getByText(DELIVERY_PROMPT)).toBeVisible({ timeout: 20_000 });

		await page.evaluate(() => {
			const fixture = document.createElement("div");
			fixture.id = "pie-runtime-support-off-fixture";
			document.body.appendChild(fixture);
			const player = document.createElement("pie-item-player") as any;
			player.strategy = "iife";
			player.loaderOptions = {
				runtimeSupportCheck: "off",
			};
			player.env = { mode: "gather", role: "student" };
			player.session = { id: "off-runtime-support", data: [] };
			player.config = {
				elements: {
					"pie-multiple-choice": "@pie-element/multiple-choice@11.4.3",
				},
				models: [
					{
						id: "off-runtime-support-model",
						element: "pie-multiple-choice",
						prompt: "Off runtime support prompt",
						choiceMode: "radio",
						choices: [
							{ value: "a", label: "A", correct: false },
							{ value: "b", label: "B", correct: true },
						],
					},
				],
				markup:
					'<pie-multiple-choice id="off-runtime-support-model"></pie-multiple-choice>',
			};
			fixture.appendChild(player);
		});

		await expect(page.getByText("Off runtime support prompt")).toBeVisible({
			timeout: 20_000,
		});
		await page.waitForTimeout(400);
		expect(runtimeSupportRequests).toBe(0);
	});

	test("metadata unsupported does not alter unrelated load errors", async ({ page }) => {
		await page.goto(PRELOADED_DELIVERY_PATH, { waitUntil: "networkidle" });
		await expect(page.getByText(DELIVERY_PROMPT)).toBeVisible({ timeout: 20_000 });

		await page.route("**/runtime-support*", async (route) => {
			await route.fulfill({
				status: 200,
				contentType: "application/javascript",
				headers: {
					"access-control-allow-origin": "*",
					"cache-control": "no-store",
				},
				body: `
          export default {
            schemaVersion: 1,
            supports: {
              iife: { delivery: false },
              esm: { delivery: true }
            }
          };
        `,
			});
		});

		await page.evaluate(() => {
			const fixture = document.createElement("div");
			fixture.id = "pie-runtime-support-hint-fixture";
			document.body.appendChild(fixture);
			const player = document.createElement("pie-item-player") as any;
			player.strategy = "preloaded";
			player.loaderOptions = {
				runtimeSupportCheck: "on",
			};
			player.env = { mode: "gather", role: "student" };
			player.session = { id: "hint-runtime-support", data: [] };
			player.config = {
				elements: {
					"pie-hint-mode": "@pie-element/multiple-choice@11.4.3-hint",
				},
				models: [
					{
						id: "hint-runtime-support-model",
						element: "pie-hint-mode",
						prompt: "Hint runtime support prompt",
						choiceMode: "radio",
						choices: [
							{ value: "a", label: "A", correct: false },
							{ value: "b", label: "B", correct: true },
						],
					},
				],
				markup: '<pie-hint-mode id="hint-runtime-support-model"></pie-hint-mode>',
			};
			fixture.appendChild(player);
		});

		await expect(page.getByText("Error loading elements (preloaded-readiness):")).toBeVisible(
			{ timeout: 20_000 },
		);
		await expect(page.getByText("Missing runtime-support metadata")).not.toBeVisible();
	});
});
