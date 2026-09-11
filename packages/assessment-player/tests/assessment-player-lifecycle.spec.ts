import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import type { ToolkitCoordinator } from "@pie-players/pie-assessment-toolkit";
import type {
	AssessmentControllerHandle,
	AssessmentDefinition,
	AssessmentPlayerHooks,
	AssessmentPlayerRuntimeHostContract,
} from "@pie-players/pie-assessment-player";

type Host = HTMLElement & AssessmentPlayerRuntimeHostContract & {
	assessmentId: string;
	attemptId: string;
	assessment: AssessmentDefinition | null;
	hooks: AssessmentPlayerHooks;
	locale: string;
	showNavigation: boolean;
	coordinator?: ToolkitCoordinator;
};

declare global {
	interface Window {
		assessmentLifecycle: {
			host: Host;
			configure: (id: string) => void;
			release: () => void;
			loads: string[];
			readyHooks: string[];
			readyEvents: string[];
			errorHooks: string[];
			errors: number;
			disposed: AssessmentControllerHandle[];
			waiter: Promise<AssessmentControllerHandle | null>;
			firstController?: AssessmentControllerHandle | null;
			coordinators: ToolkitCoordinator[];
			disposeCalls: number;
			borrowedHost?: Host;
			borrowedReady?: boolean;
			hookControllerMatches?: boolean;
			failNextLoad: () => void;
		}
	}
}

async function mountHost(
	page: Page,
	options: { beforeConnect?: boolean; holdLoad?: boolean; failure?: "load" | "plan"; awaitReadyHook?: boolean; rejectReadyHook?: boolean } = {},
) {
	await page.goto("/lifecycle-host");
	await page.waitForFunction(() => customElements.get("pie-assessment-player-default"));
	await page.evaluate((options) => {
		const host = document.createElement("pie-assessment-player-default") as Host;
		const target = document.querySelector("[data-pie-assessment-fixture]")!;
		let release = () => {};
		const delayed = new Promise<void>((resolve) => { release = resolve; });
		let fail = options.failure;
		const state: Window["assessmentLifecycle"] = {
			host,
			configure(id) {
				host.assessmentId = id;
				host.attemptId = `attempt-${id}`;
				host.assessment = {
					identifier: id,
					sections: [
						{ identifier: `${id}-one`, assessmentItemRefs: [] },
						{ identifier: `${id}-two`, assessmentItemRefs: [] },
					],
				};
				host.hooks = {
					createAssessmentDeliveryPlan(_context, defaults) {
						if (fail === "plan") { fail = undefined; throw new Error("Plan unavailable"); }
						return defaults.createDefaultDeliveryPlan();
					},
					createAssessmentSessionPersistence() {
						return {
							async loadSession() {
								state.loads.push(id);
								if (id === "first" && options.holdLoad) await delayed;
								if (fail === "load") { fail = undefined; throw new Error("Saved attempt unavailable"); }
								return null;
							},
							saveSession() {},
						};
					},
					async onAssessmentControllerReady(controller) {
						if (options.awaitReadyHook) {
							state.hookControllerMatches = (await host.waitForAssessmentController(500)) === controller && host.getAssessmentController() === controller;
						}
						state.readyHooks.push((controller as AssessmentControllerHandle).getSession()!.assessmentId);
						if (options.rejectReadyHook) throw new Error("Host ready notification failed");
					},
					onAssessmentControllerDispose(controller) {
						state.disposed.push(controller as AssessmentControllerHandle);
					},
					onError(_error, context) { state.errorHooks.push(context.phase); },
				};
			},
			release,
			failNextLoad: () => { fail = "load"; },
			loads: [], readyHooks: [], readyEvents: [], errorHooks: [], errors: 0, disposed: [],
			waiter: Promise.resolve(null),
			coordinators: [], disposeCalls: 0,
		};
		window.assessmentLifecycle = state;
		host.addEventListener("assessment-controller-ready", (event) => {
			const ready = event as CustomEvent<{ controller: AssessmentControllerHandle }>;
			if (!event.bubbles || !event.composed || event.cancelable) {
				throw new Error("Ready event contract changed");
			}
			state.readyEvents.push(ready.detail.controller.getSession()!.assessmentId);
		});
		host.addEventListener("assessment-error", () => { state.errors += 1; });
		host.addEventListener("toolkit-ready", (event) => {
			const coordinator = (event as CustomEvent<{ coordinator: ToolkitCoordinator }>).detail.coordinator;
			if (!state.coordinators.includes(coordinator)) state.coordinators.push(coordinator);
		});
		if (options.beforeConnect) state.configure("first");
		target.appendChild(host);
		state.waiter = host.waitForAssessmentController(3000);
		if (!options.beforeConnect) state.configure("first");
	}, options);
	return page.locator("[data-pie-assessment-fixture] pie-assessment-player-default");
}

