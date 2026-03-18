import { expect, test } from "@playwright/test";

const DEMO_PATH = "/tts-ssml?mode=candidate&layout=splitpane";

test.describe("assessment toolkit observability integration", () => {
	test("emits runtime ownership and composition/session events from toolkit host", async ({
		page,
	}) => {
		await page.addInitScript(() => {
			const runtimeWindow = window as unknown as {
				__toolkitEventHistory?: Array<{
					name: string;
					targetTag: string;
					detail: Record<string, unknown> | null;
				}>;
				__toolkitDispatchPatched?: boolean;
			};
			if (runtimeWindow.__toolkitDispatchPatched) return;
			runtimeWindow.__toolkitDispatchPatched = true;
			runtimeWindow.__toolkitEventHistory = [];
			const trackedEvents = new Set([
				"runtime-owned",
				"runtime-inherited",
				"composition-changed",
				"session-changed",
			]);
			const originalDispatch = EventTarget.prototype.dispatchEvent;
			EventTarget.prototype.dispatchEvent = function patchedDispatch(event: Event) {
				const tagName =
					this && typeof (this as Element).tagName === "string"
						? (this as Element).tagName.toLowerCase()
						: "";
				if (
					trackedEvents.has(event.type) &&
					tagName === "pie-assessment-toolkit"
				) {
					runtimeWindow.__toolkitEventHistory?.push({
						name: event.type,
						targetTag: tagName,
						detail:
							typeof (event as CustomEvent<Record<string, unknown>>).detail ===
							"object"
								? ((event as CustomEvent<Record<string, unknown>>).detail as Record<
										string,
										unknown
								  >)
								: null,
					});
				}
				return originalDispatch.call(this, event);
			};
		});

		await page.goto(DEMO_PATH, { waitUntil: "networkidle" });

		const firstSelectable = page
			.locator("main.pie-section-player-items-pane")
			.locator('input[type="radio"], input[type="checkbox"]')
			.first();
		await firstSelectable.click();

		await page.waitForFunction(() => {
			const events = (window as any).__toolkitEventHistory || [];
			const runtimeDirectionCount = events.filter(
				(entry: { name?: string }) =>
					entry.name === "runtime-owned" || entry.name === "runtime-inherited",
			).length;
			const compositionChangedCount = events.filter(
				(entry: { name?: string }) => entry.name === "composition-changed",
			).length;
			const sessionChangedCount = events.filter(
				(entry: { name?: string }) => entry.name === "session-changed",
			).length;
			return (
				runtimeDirectionCount === 1 &&
				compositionChangedCount >= 1 &&
				sessionChangedCount >= 1
			);
		});

		const toolkitEvents = await page.evaluate(() => {
			return (window as any).__toolkitEventHistory || [];
		});
		expect(
			toolkitEvents.some(
				(entry: { targetTag?: string }) =>
					entry.targetTag === "pie-assessment-toolkit",
			),
		).toBe(true);
	});

	test("emits canonical session payload from toolkit", async ({ page }) => {
		await page.addInitScript(() => {
			const runtimeWindow = window as unknown as {
				__toolkitSessionEvents?: Array<Record<string, unknown>>;
				__toolkitSessionDispatchPatched?: boolean;
			};
			if (runtimeWindow.__toolkitSessionDispatchPatched) return;
			runtimeWindow.__toolkitSessionDispatchPatched = true;
			runtimeWindow.__toolkitSessionEvents = [];
			const originalDispatch = EventTarget.prototype.dispatchEvent;
			EventTarget.prototype.dispatchEvent = function patchedDispatch(event: Event) {
				const tagName =
					this && typeof (this as Element).tagName === "string"
						? (this as Element).tagName.toLowerCase()
						: "";
				if (
					event.type === "session-changed" &&
					tagName === "pie-assessment-toolkit"
				) {
					const detail = (event as CustomEvent<Record<string, unknown>>).detail;
					runtimeWindow.__toolkitSessionEvents?.push({
						tagName,
						detail,
					});
				}
				return originalDispatch.call(this, event);
			};
		});

		await page.goto(DEMO_PATH, { waitUntil: "networkidle" });

		const firstSelectable = page
			.locator("main.pie-section-player-items-pane")
			.locator('input[type="radio"], input[type="checkbox"]')
			.first();
		await firstSelectable.click();

		await page.waitForFunction(() => {
			const entries = (window as any).__toolkitSessionEvents || [];
			const canonicalEvents = entries.filter(
				(entry: { detail?: Record<string, unknown> }) =>
					typeof entry.detail?.itemId === "string" &&
					typeof entry.detail?.canonicalItemId === "string" &&
					typeof entry.detail?.sourceRuntimeId === "string",
			);
			return canonicalEvents.length >= 1;
		});
	});

});
