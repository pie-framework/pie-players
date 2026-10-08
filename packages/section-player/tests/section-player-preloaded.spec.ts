import { createRequire } from "node:module";
import { expect, type Page, test } from "@playwright/test";
import { createUniversalPersonalNeedsProfile } from "@pie-players/pie-default-tool-loaders";
import {
	openPreloadedBase,
	PRELOADED_SECTION,
	REGISTERED_SPECS,
} from "./fixtures/preloaded-section";

const SPLITPANE_PRELOADED_PATH =
	"/tts-ssml?mode=candidate&layout=splitpane&player=preloaded";
const VERTICAL_PRELOADED_PATH =
	"/tts-ssml?mode=candidate&layout=vertical&player=preloaded";
// Off-origin element code: PITS bundles, or a CDN's pie package.
const ELEMENT_CODE_REQUEST =
	/\/bundles\/|\/(?:npm\/)?@pie-(?:element|lib|elements-ng)\/|esm\.sh\//;
// The demo pages register the packages demo-ui installs.
const requireFromDemoUi = createRequire(
	new URL("../../../apps/demo-ui/package.json", import.meta.url),
);
function installedSpec(name: string): string {
	const { version } = requireFromDemoUi(`${name}/package.json`) as {
		version: string;
	};
	return `${name}@${version}`;
}

// The demo players are not hosted, so each registered element needs the
// controller whose `model()` the player runs.
function collectMissingControllerWarnings(page: Page): string[] {
	const warnings: string[] = [];
	page.on("console", (message) => {
		if (message.text().includes("is registered without a controller")) {
			warnings.push(message.text());
		}
	});
	return warnings;
}