test("the documented connect-then-assign flow produces one ready controller", async ({ page }) => {
	const host = await mountHost(page);
	await expect(host.locator(".pie-assessment-player-current-position")).toHaveText("Section 1 of 2");
	expect(await page.evaluate(async () => {
		const state = window.assessmentLifecycle;
		const controller = await state.waiter;
		return {
			ready: state.readyEvents,
			hooks: state.readyHooks,
			loads: state.loads,
			sameController: controller === state.host.getAssessmentController(),
			phase: state.host.selectReadiness().phase,
		};
	})).toEqual({ ready: ["first"], hooks: ["first"], loads: ["first"], sameController: true, phase: "ready" });
	await host.getByRole("button", { name: "Next", exact: true }).click();
	await expect(host.locator(".pie-assessment-player-current-position")).toHaveText("Section 2 of 2");
});

test("pre-connect inputs stay private until hydration succeeds and notify once", async ({ page }) => {
	await mountHost(page, { beforeConnect: true, holdLoad: true });
	await expect.poll(() => page.evaluate(() => window.assessmentLifecycle.loads)).toEqual(["first"]);
	expect(await page.evaluate(async () => {
		const { host, readyEvents, readyHooks } = window.assessmentLifecycle;
		return {
			controller: host.getAssessmentController(),
			waited: await host.waitForAssessmentController(20),
			phase: host.selectReadiness().phase,
			readyEvents, readyHooks,
		};
	})).toEqual({ controller: null, waited: null, phase: "hydrating", readyEvents: [], readyHooks: [] });
	await page.evaluate(() => window.assessmentLifecycle.release());
	await expect.poll(() => page.evaluate(() => window.assessmentLifecycle.readyEvents)).toEqual(["first"]);
	expect(await page.evaluate(() => window.assessmentLifecycle.readyHooks)).toEqual(["first"]);
});

test("ready hooks observe the same controller as the public getter and waiter", async ({ page }) => {
	await mountHost(page, { awaitReadyHook: true });
	await expect.poll(() => page.evaluate(() => window.assessmentLifecycle.readyHooks)).toEqual(["first"]);
	expect(await page.evaluate(() => window.assessmentLifecycle.hookControllerMatches)).toBe(true);
	expect(await page.evaluate(() => window.assessmentLifecycle.readyEvents)).toEqual(["first"]);
});

test("a rejected ready notification is observable without undoing successful hydration", async ({ page }) => {
	const host = await mountHost(page, { rejectReadyHook: true });
	await expect.poll(() => page.evaluate(() => window.assessmentLifecycle.errors)).toBe(1);
	expect(await page.evaluate(() => ({
		phase: window.assessmentLifecycle.host.selectReadiness().phase,
		ready: window.assessmentLifecycle.readyEvents,
		errors: window.assessmentLifecycle.errorHooks,
	}))).toEqual({ phase: "ready", ready: ["first"], errors: ["controller-init"] });
	await expect(host.locator(".pie-assessment-player-current-position")).toHaveText("Section 1 of 2");
});

test("a failed explicit reload retires the published controller and exposes recovery", async ({ page }) => {
	const host = await mountHost(page);
	await expect.poll(() => page.evaluate(() => window.assessmentLifecycle.readyEvents)).toEqual(["first"]);
	expect(await page.evaluate(async () => {
		const state = window.assessmentLifecycle;
		const controller = state.host.getAssessmentController()!;
		state.failNextLoad();
		try { await controller.hydrate(); return "unexpected success"; }
		catch (error) { return (error as Error).message; }
	})).toBe("Saved attempt unavailable");
	await expect(host.getByRole("alert")).toContainText("could not be loaded");
	expect(await page.evaluate(() => ({
		controller: window.assessmentLifecycle.host.getAssessmentController(),
		phase: window.assessmentLifecycle.host.selectReadiness().phase,
		errors: window.assessmentLifecycle.errors,
	}))).toEqual({ controller: null, phase: "error", errors: 1 });
	await host.getByRole("button", { name: "Retry", exact: true }).click();
	await expect.poll(() => page.evaluate(() => window.assessmentLifecycle.readyEvents)).toEqual(["first", "first"]);
});

