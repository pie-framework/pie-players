/**
 * The page-wide player scheduler, driven through a fake `IntersectionObserver`: which rows mount,
 * when, and in which aggregated loads.
 */

import { describe, expect, test } from "bun:test";
import type { ItemConfig } from "@pie-players/pie-players-shared/types";
import {
	createPlayerScheduler,
	type PlayerLoadInputs,
	type PlayerSchedulerOptions,
	type PlayerTicket,
} from "../src/player/scheduler.js";

async function settle(): Promise<void> {
	for (let round = 0; round < 5; round += 1) await Promise.resolve();
}

function harness(overrides: Partial<PlayerSchedulerOptions> = {}) {
	let notify: IntersectionObserverCallback = () => {};
	const observed = new Set<object>();
	const loads: { ids: string[]; inputs: PlayerLoadInputs }[] = [];
	const granted: string[] = [];
	const timedOut: string[] = [];
	const scheduler = createPlayerScheduler({
		maxConcurrent: 2,
		loadTimeoutMs: 50,
		rootMargin: "0px",
		preload: async (configs, inputs) => {
			loads.push({ ids: configs.map((config) => (config as { id: string }).id), inputs });
		},
		createObserver: (callback) => {
			notify = callback;
			return {
				observe: (element) => observed.add(element),
				unobserve: (element) => observed.delete(element),
			};
		},
		...overrides,
	});
	const rows = new Map<string, object>();
	return {
		loads,
		granted,
		timedOut,
		observed,
		row(id: string, inputs: PlayerLoadInputs = {}): PlayerTicket {
			const element = { id };
			rows.set(id, element);
			return scheduler.request({
				element: element as unknown as Element,
				config: { id } as unknown as ItemConfig,
				inputs,
				grant: () => granted.push(id),
				timeout: () => timedOut.push(id),
			});
		},
		async show(ids: string[], isIntersecting = true): Promise<void> {
			notify(
				ids.map(
					(id) => ({ target: rows.get(id), isIntersecting }) as unknown as IntersectionObserverEntry,
				),
				{} as IntersectionObserver,
			);
			await settle();
		},
	};
}

describe("player scheduler", () => {
	test("mounts nothing until a row nears the viewport", async () => {
		const page = harness();
		page.row("a");
		await settle();
		expect(page.granted).toEqual([]);
		expect(page.loads).toEqual([]);
	});

	test("loads the rows that become visible together in one load per set of inputs", async () => {
		const page = harness({ maxConcurrent: 10 });
		const esm: PlayerLoadInputs = { strategy: "esm", loaderOptions: { esmCdnUrl: "https://cdn.test" } };
		page.row("a", esm);
		page.row("b", esm);
		page.row("c");
		await page.show(["a", "b", "c"]);
		expect(page.loads).toEqual([
			{ ids: ["a", "b"], inputs: esm },
			{ ids: ["c"], inputs: {} },
		]);
		expect(page.granted).toEqual(["a", "b", "c"]);
	});

	test("caps the players loading at once and grants the next as one loads", async () => {
		const page = harness();
		const tickets = ["a", "b", "c"].map((id) => page.row(id));
		await page.show(["a", "b", "c"]);
		expect(page.granted).toEqual(["a", "b"]);
		tickets[0].release();
		expect(page.granted).toEqual(["a", "b", "c"]);
	});

	test("skips a queued row that scrolled away and grants it on return", async () => {
		const page = harness({ maxConcurrent: 1 });
		const first = page.row("a");
		page.row("b");
		page.row("c");
		await page.show(["a", "b", "c"]);
		await page.show(["b"], false);
		first.release();
		expect(page.granted).toEqual(["a", "c"]);
		await page.show(["b"]);
		expect(page.granted).toEqual(["a", "c"]);
		expect(page.loads).toHaveLength(1);
	});

	test("cancels a row released before its grant", async () => {
		const page = harness();
		const ticket = page.row("a");
		ticket.release();
		expect(page.observed.size).toBe(0);
		await page.show(["a"]);
		expect(page.granted).toEqual([]);
	});

	test("frees a granted row's slot when its player does not load in time", async () => {
		const page = harness({ maxConcurrent: 1 });
		page.row("a");
		page.row("b");
		await page.show(["a", "b"]);
		expect(page.granted).toEqual(["a"]);
		await new Promise((resolve) => setTimeout(resolve, 80));
		expect(page.timedOut).toEqual(["a"]);
		expect(page.granted).toEqual(["a", "b"]);
	});

	test("grants a row whose load failed, so its player reports the failure", async () => {
		const page = harness({ preload: async () => Promise.reject(new Error("offline")) });
		page.row("a");
		await page.show(["a"]);
		expect(page.granted).toEqual(["a"]);
	});

	test("counts every row as visible without an IntersectionObserver", async () => {
		const original = globalThis.IntersectionObserver;
		// @ts-expect-error: removed for this test
		delete globalThis.IntersectionObserver;
		try {
			const granted: string[] = [];
			const scheduler = createPlayerScheduler({
				maxConcurrent: 1,
				loadTimeoutMs: 1000,
				rootMargin: "0px",
				preload: async () => {},
			});
			const ticket = scheduler.request({
				element: {} as Element,
				config: {} as ItemConfig,
				inputs: {},
				grant: () => granted.push("a"),
				timeout: () => {},
			});
			await settle();
			expect(granted).toEqual(["a"]);
			ticket.release();
		} finally {
			if (original) globalThis.IntersectionObserver = original;
		}
	});
});
