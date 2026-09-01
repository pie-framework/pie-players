import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { openDemoMenuIfCollapsed } from "../../../test-support/demo-menu";

const DEMO_ID = "multiple-choice-radio-simple";
const DELIVERY_PATH = `/demo/${DEMO_ID}/delivery?mode=gather&role=student`;
const AUTHOR_PATH = `/demo/${DEMO_ID}/author?mode=gather&role=student`;
const SOURCE_PATH = `/demo/${DEMO_ID}/source?mode=gather&role=student`;
const DELIVERY_PROMPT = "Which is the largest planet in our solar system?";
const SESSION_ENTRY_ID = "2";
const KNOWN_DELIVERY_ITEM_DEBT = new Set(["aria-allowed-attr"]);

type SessionSnapshot = {
	id?: string;
	data?: Array<{
		id?: string;
		value?: string[];
		selector?: string;
		[key: string]: unknown;
	}>;
	[key: string]: unknown;
};

type ChoiceState = {
	text: string;
	checked: boolean;
	disabled: boolean;
	ariaChecked: string | null;
};

type ExternalStyleProbe = {
	customClassName?: string;
	id: string;
	styleUrl: string;
};

async function mountExternalStyleProbes(
	page: Page,
	groupId: string,
	probes: ExternalStyleProbe[],
) {
	await page.evaluate(
		({ id, definitions }) => {
			const group = document.createElement("div");
			group.id = id;
			document.body.appendChild(group);
			for (const definition of definitions) {
				const player = document.createElement("pie-item-player") as any;
				group.appendChild(player);
				player.strategy = "preloaded";
				player.session = { id: `${definition.id}-session`, data: [] };
				player.externalStyleUrls = definition.styleUrl;
				if (definition.customClassName) {
					player.customClassName = definition.customClassName;
				}
				player.config = {
					id: definition.id,
					markup: `<p class="pie-style-probe" data-style-probe="${definition.id}">${definition.id}</p>`,
					elements: {},
					models: [],
				};
			}
		},
		{ id: groupId, definitions: probes },
	);
	await expect
		.poll(() => page.locator(`#${groupId} [data-style-probe]`).count())
		.toBe(probes.length);
}

async function gotoRoute(page: Page, path: string) {
	// `networkidle` is unreliable against vite dev (HMR websocket + lazy module
	// loads) — wait on the rendered nav link as the mount signal instead, with
	// the same generous timeout the rest of this file uses for client-only routes.
	await page.goto(path, { waitUntil: "domcontentloaded" });
	await expect(
		page.getByRole("navigation", { name: "Demo controls" }),
	).toBeVisible({ timeout: 15_000 });
	await openDemoMenuIfCollapsed(page);
	await expect(page.getByRole("link", { name: "Delivery" })).toBeVisible({
		timeout: 15_000,
	});
}

async function openSessionPanel(page: Page) {
	const panel = page.locator("pie-item-player-session-debugger");
	const sessionTab = page.getByRole("tab", { name: "Session" });
	if (await sessionTab.isVisible().catch(() => false)) {
		return panel;
	}
	await openDemoMenuIfCollapsed(page);
	await page.getByRole("button", { name: "Toggle item session panel" }).click();
	await expect(sessionTab).toBeVisible();
	return panel;
}

async function openInstrumentationPanel(page: Page) {
	const panel = page.locator(
		"pie-section-player-tools-instrumentation-debugger",
	);
	const firstRow = panel
		.locator(".pie-section-player-tools-instrumentation-debugger__row")
		.first();
	if (await firstRow.isVisible().catch(() => false)) {
		return panel;
	}
	await openDemoMenuIfCollapsed(page);
	await page
		.getByRole("button", { name: "Toggle instrumentation panel" })
		.click();
	await expect(
		panel.locator(".pie-section-player-tools-instrumentation-debugger"),
	).toBeVisible();
	return panel;
}

async function selectChoiceByLabel(page: Page, labelText: string) {
	await page
		.locator('label[for^="choice-"]')
		.filter({ hasText: labelText })
		.first()
		.click();
}

