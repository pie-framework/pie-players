import { describe, expect, test } from "bun:test";
import { settleAll } from "../src/promise/index.js";

describe("settleAll", () => {
	test("reports each outcome in input order, plain values included", async () => {
		const failure = new Error("boom");
		const results = await settleAll<number>([
			Promise.resolve(1),
			Promise.reject(failure),
			3,
		]);
		expect(results).toEqual([
			{ status: "fulfilled", value: 1 },
			{ status: "rejected", reason: failure },
			{ status: "fulfilled", value: 3 },
		]);
	});

	test("matches Promise.allSettled", async () => {
		const inputs = () => [Promise.resolve("a"), Promise.reject("b"), "c"];
		expect(await settleAll(inputs())).toEqual(
			await Promise.allSettled(inputs()),
		);
	});

	test("waits for every promise, not just the first rejection", async () => {
		let lateSettled = false;
		const late = new Promise<void>((resolve) =>
			setTimeout(() => {
				lateSettled = true;
				resolve();
			}, 5),
		);
		await settleAll([Promise.reject(new Error("early")), late]);
		expect(lateSettled).toBe(true);
	});

	test("works when the global Promise has no allSettled", async () => {
		const allSettled = Promise.allSettled;
		delete (Promise as { allSettled?: unknown }).allSettled;
		try {
			expect(await settleAll([Promise.resolve(1)])).toEqual([
				{ status: "fulfilled", value: 1 },
			]);
		} finally {
			Promise.allSettled = allSettled;
		}
	});

	test("resolves an empty input with an empty array", async () => {
		expect(await settleAll([])).toEqual([]);
	});
});
