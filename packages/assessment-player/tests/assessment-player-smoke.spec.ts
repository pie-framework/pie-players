import { expect, test } from "@playwright/test";

const DEMO_PATH = "/three-section-assessment";

test.describe("assessment player smoke", () => {
	test("renders default layout and supports back/next section navigation", async ({
		page,
	}) => {
		await page.goto(DEMO_PATH, { waitUntil: "networkidle" });

		const host = page.locator("pie-assessment-player-default");
		await expect(host).toBeVisible();

		const position = host.locator(".pie-assessment-player-current-position");
		await expect(position).toHaveText("Section 1 of 3");

		const backButton = host.getByRole("button", { name: "Back" });
		const nextButton = host.getByRole("button", { name: "Next" });
		await expect(backButton).toBeDisabled();
		await expect(nextButton).toBeEnabled();

		await nextButton.click();

		await expect(position).toHaveText("Section 2 of 3");
		await expect(backButton).toBeEnabled();
		await expect(nextButton).toBeEnabled();
	});

	test("persists section route on refresh for same attempt", async ({ page }) => {
		await page.goto(DEMO_PATH, { waitUntil: "networkidle" });

		const host = page.locator("pie-assessment-player-default");
		const position = host.locator(".pie-assessment-player-current-position");
		const nextButton = host.getByRole("button", { name: "Next" });

		await expect(nextButton).toBeEnabled();
		await nextButton.click();
		await expect(position).toHaveText("Section 2 of 3");

		await page.reload({ waitUntil: "networkidle" });
		await expect(position).toHaveText("Section 2 of 3");
	});

	test("forwards sectionPlayerRuntime loaderConfig to nested item players", async ({
		page,
	}) => {
		await page.goto(DEMO_PATH, { waitUntil: "networkidle" });

		const host = page.locator("pie-assessment-player-default");
		await expect(host).toBeVisible();
		await expect(host.locator(".pie-assessment-player-current-position")).toHaveText(
			"Section 1 of 3",
		);
		await expect(page.locator("pie-item-player").first()).toBeVisible({
			timeout: 30_000,
		});

		await page.evaluate(() => {
			const assessmentHost = document.querySelector(
				"pie-assessment-player-default",
			) as HTMLElement & { sectionPlayerRuntime?: Record<string, unknown> };
			if (!assessmentHost) {
				throw new Error("assessment player host not found");
			}
			assessmentHost.sectionPlayerRuntime = {
				player: {
					loaderConfig: {
						trackPageActions: true,
						maxResourceRetries: 9,
						resourceRetryDelay: 654,
					},
				},
			};
		});

		await host.getByRole("button", { name: "Next" }).click();
		await expect(host.locator(".pie-assessment-player-current-position")).toHaveText(
			"Section 2 of 3",
		);

		await page.waitForFunction(() => {
			const players = Array.from(document.querySelectorAll("pie-item-player")) as Array<
				HTMLElement & { loaderConfig?: Record<string, unknown> }
			>;
			if (!players.length) return false;
			return players.every((player) => {
				const cfg = player.loaderConfig;
				return (
					cfg?.trackPageActions === true &&
					cfg?.maxResourceRetries === 9 &&
					cfg?.resourceRetryDelay === 654
				);
			});
		});
	});

	test("emits navigation/session/progress events and supports cancelable navigation", async ({
		page,
	}) => {
		await page.goto(DEMO_PATH, { waitUntil: "networkidle" });
		const host = page.locator("pie-assessment-player-default");
		await expect(host).toBeVisible();

		await page.evaluate(() => {
			const assessmentHost = document.querySelector(
				"pie-assessment-player-default",
			) as HTMLElement | null;
			if (!assessmentHost) {
				throw new Error("assessment player host not found");
			}
			(window as any).__assessmentEvents = [];
			(window as any).__blockNextNavigation = true;

			assessmentHost.addEventListener("assessment-navigation-requested", (event) => {
				const customEvent = event as CustomEvent<Record<string, unknown>>;
				const shouldBlock = Boolean((window as any).__blockNextNavigation);
				if (shouldBlock) {
					event.preventDefault();
					(window as any).__blockNextNavigation = false;
				}
				(window as any).__assessmentEvents.push({
					name: event.type,
					cancelable: event.cancelable,
					defaultPrevented: event.defaultPrevented,
					detail: customEvent.detail,
				});
			});

			for (const name of [
				"assessment-route-changed",
				"assessment-session-changed",
				"assessment-progress-changed",
			]) {
				assessmentHost.addEventListener(name, (event) => {
					const customEvent = event as CustomEvent<Record<string, unknown>>;
					(window as any).__assessmentEvents.push({
						name: event.type,
						cancelable: event.cancelable,
						defaultPrevented: event.defaultPrevented,
						detail: customEvent.detail,
					});
				});
			}
		});

		const position = host.locator(".pie-assessment-player-current-position");
		await expect(position).toHaveText("Section 1 of 3");

		await host.getByRole("button", { name: "Next" }).click();
		await expect(position).toHaveText("Section 1 of 3");

		await host.getByRole("button", { name: "Next" }).click();
		await expect(position).toHaveText("Section 2 of 3");

		await page.waitForFunction(() => {
			const events = (window as any).__assessmentEvents || [];
			const routeChanged = events.some(
				(entry: { name?: string }) => entry.name === "assessment-route-changed",
			);
			const sessionChanged = events.some(
				(entry: { name?: string }) => entry.name === "assessment-session-changed",
			);
			const progressChanged = events.some(
				(entry: { name?: string }) => entry.name === "assessment-progress-changed",
			);
			const blockedNavigation = events.some(
				(entry: { name?: string; defaultPrevented?: boolean; cancelable?: boolean }) =>
					entry.name === "assessment-navigation-requested" &&
					entry.defaultPrevented === true &&
					entry.cancelable === true,
			);
			return routeChanged && sessionChanged && progressChanged && blockedNavigation;
		});
	});

	test("emits session-applied after hydrate and submission-state-changed on submit", async ({
		page,
	}) => {
		await page.addInitScript(() => {
			(window as any).__assessmentLifecycleEvents = [];
			document.addEventListener("assessment-session-applied", (event) => {
				const customEvent = event as CustomEvent<Record<string, unknown>>;
				(window as any).__assessmentLifecycleEvents.push({
					name: event.type,
					detail: customEvent.detail || null,
				});
			});
			document.addEventListener("assessment-submission-state-changed", (event) => {
				const customEvent = event as CustomEvent<Record<string, unknown>>;
				(window as any).__assessmentLifecycleEvents.push({
					name: event.type,
					detail: customEvent.detail || null,
				});
			});
		});

		await page.goto(DEMO_PATH, { waitUntil: "networkidle" });
		const host = page.locator("pie-assessment-player-default");
		await expect(host).toBeVisible();

		await host.getByRole("button", { name: "Next" }).click();
		await expect(host.locator(".pie-assessment-player-current-position")).toHaveText(
			"Section 2 of 3",
		);

		await page.reload({ waitUntil: "networkidle" });
		await expect(host.locator(".pie-assessment-player-current-position")).toHaveText(
			"Section 2 of 3",
		);

		await page.waitForFunction(() => {
			const events = (window as any).__assessmentLifecycleEvents || [];
			return events.some(
				(entry: { name?: string }) => entry.name === "assessment-session-applied",
			);
		});

		await page.evaluate(async () => {
			const assessmentHost = document.querySelector(
				"pie-assessment-player-default",
			) as HTMLElement & {
				getAssessmentController?: () => { submit?: () => Promise<void> };
			};
			if (!assessmentHost?.getAssessmentController) {
				throw new Error("assessment controller host not available");
			}
			const controller = assessmentHost.getAssessmentController();
			if (!controller?.submit) {
				throw new Error("assessment controller submit is not available");
			}
			await controller.submit();
		});

		await page.waitForFunction(() => {
			const events = (window as any).__assessmentLifecycleEvents || [];
			return events.some(
				(entry: { name?: string; detail?: Record<string, unknown> }) =>
					entry.name === "assessment-submission-state-changed" &&
					entry.detail?.submitted === true,
			);
		});
	});
});
