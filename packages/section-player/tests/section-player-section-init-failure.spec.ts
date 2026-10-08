/**
 * A section whose controller fails to start ends its cohort's stage chain at
 * the first stage it did not reach, and the failure reaches the host once: one
 * `framework-error` event out of the player and one `onFrameworkError` call.
 * The host-navigation page passes its own coordinator, which the test gives a
 * `createSectionController` hook whose controller rejects `initialize` before
 * moving to the next section.
 */

import { expect, test } from "@playwright/test";

const DEMO = "/section-switch-commit";

type FailureLog = {
	stages: Array<{ sectionId?: string; stage: string; status: string }>;
	errors: Array<{ kind: string; source: string }>;
	hookKinds: string[];
};

declare global {
	interface Window {
		__pageCoordinator?: { setHooks(hooks: Record<string, unknown>): void };
		__failure?: FailureLog;
	}
}

test("a section whose controller fails to start fails engine-ready and reports one framework-error", async ({
	page,
}) => {
	await page.addInitScript(() => {
		const log: FailureLog = { stages: [], errors: [], hookKinds: [] };
		window.__failure = log;
		document.addEventListener("toolkit-ready", (event) => {
			window.__pageCoordinator ??= (
				event as CustomEvent<{ coordinator: Window["__pageCoordinator"] }>
			).detail.coordinator;
		});
		document.addEventListener("pie-stage-change", (event) => {
			const { sectionId, stage, status } = (
				event as CustomEvent<{ sectionId?: string; stage: string; status: string }>
			).detail;
			log.stages.push({ sectionId, stage, status });
		});
		document.addEventListener("framework-error", (event) => {
			const { kind, source } = (
				event as CustomEvent<{ kind: string; source: string }>
			).detail;
			log.errors.push({ kind, source });
		});
	});
	await page.goto(DEMO, { waitUntil: "domcontentloaded" });
	await expect
		.poll(
			() =>
				page.evaluate(() =>
					window.__failure?.stages.some(
						({ stage, status }) => stage === "interactive" && status === "entered",
					),
				),
			{ timeout: 45_000 },
		)
		.toBe(true);
	const firstSectionId = await page.evaluate(
		() => window.__failure?.stages[0]?.sectionId,
	);
	expect(firstSectionId).toBeTruthy();

	await page.evaluate(() => {
		const log = window.__failure as FailureLog;
		log.stages.length = 0;
		log.errors.length = 0;
		window.__pageCoordinator?.setHooks({
			onFrameworkError: (model: { kind: string }) => log.hookKinds.push(model.kind),
			createSectionController: () => ({
				initialize: async () => {
					throw new Error("The section controller failed to start");
				},
				getSession: () => null,
				subscribe: () => () => {},
				dispose: async () => {},
			}),
		});
	});
	await page.locator("#host-next-section").click();

	const cohortChain = () =>
		page.evaluate(
			(previous) =>
				(window.__failure?.stages ?? [])
					.filter(({ sectionId }) => sectionId !== previous)
					.map(({ stage, status }) => `${stage}:${status}`),
			firstSectionId,
		);
	await expect
		.poll(cohortChain, { timeout: 30_000 })
		.toEqual(["composed:entered", "engine-ready:failed", "interactive:skipped"]);

	// Whatever else the failure would set off has had time to arrive.
	await page.waitForTimeout(1_000);
	const log = (await page.evaluate(() => window.__failure)) as FailureLog;
	expect(await cohortChain()).toEqual([
		"composed:entered",
		"engine-ready:failed",
		"interactive:skipped",
	]);
	expect(log.errors.map(({ kind }) => kind)).toEqual(["section-controller-init"]);
	expect(log.hookKinds).toEqual(["section-controller-init"]);
	expect(
		log.stages
			.filter(({ sectionId }) => sectionId === firstSectionId)
			.map(({ stage, status }) => `${stage}:${status}`),
	).toEqual(["disposed:entered"]);
});