test("a superseded load cannot publish after the newer assessment", async ({ page }) => {
	const host = await mountHost(page, { beforeConnect: true, holdLoad: true });
	await expect.poll(() => page.evaluate(() => window.assessmentLifecycle.loads)).toEqual(["first"]);
	await page.evaluate(() => window.assessmentLifecycle.configure("second"));
	await expect.poll(() => page.evaluate(() => window.assessmentLifecycle.readyEvents)).toEqual(["second"]);
	await page.evaluate(async () => {
		window.assessmentLifecycle.release();
		await new Promise((resolve) => setTimeout(resolve, 30));
	});
	expect(await page.evaluate(() => {
		const state = window.assessmentLifecycle;
		return {
			ready: state.readyEvents, hooks: state.readyHooks, errors: state.errors,
			assessment: state.host.getAssessmentController()?.getSession()?.assessmentId,
			disposals: state.disposed.length,
		};
	})).toEqual({ ready: ["second"], hooks: ["second"], errors: 0, assessment: "second", disposals: 1 });
	await expect(host.locator(".pie-assessment-player-current-position")).toHaveText("Section 1 of 2");
});

for (const failure of ["plan", "load"] as const) {
	test(`${failure} failure stays unavailable and can be retried accessibly`, async ({ page }) => {
		if (failure === "load") await page.setViewportSize({ width: 320, height: 640 });
		const host = await mountHost(page, { beforeConnect: true, failure });
		await expect(host.getByRole("alert")).toContainText("could not be loaded");
		expect(await page.evaluate(async () => {
			const state = window.assessmentLifecycle;
			return {
				controller: state.host.getAssessmentController(),
				waited: await state.waiter,
				phase: state.host.selectReadiness().phase,
				ready: state.readyEvents, hooks: state.readyHooks,
				errors: state.errors, errorHooks: state.errorHooks,
			};
		})).toEqual({
			controller: null, waited: null, phase: "error", ready: [], hooks: [], errors: 1,
			errorHooks: [failure === "plan" ? "delivery-plan-create" : "session-load"],
		});
		const axe = await new AxeBuilder({ page }).include("[data-pie-assessment-fixture]").analyze();
		expect(axe.violations).toEqual([]);
		await host.screenshot({ path: test.info().outputPath(`${failure}-error.png`) });
		await host.getByRole("button", { name: "Retry", exact: true }).focus();
		await page.keyboard.press("Enter");
		await expect(host.locator(".pie-assessment-player-current-position")).toHaveText("Section 1 of 2");
		await expect(host.locator(".pie-assessment-player-section-host")).toBeFocused();
		await expect.poll(() => page.evaluate(() => window.assessmentLifecycle.readyEvents)).toEqual(["first"]);
	});
}

test("disconnect retires pending work and reconnect creates a fresh controller", async ({ page }) => {
	await mountHost(page, { beforeConnect: true, holdLoad: true });
	await expect.poll(() => page.evaluate(() => window.assessmentLifecycle.loads)).toEqual(["first"]);
	await page.evaluate(async () => {
		const state = window.assessmentLifecycle;
		state.host.remove();
		state.release();
		await new Promise((resolve) => setTimeout(resolve, 30));
	});
	expect(await page.evaluate(async () => {
		const state = window.assessmentLifecycle;
		return {
			controller: state.host.getAssessmentController(), waited: await state.waiter,
			ready: state.readyEvents, hooks: state.readyHooks, errors: state.errors,
			disposals: state.disposed.length,
		};
	})).toEqual({ controller: null, waited: null, ready: [], hooks: [], errors: 0, disposals: 1 });
	await page.evaluate(() => {
		const state = window.assessmentLifecycle;
		document.querySelector("[data-pie-assessment-fixture]")!.appendChild(state.host);
	});
	await expect.poll(() => page.evaluate(() => window.assessmentLifecycle.readyEvents)).toEqual(["first"]);
	expect(await page.evaluate(() => window.assessmentLifecycle.readyHooks)).toEqual(["first"]);
});

