import { expect, type Page, test } from "@playwright/test";
import {
	MC_PROMPT,
	openPreloadedBase,
	PRELOADED_SECTION,
} from "./fixtures/preloaded-section";

// Each test replaces the preloaded demo's player with a fresh layout element it
// configures itself, so the fresh player owns its coordinator and no assessment
// is bound to it.
const LAYOUT_TAGS = [
	"pie-section-player-splitpane",
	"pie-section-player-vertical",
	"pie-section-player-tabbed",
	"pie-section-player-kernel-host",
] as const;
const HOST_METHODS = [
	["getSnapshot", []],
	["selectComposition", []],
	["selectNavigation", []],
	["selectReadiness", []],
	["navigateTo", [0]],
	["navigateNext", []],
	["navigatePrevious", []],
	["getSectionController", []],
] as const;
const UNBOUND_WARNING = "with no assessment bound";
const LATE_INPUTS_WARNING = "changed after a section initialized";

type MethodResults = Record<string, unknown>;
type HostApiLog = {
	sectionIdentifier: string;
	stageSectionIds: string[];
	loadingCompleteSectionIds: string[];
	telemetrySectionIds: string[];
	coordinatorAssessmentId: string | null;
	beforeAppend: MethodResults | null;
	afterAppend: MethodResults | null;
	controller: "resolved" | "null" | string | null;
};

type HostApiElement = HTMLElement & {
	runtime?: Record<string, unknown>;
	section?: unknown;
	getSnapshot?: () => { composition?: { itemsCount?: number } } | null;
	waitForSectionController?: (timeoutMs?: number) => Promise<unknown>;
};

declare global {
	interface Window {
		__pieHostApi?: HostApiLog;
		__pieHostApiRuntime?: Record<string, unknown>;
	}
}

type MountOptions = {
	tag: string;
	/** Sets `runtime` and `section` a tick after the element is appended. */
	late?: boolean;
	/** Calls every host method before and right after the append. */
	probeMethods?: boolean;
	runtime?: Record<string, unknown>;
};

async function mountFreshLayout(page: Page, options: MountOptions) {
	await page.evaluate(
		({ tag, late, probeMethods, extraRuntime, methods, section }) => {
			const existing = document.querySelector("pie-section-player-splitpane");
			if (!existing?.parentElement) {
				throw new Error("demo section player not found");
			}
			const parent = existing.parentElement;
			existing.remove();

			const log: HostApiLog = {
				sectionIdentifier: section.identifier,
				stageSectionIds: [],
				loadingCompleteSectionIds: [],
				telemetrySectionIds: [],
				coordinatorAssessmentId: null,
				beforeAppend: null,
				afterAppend: null,
				controller: null,
			};
			window.__pieHostApi = log;

			const fresh = document.createElement(tag) as HostApiElement;
			fresh.setAttribute("section-id", "host-api-section");
			fresh.setAttribute("attempt-id", `host-api-${Date.now()}`);
			fresh.setAttribute("show-toolbar", "true");
			fresh.addEventListener("pie-stage-change", (event) => {
				log.stageSectionIds.push(
					(event as CustomEvent<{ sectionId?: string }>).detail?.sectionId ??
						"",
				);
			});
			fresh.addEventListener("pie-loading-complete", (event) => {
				log.loadingCompleteSectionIds.push(
					(event as CustomEvent<{ sectionId?: string }>).detail?.sectionId ??
						"",
				);
			});
			fresh.addEventListener("toolkit-ready", (event) => {
				const coordinator = (
					event as CustomEvent<{ coordinator?: { assessmentId?: string } }>
				).detail?.coordinator;
				log.coordinatorAssessmentId = coordinator?.assessmentId ?? null;
			});

			const instrumentationProvider = {
				providerId: "host-api-probe",
				providerName: "Host API probe",
				initialize: async () => {},
				trackError: () => {},
				trackEvent: (name: string, attributes: Record<string, unknown>) => {
					if (name === "pie-section-loading-complete") {
						log.telemetrySectionIds.push(String(attributes.sectionId ?? ""));
					}
				},
				destroy: () => {},
				isReady: () => true,
			};
			const runtime = {
				playerType: "preloaded",
				env: { mode: "gather", role: "student" },
				player: { loaderConfig: { instrumentationProvider } },
				...extraRuntime,
			};
			window.__pieHostApiRuntime = runtime;

			const callAll = (): MethodResults => {
				const results: MethodResults = {};
				for (const [name, args] of methods) {
					try {
						const method = (fresh as unknown as Record<string, unknown>)[name];
						results[name] = (method as (...a: unknown[]) => unknown).apply(
							fresh,
							args as unknown[],
						);
					} catch (error) {
						results[name] = `threw: ${(error as Error).message}`;
					}
				}
				return results;
			};

			if (!late) {
				fresh.runtime = runtime;
				fresh.section = section;
			}
			if (probeMethods) log.beforeAppend = callAll();
			parent.appendChild(fresh);
			if (probeMethods) {
				log.afterAppend = callAll();
				try {
					void fresh.waitForSectionController?.(20_000).then(
						(controller) => {
							log.controller = controller ? "resolved" : "null";
						},
						(error: Error) => {
							log.controller = `rejected: ${error.message}`;
						},
					);
					if (typeof fresh.waitForSectionController !== "function") {
						log.controller = "missing";
					}
				} catch (error) {
					log.controller = `threw: ${(error as Error).message}`;
				}
			}
			if (late) {
				setTimeout(() => {
					fresh.runtime = runtime;
					fresh.section = section;
				}, 0);
			}
		},
		{
			tag: options.tag,
			late: options.late === true,
			probeMethods: options.probeMethods === true,
			extraRuntime: options.runtime ?? {},
			methods: HOST_METHODS,
			section: PRELOADED_SECTION,
		},
	);
}

