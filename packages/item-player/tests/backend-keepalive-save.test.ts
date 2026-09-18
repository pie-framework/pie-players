import { afterEach, describe, expect, test } from "bun:test";
import { saveToDeliveryBackend } from "../src/backend/delivery";
import { callPieApiDeliverySave } from "../src/backend/pie-api-client";
import type { BackendConfig } from "../src/types";

function backendWithSaveSpy(seen: unknown[]): BackendConfig {
	return {
		delivery: {
			enabled: true,
			itemId: "item-1",
			sessionId: "session-1",
			options: { overrides: { "student-grade": "5" } },
			client: {
				async saveSession(context) {
					seen.push(context.requestOptions);
					return null;
				},
			},
		},
	} as unknown as BackendConfig;
}

const context = {
	itemId: "item-1",
	sessionId: "session-1",
	session: { id: "session-1", data: [] },
	env: { mode: "gather", role: "student" },
};

describe("keepalive on the unload save path", () => {
	test("an ordinary save carries no keepalive flag", async () => {
		const seen: unknown[] = [];
		await saveToDeliveryBackend(backendWithSaveSpy(seen), context);

		expect(seen).toEqual([{ overrides: { "student-grade": "5" } }]);
	});

	test("a save issued while the page is going away asks for keepalive", async () => {
		const seen: unknown[] = [];
		await saveToDeliveryBackend(backendWithSaveSpy(seen), context, {
			keepalive: true,
		});

		expect(seen).toEqual([
			{ overrides: { "student-grade": "5" }, keepalive: true },
		]);
	});

	test("keepalive does not mutate the host's delivery options", async () => {
		const seen: unknown[] = [];
		const backend = backendWithSaveSpy(seen);
		await saveToDeliveryBackend(backend, context, { keepalive: true });

		expect(
			(backend as { delivery?: { options?: unknown } }).delivery?.options,
		).toEqual({ overrides: { "student-grade": "5" } });
	});
});

describe("the keepalive body-size limit", () => {
	const originalFetch = globalThis.fetch;

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	function captureFetch(seen: Array<Record<string, unknown>>) {
		globalThis.fetch = (async (_url: string, init?: RequestInit) => {
			seen.push({
				keepalive: init?.keepalive,
				bytes: typeof init?.body === "string" ? init.body.length : 0,
			});
			return {
				ok: true,
				status: 200,
				json: async () => ({}),
			} as unknown as Response;
		}) as typeof fetch;
	}

	const config = {
		enabled: true,
		itemId: "item-1",
		sessionId: "session-1",
		endpoint: "https://example.test/api",
	} as never;

	function saveContext(session: unknown) {
		return {
			itemId: "item-1",
			sessionId: "session-1",
			session,
			env: { mode: "gather", role: "student" },
		} as never;
	}

	test("a small body goes out with keepalive", async () => {
		const seen: Array<Record<string, unknown>> = [];
		captureFetch(seen);

		await callPieApiDeliverySave(config, undefined, saveContext({
			id: "session-1",
			data: [{ id: "el-1", value: "short" }],
		}), { keepalive: true });

		expect(seen[0]?.keepalive).toBe(true);
	});

	test("a body over the 64 KiB cap goes out without it", async () => {
		// `fetch` rejects a keepalive request past the cap, and on the unload path
		// that loses the save outright. An ordinary request may be cut short by
		// the document going away, which is a worse chance than a small body has
		// and a better one than none.
		const seen: Array<Record<string, unknown>> = [];
		captureFetch(seen);

		await callPieApiDeliverySave(config, undefined, saveContext({
			id: "session-1",
			data: [{ id: "el-1", value: "x".repeat(70 * 1024) }],
		}), { keepalive: true });

		expect(seen[0]?.keepalive).toBe(false);
		expect(seen[0]?.bytes as number).toBeGreaterThan(64 * 1024);
	});
});
