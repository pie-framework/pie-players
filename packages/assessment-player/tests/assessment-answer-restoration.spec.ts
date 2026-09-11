import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import type { AssessmentPlayerRuntimeHostContract } from "@pie-players/pie-assessment-player";
import type { SectionControllerHandle, ToolkitCoordinator } from "@pie-players/pie-assessment-toolkit";
import type { SectionControllerSessionState } from "@pie-players/pie-players-shared/types";

const player = "pie-assessment-player-default";
const firstChoice = 'input[type="radio"][value="a"]';
const firstSection = "assessment-demo-colonial-sea-section-one";
const sectionHost = ".pie-assessment-player-section-host";
type Host = HTMLElement & AssessmentPlayerRuntimeHostContract;

declare global {
	interface Window {
		assessmentRestore: {
			host: Host;
			saved: SectionControllerSessionState;
			started: boolean;
			finished: boolean;
			errors: number;
			release: () => void;
		};
	}
}

/** Delay/fail a real public controller operation, retaining the actual item and coordinator. */
async function prepareRestore(page: Page, fault: "delay" | "reject" | "readiness") {
	await page.goto("/three-section-assessment", { waitUntil: "networkidle" });
	const host = page.locator(player);
	await host.locator(firstChoice).first().click();
	await expect(host.locator(firstChoice).first()).toBeChecked();
	await host.getByRole("button", { name: "Next", exact: true }).click();
	await expect(host.locator(sectionHost)).toHaveAttribute("aria-busy", "false");
	await page.evaluate(async ({ fault, firstSection }) => {
		const host = document.querySelector("pie-assessment-player-default") as Host;
		const assessment = host.getAssessmentController()!;
		await assessment.persist();
		let release!: () => void;
		const held = new Promise<void>((resolve) => { release = resolve; });
		const state = window.assessmentRestore = {
			host,
			saved: structuredClone(assessment.getSectionSession(firstSection)!),
			started: false,
			finished: false,
			errors: 0,
			release,
		};
		host.addEventListener("assessment-error", () => { state.errors += 1; });
		const coordinator = host.coordinator as ToolkitCoordinator;
		const acquire = coordinator.getOrCreateSectionController.bind(coordinator);
		const wrapped = new WeakSet<SectionControllerHandle>();
		coordinator.getOrCreateSectionController = async (args) => {
			const controller = await acquire(args);
			if (args.sectionId !== firstSection || wrapped.has(controller)) return controller;
			wrapped.add(controller);
			if (fault === "readiness" && !state.started) {
				state.started = true;
				await held;
				state.finished = true;
			}
			const apply = controller.applySession!.bind(controller);
			controller.applySession = async (session, options) => {
				if (state.started || !session) return apply(session, options);
				state.started = true;
				try {
					if (fault === "reject") throw new Error("Restoration unavailable");
					await held;
					await apply(session, options);
				} finally {
					state.finished = true;
				}
			};
			return controller;
		};
	}, { fault, firstSection });
	await host.getByRole("button", { name: "Back", exact: true }).click();
	await expect.poll(() => page.evaluate(() => window.assessmentRestore.started)).toBe(true);
	return host;
}

async function expectSavedAnswerIntact(page: Page) {
	const { current, saved } = await page.evaluate((firstSection) => {
		const { host, saved } = window.assessmentRestore;
		return { current: host.getAssessmentController()!.getSectionSession(firstSection), saved };
	}, firstSection);
	expect(current).toEqual(saved);
}

test("answers survive Next and Back through every section and a saved reload", async ({ page }) => {
	await page.goto("/three-section-assessment", { waitUntil: "networkidle" });
	const host = page.locator(player);
	const position = host.locator(".pie-assessment-player-current-position");
	for (let section = 1; section <= 3; section += 1) {
		await expect(position).toHaveText(`Section ${section} of 3`);
		await host.locator(firstChoice).first().click();
		await expect(host.locator(firstChoice).first()).toBeChecked();
		if (section < 3) await host.getByRole("button", { name: "Next", exact: true }).click();
	}
	for (let section = 3; section >= 1; section -= 1) {
		await expect(position).toHaveText(`Section ${section} of 3`);
		await expect(host.locator(firstChoice).first()).toBeChecked();
		if (section > 1) await host.getByRole("button", { name: "Back", exact: true }).click();
	}
	const saved = await page.evaluate(async () => {
		const host = document.querySelector("pie-assessment-player-default") as HTMLElement & AssessmentPlayerRuntimeHostContract;
		const controller = await host.waitForAssessmentController();
		await controller!.persist();
		return controller!.getSession();
	});
	expect(Object.keys(saved!.sectionSessions)).toHaveLength(3);
	for (const entry of Object.values(saved!.sectionSessions)) {
		expect(JSON.stringify(entry.session?.itemSessions)).toContain('"value":["a"]');
	}
	await page.reload({ waitUntil: "networkidle" });
	for (let section = 1; section <= 3; section += 1) {
		await expect(position).toHaveText(`Section ${section} of 3`);
		await expect(host.locator(firstChoice).first()).toBeChecked();
		if (section < 3) await host.getByRole("button", { name: "Next", exact: true }).click();
	}
});

for (const fault of ["delay", "readiness"] as const) {
	test(`saved answers wait for ${fault === "delay" ? "restoration" : "section readiness"} before interaction`, async ({ page }) => {
		const host = await prepareRestore(page, fault);
		await expect(host.locator(sectionHost)).toHaveAttribute("aria-busy", "true");
		await expect(host.locator(`${sectionHost} > pie-section-player-splitpane`)).toHaveAttribute("inert", "");
		await expectSavedAnswerIntact(page);
		await page.evaluate(() => window.assessmentRestore.release());
		await expect(host.locator(sectionHost)).toHaveAttribute("aria-busy", "false");
		await expect(host.locator(firstChoice).first()).toBeChecked();
		expect(await page.evaluate(() => window.assessmentRestore.errors)).toBe(0);
	});
}