function hostApiLog(page: Page): Promise<HostApiLog> {
	return page.evaluate(() => {
		const log = window.__pieHostApi;
		if (!log) throw new Error("host API log not installed");
		return log;
	});
}

async function waitForLoadingComplete(page: Page): Promise<HostApiLog> {
	await expect
		.poll(async () => (await hostApiLog(page)).loadingCompleteSectionIds.length, {
			timeout: 30_000,
			message: "the fresh layout never emitted pie-loading-complete",
		})
		.toBeGreaterThan(0);
	return hostApiLog(page);
}

function collectWarnings(page: Page): string[] {
	const warnings: string[] = [];
	page.on("console", (message) => {
		if (message.type() === "warning") warnings.push(message.text());
	});
	return warnings;
}

function collectPageErrors(page: Page): string[] {
	const errors: string[] = [];
	page.on("pageerror", (error) => errors.push(error.message));
	return errors;
}

test.describe("section player host API", () => {
	for (const tag of LAYOUT_TAGS) {
		test(`${tag} answers its host methods before it mounts`, async ({
			page,
		}) => {
			await openPreloadedBase(page);
			await mountFreshLayout(page, { tag, probeMethods: true });

			const kernelHost = tag === "pie-section-player-kernel-host";
			const bootstrapSnapshot = {
				readiness: {
					phase: "bootstrapping",
					interactionReady: false,
					allLoadingComplete: false,
				},
				composition: { itemsCount: 0, passagesCount: 0 },
				navigation: {
					currentIndex: 0,
					totalItems: 0,
					canNext: false,
					canPrevious: false,
				},
			};
			const unmounted = {
				getSnapshot: kernelHost ? bootstrapSnapshot : null,
				selectComposition: kernelHost ? bootstrapSnapshot.composition : null,
				selectNavigation: kernelHost ? bootstrapSnapshot.navigation : null,
				selectReadiness: kernelHost ? bootstrapSnapshot.readiness : null,
				navigateTo: false,
				navigateNext: false,
				navigatePrevious: false,
				getSectionController: null,
			};
			const log = await hostApiLog(page);
			expect(log.beforeAppend).toEqual(unmounted);
			expect(log.afterAppend).toEqual(unmounted);

			await expect
				.poll(async () => (await hostApiLog(page)).controller, {
					timeout: 30_000,
				})
				.toBe("resolved");
			await waitForLoadingComplete(page);
			const itemsCount = await page.evaluate(
				(layoutTag) =>
					(document.querySelector(layoutTag) as HostApiElement | null)
						?.getSnapshot?.()?.composition?.itemsCount ?? 0,
				tag,
			);
			expect(itemsCount).toBeGreaterThan(0);
		});
	}

	test("an owned coordinator reports no unbound assessment while enforcement is unset", async ({
		page,
	}) => {
		await openPreloadedBase(page);
		const warnings = collectWarnings(page);
		await mountFreshLayout(page, { tag: "pie-section-player-splitpane" });
		await waitForLoadingComplete(page);
		await expect(
			page.locator("pie-section-player-splitpane").getByText(MC_PROMPT),
		).toBeVisible({ timeout: 30_000 });
		// Room for the section-scoped surfaces to ask policy about their features.
		await page.waitForTimeout(1_000);
		expect(warnings.filter((text) => text.includes(UNBOUND_WARNING))).toEqual(
			[],
		);
	});

	test("an owned coordinator reports an unbound assessment once when enforcement is on", async ({
		page,
	}) => {
		await openPreloadedBase(page);
		const warnings = collectWarnings(page);
		await mountFreshLayout(page, {
			tag: "pie-section-player-splitpane",
			runtime: { tools: { pnpEnforcement: "on" } },
		});
		await waitForLoadingComplete(page);
		await expect
			.poll(() => warnings.filter((text) => text.includes(UNBOUND_WARNING)))
			.toHaveLength(1);
	});

	for (const late of [false, true]) {
		test(`a runtime set ${late ? "a tick after mount" : "before mount"} configures the owned coordinator`, async ({
			page,
		}) => {
			await openPreloadedBase(page);
			const warnings = collectWarnings(page);
			const pageErrors = collectPageErrors(page);
			await mountFreshLayout(page, {
				tag: "pie-section-player-splitpane",
				late,
				runtime: {
					assessmentId: "host-api-assessment",
					tools: {
						placement: { section: ["ruler"], item: ["answerEliminator"] },
					},
				},
			});
			await waitForLoadingComplete(page);

			const player = page.locator("pie-section-player-splitpane");
			await expect(player.getByRole("button", { name: "Ruler" })).toBeVisible({
				timeout: 30_000,
			});
			await expect(
				player.getByRole("button", { name: /strike through/i }).first(),
			).toBeVisible({ timeout: 30_000 });
			expect((await hostApiLog(page)).coordinatorAssessmentId).toBe(
				"host-api-assessment",
			);
			expect(
				warnings.filter((text) => text.includes(LATE_INPUTS_WARNING)),
			).toEqual([]);
			expect(pageErrors).toEqual([]);
		});
	}

	test("a tools change after the section initialized is reported once", async ({
		page,
	}) => {
		await openPreloadedBase(page);
		const warnings = collectWarnings(page);
		await mountFreshLayout(page, {
			tag: "pie-section-player-splitpane",
			runtime: { tools: { placement: { section: ["ruler"] } } },
		});
		await waitForLoadingComplete(page);
		const player = page.locator("pie-section-player-splitpane");
		await expect(player.getByRole("button", { name: "Ruler" })).toBeVisible({
			timeout: 30_000,
		});

		const reassign = (tools?: Record<string, unknown>) =>
			page.evaluate((nextTools) => {
				const element = document.querySelector(
					"pie-section-player-splitpane",
				) as HostApiElement;
				const runtime = window.__pieHostApiRuntime ?? {};
				element.runtime = nextTools ? { ...runtime, tools: nextTools } : { ...runtime };
			}, tools);

		// A new runtime object with the same content changes nothing.
		await reassign();
		await page.waitForTimeout(250);
		expect(warnings.filter((text) => text.includes(LATE_INPUTS_WARNING))).toEqual(
			[],
		);

		await reassign({ placement: { section: ["protractor"] } });
		await reassign({ placement: { section: ["lineReader"] } });
		await expect
			.poll(() => warnings.filter((text) => text.includes(LATE_INPUTS_WARNING)))
			.toHaveLength(1);
		const [reported] = warnings.filter((text) =>
			text.includes(LATE_INPUTS_WARNING),
		);
		expect(reported).toContain("tools");
		await page.waitForTimeout(250);
		expect(
			warnings.filter((text) => text.includes(LATE_INPUTS_WARNING)),
		).toHaveLength(1);
	});
});
