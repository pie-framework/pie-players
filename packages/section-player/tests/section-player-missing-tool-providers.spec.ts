import { expect, type Page, test } from "@playwright/test";

// A coordinator registers tool providers only from its own `toolRegistry`, while
// the toolbar renders from the section player's. Each test replaces the demo's
// player (whose host coordinator shares the player's registry) with a fresh one
// whose runtime either supplies a coordinator built without `toolRegistry`, as
// Host R's section demos do, or none, so the player builds its own.
const DEMO_PATH = "/three-questions?mode=candidate&layout=splitpane";
const LAYOUT_TAG = "pie-section-player-splitpane";
const PROVIDER_WARNING = "[pie-section-player] Placed tool";
const CALCULATOR_WARNING = `${PROVIDER_WARNING} "calculator" uses provider "calculator-desmos"`;
const NEW_WARNINGS = [
	PROVIDER_WARNING,
	"falls back to browser speech",
	"registers no tool providers",
];

function captureWarnings(page: Page): string[] {
	const warnings: string[] = [];
	page.on("console", (message) => {
		if (message.type() === "warning") warnings.push(message.text());
	});
	return warnings;
}

const matching = (lines: string[], fragment: string) =>
	lines.filter((line) => line.includes(fragment));

async function openDemo(page: Page, player: string): Promise<void> {
	await page.goto(`${DEMO_PATH}&player=${player}`, { waitUntil: "networkidle" });
	await expect(calculatorButton(page)).toBeVisible({ timeout: 30_000 });
}

/** Replaces the demo's player; `bare` supplies a coordinator with no registry. */
async function mountFreshPlayer(page: Page, coordinator: "bare" | "own") {
	await page.evaluate(
		({ tag, mode }) => {
			const existing = document.querySelector(tag) as
				| (HTMLElement & {
						runtime?: Record<string, unknown>;
						section?: unknown;
						toolRegistry?: unknown;
				  })
				| null;
			if (!existing?.parentElement) throw new Error(`${tag} not found`);
			const runtime = existing.runtime ?? {};
			const demoCoordinator = runtime.coordinator as {
				constructor: new (
					config: object,
				) => { updateAssessment(assessment: object): void };
				config: { toolContextResolvers?: unknown };
			};
			// The demo's item-metadata resolvers are what show the calculator here.
			const toolContextResolvers = demoCoordinator.config.toolContextResolvers;
			const section = existing.section as { personalNeedsProfile?: unknown };
			let hostCoordinator: object | undefined;
			if (mode === "bare") {
				const bare = new demoCoordinator.constructor({
					assessmentId: "missing-providers-assessment",
					toolConfigStrictness: "error",
					tools: runtime.tools,
					toolContextResolvers,
				});
				bare.updateAssessment({
					id: "missing-providers-assessment",
					personalNeedsProfile: section.personalNeedsProfile,
				});
				hostCoordinator = bare;
			}
			const fresh = document.createElement(tag) as HTMLElement & {
				runtime?: unknown;
				section?: unknown;
				toolRegistry?: unknown;
			};
			for (const name of existing.getAttributeNames()) {
				fresh.setAttribute(name, existing.getAttribute(name) ?? "");
			}
			fresh.setAttribute("attempt-id", `missing-providers-${Date.now()}`);
			if (mode === "own") {
				// A host on the player's own coordinator binds the assessment through it.
				fresh.addEventListener("toolkit-ready", (event) => {
					(
						event as CustomEvent<{
							coordinator?: { updateAssessment(assessment: object): void };
						}>
					).detail?.coordinator?.updateAssessment({
						id: "missing-providers-assessment",
						personalNeedsProfile: section.personalNeedsProfile,
					});
				});
			}
			fresh.toolRegistry = existing.toolRegistry;
			fresh.section = existing.section;
			fresh.runtime = {
				...runtime,
				toolContextResolvers,
				coordinator: hostCoordinator,
			};
			const parent = existing.parentElement;
			existing.remove();
			parent.appendChild(fresh);
		},
		{ tag: LAYOUT_TAG, mode: coordinator },
	);
	await expect(calculatorButton(page)).toBeVisible({ timeout: 30_000 });
}

function calculatorButton(page: Page) {
	return page
		.locator(LAYOUT_TAG)
		.getByRole("button", { name: "Calculator", exact: true })
		.first();
}

for (const player of ["iife", "esm"]) {
	test.describe(`missing tool providers under the ${player} player`, () => {
		test("a host coordinator without toolRegistry reports the calculator's provider once", async ({
			page,
		}) => {
			const warnings = captureWarnings(page);
			await openDemo(page, player);
			// The demo's own host coordinator shares the player's registry.
			expect(matching(warnings, PROVIDER_WARNING)).toEqual([]);

			await mountFreshPlayer(page, "bare");
			await expect
				.poll(() => matching(warnings, CALCULATOR_WARNING).length, {
					timeout: 30_000,
				})
				.toBe(1);
			const calculator = calculatorButton(page);
			await calculator.click();
			await calculator.click();
			// Room for a late duplicate to land.
			await page.waitForTimeout(500);

			expect(matching(warnings, CALCULATOR_WARNING)).toHaveLength(1);
			expect(matching(warnings, CALCULATOR_WARNING)[0]).toContain(
				"createPackagedToolRegistry()",
			);
			await expect(
				page.locator('[data-pie-tool-shell="calculator"]:visible'),
			).toHaveCount(0);
		});

		test("the player's own coordinator reports nothing", async ({ page }) => {
			const warnings = captureWarnings(page);
			await openDemo(page, player);

			await mountFreshPlayer(page, "own");
			await calculatorButton(page).click();
			await expect(
				page.locator('[data-pie-tool-shell="calculator"]:visible'),
			).toBeVisible({ timeout: 30_000 });
			await page.waitForTimeout(500);

			for (const fragment of NEW_WARNINGS) {
				expect(matching(warnings, fragment), fragment).toEqual([]);
			}
		});
	});
}