test("presentation updates preserve the initialized controller and section", async ({ page }) => {
	await mountHost(page);
	await expect.poll(() => page.evaluate(() => window.assessmentLifecycle.readyEvents)).toEqual(["first"]);
	expect(await page.evaluate(async () => {
		const state = window.assessmentLifecycle;
		const controller = state.host.getAssessmentController();
		const section = state.host.querySelector("pie-section-player-splitpane");
		state.host.locale = "nl-NL";
		state.host.showNavigation = false;
		await new Promise((resolve) => setTimeout(resolve, 100));
		state.host.showNavigation = true;
		return {
			sameController: controller === state.host.getAssessmentController(),
			sameSection: section === state.host.querySelector("pie-section-player-splitpane"),
			ready: state.readyEvents, loads: state.loads,
		};
	})).toEqual({ sameController: true, sameSection: true, ready: ["first"], loads: ["first"] });
	await expect(page.locator("[data-pie-assessment-fixture]").getByRole("button", { name: "Volgende", exact: true })).toBeVisible();
});

test("removing an initialized player disposes its controller and the toolkit's owned coordinator once", async ({ page }) => {
	await mountHost(page);
	await expect.poll(() => page.evaluate(() => window.assessmentLifecycle.coordinators.length)).toBe(1);
	await page.evaluate(() => {
		const state = window.assessmentLifecycle;
		const coordinator = state.coordinators[0];
		const original = coordinator.dispose.bind(coordinator);
		coordinator.dispose = () => { state.disposeCalls += 1; return original(); };
		state.firstController = state.host.getAssessmentController();
		state.host.remove();
	});
	await expect.poll(() => page.evaluate(() => window.assessmentLifecycle.disposeCalls)).toBe(1);
	expect(await page.evaluate(() => {
		const state = window.assessmentLifecycle;
		return {
			session: state.firstController?.getSession(),
			canNavigate: state.firstController?.navigateNext(),
			disposals: state.disposed.length,
		};
	})).toEqual({ session: null, canNavigate: false, disposals: 1 });
});

test("a nested player releases its section without disposing a borrowed coordinator", async ({ page }) => {
	await mountHost(page);
	await expect.poll(() => page.evaluate(() => window.assessmentLifecycle.coordinators.length)).toBe(1);
	await page.evaluate(() => {
		const state = window.assessmentLifecycle;
		const coordinator = state.coordinators[0];
		const original = coordinator.dispose.bind(coordinator);
		coordinator.dispose = () => { state.disposeCalls += 1; return original(); };
		const borrowed = document.createElement("pie-assessment-player-default") as Host;
		borrowed.assessmentId = state.host.assessmentId;
		borrowed.attemptId = "borrowed-attempt";
		borrowed.assessment = state.host.assessment;
		borrowed.hooks = {
			createAssessmentSessionPersistence: () => ({ loadSession: () => null, saveSession: () => {} }),
		};
		borrowed.coordinator = coordinator;
		borrowed.addEventListener("toolkit-ready", (event) => {
			state.borrowedReady = (event as CustomEvent).detail.coordinator === coordinator;
		});
		state.borrowedHost = borrowed;
		document.querySelector("[data-pie-assessment-fixture]")!.appendChild(borrowed);
	});
	await expect.poll(() => page.evaluate(() => window.assessmentLifecycle.borrowedReady)).toBe(true);
	expect(await page.evaluate(() => Boolean(window.assessmentLifecycle.coordinators[0].getSectionController({ sectionId: "first-one", attemptId: "borrowed-attempt" })))).toBe(true);
	await page.evaluate(() => window.assessmentLifecycle.borrowedHost!.remove());
	await expect.poll(() => page.evaluate(() => {
		const state = window.assessmentLifecycle;
		return state.coordinators[0].getSectionController({ sectionId: "first-one", attemptId: "borrowed-attempt" }) === undefined;
	})).toBe(true);
	expect(await page.evaluate(() => window.assessmentLifecycle.disposeCalls)).toBe(0);
	await page.evaluate(() => window.assessmentLifecycle.host.remove());
	await expect.poll(() => page.evaluate(() => window.assessmentLifecycle.disposeCalls)).toBe(1);
});
