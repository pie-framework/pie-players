import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function waitForPlayerReady(
	page: Page,
	playerSelector: "pie-iife-player" | "pie-esm-player",
	timeoutMs = 20_000,
) {
	const player = page.locator(playerSelector);
	await expect(player).toBeAttached();

	// Prefer DOM readiness signals over arbitrary sleeps.
	// All players render a `.player-item-container` once the item is ready, and remove the `.pie-loading` overlay.
	await Promise.race([
		// "Loaded": spinner gone and content visible
		(async () => {
			await expect(player.locator(".pie-loading")).toHaveCount(0, { timeout: timeoutMs });
			await expect(player.locator(".player-item-container")).toBeVisible({
				timeout: timeoutMs,
			});
		})(),
		// "Failed fast": error UI is shown
		expect(player.locator(".pie-player-error")).toBeVisible({ timeout: timeoutMs }),
	]);
}

/**
 * Player Content Accessibility Tests
 *
 * These tests scan the ACTUAL content rendered by PIE players,
 * unlike the shell tests which exclude player content.
 *
 * This helps catch accessibility issues in:
 * - PIE elements (from pie-elements repo)
 * - Player implementations
 * - Element rendering
 */

test.describe("PIE Player Content Accessibility", () => {
	test("IIFE player with multiple choice should have minimal WCAG violations", async ({
		page,
	}) => {
		await page.goto("/samples");
		await waitForPlayerReady(page, "pie-iife-player");

		// Scan only the player content
		const results = await new AxeBuilder({ page })
			.include("pie-iife-player")
			.withTags(["wcag2a", "wcag2aa", "wcag22aa"])
			.analyze();

		// Log violations for debugging
		if (results.violations.length > 0) {
			console.log("\n=== IIFE Player A11y Violations ===");
			results.violations.forEach((violation) => {
				console.log(
					`\n[${violation.impact}] ${violation.id}: ${violation.help}`,
				);
				console.log(`  ${violation.helpUrl}`);
				console.log(`  Affected elements: ${violation.nodes.length}`);
				violation.nodes.slice(0, 2).forEach((node) => {
					console.log(`    - ${node.html.substring(0, 100)}...`);
				});
			});
			console.log("\n");
		}

		// For now, we document known issues rather than fail the test
		// This allows us to track progress on fixing upstream PIE element issues
		const knownIssues = results.violations.filter((v) =>
			["aria-allowed-attr"].includes(v.id),
		);

		const criticalIssues = results.violations.filter(
			(v) => !["aria-allowed-attr"].includes(v.id) && v.impact === "critical",
		);

		// Document known issues but don't fail
		if (knownIssues.length > 0) {
			console.log(
				`\nKnown issues (${knownIssues.length}): ${knownIssues.map((v) => v.id).join(", ")}`,
			);
			console.log("These should be fixed in pie-elements repository\n");
		}

		// Fail only on new critical issues
		expect(criticalIssues).toEqual([]);
	});

	test("ESM player should handle loading errors accessibly", async ({
		page,
	}) => {
		await page.goto("/samples");

		// Switch to ESM player (UI is a button toggle, not a <select>)
		await page.getByRole("button", { name: "ESM", exact: true }).click();
		await waitForPlayerReady(page, "pie-esm-player");

		// Scan the player content
		const results = await new AxeBuilder({ page })
			.include("pie-esm-player")
			.withTags(["wcag2a", "wcag2aa", "wcag22aa"])
			.analyze();

		// Document known issues but don't fail
		const knownIssues = results.violations.filter((v) =>
			["aria-allowed-attr"].includes(v.id),
		);
		const criticalIssues = results.violations.filter(
			(v) => !["aria-allowed-attr"].includes(v.id) && v.impact === "critical",
		);

		if (knownIssues.length > 0) {
			console.log(
				`\nKnown issues (${knownIssues.length}): ${knownIssues.map((v) => v.id).join(", ")}`,
			);
			console.log("These should be fixed in pie-elements repository\n");
		}

		expect(criticalIssues).toEqual([]);
	});

	test("Player mode switching maintains accessibility", async ({ page }) => {
		await page.goto("/samples");
		await waitForPlayerReady(page, "pie-iife-player");

		// Test each mode for accessibility
		const modes = ["view", "evaluate", "browse", "gather"];

		for (const mode of modes) {
			// Switch mode
			await page.getByRole("radio", { name: mode, exact: false }).click();
			await expect(page.getByRole("radio", { name: mode, exact: false })).toBeChecked();

			// Scan in this mode
			const results = await new AxeBuilder({ page })
				.include("pie-iife-player")
				.withTags(["wcag2a", "wcag2aa", "wcag22aa"])
				.analyze();

			// Filter out known issues
			const criticalUnknownIssues = results.violations.filter(
				(v) => !["aria-allowed-attr"].includes(v.id) && v.impact === "critical",
			);

			if (criticalUnknownIssues.length > 0) {
				console.log(
					`\nMode '${mode}' has ${criticalUnknownIssues.length} critical issues:`,
				);
				criticalUnknownIssues.forEach((v) => {
					console.log(`  - ${v.id}: ${v.help}`);
				});
			}

			expect(criticalUnknownIssues).toEqual([]);
		}
	});

	test("Extended text entry element should be accessible", async ({ page }) => {
		await page.goto("/samples");
		await waitForPlayerReady(page, "pie-iife-player");

		// Select extended text entry example
		await page.getByRole("button", { name: "Extended Text Entry" }).click();
		await waitForPlayerReady(page, "pie-iife-player");

		const results = await new AxeBuilder({ page })
			.include("pie-iife-player")
			.withTags(["wcag2a", "wcag2aa", "wcag22aa"])
			.analyze();

		// Filter known issues
		const criticalUnknownIssues = results.violations.filter(
			(v) => !["aria-allowed-attr"].includes(v.id) && v.impact === "critical",
		);

		expect(criticalUnknownIssues).toEqual([]);
	});

	test("Graphing element should be accessible", async ({ page }) => {
		await page.goto("/samples");
		await waitForPlayerReady(page, "pie-iife-player");

		// Select graphing example
		await page.getByRole("button", { name: "Graphing", exact: true }).click();
		await waitForPlayerReady(page, "pie-iife-player", 30_000); // Graphing can take longer to load

		const results = await new AxeBuilder({ page })
			.include("pie-iife-player")
			.withTags(["wcag2a", "wcag2aa", "wcag22aa"])
			.analyze();

		// Filter known issues
		const criticalUnknownIssues = results.violations.filter(
			(v) => !["aria-allowed-attr"].includes(v.id) && v.impact === "critical",
		);

		if (criticalUnknownIssues.length > 0) {
			console.log("\n=== Graphing Element Critical Issues ===");
			criticalUnknownIssues.forEach((v) => {
				console.log(`  - ${v.id}: ${v.help}`);
			});
		}

		expect(criticalUnknownIssues).toEqual([]);
	});

	test("Math elements should be accessible", async ({ page }) => {
		await page.goto("/samples");
		await waitForPlayerReady(page, "pie-iife-player");

		// Select equation response example
		await page.getByRole("button", { name: "Equation Response" }).click();
		await waitForPlayerReady(page, "pie-iife-player");

		const results = await new AxeBuilder({ page })
			.include("pie-iife-player")
			.withTags(["wcag2a", "wcag2aa", "wcag22aa"])
			.analyze();

		// Filter known issues
		const criticalUnknownIssues = results.violations.filter(
			(v) => !["aria-allowed-attr"].includes(v.id) && v.impact === "critical",
		);

		expect(criticalUnknownIssues).toEqual([]);
	});

	test("Interactive elements should have keyboard accessibility", async ({
		page,
	}) => {
		await page.goto("/samples");
		await waitForPlayerReady(page, "pie-iife-player");

		// Check that interactive elements are focusable
		const player = page.locator("pie-iife-player");

		// Find all focusable elements within the player
		const focusableElements = await player
			.locator(
				'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])',
			)
			.count();

		// Should have at least some focusable elements (radio buttons for answers)
		expect(focusableElements).toBeGreaterThan(0);

		// Try to focus the first interactive element
		const firstFocusable = player
			.locator(
				'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])',
			)
			.first();

		await firstFocusable.focus();
		await expect(firstFocusable).toBeFocused();
	});
});
