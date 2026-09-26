import { expect, type Page, test } from "@playwright/test";

// A host sets only the policy fields it changes; the rest take their defaults.
const DEMO_PATH = "/preloaded-fixed-elements?mode=candidate&layout=splitpane";
const MC_PROMPT = "Which field fixes the multiple-choice package version";

declare global {
	interface Window {
		__piePolicyStages?: string[];
	}
}

async function mountWithPolicies(
	page: Page,
	policies: unknown,
): Promise<string[]> {
	const pageErrors: string[] = [];
	page.on("pageerror", (error) => pageErrors.push(error.message));
	await page.goto(DEMO_PATH, { waitUntil: "networkidle" });
	await expect(page.getByText(MC_PROMPT)).toBeVisible({ timeout: 30_000 });

	await page.evaluate((hostPolicies) => {
		const existing = document.querySelector("pie-section-player-splitpane") as
			| (HTMLElement & { section?: unknown })
			| null;
		if (!existing?.parentElement) {
			throw new Error("demo section player not found");
		}
		const section = JSON.parse(JSON.stringify(existing.section));
		const parent = existing.parentElement;
		existing.remove();

		const stages: string[] = [];
		window.__piePolicyStages = stages;
		const fresh = document.createElement(
			"pie-section-player-splitpane",
		) as HTMLElement & {
			policies?: unknown;
			runtime?: unknown;
			section?: unknown;
		};
		fresh.setAttribute("assessment-id", "policies-assessment");
		fresh.setAttribute("section-id", "policies-section");
		fresh.setAttribute("attempt-id", `policies-${Date.now()}`);
		fresh.addEventListener("pie-stage-change", (event) => {
			stages.push((event as CustomEvent<{ stage: string }>).detail.stage);
		});
		fresh.addEventListener("pie-loading-complete", () => {
			stages.push("loading-complete");
		});
		fresh.policies = hostPolicies;
		fresh.runtime = {
			playerType: "preloaded",
			env: { mode: "gather", role: "student" },
		};
		fresh.section = section;
		parent.appendChild(fresh);
	}, policies);

	await expect(
		page.locator("pie-section-player-splitpane").getByText(MC_PROMPT),
	).toBeVisible({ timeout: 30_000 });
	await expect
		.poll(() => page.evaluate(() => window.__piePolicyStages ?? []))
		.toContain("loading-complete");
	return pageErrors;
}

test.describe("section player partial policies", () => {
	test("a preload-only policy object keeps the readiness defaults", async ({
		page,
	}) => {
		const pageErrors = await mountWithPolicies(page, {
			preload: { enabled: false },
		});
		expect(pageErrors).toEqual([]);
		expect(await page.evaluate(() => window.__piePolicyStages)).toContain(
			"interactive",
		);
	});

	test("a readiness-only policy object keeps the preload and telemetry defaults", async ({
		page,
	}) => {
		const pageErrors = await mountWithPolicies(page, {
			readiness: { mode: "strict" },
		});
		expect(pageErrors).toEqual([]);
		expect(await page.evaluate(() => window.__piePolicyStages)).toContain(
			"interactive",
		);
	});
});