async function readSessionState(page: Page): Promise<SessionSnapshot> {
	const panel = await openSessionPanel(page);
	await panel.getByRole("tab", { name: "Session" }).click();
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

function selectedValueFromSession(session: SessionSnapshot): string | null {
	const entry = session.data?.find((item) => item.id === SESSION_ENTRY_ID);
	const value = entry?.value;
	return Array.isArray(value) ? (value[0] ?? null) : null;
}

async function readChoiceStates(page: Page): Promise<ChoiceState[]> {
	return await page.evaluate(() => {
		const labels = Array.from(
			document.querySelectorAll('label[for^="choice-"]'),
		);
		return labels.map((label) => {
			const choiceId = label.getAttribute("for") || "";
			const input = document.getElementById(
				choiceId,
			) as HTMLInputElement | null;
			return {
				text: (label.textContent || "").replace(/\s+/g, " ").trim(),
				checked: Boolean(input?.checked),
				disabled: Boolean(input?.disabled),
				ariaChecked:
					label.querySelector("[aria-checked]")?.getAttribute("aria-checked") ||
					null,
			};
		});
	});
}

async function setDemoPerspective(
	page: Page,
	perspective: "student" | "scorer",
) {
	await page
		.getByRole("link", {
			name: perspective === "student" ? "Student" : "Scorer",
		})
		.click();
	if (perspective === "student") {
		await expect(page).toHaveURL(/mode=gather/);
		await expect(page).toHaveURL(/role=student/);
		return;
	}
	await expect(page).toHaveURL(/mode=evaluate/);
	await expect(page).toHaveURL(/role=instructor/);
}

function getCheckedChoiceLabel(choiceStates: ChoiceState[]): string | null {
	return choiceStates.find((state) => state.checked)?.text || null;
}

async function replaceSourcePrompt(page: Page, nextPrompt: string) {
	const editor = page.locator(".ProseMirror").first();
	await expect(editor).toBeVisible();
	const currentConfig = JSON.parse(await editor.innerText()) as {
		models?: Array<{ prompt?: string }>;
	};
	if (!currentConfig.models?.[0]) {
		throw new Error("Source editor JSON does not include models[0]");
	}
	currentConfig.models[0].prompt = nextPrompt;
	const nextJson = JSON.stringify(currentConfig, null, 2);
	await editor.click();
	await page.keyboard.press(
		process.platform === "darwin" ? "Meta+A" : "Control+A",
	);
	await page.keyboard.press("Backspace");
	await page.keyboard.insertText(nextJson);
	await expect(editor).toContainText(nextPrompt);
}

test.describe("item-player demo multiple-choice", () => {
	test("delivery supports gather/evaluate transitions with carried session state", async ({
		page,
	}) => {
		await gotoRoute(page, DELIVERY_PATH);
		await expect(page.getByText(DELIVERY_PROMPT)).toBeVisible();
		const apiSnapshot = await page.evaluate(() => {
			const player = document.querySelector("pie-item-player") as any;
			return {
				provideScore: typeof player?.provideScore,
				updateElementModel: typeof player?.updateElementModel,
				loaderOptionsBundleHost: player?.loaderOptions?.bundleHost,
			};
		});
		expect(apiSnapshot).toEqual({
			provideScore: "function",
			updateElementModel: "function",
			loaderOptionsBundleHost: "https://proxy.pie-api.com/bundles/",
		});

		// Gather mode supports mouse selection.
		const firstSessionChangedDetail = page.evaluate(
			() =>
				new Promise((resolve) => {
					const player = document.querySelector("pie-item-player");
					player?.addEventListener(
						"session-changed",
						(event) => {
							const detail = (event as CustomEvent).detail;
							resolve({
								hasSession: !!detail?.session,
								sessionDataIsArray: Array.isArray(detail?.session?.data),
								hasCompleteField: "complete" in (detail || {}),
							});
						},
						{ once: true },
					);
				}),
		);
		await selectChoiceByLabel(page, "Mars");
		await expect(firstSessionChangedDetail).resolves.toEqual({
			hasSession: true,
			sessionDataIsArray: true,
			hasCompleteField: true,
		});
		const sessionAfterMouse = await readSessionState(page);
		const selectedAfterMouse = selectedValueFromSession(sessionAfterMouse);
		expect(selectedAfterMouse).not.toBeNull();

		const localScore = await page.evaluate(async () => {
			const player = document.querySelector("pie-item-player") as any;
			const result = await player.provideScore();
			const first = Array.isArray(result) ? result[0] : null;
			return {
				isArray: Array.isArray(result),
				length: Array.isArray(result) ? result.length : 0,
				firstId: first?.id,
				hasScore: typeof first?.score === "number",
			};
		});
		expect(localScore).toEqual({
			isArray: true,
			length: 1,
			firstId: SESSION_ENTRY_ID,
			hasScore: true,
		});

		const noModelScore = await page.evaluate(async () => {
			const fixture = document.createElement("div");
			document.body.appendChild(fixture);
			const player = document.createElement("pie-item-player") as any;
			const loaded = new Promise((resolve) => {
				player.addEventListener("load-complete", resolve, { once: true });
			});
			player.config = {
				id: "html-only",
				markup: "<p>No scored models</p>",
				elements: {},
				models: [],
			};
			player.session = { id: "html-only-session", data: [] };
			player.env = { mode: "gather", role: "student" };
			fixture.appendChild(player);
			await loaded;
			return player.provideScore();
		});
		expect(noModelScore).toBe(false);

		// Gather mode supports keyboard selection and session updates dynamically.
		const checkedChoiceBeforeKeyboard = page
			.locator('input[type="radio"]:checked')
			.first();
		await expect(checkedChoiceBeforeKeyboard).toBeVisible();
		await checkedChoiceBeforeKeyboard.focus();
		await page.keyboard.press("ArrowDown");
		const sessionAfterKeyboard = await readSessionState(page);
		const selectedAfterKeyboard =
			selectedValueFromSession(sessionAfterKeyboard);
		expect(selectedAfterKeyboard).not.toBeNull();
		expect(selectedAfterKeyboard).not.toBe(selectedAfterMouse);

		// Return to a deterministic wrong selection before evaluate mode assertions.
		await selectChoiceByLabel(page, "Mars");
		const sessionBeforeEvaluate = await readSessionState(page);
		const selectedBeforeEvaluate = selectedValueFromSession(
			sessionBeforeEvaluate,
		);
		expect(selectedBeforeEvaluate).not.toBeNull();

		await setDemoPerspective(page, "scorer");
		await expect(page.getByText(DELIVERY_PROMPT)).toBeVisible({
			timeout: 15_000,
		});

		// Evaluate mode keeps session state and exposes correct-answer affordance.
		const evaluateChoiceStates = await readChoiceStates(page);
		expect(
			evaluateChoiceStates.some((state) => state.checked && state.disabled),
		).toBe(true);
		const sessionInEvaluate = await readSessionState(page);
		const selectedInEvaluate = selectedValueFromSession(sessionInEvaluate);
		expect(selectedInEvaluate).toBe(selectedBeforeEvaluate);

		// Switching back to student carries session state from gather.
		await setDemoPerspective(page, "student");
		await expect(page.getByText(DELIVERY_PROMPT)).toBeVisible({
			timeout: 15_000,
		});
		await expect
			.poll(async () => {
				const states = await readChoiceStates(page);
				return getCheckedChoiceLabel(states);
			})
			.not.toBeNull();
		const gatherStatesAfterSwitchBack = await readChoiceStates(page);
		expect(gatherStatesAfterSwitchBack.some((state) => state.checked)).toBe(
			true,
		);
		const sessionAfterSwitchBack = await readSessionState(page);
		const selectedAfterSwitchBackValue = selectedValueFromSession(
			sessionAfterSwitchBack,
		);
		expect(selectedAfterSwitchBackValue).toBe(selectedBeforeEvaluate);
	});

	test("supports additive legacy host APIs without changing canonical prop precedence", async ({
		page,
	}) => {
		await gotoRoute(page, DELIVERY_PATH);
		await expect(page.getByText(DELIVERY_PROMPT)).toBeVisible();

		const updatedPrompt = "Updated through updateElementModel";
		await page.evaluate(
			async ({ prompt, modelId }) => {
				const player = document.querySelector("pie-item-player") as any;
				await player.updateElementModel({ id: modelId, prompt });
			},
			{ prompt: updatedPrompt, modelId: SESSION_ENTRY_ID },
		);
		await expect(page.getByText(updatedPrompt)).toBeVisible();

		await page.evaluate(async () => {
			const player = document.querySelector("pie-item-player") as any;
			const currentConfig = structuredClone(player.config);
			const loaded = new Promise((resolve) => {
				player.addEventListener("load-complete", resolve, { once: true });
			});
			player.customClassName = "canonical-current-class";
			player.customClassname = "legacy-class-should-not-win";
			player.renderStimulus = true;
			player.allowedResize = true;
			player.passageContainerClass = "legacy-passage-class";
			player.baseHeadingLevel = 3;
			player.config = {
				id: "advanced-item",
				pie: currentConfig,
				passage: {
					id: "passage",
					markup: '<p data-test-passage="true">Legacy stimulus passage</p>',
					elements: {},
					models: [],
				},
			};
			await loaded;
		});

		await expect(page.locator(".legacy-passage-class")).toContainText(
			"Legacy stimulus passage",
		);
		await expect(
			page.locator("pie-item-player .pie-item-player--resize-allowed"),
		).toBeVisible();
		const advancedScore = await page.evaluate(async () => {
			const player = document.querySelector("pie-item-player") as any;
			const result = await player.provideScore();
			return {
				isArray: Array.isArray(result),
				length: Array.isArray(result) ? result.length : 0,
				firstId: Array.isArray(result) ? result[0]?.id : null,
			};
		});
		expect(advancedScore).toEqual({
			isArray: true,
			length: 1,
			firstId: SESSION_ENTRY_ID,
		});
		const scopedClassName = await page
			.locator("pie-item-player .pie-item-player")
			.first()
			.evaluate((element) => element.className);
		expect(scopedClassName).toContain("canonical-current-class");
		expect(scopedClassName).not.toContain("legacy-class-should-not-win");
	});

	test("isolates different same-origin stylesheets between default player instances", async ({
		page,
	}) => {
		await page.route("**/__pie-style-first.css", (route) =>
			route.fulfill({
				body: ".pie-style-probe { color: rgb(17, 34, 51); }",
				contentType: "text/css",
			}),
		);
		await page.route("**/__pie-style-second.css", (route) =>
			route.fulfill({
				body: ".pie-style-probe { color: rgb(68, 85, 102); }",
				contentType: "text/css",
			}),
		);
		await gotoRoute(page, DELIVERY_PATH);
		await mountExternalStyleProbes(page, "default-style-probes", [
			{ id: "default-first", styleUrl: "/__pie-style-first.css" },
			{ id: "default-second", styleUrl: "/__pie-style-second.css" },
		]);

		const firstProbe = page.locator('[data-style-probe="default-first"]');
		const secondProbe = page.locator('[data-style-probe="default-second"]');
		await expect
			.poll(() =>
				firstProbe.evaluate((element) => getComputedStyle(element).color),
			)
			.toBe("rgb(17, 34, 51)");
		await expect
			.poll(() =>
				secondProbe.evaluate((element) => getComputedStyle(element).color),
			)
			.toBe("rgb(68, 85, 102)");

		const playerClasses = await page
			.locator("#default-style-probes pie-item-player > .pie-item-player")
			.evaluateAll((elements) =>
				elements.map((element) => [...element.classList]),
			);
		expect(playerClasses).toHaveLength(2);
		const privateStyleScopes = playerClasses.map((classes) =>
			classes.find((name) => name.startsWith("pie-item-player-style-scope-")),
		);
		expect(privateStyleScopes.every(Boolean)).toBe(true);
		expect(new Set(privateStyleScopes).size).toBe(2);
	});

	test("shares one fetch while materializing the stylesheet for each explicit scope", async ({
		page,
	}) => {
		let stylesheetRequests = 0;
		let noteFirstRequest!: () => void;
		let releaseStylesheetResponse!: () => void;
		const firstRequest = new Promise<void>((resolve) => {
			noteFirstRequest = resolve;
		});
		const responseGate = new Promise<void>((resolve) => {
			releaseStylesheetResponse = resolve;
		});
		await page.route("**/__pie-style-shared.css", async (route) => {
			stylesheetRequests += 1;
			noteFirstRequest();
			await responseGate;
			return route.fulfill({
				body: ".pie-style-probe { border-top: 3px solid rgb(119, 136, 153); }",
				contentType: "text/css",
			});
		});
		await gotoRoute(page, DELIVERY_PATH);
		await mountExternalStyleProbes(page, "custom-style-probes", [
			{
				customClassName: "first-explicit-style-scope",
				id: "custom-first",
				styleUrl: "/__pie-style-shared.css",
			},
			{
				customClassName: "second-explicit-style-scope",
				id: "custom-second",
				styleUrl: "/__pie-style-shared.css",
			},
		]);
		try {
			await firstRequest;
			await page.evaluate(
				() =>
					new Promise<void>((resolve) =>
						requestAnimationFrame(() => resolve()),
					),
			);
			expect(stylesheetRequests).toBe(1);
		} finally {
			releaseStylesheetResponse();
		}

		for (const id of ["custom-first", "custom-second"]) {
			const probe = page.locator(`[data-style-probe="${id}"]`);
			await expect
				.poll(() =>
					probe.evaluate((element) => getComputedStyle(element).borderTopColor),
				)
				.toBe("rgb(119, 136, 153)");
		}
		expect(stylesheetRequests).toBe(1);
	});

	test("honors legacy config resources without dropping advanced config properties", async ({
		page,
	}) => {
		await gotoRoute(page, DELIVERY_PATH);
		await expect(page.getByText(DELIVERY_PROMPT)).toBeVisible();

		await page.evaluate(async () => {
			const player = document.querySelector("pie-item-player") as any;
			const currentConfig = structuredClone(player.config);
			const loaded = new Promise((resolve) => {
				player.addEventListener("load-complete", resolve, { once: true });
			});
			player.config = {
				id: "advanced-item-with-resources",
				pie: {
					...currentConfig,
					resources: {
						containerClass: "resource-container-class",
						passageContainerClass: "resource-passage-class",
					},
				},
				passage: {
					id: "passage",
					markup: '<p data-test-passage="true">Legacy resource passage</p>',
					elements: {},
					models: [],
				},
				defaultExtraModels: {
					legacyExtra: { preserved: true },
				},
			};
			await loaded;
		});

		await expect(
			page.locator("pie-item-player .resource-container-class"),
		).toBeVisible();
		await expect(page.locator(".resource-passage-class")).toContainText(
			"Legacy resource passage",
		);
		const defaultExtraModels = await page.evaluate(() => {
			const player = document.querySelector("pie-item-player") as any;
			return player.config.defaultExtraModels;
		});
		expect(defaultExtraModels).toEqual({ legacyExtra: { preserved: true } });
	});

	test("author route loads and stays in sync with delivery/source", async ({
		page,
	}) => {
		await gotoRoute(page, AUTHOR_PATH);
		await expect(page).toHaveURL(/\/author/);
		await expect(page.getByText("Configuration Error")).toHaveCount(0);

		await page.getByRole("link", { name: "Delivery" }).click();
		await expect(page).toHaveURL(/\/delivery/);
		await expect(page.getByText(DELIVERY_PROMPT)).toBeVisible();

		await page.getByRole("link", { name: "Source" }).click();
		await expect(page).toHaveURL(/\/source/);
		await expect(page.locator(".ProseMirror").first()).toContainText(
			DELIVERY_PROMPT,
		);
	});

	test("source edits apply and sync to delivery and author", async ({
		page,
	}) => {
		const sourcePrompt =
			"Source test prompt: Select the planet with the greatest moon count.";
		await gotoRoute(page, SOURCE_PATH);
		await expect(page).toHaveURL(/\/source/);

		await replaceSourcePrompt(page, sourcePrompt);
		await expect(page.getByText("Unsaved changes")).toBeVisible();
		await expect(page.getByRole("button", { name: "Apply" })).toBeEnabled();
		await page.getByRole("button", { name: "Apply" }).click();
		await expect(page.getByText("Changes applied.")).toBeVisible();

		await page.getByRole("link", { name: "Delivery" }).click();
		await expect(page).toHaveURL(/\/delivery/);
		await expect(page.getByText(sourcePrompt)).toBeVisible();

		await page.getByRole("link", { name: "Author" }).click();
		await expect(page).toHaveURL(/\/author/);
		await expect(page.getByText("Configuration Error")).toHaveCount(0);
		await expect(
			page.getByText("Single Select (Radio) - Author"),
		).toBeVisible();

		await page.getByRole("link", { name: "Source" }).click();
		await expect(page).toHaveURL(/\/source/);
		await expect(page.locator(".ProseMirror").first()).toContainText(
			sourcePrompt,
		);
	});

	test("keeps baseline a11y regressions in check", async ({ page }) => {
		await gotoRoute(page, DELIVERY_PATH);

		// Scope the automated check to the rendered player surface so the baseline
		// stays generic to pie-item-player and does not conflate demo-route chrome
		// with delivery-item accessibility debt.
		const axeResults = await new AxeBuilder({ page })
			.include("pie-item-player")
			.disableRules(["region"])
			.analyze();
		const seriousOrCritical = axeResults.violations.filter((violation) =>
			["serious", "critical"].includes(violation.impact || ""),
		);
		const unexpectedSeriousOrCritical = seriousOrCritical.filter(
			(violation) => !KNOWN_DELIVERY_ITEM_DEBT.has(violation.id),
		);

		expect(
			unexpectedSeriousOrCritical,
			`Unexpected delivery-item axe serious/critical violations in pie-item-player: ${JSON.stringify(
				unexpectedSeriousOrCritical,
				null,
				2,
			)}\nKnown delivery-item blockers (currently upstream, not fixed in pie-players): ${JSON.stringify(
				seriousOrCritical,
				null,
				2,
			)}`,
		).toEqual([]);
	});

	test("renders instrumentation records in instrumentation panel", async ({
		page,
	}) => {
		await gotoRoute(page, DELIVERY_PATH);
		const panel = await openInstrumentationPanel(page);
		await page.evaluate(() => {
			window.dispatchEvent(
				new CustomEvent("pie-instrumentation-debug-record", {
					detail: {
						id: 1,
						kind: "event",
						providerId: "test",
						providerName: "Test Provider",
						timestamp: new Date().toISOString(),
						name: "pie-item-test-event",
						attributes: { component: "pie-item-player" },
					},
				}),
			);
		});
		await expect(
			panel
				.locator(".pie-section-player-tools-instrumentation-debugger__row")
				.first(),
		).toBeVisible({ timeout: 30_000 });
		// Assert the dispatched record itself lands in the list. The demo already
		// emits bootstrap records, so a row being visible is not evidence on its
		// own that the panel ingested this one.
		await expect(
			panel.getByText("pie-item-test-event", { exact: true }),
		).toBeVisible({ timeout: 30_000 });
	});

	test("keeps ingesting instrumentation records when ids collide", async ({
		page,
	}) => {
		// The debug-record stream is an open window event: hosts, demo pages and
		// tests dispatch synthetic records with hand-written ids that repeat the
		// ids the provider stream hands out. The panel used to key its `{#each}`
		// on `record.id`, so a repeat threw each_key_duplicate and froze the list
		// — every later record was silently dropped while the test still passed.
		const svelteErrors: string[] = [];
		page.on("pageerror", (error) => {
			if (String(error).includes("svelte.dev/e/")) {
				svelteErrors.push(String(error));
			}
		});
		await gotoRoute(page, DELIVERY_PATH);
		const panel = await openInstrumentationPanel(page);
		const rows = panel.locator(
			".pie-section-player-tools-instrumentation-debugger__row",
		);
		const baselineRowCount = await rows.count();

		await page.evaluate(() => {
			const dispatchRecord = (id: number, name: string) => {
				window.dispatchEvent(
					new CustomEvent("pie-instrumentation-debug-record", {
						detail: {
							id,
							kind: "event",
							providerId: "test",
							providerName: "Test Provider",
							timestamp: new Date().toISOString(),
							name,
							attributes: { component: "pie-item-player" },
						},
					}),
				);
			};
			// `id: 1` also collides with the demo's first bootstrap record.
			dispatchRecord(1, "pie-item-duplicate-id-first");
			dispatchRecord(1, "pie-item-duplicate-id-second");
		});

		await expect(rows).toHaveCount(baselineRowCount + 2, { timeout: 30_000 });
		await expect(
			panel.getByText("pie-item-duplicate-id-first", { exact: true }),
		).toBeVisible();
		await expect(
			panel.getByText("pie-item-duplicate-id-second", { exact: true }),
		).toBeVisible();

		// Selecting one of the colliding rows must highlight exactly that row and
		// show its details, not the other record that shares its id.
		await panel
			.getByText("pie-item-duplicate-id-first", { exact: true })
			.click();
		await expect(
			panel.locator(
				".pie-section-player-tools-instrumentation-debugger__row--active",
			),
		).toHaveCount(1);
		await expect(
			panel.locator(
				".pie-section-player-tools-instrumentation-debugger__detail-meta",
			),
		).toContainText("pie-item-duplicate-id-first");

		// The list stays live for records that arrive after the collision.
		await page.evaluate(() => {
			window.dispatchEvent(
				new CustomEvent("pie-instrumentation-debug-record", {
					detail: {
						id: 2,
						kind: "event",
						providerId: "test",
						providerName: "Test Provider",
						timestamp: new Date().toISOString(),
						name: "pie-item-after-duplicate-id",
						attributes: { component: "pie-item-player" },
					},
				}),
			);
		});
		await expect(rows).toHaveCount(baselineRowCount + 3, { timeout: 30_000 });
		await expect(
			panel.getByText("pie-item-after-duplicate-id", { exact: true }),
		).toBeVisible();

		expect(
			svelteErrors,
			`Unexpected Svelte runtime errors: ${JSON.stringify(svelteErrors, null, 2)}`,
		).toEqual([]);
	});
});
