import { expect, test } from "@playwright/test";

const DEMO_PATH =
	"/metadata-session-forwarding?mode=candidate&layout=splitpane&player=preloaded";

type ToolkitSessionEvent = {
	detail?: {
		intent?: string;
		session?: { data?: Array<{ value?: unknown }> } | null;
		[key: string]: unknown;
	};
	tagName?: string;
};

function hasSeededResponse(entry: ToolkitSessionEvent): boolean {
	const data = entry.detail?.session?.data;
	return Boolean(
		entry.detail?.intent !== "metadata-only" &&
			Array.isArray(data) &&
			data.some((sessionEntry) => {
				const value = sessionEntry?.value;
				return Array.isArray(value) && value.includes("A");
			}),
	);
}

test.describe("metadata-only session forwarding", () => {
	test("forwards metadata-only session changes after response data is seeded", async ({
		page,
	}) => {
		await page.addInitScript(() => {
			const runtimeWindow = window as unknown as {
				__metadataSessionEvents?: Array<Record<string, unknown>>;
				__metadataSessionDispatchPatched?: boolean;
			};
			if (runtimeWindow.__metadataSessionDispatchPatched) return;
			runtimeWindow.__metadataSessionDispatchPatched = true;
			runtimeWindow.__metadataSessionEvents = [];
			const originalDispatch = EventTarget.prototype.dispatchEvent;
			EventTarget.prototype.dispatchEvent = function patchedDispatch(
				event: Event,
			) {
				const tagName =
					this && typeof (this as Element).tagName === "string"
						? (this as Element).tagName.toLowerCase()
						: "";
				if (
					event.type === "session-changed" &&
					tagName === "pie-assessment-toolkit"
				) {
					const detail = (event as CustomEvent<Record<string, unknown>>).detail;
					runtimeWindow.__metadataSessionEvents?.push({
						tagName,
						detail: JSON.parse(JSON.stringify(detail ?? null)),
					});
				}
				return originalDispatch.call(this, event);
			};
		});

		await page.goto(DEMO_PATH, { waitUntil: "networkidle" });
		await expect(page.locator(".preload-status.error")).toHaveCount(0);

		const seedResponse = page.getByRole("button", { name: "Seed response" });
		const emitMetadata = page.getByRole("button", {
			name: "Emit metadata echo",
		});
		await expect(seedResponse).toBeVisible({ timeout: 30_000 });
		await expect(emitMetadata).toBeVisible();

		await page.evaluate(() => {
			(window as any).__metadataSessionEvents = [];
		});

		await seedResponse.click();
		await page.waitForFunction(() => {
			const events = ((window as any).__metadataSessionEvents ||
				[]) as ToolkitSessionEvent[];
			return events.some((entry) => {
				const data = entry.detail?.session?.data;
				return Boolean(
					entry.detail?.intent !== "metadata-only" &&
						Array.isArray(data) &&
						data.some((sessionEntry) => {
							const value = sessionEntry?.value;
							return Array.isArray(value) && value.includes("A");
						}),
				);
			});
		});
		await page.waitForFunction(() => {
			const player = document.querySelector("pie-item-player") as {
				session?: { data?: Array<{ value?: unknown }> };
			} | null;
			const data = player?.session?.data;
			return Boolean(
				Array.isArray(data) &&
					data.some((sessionEntry) => {
						const value = sessionEntry?.value;
						return Array.isArray(value) && value.includes("A");
					}),
			);
		});

		const beforeMetadata = await page.evaluate(() => {
			return (
				((window as any).__metadataSessionEvents || []) as ToolkitSessionEvent[]
			).length;
		});
		const responseCountBefore = await page.evaluate(() => {
			const events = ((window as any).__metadataSessionEvents ||
				[]) as ToolkitSessionEvent[];
			return events.filter((entry) => {
				const data = entry.detail?.session?.data;
				return Boolean(
					entry.detail?.intent !== "metadata-only" &&
						Array.isArray(data) &&
						data.some((sessionEntry) => {
							const value = sessionEntry?.value;
							return Array.isArray(value) && value.includes("A");
						}),
				);
			}).length;
		});
		expect(responseCountBefore).toBe(1);

		await emitMetadata.click();
		await page.waitForFunction((startIndex) => {
			const events = ((window as any).__metadataSessionEvents ||
				[]) as ToolkitSessionEvent[];
			return events.slice(startIndex as number).some((entry) => {
				return (
					entry.detail?.intent === "metadata-only" &&
					entry.detail?.session === null
				);
			});
		}, beforeMetadata);

		const responseCountAfter = await page.evaluate(() => {
			const events = ((window as any).__metadataSessionEvents ||
				[]) as ToolkitSessionEvent[];
			return events.filter((entry) => {
				const data = entry.detail?.session?.data;
				return Boolean(
					entry.detail?.intent !== "metadata-only" &&
						Array.isArray(data) &&
						data.some((sessionEntry) => {
							const value = sessionEntry?.value;
							return Array.isArray(value) && value.includes("A");
						}),
				);
			}).length;
		});
		expect(responseCountAfter).toBe(responseCountBefore);

		const toolkitEvents = await page.evaluate(() => {
			return ((window as any).__metadataSessionEvents ||
				[]) as ToolkitSessionEvent[];
		});
		expect(toolkitEvents.some(hasSeededResponse)).toBe(true);
	});
});
