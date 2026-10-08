import { expect, test, type Page } from "@playwright/test";

/**
 * Toolkits a host nests, and item scopes a host mounts without a toolkit, built
 * on the calculator-pnp page, which defines the elements. A nested toolkit
 * decides at connect whether it inherits the runtime above it. One that built
 * its coordinator, or was given one, never swaps it after that.
 */

type RuntimeReady = { who: string; ownership: string; runtimeId: string };

async function gotoPage(page: Page): Promise<void> {
	await page.goto("/calculator-pnp", { waitUntil: "networkidle" });
	await page.evaluate(() => {
		const win = window as unknown as {
			__nest: { ready: RuntimeReady[]; coordinators: Record<string, unknown> };
		};
		win.__nest = { ready: [], coordinators: {} };
		document.addEventListener("runtime-ready", (event) => {
			const target = event.composedPath()[0] as HTMLElement;
			const who = target.dataset?.nest;
			if (!who) return;
			const detail = (
				event as CustomEvent<{
					ownership: string;
					runtimeId: string;
					coordinator: unknown;
				}>
			).detail;
			win.__nest.ready.push({
				who,
				ownership: detail.ownership,
				runtimeId: detail.runtimeId,
			});
			win.__nest.coordinators[who] = detail.coordinator;
		});
	});
}

const readyLog = (page: Page) =>
	page.evaluate(
		() =>
			(window as unknown as { __nest: { ready: RuntimeReady[] } }).__nest.ready,
	);

const sameCoordinator = (page: Page) =>
	page.evaluate(() => {
		const { coordinators } = (
			window as unknown as { __nest: { coordinators: Record<string, unknown> } }
		).__nest;
		return Boolean(coordinators.outer) && coordinators.outer === coordinators.inner;
	});

function createToolkit(page: Page, who: string, parent: string | null) {
	return page.evaluate(
		([name, parentName]) => {
			const toolkit = document.createElement("pie-assessment-toolkit");
			toolkit.dataset.nest = name;
			toolkit.setAttribute("assessment-id", `nested-${name}`);
			const parentElement = parentName
				? document.querySelector(`[data-nest="${parentName}"]`)
				: document.body;
			parentElement?.append(toolkit);
		},
		[who, parent] as const,
	);
}