test("failed restoration preserves answers and offers accessible keyboard retry", async ({ page }, testInfo) => {
	const host = await prepareRestore(page, "reject");
	await expect(host.getByRole("alert")).toHaveText("Your saved answers for this section could not be restored. Try again.");
	await expectSavedAnswerIntact(page);
	expect(await page.evaluate(() => window.assessmentRestore.errors)).toBe(1);
	await page.setViewportSize({ width: 320, height: 800 });
	const axe = await new AxeBuilder({ page }).include(sectionHost).analyze();
	expect(axe.violations).toEqual([]);
	const retry = host.getByRole("button", { name: "Retry", exact: true });
	await expect(host.getByRole("button", { name: "Next", exact: true })).toBeFocused();
	await page.keyboard.press("Tab");
	await expect(retry).toBeFocused();
	expect(await retry.evaluate((element) => getComputedStyle(element).outlineStyle)).toBe("solid");
	await page.screenshot({ path: testInfo.outputPath("restore-error.png"), fullPage: true });
	await page.keyboard.press("Enter");
	await expect(host.locator(sectionHost)).toHaveAttribute("aria-busy", "false");
	await expect(host.locator(firstChoice).first()).toBeChecked();
	await expect(host.locator(sectionHost)).toBeFocused();
	expect(await page.evaluate(() => window.assessmentRestore.errors)).toBe(1);
});

for (const fault of ["delay", "readiness"] as const) {
	test(`rapid navigation retires ${fault} without replacing the current answer`, async ({ page }) => {
		const host = await prepareRestore(page, fault);
		await page.evaluate(() => {
			const assessment = window.assessmentRestore.host.getAssessmentController()!;
			assessment.navigateNext();
			assessment.navigatePrevious();
		});
		await expect(host.locator(sectionHost)).toHaveAttribute("aria-busy", "false");
		await expect(host.locator(firstChoice).first()).toBeChecked();
		const restored = await page.evaluate((firstSection) => window.assessmentRestore.host.getAssessmentController()!.getSectionSession(firstSection), firstSection);
		await page.evaluate(() => window.assessmentRestore.release());
		await expect.poll(() => page.evaluate(() => window.assessmentRestore.finished)).toBe(true);
		await expect(host.locator(firstChoice).first()).toBeChecked();
		expect(await page.evaluate((firstSection) => window.assessmentRestore.host.getAssessmentController()!.getSectionSession(firstSection), firstSection)).toEqual(restored);
		expect(await page.evaluate(() => window.assessmentRestore.errors)).toBe(0);
	});
}

test("a section readiness timeout preserves answers and can be retried", async ({ page }) => {
	const host = await prepareRestore(page, "readiness");
	await expect(host.getByRole("alert")).toHaveText("Your saved answers for this section could not be restored. Try again.", { timeout: 7000 });
	await expectSavedAnswerIntact(page);
	await expect(host.locator(sectionHost)).toHaveAttribute("aria-busy", "false");
	await page.evaluate(() => window.assessmentRestore.release());
	await expect.poll(() => page.evaluate(() => window.assessmentRestore.finished)).toBe(true);
	await host.getByRole("button", { name: "Retry", exact: true }).click();
	await expect(host.locator(firstChoice).first()).toBeChecked();
	expect(await page.evaluate(() => window.assessmentRestore.errors)).toBe(1);
});

test("disconnect retires an in-flight restore and preserves the saved reload", async ({ page }) => {
	const host = await prepareRestore(page, "delay");
	await page.evaluate(async () => {
		const { host } = window.assessmentRestore;
		await host.getAssessmentController()!.persist();
		host.remove();
		window.assessmentRestore.release();
	});
	await expect.poll(() => page.evaluate(() => window.assessmentRestore.finished)).toBe(true);
	expect(await page.evaluate(() => ({
		controller: window.assessmentRestore.host.getAssessmentController(),
		errors: window.assessmentRestore.errors,
	}))).toEqual({ controller: null, errors: 0 });
	await page.reload({ waitUntil: "networkidle" });
	await expect(host.locator(".pie-assessment-player-current-position")).toHaveText("Section 1 of 3");
	await expect(host.locator(firstChoice).first()).toBeChecked();
});

for (const layout of ["splitpane", "vertical"]) {
	test(`controller-driven navigation captures the outgoing ${layout} answer`, async ({ page }) => {
		await page.goto("/three-section-assessment", { waitUntil: "networkidle" });
		const host = page.locator(player);
		await host.evaluate((element, layout) => element.setAttribute("section-player-layout", layout), layout);
		await host.locator(firstChoice).first().click();
		await expect(host.locator(firstChoice).first()).toBeChecked();
		await page.evaluate(() => {
			const host = document.querySelector("pie-assessment-player-default") as HTMLElement & AssessmentPlayerRuntimeHostContract;
			host.getAssessmentController()!.navigateNext();
		});
		await expect(host.locator(".pie-assessment-player-current-position")).toHaveText("Section 2 of 3");
		await page.evaluate(() => {
			const host = document.querySelector("pie-assessment-player-default") as HTMLElement & AssessmentPlayerRuntimeHostContract;
			host.getAssessmentController()!.navigatePrevious();
		});
		await expect(host.locator(".pie-assessment-player-current-position")).toHaveText("Section 1 of 3");
		await expect(host.locator(firstChoice).first()).toBeChecked();
	});
}
