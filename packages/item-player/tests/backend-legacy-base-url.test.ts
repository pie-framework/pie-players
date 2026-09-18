/**
 * `<pie-api-player>` put the `/api` segment in its `host` and left it out of its
 * paths; this client does the reverse. Both name the same routes, so a host
 * moving over must reach them whichever way it splits the URL.
 */
import { afterEach, describe, expect, test } from "bun:test";
import {
	callPieApiDeliveryLoad,
	callPieApiDeliverySave,
} from "../src/backend/pie-api-client";

const originalFetch = globalThis.fetch;

afterEach(() => {
	globalThis.fetch = originalFetch;
});

function captureUrls(seen: string[]) {
	globalThis.fetch = (async (url: string) => {
		seen.push(String(url));
		return {
			ok: true,
			status: 200,
			json: async () => ({}),
		} as unknown as Response;
	}) as typeof fetch;
}

const context = {
	itemId: "item-1",
	sessionId: "session-1",
	env: { mode: "gather", role: "student" },
} as never;

const saveContext = {
	itemId: "item-1",
	sessionId: "session-1",
	session: { id: "session-1", data: [] },
	env: { mode: "gather", role: "student" },
} as never;

describe("legacy base URLs", () => {
	test("a base that already carries /api does not double it", async () => {
		const seen: string[] = [];
		captureUrls(seen);
		await callPieApiDeliveryLoad(
			{ enabled: true, baseUrl: "https://api.pie-api.com/api" } as never,
			undefined,
			context,
		);
		await callPieApiDeliverySave(
			{ enabled: true, baseUrl: "https://api.pie-api.com/api/" } as never,
			undefined,
			saveContext,
		);

		expect(seen).toEqual([
			"https://api.pie-api.com/api/player/load",
			"https://api.pie-api.com/api/player/save",
		]);
	});

	test("an origin base resolves the documented paths unchanged", async () => {
		const seen: string[] = [];
		captureUrls(seen);
		await callPieApiDeliveryLoad(
			{ enabled: true, baseUrl: "https://api.pie-api.com" } as never,
			undefined,
			context,
		);

		expect(seen).toEqual(["https://api.pie-api.com/api/player/load"]);
	});

	test("the legacy split — base with /api, endpoint without — still works", async () => {
		const seen: string[] = [];
		captureUrls(seen);
		await callPieApiDeliveryLoad(
			{
				enabled: true,
				baseUrl: "https://api.pie-api.com/api",
				endpoints: { load: "/player/load" },
			} as never,
			undefined,
			context,
		);

		expect(seen).toEqual(["https://api.pie-api.com/api/player/load"]);
	});

	test("a base ending in another segment is left alone", async () => {
		const seen: string[] = [];
		captureUrls(seen);
		await callPieApiDeliveryLoad(
			{ enabled: true, baseUrl: "https://example.test/myapi" } as never,
			undefined,
			context,
		);

		expect(seen).toEqual(["https://example.test/myapi/api/player/load"]);
	});

	test("a backend that really serves /api/api keeps the doubled path", async () => {
		const seen: string[] = [];
		captureUrls(seen);
		await callPieApiDeliveryLoad(
			{
				enabled: true,
				baseUrl: "https://example.test",
				endpoints: { load: "/api/api/player/load" },
			} as never,
			undefined,
			context,
		);

		expect(seen).toEqual(["https://example.test/api/api/player/load"]);
	});
});