test.describe("nested toolkits", () => {
	test("an inner toolkit mounted with its outer one inherits the outer coordinator", async ({
		page,
	}) => {
		await gotoPage(page);
		await page.evaluate(() => {
			const outer = document.createElement("pie-assessment-toolkit");
			outer.dataset.nest = "outer";
			outer.setAttribute("assessment-id", "nested-outer");
			const inner = document.createElement("pie-assessment-toolkit");
			inner.dataset.nest = "inner";
			inner.setAttribute("assessment-id", "nested-inner");
			outer.append(inner);
			document.body.append(outer);
		});

		await expect
			.poll(async () => (await readyLog(page)).map(({ who }) => who).sort())
			.toEqual(["inner", "outer"]);
		const log = await readyLog(page);
		expect(log.find(({ who }) => who === "outer")?.ownership).toBe("owned");
		expect(log.find(({ who }) => who === "inner")?.ownership).toBe("inherited");
		expect(await sameCoordinator(page)).toBe(true);
	});

	test("an inner toolkit mounted after its outer one is ready inherits the outer coordinator", async ({
		page,
	}) => {
		await gotoPage(page);
		await createToolkit(page, "outer", null);
		await expect
			.poll(async () => (await readyLog(page)).map(({ who }) => who))
			.toEqual(["outer"]);

		await createToolkit(page, "inner", "outer");

		await expect
			.poll(async () => (await readyLog(page)).map(({ who }) => who))
			.toEqual(["outer", "inner"]);
		expect((await readyLog(page))[1]?.ownership).toBe("inherited");
		expect(await sameCoordinator(page)).toBe(true);
	});

	test("an inner toolkit that built its own coordinator keeps it, and reports an outer one arriving later", async ({
		page,
	}) => {
		const warnings: string[] = [];
		page.on("console", (message) => {
			if (message.type() === "warning" && message.text().includes("had no coordinator")) {
				warnings.push(message.text());
			}
		});
		await gotoPage(page);
		// The outer toolkit's bootstrap rejects a placement naming an unregistered
		// tool, so it has no coordinator when the inner one connects.
		await page.evaluate(() => {
			const registry = (
				document.querySelector("pie-assessment-toolkit") as unknown as {
					toolRegistry: unknown;
				}
			).toolRegistry;
			const outer = document.createElement("pie-assessment-toolkit") as HTMLElement & {
				toolRegistry: unknown;
				tools: unknown;
			};
			outer.dataset.nest = "outer";
			outer.setAttribute("assessment-id", "nested-outer");
			outer.toolRegistry = registry;
			outer.tools = { placement: { item: ["no-such-tool"] } };
			const inner = document.createElement("pie-assessment-toolkit");
			inner.dataset.nest = "inner";
			inner.setAttribute("assessment-id", "nested-inner");
			outer.append(inner);
			document.body.append(outer);
		});
		await expect
			.poll(async () => (await readyLog(page)).map(({ who }) => who))
			.toEqual(["inner"]);
		expect((await readyLog(page))[0]?.ownership).toBe("owned");

		await page.evaluate(() => {
			(
				document.querySelector('[data-nest="outer"]') as unknown as { tools: unknown }
			).tools = { placement: { item: [] } };
		});

		await expect
			.poll(async () => (await readyLog(page)).map(({ who }) => who))
			.toEqual(["inner", "outer"]);
		await expect.poll(() => warnings.length).toBe(1);
		const outerRuntimeId = (await readyLog(page))[1]?.runtimeId;
		expect(warnings[0]).toContain(`runtime "${outerRuntimeId}"`);
		expect(await sameCoordinator(page)).toBe(false);
	});

	test("an inner toolkit written with isolation=\"force\" keeps its own coordinator", async ({
		page,
	}) => {
		await gotoPage(page);
		await page.evaluate(() => {
			const wrapper = document.createElement("div");
			wrapper.innerHTML =
				'<pie-assessment-toolkit data-nest="outer" assessment-id="nested-outer">' +
				'<pie-assessment-toolkit data-nest="inner" assessment-id="nested-inner" isolation="force"></pie-assessment-toolkit>' +
				"</pie-assessment-toolkit>";
			document.body.append(wrapper);
		});

		await expect
			.poll(async () => (await readyLog(page)).map(({ who }) => who).sort())
			.toEqual(["inner", "outer"]);
		const log = await readyLog(page);
		expect(log.map(({ ownership }) => ownership)).toEqual(["owned", "owned"]);
		expect(await sameCoordinator(page)).toBe(false);
	});

	test("an inner toolkit given a coordinator keeps it under an outer one", async ({
		page,
	}) => {
		await gotoPage(page);
		await createToolkit(page, "donor", null);
		await createToolkit(page, "outer", null);
		await expect
			.poll(async () => (await readyLog(page)).map(({ who }) => who).sort())
			.toEqual(["donor", "outer"]);

		await page.evaluate(() => {
			const { coordinators } = (
				window as unknown as { __nest: { coordinators: Record<string, unknown> } }
			).__nest;
			const inner = document.createElement("pie-assessment-toolkit") as HTMLElement & {
				coordinator: unknown;
			};
			inner.dataset.nest = "inner";
			inner.setAttribute("assessment-id", "nested-inner");
			inner.coordinator = coordinators.donor;
			document.querySelector('[data-nest="outer"]')?.append(inner);
		});

		await expect
			.poll(async () => (await readyLog(page)).map(({ who }) => who).sort())
			.toEqual(["donor", "inner", "outer"]);
		await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 100)));
		const inner = (await readyLog(page)).filter(({ who }) => who === "inner");
		expect(inner.map(({ ownership }) => ownership)).toEqual(["owned"]);
		expect(
			await page.evaluate(() => {
				const { coordinators } = (
					window as unknown as { __nest: { coordinators: Record<string, unknown> } }
				).__nest;
				return coordinators.inner === coordinators.donor;
			}),
		).toBe(true);
	});
});

test.describe("item scope without a toolkit", () => {
	// The clock runs naturally until the test jumps it forward.
	async function gotoWithClock(page: Page): Promise<string[]> {
		const warnings: string[] = [];
		page.on("console", (message) => {
			if (message.type() === "warning" && message.text().includes("[pie-item-scope]")) {
				warnings.push(message.text());
			}
		});
		await page.clock.install();
		await page.goto("/calculator-pnp", { waitUntil: "networkidle" });
		return warnings;
	}

	test("warns once per page after 10 s with no toolkit", async ({ page }) => {
		const warnings = await gotoWithClock(page);
		await page.evaluate(() => {
			for (const id of ["orphan-one", "orphan-two"]) {
				const scope = document.createElement("pie-item-scope");
				scope.setAttribute("item-id", id);
				document.body.append(scope);
			}
		});

		await page.clock.fastForward(8_000);
		expect(warnings).toEqual([]);
		await page.clock.fastForward(3_000);
		await expect.poll(() => warnings.length).toBe(1);
		expect(warnings[0]).toContain('item "orphan-one"');
	});

	test("does not warn for a scope inside a toolkit", async ({ page }) => {
		const warnings = await gotoWithClock(page);

		await page.clock.fastForward(11_000);
		await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 0)));
		expect(warnings).toEqual([]);
	});
});