test.describe("section player preloaded strategy", () => {
	test("splitpane renders item shells with preloaded strategy", async ({
		page,
		baseURL,
	}) => {
		const elementRequests: string[] = [];
		page.on("request", (request) => {
			const url = request.url();
			if (!url.startsWith(`${baseURL}/`) && ELEMENT_CODE_REQUEST.test(url)) {
				elementRequests.push(url);
			}
		});
		const controllerWarnings = collectMissingControllerWarnings(page);

		await page.goto(SPLITPANE_PRELOADED_PATH, { waitUntil: "networkidle" });
		await expect(page.locator(".preload-status")).toHaveCount(0, {
			timeout: 30_000,
		});
		await expect(page.getByRole("main", { name: "Items" })).toBeVisible({
			timeout: 30_000,
		});
		// Two items, not three: `q2-find-factors` was dropped from the tts-ssml
		// fixture in f3dffd7d (PIE-619). The passage is a `pie-passage-shell`, so it
		// is not in this count.
		await expect(
			page.locator('pie-item-scope[data-pie-shell-root="item"]'),
		).toHaveCount(2, { timeout: 30_000 });
		// The passage's math is typeset by its passage element.
		await expect(
			page
				.getByRole("complementary", { name: "Passages" })
				.locator("p.formula mjx-container"),
		).toBeVisible({ timeout: 30_000 });

		const playerAttrs = await page
			.locator("pie-item-player")
			.evaluateAll((els) =>
				els.map((el) => ({
					strategy: el.getAttribute("strategy"),
				})),
			);
		expect(playerAttrs.length).toBeGreaterThan(0);
		for (const attrs of playerAttrs) {
			expect(attrs.strategy).toBe("preloaded");
		}

		// The page registers each package at the version demo-ui installs.
		const preloaded = await page.evaluate(
			() =>
				(window as { PIE_PRELOADED_ELEMENTS?: Record<string, string> })
					.PIE_PRELOADED_ELEMENTS ?? {},
		);
		expect(Object.keys(preloaded).length).toBeGreaterThan(0);
		for (const [name, spec] of Object.entries(preloaded)) {
			expect(spec).toBe(installedSpec(name));
		}
		expect(elementRequests).toEqual([]);
		expect(controllerWarnings).toEqual([]);
	});

	test("vertical layout renders with preloaded strategy", async ({ page }) => {
		await page.goto(VERTICAL_PRELOADED_PATH, { waitUntil: "networkidle" });
		await expect(page.locator(".preload-status")).toHaveCount(0, {
			timeout: 30_000,
		});
		await expect(page.locator(".preload-status.error")).toHaveCount(0);
		// Two items, not three: `q2-find-factors` was dropped from the tts-ssml
		// fixture in f3dffd7d (PIE-619). The passage is a `pie-passage-shell`, so it
		// is not in this count.
		await expect(
			page.locator('pie-item-scope[data-pie-shell-root="item"]'),
		).toHaveCount(2, { timeout: 30_000 });
	});

	// These pages host their own section player, so they preload its elements
	// themselves.
	for (const path of ["/custom-tools", "/tts-toggle-speed"]) {
		test(`${path} renders under the preloaded player`, async ({ page }) => {
			const controllerWarnings = collectMissingControllerWarnings(page);
			await page.goto(
				`${path}?mode=candidate&layout=splitpane&player=preloaded`,
				{ waitUntil: "networkidle" },
			);
			await expect(
				page
					.locator(
						'pie-section-player-splitpane pie-item-player input[type="radio"]',
					)
					.first(),
			).toBeVisible({ timeout: 30_000 });
			await expect(page.locator(".preload-status")).toHaveCount(0);
			expect(controllerWarnings).toEqual([]);
		});
	}

	// The demo imports pie-elements-ng's browser builds and registers each with
	// its controller, so no request fetches element code. The full check of
	// that demo is section-player-preloaded-npm.spec.ts.
	test("host-bundled element renders with no element request", async ({
		page,
		baseURL,
	}) => {
		const pageModules: string[] = [];
		const elementRequests: string[] = [];
		page.on("request", (request) => {
			const url = request.url();
			if (url.startsWith(`${baseURL}/`)) {
				if (url.includes("mc-populated-blank")) pageModules.push(url);
			} else if (/\/bundles\/|\/@pie-element\//.test(url)) {
				elementRequests.push(url);
			}
		});
		const controllerWarnings = collectMissingControllerWarnings(page);

		await page.goto(
			"/preloaded-npm-elements?mode=candidate&layout=splitpane",
			{ waitUntil: "networkidle" },
		);
		await expect(page.locator(".preload-status")).toHaveCount(0);
		const choice = page
			.locator("#npm-mc-populated-blank-element")
			.getByRole("radio", { name: "teapot" });
		await expect(choice).toBeVisible({ timeout: 30_000 });
		await choice.click();
		await expect(choice).toBeChecked();

		// The element came with the page's own modules, and from nowhere else.
		expect(pageModules.length).toBeGreaterThan(0);
		expect(elementRequests).toEqual([]);
		expect(controllerWarnings).toEqual([]);
	});

	// The universal personal needs profile makes answer masking a granted
	// accommodation on both items. A grant skips the relevance gate, which is why
	// the eliminator used to reach `categorize` — an interaction whose `choices`
	// hold draggables the tool cannot strike through (PIE-935). The applicability
	// gate is the one a grant does not survive.
	test("answer eliminator reaches the choice item and not the categorize item", async ({
		page,
	}) => {
		await openPreloadedBase(page);
		await page.evaluate(
			({ section, specs, personalNeedsProfile }) => {
				const existing = document.querySelector("pie-section-player-splitpane");
				if (!existing?.parentElement) {
					throw new Error("demo section player not found");
				}
				(
					window as { PIE_PRELOADED_ELEMENTS?: Record<string, string> }
				).PIE_PRELOADED_ELEMENTS = { ...specs };
				const fresh = document.createElement(
					"pie-section-player-splitpane",
				) as HTMLElement & { runtime?: unknown; section?: unknown };
				fresh.setAttribute("assessment-id", "eliminator-assessment");
				fresh.setAttribute("section-id", "eliminator-section");
				fresh.setAttribute("attempt-id", `eliminator-${Date.now()}`);
				fresh.addEventListener("toolkit-ready", (event) => {
					(
						event as CustomEvent<{
							coordinator?: { updateAssessment(assessment: object): void };
						}>
					).detail?.coordinator?.updateAssessment({
						id: "eliminator-assessment",
						personalNeedsProfile,
					});
				});
				fresh.runtime = {
					playerType: "preloaded",
					env: { mode: "gather", role: "student" },
					tools: {
						placement: { section: [], item: ["answerEliminator"], passage: [] },
					},
				};
				fresh.section = section;
				const parent = existing.parentElement;
				existing.remove();
				parent.appendChild(fresh);
			},
			{
				section: PRELOADED_SECTION,
				specs: REGISTERED_SPECS,
				personalNeedsProfile: createUniversalPersonalNeedsProfile(),
			},
		);

		const itemShells = page.locator(
			'pie-item-scope[data-pie-shell-root="item"]',
		);
		const multipleChoice = itemShells.nth(0);
		const categorize = itemShells.nth(1);
		const eliminator = (scope: typeof multipleChoice) =>
			scope.getByRole("button", { name: /strike through/i });

		await expect(eliminator(multipleChoice)).toBeVisible({ timeout: 30_000 });
		await expect(eliminator(categorize)).toHaveCount(0);
	});

	test("forwards runtime.player.loaderConfig to embedded item players", async ({
		page,
	}) => {
		await page.goto("/tts-ssml?mode=candidate&layout=splitpane&player=iife", {
			waitUntil: "networkidle",
		});
		await expect(page.getByRole("main", { name: "Items" })).toBeVisible();
		await expect(page.locator("pie-item-player").first()).toBeVisible({
			timeout: 30_000,
		});

		await page.evaluate(() => {
			const sectionPlayer = document.querySelector(
				"pie-section-player-splitpane",
			) as HTMLElement & { runtime?: Record<string, unknown> };
			if (!sectionPlayer) {
				throw new Error("section player host not found");
			}
			sectionPlayer.runtime = {
				player: {
					loaderConfig: {
						trackPageActions: true,
						maxResourceRetries: 7,
						resourceRetryDelay: 321,
					},
				},
			};
		});

		await page.waitForFunction(() => {
			const players = Array.from(
				document.querySelectorAll("pie-item-player"),
			) as Array<HTMLElement & { loaderConfig?: Record<string, unknown> }>;
			if (!players.length) return false;
			return players.every((player) => {
				const cfg = player.loaderConfig;
				return (
					cfg?.trackPageActions === true &&
					cfg?.maxResourceRetries === 7 &&
					cfg?.resourceRetryDelay === 321
				);
			});
		});
	});

	test("reconfigures runtime loaderConfig and updates embedded item players", async ({
		page,
	}) => {
		await page.goto("/tts-ssml?mode=candidate&layout=splitpane&player=iife", {
			waitUntil: "networkidle",
		});
		await expect(page.locator("pie-item-player").first()).toBeVisible({
			timeout: 30_000,
		});

		await page.evaluate(() => {
			const sectionPlayer = document.querySelector(
				"pie-section-player-splitpane",
			) as HTMLElement & { runtime?: Record<string, unknown> };
			if (!sectionPlayer) {
				throw new Error("section player host not found");
			}
			sectionPlayer.runtime = {
				player: {
					loaderConfig: {
						trackPageActions: true,
						maxResourceRetries: 1,
						resourceRetryDelay: 10,
					},
				},
			};
		});

		await page.waitForFunction(() => {
			const players = Array.from(
				document.querySelectorAll("pie-item-player"),
			) as Array<
				HTMLElement & {
					loaderConfig?: {
						maxResourceRetries?: number;
						resourceRetryDelay?: number;
					};
				}
			>;
			if (players.length === 0) return false;
			return players.every(
				(player) =>
					player.loaderConfig?.maxResourceRetries === 1 &&
					player.loaderConfig?.resourceRetryDelay === 10,
			);
		});

		await page.evaluate(() => {
			const sectionPlayer = document.querySelector(
				"pie-section-player-splitpane",
			) as HTMLElement & { runtime?: Record<string, unknown> };
			if (!sectionPlayer) {
				throw new Error("section player host not found");
			}
			sectionPlayer.runtime = {
				player: {
					loaderConfig: {
						trackPageActions: true,
						maxResourceRetries: 2,
						resourceRetryDelay: 25,
					},
				},
			};
		});

		await page.waitForFunction(() => {
			const players = Array.from(
				document.querySelectorAll("pie-item-player"),
			) as Array<
				HTMLElement & {
					loaderConfig?: {
						maxResourceRetries?: number;
						resourceRetryDelay?: number;
					};
				}
			>;
			if (players.length === 0) return false;
			return players.every(
				(player) =>
					player.loaderConfig?.maxResourceRetries === 2 &&
					player.loaderConfig?.resourceRetryDelay === 25,
			);
		});
	});

	test("iife section strategy propagates verbatim to embedded item-players", async ({
		page,
	}) => {
		// The section-player no longer substitutes `iife` → `preloaded` on
		// embedded item-players. That substitution was the parent-to-child
		// state coupling behind the "missing tags: pie-passage--version-3-2-4"
		// section-swap race: the section-player pre-registered aggregate
		// elements once then rewrote the embedded strategy to `preloaded`,
		// so any later section-swap that added new tags produced items
		// asserting pre-registration the host had not done.
		//
		// Under the new architecture, section and items share the deep
		// `ElementLoader` primitive. The primitive deduplicates concurrent
		// identical load requests, so letting each item-player inherit
		// `iife` verbatim does not cost extra fetches — the aggregate pre-warm
		// satisfies every per-item call synchronously-ish.
		await page.goto("/tts-ssml?mode=candidate&layout=splitpane&player=iife", {
			waitUntil: "networkidle",
		});
		await expect(page.getByRole("main", { name: "Items" })).toBeVisible();
		await expect(page.locator("pie-item-player").first()).toBeVisible({
			timeout: 30_000,
		});
		const strategyValues = await page
			.locator("pie-item-player")
			.evaluateAll((els) => els.map((el) => el.getAttribute("strategy")));
		expect(strategyValues.length).toBeGreaterThan(0);
		for (const strategy of strategyValues) {
			expect(strategy).toBe("iife");
		}
	});

	test("derives runtime.player backend delivery per embedded item and auto-loads mounted items", async ({
		page,
	}) => {
		const loadCalls: Array<{
			itemId?: string;
			sessionId?: string;
			assignmentId?: string;
		}> = [];
		await page.route("**/qe-player/load", async (route) => {
			const body = JSON.parse(route.request().postData() || "{}");
			loadCalls.push(body);
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({
					item: {
						markup: "",
						elements: {},
						models: [],
					},
					session: {
						id: body.sessionId || "",
						data: [],
					},
					metadata: {
						itemId: body.itemId,
					},
				}),
			});
		});
		await page.goto("/tts-ssml?mode=candidate&layout=splitpane&player=iife", {
			waitUntil: "networkidle",
		});
		await expect(page.getByRole("main", { name: "Items" })).toBeVisible();
		const itemPlayerCount = await page.locator("main pie-item-player").count();
		expect(itemPlayerCount).toBeGreaterThan(0);

		await page.evaluate(() => {
			for (const shell of document.querySelectorAll(
				'pie-item-scope[data-pie-shell-root="item"]',
			)) {
				shell.setAttribute("data-remount-probe", "");
			}
			const sectionPlayer = document.querySelector(
				"pie-section-player-splitpane",
			) as HTMLElement & { runtime?: Record<string, unknown> };
			if (!sectionPlayer) {
				throw new Error("section player host not found");
			}
			sectionPlayer.runtime = {
				player: {
					backend: {
						delivery: {
							enabled: true,
							assignmentId: "qe-attempt-1",
							endpoints: {
								load: "/qe-player/load",
							},
						},
					},
				},
			};
		});

		await expect
			.poll(() => loadCalls.length, { timeout: 30_000 })
			.toBe(itemPlayerCount);

		// The cards must survive enabling the backend. Enabling it flips `hosted`,
		// which re-warms the element bundles; tearing the cards down to do that
		// destroyed every item player, discarded in-progress session state, and made
		// each item load twice — once from the dying instance, once from its
		// replacement. Element identity is the assertion that catches a remount.
		expect(
			await page.evaluate(
				() =>
					(
						window as unknown as { __pieShellIdentity?: unknown[] }
					).__pieShellIdentity?.length ?? 0,
			),
		).toBe(0);
		await page.waitForTimeout(500);
		expect(loadCalls).toHaveLength(itemPlayerCount);
		expect(new Set(loadCalls.map((call) => call.itemId)).size).toBe(
			itemPlayerCount,
		);
		expect(loadCalls.every((call) => call.assignmentId === "qe-attempt-1")).toBe(
			true,
		);
	});
});
